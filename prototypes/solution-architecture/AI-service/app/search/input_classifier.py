import re
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import List

logger = logging.getLogger(__name__)


class InputType(str, Enum):
    EXACT_ERROR_CODE = "EXACT_ERROR_CODE"
    NATURAL_LANGUAGE = "NATURAL_LANGUAGE"
    MIXED = "MIXED"
    GARBAGE = "GARBAGE"


@dataclass
class InputClassification:
    input_type: InputType
    extracted_codes: List[str] = field(default_factory=list)
    token_count: int = 0
    has_typos_likely: bool = False
    confidence: float = 1.0


class InputClassifier:
    """
    Classifies raw query input into InputType using patterns derived
    dynamically from the loaded KB error codes at startup.
    """

    def __init__(self):
        self._code_patterns: List[re.Pattern] = []
        self._known_codes: List[str] = []

    def build_patterns_from_kb(self, error_codes: List[str]) -> None:
        """
        Called at startup after errors are loaded. Derives regex patterns
        from the actual error code formats present in the KB.
        """
        self._known_codes = [c.upper() for c in error_codes if c]

        formats: set[str] = set()
        for code in self._known_codes:
            # Match prefix-digits patterns like K-100, ERR-001, ABC-123
            m = re.match(r'^([A-Z]+)-(\d+)$', code)
            if m:
                prefix = re.escape(m.group(1))
                formats.add(rf'\b{prefix}\s*-?\s*\d+\b')
            # Plain numeric codes like 881, 100
            elif re.match(r'^\d{3,4}$', code):
                formats.add(r'\b\d{3,4}\b')

        self._code_patterns = [re.compile(p, re.IGNORECASE) for p in formats]
        logger.info(f"Built {len(self._code_patterns)} code patterns from {len(self._known_codes)} KB codes")

    def classify(self, raw_query: str) -> InputClassification:
        if not raw_query or not raw_query.strip():
            return InputClassification(input_type=InputType.GARBAGE, confidence=1.0)

        stripped = raw_query.strip()

        # Extract alphanumeric content
        alnum_only = re.sub(r'[^a-zA-Z0-9\s\-\.]', '', stripped).strip()

        if not alnum_only:
            return InputClassification(input_type=InputType.GARBAGE, confidence=1.0)

        tokens = alnum_only.split()
        token_count = len(tokens)

        # Single char → garbage
        if token_count == 1 and len(tokens[0]) == 1:
            return InputClassification(input_type=InputType.GARBAGE, token_count=1, confidence=1.0)

        # Check for garbage tokens (high char-repeat ratio)
        garbage_tokens = sum(1 for t in tokens if self._is_garbage_token(t))
        if garbage_tokens == token_count:
            return InputClassification(input_type=InputType.GARBAGE, token_count=token_count, confidence=1.0)

        # Extract any embedded error codes
        extracted_codes = self._extract_codes(stripped)

        # Check for likely typos
        has_typos_likely = any(
            len(t) < 3 or self._has_repeated_chars(t)
            for t in tokens
        )

        # Classify based on code presence + natural language tokens
        nl_tokens = [t for t in tokens if len(t) >= 3 and not self._looks_like_code(t)]
        has_codes = len(extracted_codes) > 0
        has_nl = len(nl_tokens) >= 1

        if has_codes and has_nl:
            return InputClassification(
                input_type=InputType.MIXED,
                extracted_codes=extracted_codes,
                token_count=token_count,
                has_typos_likely=has_typos_likely,
                confidence=0.9,
            )
        elif has_codes and not has_nl:
            return InputClassification(
                input_type=InputType.EXACT_ERROR_CODE,
                extracted_codes=extracted_codes,
                token_count=token_count,
                has_typos_likely=has_typos_likely,
                confidence=0.95,
            )
        else:
            return InputClassification(
                input_type=InputType.NATURAL_LANGUAGE,
                extracted_codes=[],
                token_count=token_count,
                has_typos_likely=has_typos_likely,
                confidence=0.85,
            )

    def _extract_codes(self, text: str) -> List[str]:
        found = []
        for pattern in self._code_patterns:
            matches = pattern.findall(text)
            found.extend(m.strip() for m in matches)
        # Deduplicate preserving order
        seen: set[str] = set()
        result = []
        for c in found:
            key = c.upper().replace(' ', '').replace('-', '')
            if key not in seen:
                seen.add(key)
                result.append(c)
        return result

    @staticmethod
    def _is_garbage_token(token: str) -> bool:
        if len(token) <= 1:
            return True
        alnum = re.sub(r'[^a-zA-Z0-9]', '', token)
        if not alnum:
            return True
        return InputClassifier._has_repeated_chars(token)

    @staticmethod
    def _has_repeated_chars(token: str) -> bool:
        if len(token) < 3:
            return False
        char_counts: dict[str, int] = {}
        for c in token.lower():
            char_counts[c] = char_counts.get(c, 0) + 1
        max_freq = max(char_counts.values())
        return (max_freq / len(token)) > 0.6

    @staticmethod
    def _looks_like_code(token: str) -> bool:
        return bool(re.match(r'^[A-Z]+-\d+$', token, re.IGNORECASE)) or \
               bool(re.match(r'^\d{3,4}$', token))
