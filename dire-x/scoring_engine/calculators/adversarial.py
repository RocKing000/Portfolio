"""
calculators/adversarial.py

Computes the Adversarial Penalty — deduction for manipulation risk.

Mapping:
    low    → 0   (data is trustworthy, no penalty)
    medium → 5   (moderate concern, small deduction)
    high   → 10  (significant manipulation risk, hard deduction)

The penalty is subtracted directly from the final score.
High manipulation risk suggests the scenario data may be gamed,
inflated, or strategically biased — reducing score credibility.
"""

from scoring_engine.utils import clamp


# Penalty values per manipulation risk level
PENALTY_MAP = {
    "low":    0,
    "medium": 5,
    "high":   10,
}


def compute_adversarial_penalty(manipulation_risk: str) -> tuple[float, dict]:
    """
    Compute the adversarial penalty.

    Args:
        manipulation_risk: "low" | "medium" | "high"

    Returns:
        penalty  — float (0, 5, or 10)
        detail   — breakdown for explainability
    """
    if manipulation_risk not in PENALTY_MAP:
        raise ValueError(
            f"Unknown manipulation_risk '{manipulation_risk}'. Must be: low, medium, high."
        )

    penalty = float(PENALTY_MAP[manipulation_risk])

    detail = {
        "manipulation_risk":  manipulation_risk,
        "penalty_applied":    penalty,
        "interpretation": (
            "No penalty — data is considered trustworthy."
            if penalty == 0
            else "Moderate penalty — partial data integrity concern."
            if penalty == 5
            else "High penalty — significant manipulation risk detected."
        ),
    }

    return penalty, detail
