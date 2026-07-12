"""
calculators/dependency.py

Computes the Exposure Score from dependency weight and hidden dependency percentage.

Formula:
    exposure_score = dependency_weight * (hidden_dependency_percentage / 100)

Dependency weight:
    low    → 0.3
    medium → 0.6
    high   → 0.9

Result range: [0.0, 0.9]
Scaled to [0, 100] in the output for consistency with other scores.
"""

from scoring_engine.utils import dependency_to_weight, clamp


def compute_exposure(
    dependency_level: str,
    hidden_dependency_percentage: float,
) -> tuple[float, float, dict]:
    """
    Compute exposure score.

    Args:
        dependency_level:             "low" | "medium" | "high"
        hidden_dependency_percentage: 0–100

    Returns:
        dependency_weight  — numeric weight [0.3, 0.6, 0.9]
        exposure_score     — raw score [0.0, 0.9]
        detail             — intermediate values for explainability
    """
    dependency_weight = dependency_to_weight(dependency_level)
    hidden_norm       = hidden_dependency_percentage / 100.0

    exposure_score = dependency_weight * hidden_norm
    exposure_score = clamp(exposure_score, 0.0, 1.0)

    detail = {
        "dependency_level":            dependency_level,
        "dependency_weight":           dependency_weight,
        "hidden_dependency_pct":       hidden_dependency_percentage,
        "hidden_dependency_norm":      round(hidden_norm, 4),
        "exposure_score_raw":          round(exposure_score, 4),
        "exposure_score_pct":          round(exposure_score * 100, 2),
        "interpretation": (
            "High hidden dependency through deep supply chain tiers."
            if exposure_score >= 0.6
            else "Moderate dependency exposure — second-order risks present."
            if exposure_score >= 0.3
            else "Low hidden exposure — primary dependencies are visible."
        ),
    }

    return dependency_weight, exposure_score, detail
