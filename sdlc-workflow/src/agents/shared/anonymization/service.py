from __future__ import annotations

import re
import uuid
from typing import Any

from presidio_analyzer import AnalyzerEngine, RecognizerResult
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

from .registry import MappingRegistry


class AnonymizationService:
    """
    Ensures client data never reaches external LLM APIs in readable form.

    Pipeline:
    1. PII detection via Presidio (names, emails, phones, addresses, IDs)
    2. Sensitive term detection (business domain terms from client config)
    3. Tokenization — replaces real values with session-scoped opaque tokens
    4. De-anonymization — restores real values in LLM responses

    Token format: ANON_<TYPE>_<SHORT_UUID> — opaque, type-hinted for LLM reasoning
    """

    _TOKEN_PATTERN = re.compile(r"ANON_[A-Z_]+_[0-9A-F]{8}")

    def __init__(
        self,
        registry: MappingRegistry,
        sensitive_terms: list[str] | None = None,
        sensitivity_level: str = "Standard",
    ):
        self._registry = registry
        self._sensitive_terms = sensitive_terms or []
        self._sensitivity_level = sensitivity_level
        self._analyzer = AnalyzerEngine()
        self._anonymizer = AnonymizerEngine()
        self._entity_types = self._entities_for_level(sensitivity_level)

    def _entities_for_level(self, level: str) -> list[str]:
        base = ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "LOCATION",
                "IBAN_CODE", "CREDIT_CARD", "US_SSN", "US_BANK_NUMBER", "IP_ADDRESS"]
        if level in ("Enhanced", "Maximum"):
            base += ["ORG", "DATE_TIME", "NRP"]
        return base

    def _make_token(self, entity_type: str) -> str:
        short_id = uuid.uuid4().hex[:8].upper()
        clean_type = re.sub(r"[^A-Z_]", "_", entity_type.upper())
        return f"ANON_{clean_type}_{short_id}"

    async def anonymize(self, text: str) -> tuple[str, dict[str, str]]:
        """
        Anonymize text. Returns (anonymized_text, token_map).
        token_map maps each token to the real value it replaced.
        """
        if not text:
            return text, {}

        new_tokens: dict[str, str] = {}
        result = text

        # 1. Presidio PII detection
        analyzer_results: list[RecognizerResult] = self._analyzer.analyze(
            text=text, language="en", entities=self._entity_types
        )

        # Sort longest span first to avoid offset shifts
        analyzer_results.sort(key=lambda r: r.start, reverse=True)

        for rec in analyzer_results:
            real_value = text[rec.start:rec.end]
            existing_token = await self._registry.get_token(real_value)
            token = existing_token or self._make_token(rec.entity_type)

            if not existing_token:
                await self._registry.store(token, real_value)
                new_tokens[token] = real_value

            result = result[:rec.start] + token + result[rec.end:]

        # 2. Sensitive business terms
        for term in self._sensitive_terms:
            if term in result:
                existing_token = await self._registry.get_token(term)
                token = existing_token or self._make_token("BUSINESS_TERM")
                if not existing_token:
                    await self._registry.store(token, term)
                    new_tokens[token] = term
                result = result.replace(term, token)

        return result, new_tokens

    async def deanonymize(self, text: str) -> str:
        """Restore all tokens in an LLM response back to real values."""
        if not text:
            return text

        result = text
        for token in self._TOKEN_PATTERN.findall(result):
            real_value = await self._registry.get_real_value(token)
            if real_value:
                result = result.replace(token, real_value)

        return result

    async def anonymize_dict(self, data: dict[str, Any]) -> dict[str, Any]:
        """Recursively anonymize all string values in a dict."""
        result = {}
        for key, value in data.items():
            if isinstance(value, str):
                anon, _ = await self.anonymize(value)
                result[key] = anon
            elif isinstance(value, dict):
                result[key] = await self.anonymize_dict(value)
            elif isinstance(value, list):
                result[key] = [
                    (await self.anonymize(v))[0] if isinstance(v, str) else v
                    for v in value
                ]
            else:
                result[key] = value
        return result
