"""
AadhaarValidator — validate extracted Aadhaar card data against UIDAI rules.

Single Responsibility: apply domain rules to the data dict extracted by
OCRExtractor and return a structured validation result.
Pure logic — zero image operations.
"""

import logging
import re
from datetime import datetime
from typing import Dict, List

from vision_framework.core.interfaces.base_validator import BaseValidator

logger = logging.getLogger(__name__)

_AADHAAR_PATTERN = re.compile(r'^[2-9]\d{11}$')
_NAME_PATTERN = re.compile(r'^[A-Za-z\s\.]{2,60}$')
_DOB_FORMATS = ["%d/%m/%Y", "%Y", "%d-%m-%Y", "%d.%m.%Y"]


class AadhaarValidator(BaseValidator):
    """
    Validates extracted Aadhaar card fields against UIDAI rules.

    Rules enforced:
      1. aadhaar_number: exactly 12 digits, first digit 2–9.
      2. aadhaar_number: not all same digit.
      3. aadhaar_number: matches UIDAI structural regex.
      4. name: non-empty, only alphabets and spaces.
      5. dob: valid date format, not in the future.
      6. gender: one of M / F / T (male / female / transgender).
    """

    def get_validation_rules(self) -> Dict[str, str]:
        return {
            "aadhaar_12_digits": "Must be exactly 12 numeric digits.",
            "aadhaar_first_digit": "First digit must be between 2 and 9.",
            "aadhaar_not_uniform": "All 12 digits must not be the same.",
            "aadhaar_structural": r"Pattern: \b[2-9]\d{3}\s?\d{4}\s?\d{4}\b",
            "name_alpha": "Name must contain only letters and spaces.",
            "dob_valid": "DOB must be a valid past date.",
            "gender_valid": "Gender must be MALE, FEMALE, or TRANSGENDER.",
        }

    def validate(self, data: dict) -> dict:
        """
        Validate Aadhaar-specific fields in *data*.

        Parameters
        ----------
        data:
            Dict from OCRExtractor with keys: aadhaar_number, name, dob, gender.

        Returns
        -------
        Standard validator result dict.
        """
        errors: List[str] = []
        warnings: List[str] = []
        validated: Dict = {}

        # --- Aadhaar number ---
        raw_number: str = str(data.get("aadhaar_number") or "").replace(" ", "")
        if not raw_number:
            errors.append("aadhaar_number is missing.")
        else:
            if not raw_number.isdigit():
                errors.append(f"aadhaar_number '{raw_number}' contains non-digit characters.")
            elif len(raw_number) != 12:
                errors.append(
                    f"aadhaar_number must be 12 digits; got {len(raw_number)}."
                )
            elif int(raw_number[0]) < 2:
                errors.append("aadhaar_number first digit must be 2–9.")
            elif len(set(raw_number)) == 1:
                errors.append("aadhaar_number cannot be all the same digit.")
            elif not _AADHAAR_PATTERN.match(raw_number):
                errors.append("aadhaar_number does not match structural pattern.")
            else:
                validated["aadhaar_number"] = raw_number

        # --- Name ---
        name: str = str(data.get("name") or "").strip()
        if not name:
            warnings.append("name is missing or empty.")
        elif not _NAME_PATTERN.match(name):
            warnings.append(f"name '{name}' contains unexpected characters.")
        else:
            validated["name"] = name.title()

        # --- DOB ---
        raw_dob: str = str(data.get("dob") or "").strip()
        if raw_dob:
            dob_dt = self._parse_dob(raw_dob)
            if dob_dt is None:
                warnings.append(f"dob '{raw_dob}' could not be parsed.")
            elif dob_dt > datetime.now():
                errors.append(f"dob '{raw_dob}' is in the future.")
            else:
                validated["dob"] = dob_dt.strftime("%d/%m/%Y")
        else:
            warnings.append("dob is missing.")

        # --- Gender ---
        raw_gender: str = str(data.get("gender") or "").upper().strip()
        gender_map = {
            "MALE": "M", "M": "M",
            "FEMALE": "F", "F": "F",
            "TRANSGENDER": "T", "T": "T",
        }
        if raw_gender in gender_map:
            validated["gender"] = gender_map[raw_gender]
        elif raw_gender:
            warnings.append(f"gender '{raw_gender}' is not recognised (expected MALE/FEMALE/TRANSGENDER).")
        else:
            warnings.append("gender is missing.")

        valid = len(errors) == 0
        logger.debug(
            "AadhaarValidator: valid=%s, errors=%d, warnings=%d",
            valid, len(errors), len(warnings),
        )

        return {
            "valid": valid,
            "errors": errors,
            "warnings": warnings,
            "validated_data": validated,
        }

    # ------------------------------------------------------------------

    @staticmethod
    def _parse_dob(raw: str) -> datetime:
        for fmt in _DOB_FORMATS:
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                continue
        return None  # type: ignore[return-value]
