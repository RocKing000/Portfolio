"""
calculators/macro.py

Computes the Impact Score from direct and indirect impact inputs.

Formula:
    impact_score = 0.6 * direct_impact + 0.4 * indirect_impact

Direct impact is weighted higher because it is more certain and measurable.
Indirect impact captures second-order propagation effects.

Result range: [0, 100]
"""

from scoring_engine.utils import clamp


# Weight constants — direct impact is more certain than indirect
W_DIRECT   = 0.6
W_INDIRECT = 0.4


def compute_impact(
    direct_impact_score: float,
    indirect_impact_score: float,
) -> tuple[float, dict]:
    """
    Compute the impact score.

    Args:
        direct_impact_score:   0–100
        indirect_impact_score: 0–100

    Returns:
        impact_score  — float [0, 100]
        detail        — intermediate values for explainability
    """
    impact_score = W_DIRECT * direct_impact_score + W_INDIRECT * indirect_impact_score
    impact_score = clamp(impact_score, 0.0, 100.0)

    direct_contribution   = W_DIRECT   * direct_impact_score
    indirect_contribution = W_INDIRECT * indirect_impact_score

    detail = {
        "direct_impact_raw":          direct_impact_score,
        "indirect_impact_raw":        indirect_impact_score,
        "direct_contribution":        round(direct_contribution, 2),
        "indirect_contribution":      round(indirect_contribution, 2),
        "weight_direct":              W_DIRECT,
        "weight_indirect":            W_INDIRECT,
        "impact_score":               round(impact_score, 2),
        "dominant_channel": (
            "direct" if direct_contribution >= indirect_contribution else "indirect"
        ),
    }

    return impact_score, detail
