"""
services/scoring_engine.py

Thin wrapper around the DIRE-X V2 Scoring Engine.

Responsibility:
    - Locate scoring_engine_v2 relative to this file
    - Import compute_scores safely at module load time
    - Expose a single score(scenario_dict) -> dict function
    - Translate engine exceptions into ScoringError

The scoring_engine_v2 package lives two levels up from backend/:
    dire-x/
        scoring_engine_v2/    <- target
        backend/
            app/
                services/
                    scoring_engine.py  <- this file

Path resolution:
    __file__ -> .../backend/app/services/scoring_engine.py
    ../../../ -> dire-x/
"""

import sys
import os

# ---------------------------------------------------------------------------
# Ensure scoring_engine_v2 is importable
# ---------------------------------------------------------------------------

_DIREX_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
if _DIREX_ROOT not in sys.path:
    sys.path.insert(0, _DIREX_ROOT)

try:
    from scoring_engine_v2.main import compute_scores as _compute_scores
    _ENGINE_AVAILABLE = True
    _IMPORT_ERROR     = ""
except ImportError as _e:
    _ENGINE_AVAILABLE = False
    _IMPORT_ERROR     = str(_e)

from app.utils.errors import ScoringError


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def score(scenario_dict: dict) -> dict:
    """
    Score a validated scenario using DIRE-X V2.

    Args:
        scenario_dict: raw scenario dict (already validated)

    Returns:
        Full result dict from compute_scores() including all scores,
        shocks_triggered, v2_flags, and explanation.

    Raises:
        ScoringError: engine unavailable or scoring logic failure
    """
    if not _ENGINE_AVAILABLE:
        raise ScoringError(
            f"Scoring engine (scoring_engine_v2) could not be imported: {_IMPORT_ERROR}. "
            f"Ensure scoring_engine_v2/ exists at: {_DIREX_ROOT}"
        )

    try:
        return _compute_scores(scenario_dict)
    except ValueError as exc:
        raise ScoringError(f"Invalid scenario data: {exc}") from exc
    except Exception as exc:
        raise ScoringError(f"Scoring engine error: {exc}") from exc


def is_available() -> bool:
    """Return True if the scoring engine loaded successfully."""
    return _ENGINE_AVAILABLE
