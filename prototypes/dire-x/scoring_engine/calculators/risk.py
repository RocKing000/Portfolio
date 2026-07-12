"""
calculators/risk.py

Computes the Risk Score from impact, exposure, and temporal factors.
Then applies the policy multiplier as a final moderation step.

Formula:
    risk_score = impact_score * exposure_score * temporal_factor

    After policy adjustment:
    risk_score_adjusted = risk_score * policy_multiplier(policy_impact)

The multiplication of three factors creates natural non-linearity:
    - If any factor is near zero, risk collapses (bounded by weakest link)
    - High values on all three create compounding amplification

Result range: clamped to [0, 100] after scaling.
"""

from scoring_engine.utils import clamp, policy_multiplier


def compute_risk(
    impact_score: float,
    exposure_score: float,
    temporal_factor: float,
    policy_impact: str,
) -> tuple[float, dict]:
    """
    Compute the risk score.

    Args:
        impact_score:    0–100 (from macro calculator)
        exposure_score:  0–1   (from dependency calculator, raw)
        temporal_factor: float (from temporal calculator)
        policy_impact:   "none" | "moderate" | "high"

    Returns:
        risk_score  — float [0, 100]
        detail      — intermediate values for explainability
    """
    # Raw risk: product of the three primary factors
    # impact_score is on [0,100]; exposure and temporal are dimensionless multipliers
    risk_raw = impact_score * exposure_score * temporal_factor

    # Policy moderation: strong policy response reduces effective risk
    pol_mult = policy_multiplier(policy_impact)
    risk_adjusted = risk_raw * pol_mult

    # Clamp to [0, 100]
    risk_score = clamp(risk_adjusted, 0.0, 100.0)

    detail = {
        "impact_score":       round(impact_score, 2),
        "exposure_score_raw": round(exposure_score, 4),
        "temporal_factor":    round(temporal_factor, 4),
        "risk_pre_policy":    round(risk_raw, 4),
        "policy_impact":      policy_impact,
        "policy_multiplier":  pol_mult,
        "risk_post_policy":   round(risk_adjusted, 4),
        "risk_score":         round(risk_score, 2),
        "limiting_factor": (
            "impact"    if impact_score <= exposure_score * 100 and impact_score <= temporal_factor * 100
            else "exposure"  if exposure_score <= temporal_factor
            else "temporal"
        ),
    }

    return risk_score, detail
