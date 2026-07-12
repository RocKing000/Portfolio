import re
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple

from rapidfuzz import process as rfprocess, fuzz

logger = logging.getLogger(__name__)


@dataclass
class CorrectionEntry:
    original: str
    corrected: str
    confidence: float


@dataclass
class TypoResult:
    corrected_query: str
    corrections: List[CorrectionEntry] = field(default_factory=list)


@dataclass
class ExpansionEntry:
    term: str
    expanded_to: List[str] = field(default_factory=list)


@dataclass
class ExpansionResult:
    expanded_query: str
    expansions: List[ExpansionEntry] = field(default_factory=list)


class QueryProcessor:
    """
    Handles all query transformations: cleaning, typo correction, expansion.
    All knowledge comes from the KB corpus built at startup — no hardcoded lists.
    """

    # Characters preserved during cleaning
    _KEEP_CHARS = re.compile(r'[^a-zA-Z0-9\s\-\.]')
    # Error code pattern: letter(s)-digits, e.g. K-100
    _CODE_PATTERN = re.compile(r'\b([A-Z]+)\s*-?\s*(\d+)\b', re.IGNORECASE)
    # Multiple spaces
    _MULTI_SPACE = re.compile(r'\s+')

    def __init__(self, typo_threshold: float = 0.75):
        self._threshold = typo_threshold
        self._kb_corpus: List[str] = []  # flat list: titles + codes + tags

    def set_kb_corpus(self, corpus: List[str]) -> None:
        self._kb_corpus = [t.lower().strip() for t in corpus if t and t.strip()]

    def clean(self, raw: str) -> str:
        if not raw:
            return ""
        # Preserve error codes before stripping — normalise spacing around hyphen
        text = self._CODE_PATTERN.sub(lambda m: f"{m.group(1).upper()}-{m.group(2)}", raw)
        text = self._KEEP_CHARS.sub(' ', text)
        text = self._MULTI_SPACE.sub(' ', text)
        return text.strip()

    def correct_typos(self, query: str) -> TypoResult:
        if not query.strip() or not self._kb_corpus:
            return TypoResult(corrected_query=query)

        tokens = query.split()
        corrected_tokens: List[str] = []
        corrections: List[CorrectionEntry] = []

        for token in tokens:
            token_lower = token.lower()
            # Skip very short tokens and tokens that look like error codes
            if len(token_lower) <= 2 or re.match(r'^[a-z]+-\d+$', token_lower):
                corrected_tokens.append(token)
                continue

            result = rfprocess.extractOne(
                token_lower,
                self._kb_corpus,
                scorer=fuzz.token_sort_ratio,
                score_cutoff=int(self._threshold * 100),
            )

            if result and result[0] != token_lower:
                corrected_term, score, _ = result
                # Only correct single-word matches to avoid replacing a short
                # token with a long multi-word phrase
                if ' ' not in corrected_term:
                    corrections.append(CorrectionEntry(
                        original=token,
                        corrected=corrected_term,
                        confidence=round(score / 100, 3),
                    ))
                    corrected_tokens.append(corrected_term)
                else:
                    corrected_tokens.append(token)
            else:
                corrected_tokens.append(token)

        return TypoResult(
            corrected_query=' '.join(corrected_tokens),
            corrections=corrections,
        )

    def expand(
        self,
        query: str,
        synonyms: Dict[str, List[str]],
        extracted_codes: Optional[List[str]] = None,
        error_lookup: Optional[Dict[str, dict]] = None,
    ) -> ExpansionResult:
        """
        Expand query with synonyms from the DB synonym_mappings table.
        If extracted_codes are provided and error_lookup is given,
        also appends the matching error's title and tags.
        """
        tokens = query.lower().split()
        added_terms: List[str] = []
        expansions: List[ExpansionEntry] = []

        for token in tokens:
            syns = synonyms.get(token, [])
            if syns:
                new_syns = [s for s in syns if s.lower() not in query.lower()]
                if new_syns:
                    expansions.append(ExpansionEntry(term=token, expanded_to=new_syns))
                    added_terms.extend(new_syns)

        # If a known error code was found, append its title and tags
        if extracted_codes and error_lookup:
            for code in extracted_codes:
                code_upper = code.upper()
                error = error_lookup.get(code_upper)
                if error:
                    extra: List[str] = []
                    title = error.get('error_title', '')
                    if title:
                        extra.append(title.lower())
                    tags = error.get('tags', '') or ''
                    if tags:
                        extra.extend(t.strip().lower() for t in tags.split(',') if t.strip())
                    if extra:
                        expansions.append(ExpansionEntry(term=code, expanded_to=extra))
                        added_terms.extend(extra)

        expanded_query = query
        if added_terms:
            expanded_query = query + ' ' + ' '.join(added_terms)

        return ExpansionResult(expanded_query=expanded_query.strip(), expansions=expansions)
