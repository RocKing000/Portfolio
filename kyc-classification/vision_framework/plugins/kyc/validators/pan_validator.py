"""
PANValidator — validate extracted PAN card data against Indian IT department rules.

Single Responsibility: validate PAN number format and associated name field.
Pure logic — zero image processing.
"""

import logging
import re
from typing import Dict, List

from vision_framework.core.interfaces.base_validator import BaseValidator

logger = logging.getLogger(__name__)

# PAN format: AAAAA0000A — 5 uppercase letters, 4 digits, 1 uppercase letter
_PAN_PATTERN = re.compile(r'^[A-Z]{5}[0-9]{4}[A-Z]$')
_NAME_PATTERN = re.compile(r'^[A-Za-z\s\.]{2,60}$')

# 4th character encodes taxpayer type
_TAXPAYER_CODES = {
    "P": "Individual",
    "C": "Company",
    "H": "HUF",
    "F": "Firm",
    "A": "AOP",
    "T": "AOP/BOI Trust",
    "B": "BOI",
    "L": "Local Authority",
    "J": "Artificial Juridical Person",
    "G": "Government",
}


class PANValidator(BaseValidator):
    """
    Validates PAN card fields per Indian Income Tax Department rules.

    Rules enforced:
      1. pan_number: exactly 10 characters.
      2. pan_number: first five must be letters.
      3. pan_number: characters 6–9 must be digits.
      4. pan_number: last character must be a letter.
      5. pan_number: 4th character must be a valid taxpayer type code.
      6. name: non-empty, alphabets and spaces only.
    """

    def get_validation_rules(self) -> Dict[str, str]:
        return {
            "pan_format": "Must match [A-Z]{5}[0-9]{4}[A-Z].",
            "pan_taxpayer_code": f"4th character must be one of: {', '.join(_TAXPAYER_CODES)}.",
            "name_alpha": "Name must contain only letters and spaces.",
        }

    def validate(self, data: dict) -> dict:
        """
        Validate PAN card extracted data.

        Parameters
        ----------
        data:
            Dict with keys: pan_number, name.

        Returns
        -------
        Standard validator result dict.
        """
        errors: List[str] = []
        warnings: List[str] = []
        validated: Dict = {}

        # --- PAN number ---
        raw_pan: str = str(data.get("pan_number") or "").strip().upper()
        if not raw_pan:
            errors.append("pan_number is missing.")
        elif not _PAN_PATTERN.match(raw_pan):
            errors.append(
                f"pan_number '{raw_pan}' does not match format [A-Z]{{5}}[0-9]{{4}}[A-Z]."
            )
        else:
            taxpayer_char = raw_pan[3]
            if taxpayer_char not in _TAXPAYER_CODES:
                warnings.append(
                    f"pan_number 4th character '{taxpayer_char}' is not a standard taxpayer code."
                )
            validated["pan_number"] = raw_pan
            validated["taxpayer_type"] = _TAXPAYER_CODES.get(taxpayer_char, "Unknown")

        # --- Name ---
        name: str = str(data.get("name") or "").strip()
        if not name:
            warnings.append("name is missing or empty.")
        elif not _NAME_PATTERN.match(name):
            warnings.append(f"name '{name}' contains unexpected characters.")
        else:
            validated["name"] = name.upper()

        valid = len(errors) == 0
        logger.debug(
            "PANValidator: valid=%s, errors=%d, warnings=%d",
            valid, len(errors), len(warnings),
        )

        return {
            "valid": valid,
            "errors": errors,
            "warnings": warnings,
            "validated_data": validated,
        }
