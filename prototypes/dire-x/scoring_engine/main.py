"""
main.py

DIRE-X Scoring Engine — Version 1

Public API:
    compute_scores(scenario: dict) -> dict

Scoring pipeline:
    1. Validate + parse scenario dict into a Scenario model
    2. Compute Impact Score         (macro.py)
    3. Compute Exposure Score       (dependency.py)
    4. Compute Temporal Factor      (temporal.py)
    5. Compute Risk Score           (risk.py)
    6. Compute Fragility Score      (confidence.py)
    7. Compute Adversarial Penalty  (adversarial.py)
    8. Compute Final Score          (fusion step)
    9. Build explainability output
   10. Return structured result dict
"""

from scoring_engine.models import Scenario, ScoreResult, _clamp
from scoring_engine.utils  import clamp, format_score_label

from scoring_engine.calculators.macro       import compute_impact
from scoring_engine.calculators.dependency  import compute_exposure
from scoring_engine.calculators.temporal    import compute_temporal
from scoring_engine.calculators.risk        import compute_risk
from scoring_engine.calculators.confidence  import compute_fragility
from scoring_engine.calculators.adversarial import compute_adversarial_penalty


# ---------------------------------------------------------------------------
# Final score formula constants
# ---------------------------------------------------------------------------

FRAGILITY_AMPLIFIER = 20   # fragility contribution weight in final score


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_scores(scenario: dict) -> dict:
    """
    Compute all DIRE-X scores for a single scenario.

    Args:
        scenario: dict matching the DIRE-X scenario schema.
                  See models.py for required fields.

    Returns:
        dict containing:
            scenario_id, impact_score, exposure_score, temporal_factor,
            risk_score, fragility_score, final_score, explanation
    """
    # ── Step 1: Validate and parse input ────────────────────────────────────
    s = Scenario.from_dict(scenario)

    # ── Step 2: Impact Score ─────────────────────────────────────────────────
    # impact = 0.6 * direct + 0.4 * indirect
    impact_score, impact_detail = compute_impact(
        direct_impact_score=s.direct_impact_score,
        indirect_impact_score=s.indirect_impact_score,
    )

    # ── Step 3: Exposure Score ───────────────────────────────────────────────
    # exposure = dependency_weight * (hidden_dep_pct / 100)
    dependency_weight, exposure_score, exposure_detail = compute_exposure(
        dependency_level=s.dependency_level,
        hidden_dependency_percentage=s.hidden_dependency_percentage,
    )

    # ── Step 4: Temporal Factor ──────────────────────────────────────────────
    # temporal = (1 / (1 + time_to_impact)) * (recovery_time / 30)
    temporal_factor, temporal_detail = compute_temporal(
        time_to_impact=s.time_to_impact,
        recovery_time=s.recovery_time,
    )

    # ── Step 5: Risk Score ───────────────────────────────────────────────────
    # risk = impact * exposure * temporal  (× policy multiplier)
    risk_score, risk_detail = compute_risk(
        impact_score=impact_score,
        exposure_score=exposure_score,
        temporal_factor=temporal_factor,
        policy_impact=s.policy_impact,
    )

    # ── Step 6: Fragility Score ──────────────────────────────────────────────
    # fragility = (indirect / 100) * dependency_weight * (1 - confidence)
    fragility_score, fragility_detail = compute_fragility(
        indirect_impact_score=s.indirect_impact_score,
        dependency_weight=dependency_weight,
        confidence_score=s.confidence_score,
    )

    # ── Step 7: Adversarial Penalty ──────────────────────────────────────────
    adversarial_penalty, adversarial_detail = compute_adversarial_penalty(
        manipulation_risk=s.manipulation_risk,
    )

    # ── Step 8: Final Score ──────────────────────────────────────────────────
    # final = risk_score + fragility * 20 - adversarial_penalty
    final_score_raw = (
        risk_score
        + fragility_score * FRAGILITY_AMPLIFIER
        - adversarial_penalty
    )
    final_score = clamp(final_score_raw, 0.0, 100.0)

    # ── Step 9: Explainability ───────────────────────────────────────────────
    explanation = _build_explanation(
        s=s,
        impact_score=impact_score,
        exposure_score=exposure_score,
        temporal_factor=temporal_factor,
        risk_score=risk_score,
        fragility_score=fragility_score,
        adversarial_penalty=adversarial_penalty,
        final_score=final_score,
        impact_detail=impact_detail,
        exposure_detail=exposure_detail,
        temporal_detail=temporal_detail,
        risk_detail=risk_detail,
        fragility_detail=fragility_detail,
        adversarial_detail=adversarial_detail,
    )

    # ── Step 10: Assemble result ─────────────────────────────────────────────
    result = ScoreResult(
        scenario_id=s.scenario_id,
        impact_score=impact_score,
        exposure_score=exposure_score,       # raw [0,1]
        temporal_factor=temporal_factor,
        risk_score=risk_score,
        fragility_score=fragility_score,
        final_score=final_score,
        explanation=explanation,
    )

    return result.to_dict()


# ---------------------------------------------------------------------------
# Explainability builder
# ---------------------------------------------------------------------------

