"""
Typo correction for search queries.
Uses RapidFuzz for domain-specific fuzzy matching and SymSpellPy for
general English spell checking. Falls back gracefully if SymSpellPy
dictionary is unavailable.
"""
import re
import logging
from typing import Optional, Tuple

from rapidfuzz import fuzz, process

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Domain vocabulary — all known error codes, categories, and keywords
# ---------------------------------------------------------------------------
_DOMAIN_TERMS = [
    # Error codes
    'k-100', 'k-101', 'k-102', 'k-103', 'k-104', 'k-105',
    # Categories
    'biometric', 'fingerprint', 'face', 'iris', 'authentication',
    'cibil', 'credit', 'bureau', 'score',
    'kyc', 'ckyc', 'ekyc', 'know your customer',
    'enach', 'mandate', 'nach', 'payment',
    'frozen', 'blocked', 'restricted', 'account',
    'udyam', 'msme', 'business',
    'otp', 'verification',
    'error', 'timeout', 'connection', 'network', 'api', 'host',
    'gender', 'mismatch', 'dob', 'date of birth',
    'ifsc', 'branch', 'aadhaar', 'pan', 'dedupe', 'duplicate',
]

# Hard-coded corrections for common banking-domain typos that fuzzy
# matching might get wrong due to short edit distance to wrong words.
_TYPO_MAP = {
    # CIBIL
    'cibl':             'cibil',
    'sibil':            'cibil',
    'cibi':             'cibil',
    # KYC
    'kcy':              'kyc',
    'kycc':             'kyc',
    # Biometric
    'biomet':           'biometric',
    'biomatric':        'biometric',
    'biometr':          'biometric',
    # Frozen
    'froozen':          'frozen',
    'frozn':            'frozen',
    # ENACH
    'enatch':           'enach',
    'enaach':           'enach',
    # UDYAM
    'udhyam':           'udyam',
    'udhyog':           'udyam',
    # Mandate
    'mandat':           'mandate',
    'mandaate':         'mandate',
    # Authentication / Verification
    'authetication':    'authentication',
    'authentification': 'authentication',
    'varification':     'verification',
    'verifcation':      'verification',
    # Account
    'acouunt':          'account',
    'acount':           'account',
    # Gender
    'genr':             'gender',
    'gendr':            'gender',
    'gnder':            'gender',
    # Mismatch
    'mismtch':          'mismatch',
    'missmatch':        'mismatch',
    # Fingerprint
    'fingerpint':       'fingerprint',
    'fingerprnt':       'fingerprint',
    # Duplicate / Dedupe
    'deduplicate':      'dedupe',
    'dupicate':         'duplicate',
    # Error (abbreviation)
    'err':              'error',
    # OTP
    'ottp':             'otp',
    # Aadhaar
    'aadhar':           'aadhaar',
    'adhaar':           'aadhaar',
}

# SymSpellPy disabled — it uses a general English dictionary that corrupts
# domain-specific banking acronyms (e.g. "CIBIL 700" → "civil a of").
# Domain correction is handled by _TYPO_MAP and fuzzy matching against
# _DOMAIN_TERMS, which are sufficient for this service.
_sym_spell = None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def correct_query(query: str) -> Tuple[str, float, str]:
    """
    Correct typos in *query*.

    Returns:
        (corrected_query, confidence 0–1, method_name)
    """
    if not query or not query.strip():
        return query, 1.0, 'none'

    lower = query.lower().strip()

    # 1. Normalise error-code variants: "k100", "k 100", "error k-100"
    code = _normalise_error_code(lower)
    if code:
        return code, 1.0, 'error_code'

    # 2. Hard-coded domain typo map (whole-word replacement)
    for typo, fix in _TYPO_MAP.items():
        pattern = r'\b' + re.escape(typo) + r'\b'
        if re.search(pattern, lower):
            corrected = re.sub(pattern, fix, lower)
            return corrected, 0.97, 'typo_map'

    # 3. Fuzzy match against domain vocabulary.
    # Threshold is tighter for long queries (less likely to be a partial abbreviation)
    # and looser for short ones (e.g. "genr" → "gender").
    fuzzy = _fuzzy_correct(lower)
    if fuzzy:
        term, score = fuzzy
        threshold = 78 if len(lower) <= 6 else 85
        if score >= threshold and term != lower:
            return term, score / 100.0, 'fuzzy'

    return query, 1.0, 'original'


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _normalise_error_code(text: str) -> Optional[str]:
    """Return 'k-NNN' if the text contains an error-code pattern."""
    match = re.search(r'\bk\s*-?\s*(\d+)\b', text, re.IGNORECASE)
    if match:
        digits = match.group(1)
        if len(digits) == 1:
            digits = digits + '00'  # k-1 → k-100
        return f'k-{digits}'
    return None


def _fuzzy_correct(query: str) -> Optional[Tuple[str, float]]:
    result = process.extractOne(
        query,
        _DOMAIN_TERMS,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=72,
    )
    if result:
        term, score, _ = result
        return term, score
    return None


