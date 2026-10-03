"""
number_generator.py — Generate valid-format Indian document numbers.

All numbers follow real format rules (not cryptographically valid Verhoeff).
"""

import random
import string


class NumberGenerator:
    """Generates document identification numbers in correct formats."""

    _LETTERS = string.ascii_uppercase

    # State codes for DL number
    _STATE_CODES = [
        "MH", "DL", "UP", "TN", "KA", "WB", "GJ", "RJ",
        "MP", "AP", "TS", "KL", "PB", "HR", "BR", "OR",
    ]

    def generate_aadhaar(self) -> str:
        """
        Generate a 12-digit Aadhaar number.
        Rule: first digit is 2–9, no repeated single digit, formatted XXXX XXXX XXXX.
        """
        while True:
            first = str(random.randint(2, 9))
            rest = "".join(str(random.randint(0, 9)) for _ in range(11))
            num = first + rest
            # Reject if all same digit (degenerate)
            if len(set(num)) > 1:
                return f"{num[:4]} {num[4:8]} {num[8:]}"

    def generate_pan(self) -> str:
        """
        Generate a PAN number in AAAAA9999A format.
        First 3 chars: uppercase letters (issuing authority)
        4th char: P (individual), C (company), etc.
        5th char: first letter of surname
        Next 4: sequential digits
        Last char: check letter
        """
        prefix = "".join(random.choices(self._LETTERS, k=3))
        entity = random.choice("PCHABGJLFT")
        surname_initial = random.choice(self._LETTERS)
        seq = "".join(str(random.randint(0, 9)) for _ in range(4))
        check = random.choice(self._LETTERS)
        return f"{prefix}{entity}{surname_initial}{seq}{check}"

    def generate_passport_number(self) -> str:
        """Format: one letter + 7 digits (e.g. A1234567)."""
        letter = random.choice(self._LETTERS)
        digits = "".join(str(random.randint(0, 9)) for _ in range(7))
        return letter + digits

    def generate_dl_number(self) -> str:
        """
        Format: SS99 YYYY NNNNNNN
        SS = state code, 99 = RTO number, YYYY = year, NNNNNNN = serial
        e.g. MH02 2011 0012345
        """
        state = random.choice(self._STATE_CODES)
        rto = random.randint(1, 99)
        year = random.randint(1990, 2023)
        serial = random.randint(1000000, 9999999)
        return f"{state}{rto:02d} {year} {serial:07d}"

    def generate_voter_id(self) -> str:
        """Format: 3 letters + 7 digits (e.g. ABC1234567)."""
        prefix = "".join(random.choices(self._LETTERS, k=3))
        digits = "".join(str(random.randint(0, 9)) for _ in range(7))
        return prefix + digits
