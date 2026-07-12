"""
BaseValidator — abstract contract for all data validators.

Single Responsibility: validate extracted data against domain rules.
Examples: AadhaarValidator, PANValidator, FaceMatchValidator.
Pure logic — zero image processing.
"""

from abc import ABC, abstractmethod


class BaseValidator(ABC):
    """
    Abstract base for all validators.

    A validator receives a dict of extracted data, checks it against a set of
    domain rules, and returns a structured result describing what passed, what
    failed, and a cleaned/normalised version of the data.
    """

    @abstractmethod
    def validate(self, data: dict) -> dict:
        """
        Validate *data* against the validator's rule set.

        Parameters
        ----------
        data:
            Dict of extracted field values to validate.

        Returns
        -------
        dict with keys:
            valid          : bool   — True only if all required rules pass.
            errors         : list   — List of error strings (failed required rules).
            warnings       : list   — List of warning strings (soft failures).
            validated_data : dict   — Cleaned and normalised version of *data*.
        """

    @abstractmethod
    def get_validation_rules(self) -> dict:
        """
        Return a description of every validation rule this validator enforces.

        Returns
        -------
        dict mapping rule_name -> rule_description (str).
        Used for documentation and debugging.
        """