def _build_explanation(
    s, impact_score, exposure_score, temporal_factor,
    risk_score, fragility_score, adversarial_penalty, final_score,
    impact_detail, exposure_detail, temporal_detail,
    risk_detail, fragility_detail, adversarial_detail,
) -> dict:
    """
    Assemble the full explainability block.
    Identifies which factors most drive the final score.
    """

    # Key drivers: rank components by their contribution to final_score
    components = {
        "Risk Score":             risk_score,
        "Fragility (×20)":        fragility_score * FRAGILITY_AMPLIFIER,
        "Adversarial Penalty":    -adversarial_penalty,
    }
    sorted_drivers = sorted(components.items(), key=lambda x: abs(x[1]), reverse=True)
    key_drivers = [
        {
            "factor":       name,
            "value":        round(val, 2),
            "direction":    "increases" if val >= 0 else "reduces",
            "final_score":  format_score_label(abs(val)),
        }
        for name, val in sorted_drivers
    ]

    return {
        # Top-level driver summary
        "key_drivers": key_drivers,

        # Dependency effect narrative
        "dependency_effect": {
            "level":              s.dependency_level,
            "weight":             exposure_detail["dependency_weight"],
            "hidden_pct":         s.hidden_dependency_percentage,
            "exposure_score":     exposure_detail["exposure_score_pct"],
            "effect": (
                f"Deep supply chain dependency (weight={exposure_detail['dependency_weight']}) "
                f"combined with {s.hidden_dependency_percentage}% hidden exposure "
                f"yields an exposure score of {exposure_detail['exposure_score_pct']:.1f}/100. "
                + exposure_detail["interpretation"]
            ),
        },

        # Temporal effect narrative
        "temporal_effect": {
            "time_to_impact_days":   s.time_to_impact,
            "recovery_time_days":    s.recovery_time,
            "onset_urgency":         temporal_detail["onset_urgency"],
            "recovery_weight":       temporal_detail["recovery_weight"],
            "temporal_factor":       temporal_detail["temporal_factor"],
            "effect": (
                f"{temporal_detail['urgency_interpretation']} "
                f"{temporal_detail['recovery_interpretation']} "
                f"Temporal factor: {temporal_detail['temporal_factor']:.4f}."
            ),
        },

        # Full risk breakdown
        "risk_breakdown": {
            "formula":              "risk = impact × exposure × temporal × policy_multiplier",
            "impact_score":         round(impact_score, 2),
            "exposure_score_raw":   round(exposure_score, 4),
            "temporal_factor":      round(temporal_factor, 4),
            "policy_impact":        s.policy_impact,
            "policy_multiplier":    risk_detail["policy_multiplier"],
            "risk_pre_policy":      risk_detail["risk_pre_policy"],
            "risk_score":           round(risk_score, 2),
            "fragility_score":      round(fragility_score, 4),
            "fragility_contribution": round(fragility_score * FRAGILITY_AMPLIFIER, 2),
            "adversarial_penalty":  adversarial_penalty,
            "final_score":          round(final_score, 2),
            "final_tier":           format_score_label(final_score),
        },

        # Confidence note
        "confidence_note": (
            f"Confidence: {s.confidence_score:.2f} — "
            + (
                "high data reliability, fragility effect is muted."
                if s.confidence_score >= 0.8
                else "moderate reliability — some uncertainty in fragility estimate."
                if s.confidence_score >= 0.5
                else "low confidence — fragility is significantly amplified by uncertainty."
            )
        ),
    }


# ---------------------------------------------------------------------------
# Sample scenario (run this file directly to see output)
# ---------------------------------------------------------------------------

SAMPLE_SCENARIO = {
    "scenario_id":               "SCN-V1-001",
    "event_type":                "oil_shock",
    "region":                    "MENA",
    "industry":                  "energy",

    "direct_impact_score":       75,
    "indirect_impact_score":     55,

    "dependency_level":          "high",
    "hidden_dependency_percentage": 60,

    "time_to_impact":            7,
    "recovery_time":             180,

    "confidence_score":          0.65,
    "manipulation_risk":         "low",
    "policy_impact":             "moderate",
}


if __name__ == "__main__":
    import json
    print("\n" + "=" * 60)
    print("  DIRE-X Scoring Engine — V1")
    print("=" * 60)
    print("\nInput scenario:")
    print(json.dumps(SAMPLE_SCENARIO, indent=2))
    print("\n" + "-" * 60)

    result = compute_scores(SAMPLE_SCENARIO)

    print("\nScoring Results:")
    print(f"  Scenario ID     : {result['scenario_id']}")
    print(f"  Impact Score    : {result['impact_score']:.2f} / 100")
    print(f"  Exposure Score  : {result['exposure_score']:.4f}  ({result['exposure_score']*100:.1f}%)")
    print(f"  Temporal Factor : {result['temporal_factor']:.4f}")
    print(f"  Risk Score      : {result['risk_score']:.2f} / 100")
    print(f"  Fragility Score : {result['fragility_score']:.4f}")
    print(f"  Final Score     : {result['final_score']:.2f} / 100")
    print(f"  Tier            : {result['explanation']['risk_breakdown']['final_tier']}")

    print("\nKey Drivers:")
    for d in result["explanation"]["key_drivers"]:
        print(f"  {d['factor']:<25} {d['direction']:>9}  =>  {d['value']:>7.2f}")

    print("\nDependency Effect:")
    print(f"  {result['explanation']['dependency_effect']['effect']}")

    print("\nTemporal Effect:")
    print(f"  {result['explanation']['temporal_effect']['effect']}")

    print("\nConfidence Note:")
    print(f"  {result['explanation']['confidence_note']}")

    print("\nFull JSON output:")
    print(json.dumps(result, indent=2))
    print()
