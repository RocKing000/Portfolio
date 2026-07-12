"""
calculators/confidence.py

Computes the Fragility Score — how brittle the system is under shock.

Formula:
    fragility = (indirect_impact / 100) * dependency_weight * (1 - confidence_score)

Components:
    indirect_norm   = indirect_impact / 100
        — normalizes indirect impact to [0, 1]
        — indirect impact drives hidden fragility more than direct
          (direct shocks are visible; indirect ones cascade unexpectedly)

    dependency_weight
        — from dependency level mapping (0.3 / 0.6 / 0.9)
        — deeper dependencies → more fragile system

    uncertainty    = 1 - confidence_score
        — low confidence means we don't know what we don't know
        — high uncertainty amplifies fragility

Result range: [0.0, 0.9]
    — 0.0: resilient, low dependency, high confidence
    — 0.9: brittle, deep dependency, zero confidence (worst case)
"""

from scoring_engine.utils import clamp


def compute_fragility(
    indirect_impact_score: float,
    dependency_weight: float,
    confidence_score: float,
) -> tuple[float, dict]:
    """
    Compute the fragility score.

    Args:
        indirect_impact_score: 0–100
        dependency_weight:     0.3 | 0.6 | 0.9
        confidence_score:      0–1

    Returns:
        fragility_score  — float [0.0, ~0.9]
        detail           — intermediate values for explainability
    """
    indirect_norm = indirect_impact_score / 100.0
    uncertainty   = 1.0 - confidence_score

    fragility = indirect_norm * dependency_weight * uncertainty
    fragility  = clamp(fragility, 0.0, 1.0)

    detail = {
        "indirect_impact_raw":  indirect_impact_score,
        "indirect_norm":        round(indirect_norm, 4),
        "dependency_weight":    dependency_weight,
        "confidence_score":     confidence_score,
        "uncertainty":          round(uncertainty, 4),
        "fragility_score":      round(fragility, 4),
        "fragility_pct":        round(fragility * 100, 2),
        "fragility_level": (
            "HIGH — system highly susceptible to cascade failures."
            if fragility >= 0.6
            else "MODERATE — second-order failures possible under stress."
            if fragility >= 0.3
            else "LOW — system is resilient to indirect shocks."
        ),
    }

    return fragility, detail
