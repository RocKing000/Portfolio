"""
DIRE-X Scoring Engine — Version 1
==================================
Single-file implementation. Standard library only.

Public API:
    compute_scores(scenario: dict) -> dict

Pipeline:
    1. Validate input
    2. compute_impact()        — weighted direct + indirect
    3. compute_exposure()      — dependency weight × hidden dependency
    4. compute_temporal_factor() — urgency × recovery duration
    5. compute_risk()          — product of impact, exposure, temporal
    6. compute_fragility()     — indirect uncertainty × dependency depth
    7. compute_final_score()   — risk + fragility amplified − adversarial penalty
    8. Build explainability block
"""

# ─────────────────────────────────────────────────────────────────────────────
# Section 1: Constants
# ─────────────────────────────────────────────────────────────────────────────

DEPENDENCY_WEIGHT_MAP = {
    "low":    0.3,
    "medium": 0.6,
    "high":   0.9,
}

ADVERSARIAL_PENALTY_MAP = {
    "low":    0,
    "medium": 5,
    "high":   10,
}

POLICY_MULTIPLIER_MAP = {
    "none":     1.00,
    "moderate": 0.90,
    "high":     0.75,
}

# Final score formula weight for fragility contribution
FRAGILITY_AMPLIFIER = 20


# ─────────────────────────────────────────────────────────────────────────────
# Section 2: Input Validation
# ─────────────────────────────────────────────────────────────────────────────

def validate_scenario(scenario: dict) -> dict:
    """
    Validate and normalise raw scenario dict.
    Returns a cleaned dict with correct types and clamped ranges.
    Raises ValueError on missing or invalid fields.
    """
    required_fields = [
        "event_type", "region", "industry",
        "direct_impact_score", "indirect_impact_score",
        "dependency_level", "hidden_dependency_percentage",
        "time_to_impact", "recovery_time",
        "confidence_score", "manipulation_risk", "policy_impact",
    ]
    for field in required_fields:
        if field not in scenario:
            raise ValueError(f"Missing required field: '{field}'")

    dep_level  = str(scenario["dependency_level"]).lower().strip()
    manip_risk = str(scenario["manipulation_risk"]).lower().strip()
    pol_impact = str(scenario["policy_impact"]).lower().strip()

    if dep_level not in DEPENDENCY_WEIGHT_MAP:
        raise ValueError(f"dependency_level must be one of {list(DEPENDENCY_WEIGHT_MAP.keys())}")
    if manip_risk not in ADVERSARIAL_PENALTY_MAP:
        raise ValueError(f"manipulation_risk must be one of {list(ADVERSARIAL_PENALTY_MAP.keys())}")
    if pol_impact not in POLICY_MULTIPLIER_MAP:
        raise ValueError(f"policy_impact must be one of {list(POLICY_MULTIPLIER_MAP.keys())}")

    return {
        "event_type":                  str(scenario["event_type"]),
        "region":                      str(scenario["region"]),
        "industry":                    str(scenario["industry"]),
        "direct_impact_score":         _clamp(float(scenario["direct_impact_score"]),   0.0, 100.0),
        "indirect_impact_score":       _clamp(float(scenario["indirect_impact_score"]), 0.0, 100.0),
        "dependency_level":            dep_level,
        "hidden_dependency_percentage": _clamp(float(scenario["hidden_dependency_percentage"]), 0.0, 100.0),
        "time_to_impact":              max(0, int(scenario["time_to_impact"])),
        "recovery_time":               max(0, int(scenario["recovery_time"])),
        "confidence_score":            _clamp(float(scenario["confidence_score"]), 0.0, 1.0),
        "manipulation_risk":           manip_risk,
        "policy_impact":               pol_impact,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Section 3: Scoring Functions
# ─────────────────────────────────────────────────────────────────────────────

def compute_impact(direct: float, indirect: float) -> float:
    """
    Impact Score — weighted combination of direct and indirect impact.

    Formula:
        impact = 0.6 * direct + 0.4 * indirect

    Direct is weighted higher (0.6) because it represents confirmed,
    observable disruption. Indirect (0.4) captures downstream propagation.

    Returns: float in [0, 100]
    """
    impact = 0.6 * direct + 0.4 * indirect
    return _clamp(impact, 0.0, 100.0)


def compute_exposure(dependency_level: str, hidden_dependency_percentage: float) -> tuple:
    """
    Exposure Score — how much of the entity's risk is hidden in its supply chain.

    Formula:
        exposure = dependency_weight * (hidden_dependency_percentage / 100)

    Dependency weight:
        low → 0.3  |  medium → 0.6  |  high → 0.9

    A high-dependency entity with 80% hidden exposure has maximum surface area
    for unexpected shock propagation.

    Returns: (dependency_weight: float, exposure: float in [0.0, 0.9])
    """
    dependency_weight = DEPENDENCY_WEIGHT_MAP[dependency_level]
    hidden_norm       = hidden_dependency_percentage / 100.0
    exposure          = dependency_weight * hidden_norm
    return dependency_weight, _clamp(exposure, 0.0, 1.0)


def compute_temporal_factor(time_to_impact: int, recovery_time: int) -> float:
    """
    Temporal Factor — combines onset urgency with recovery duration.

    Formula:
        temporal = (1 / (1 + time_to_impact)) * (recovery_time / 30)

    onset_urgency  = 1 / (1 + time_to_impact)
        Approaches 1 when the event is immediate (tti=0).
        Approaches 0 for distant future events.
        Uses days as the unit; division by (1+tti) prevents div-by-zero.

    recovery_weight = recovery_time / 30
        Normalised to a 30-day baseline.
        60 days → 2.0, 180 days → 6.0.
        Longer recovery = higher sustained impact window.

    Returns: float (can exceed 1.0 for long recoveries — absorbed by risk formula)
    """
    onset_urgency   = 1.0 / (1.0 + time_to_impact)
    recovery_weight = recovery_time / 30.0
    temporal        = onset_urgency * recovery_weight
    return max(0.0, temporal)


def compute_risk(
    impact: float,
    exposure: float,
    temporal: float,
    policy_impact: str,
) -> float:
    """
    Risk Score — multiplicative combination of impact, exposure, and timing.

    Formula:
        risk = impact * exposure * temporal * policy_multiplier

    The three-way product creates natural non-linearity:
        - If any factor collapses to near-zero, risk collapses with it.
        - High values across all three amplify each other.

    Policy multiplier moderates the output:
        none → 1.00  |  moderate → 0.90  |  high → 0.75

    Returns: float in [0, 100]
    """
    policy_multiplier = POLICY_MULTIPLIER_MAP[policy_impact]
    risk = impact * exposure * temporal * policy_multiplier
    return _clamp(risk, 0.0, 100.0)


def compute_fragility(
    indirect: float,
    dependency_weight: float,
    confidence_score: float,
) -> float:
    """
    Fragility Score — system brittleness under uncertainty.

    Formula:
        fragility = (indirect / 100) * dependency_weight * (1 - confidence_score)

    Components:
        indirect_norm   = indirect / 100  — normalised indirect impact [0, 1]
        dependency_weight                 — depth of supply chain exposure
        uncertainty     = 1 - confidence  — low confidence amplifies fragility

    Interpretation:
        High fragility = deep dependency + high indirect impact + low data confidence.
        The system is brittle — a moderate shock can cascade unexpectedly.

    Returns: float in [0.0, ~0.9]
    """
    indirect_norm = indirect / 100.0
    uncertainty   = 1.0 - confidence_score
    fragility     = indirect_norm * dependency_weight * uncertainty
    return _clamp(fragility, 0.0, 1.0)


def compute_final_score(
    risk: float,
    fragility: float,
    manipulation_risk: str,
) -> dict:
    """
    Final Score — combines risk, fragility contribution, and adversarial penalty.

    Formula:
        final = risk + (fragility * 20) - adversarial_penalty

    fragility * 20:
        Amplifies the fragility signal into the [0, 20] range,
        adding up to 20 points for a maximally fragile scenario.

    adversarial_penalty:
        low → 0  |  medium → 5  |  high → 10
        Penalises scenarios flagged as potentially manipulated.

    Returns: dict with final_score and breakdown components
    """
    adversarial_penalty  = float(ADVERSARIAL_PENALTY_MAP[manipulation_risk])
    fragility_contribution = fragility * FRAGILITY_AMPLIFIER
    final_raw = risk + fragility_contribution - adversarial_penalty
    final     = _clamp(final_raw, 0.0, 100.0)

    return {
        "final_score":            round(final, 2),
        "risk_component":         round(risk, 2),
        "fragility_contribution": round(fragility_contribution, 2),
        "adversarial_penalty":    adversarial_penalty,
        "final_raw":              round(final_raw, 2),
        "clamped":                final_raw != final,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Section 4: Explainability
# ─────────────────────────────────────────────────────────────────────────────

def build_explanation(s: dict, scores: dict, dep_weight: float, final_breakdown: dict) -> dict:
    """
    Build the human-readable explainability block.
    Ranks components by their contribution to the final score.
    """
    # Key drivers: sorted by absolute contribution to final score
    drivers_raw = [
        ("Risk Score",             scores["risk"],                          "risk signal"),
        ("Fragility (x20)",        final_breakdown["fragility_contribution"], "system brittleness"),
        ("Adversarial Penalty",    -final_breakdown["adversarial_penalty"],  "data integrity"),
    ]
    drivers_sorted = sorted(drivers_raw, key=lambda x: abs(x[1]), reverse=True)

    key_drivers = [
        {
            "factor":      name,
            "value":       round(val, 2),
            "direction":   "increases final score" if val >= 0 else "reduces final score",
            "description": desc,
        }
        for name, val, desc in drivers_sorted
    ]

    # Dependency effect narrative
    dep_effect = (
        f"Dependency level '{s['dependency_level']}' maps to weight {dep_weight}. "
        f"With {s['hidden_dependency_percentage']}% hidden exposure, "
        f"exposure score = {dep_weight} x {s['hidden_dependency_percentage'] / 100:.2f} "
        f"= {scores['exposure']:.4f}. "
        + (
            "Deep hidden dependencies create significant vulnerability to Tier 2+ shocks."
            if dep_weight >= 0.9
            else "Moderate dependency — second-order cascade risk is present but contained."
            if dep_weight >= 0.6
            else "Low dependency — exposure is primarily direct and observable."
        )
    )

    # Temporal effect narrative
    onset_urgency   = 1.0 / (1.0 + s["time_to_impact"])
    recovery_weight = s["recovery_time"] / 30.0
    temporal_effect = (
        f"Onset urgency = 1/(1+{s['time_to_impact']}) = {onset_urgency:.4f}. "
        f"Recovery weight = {s['recovery_time']}/30 = {recovery_weight:.2f}. "
        f"Temporal factor = {onset_urgency:.4f} x {recovery_weight:.2f} = {scores['temporal']:.4f}. "
        + (
            "Immediate onset with no preparation window."
            if s["time_to_impact"] == 0
            else f"{s['time_to_impact']}-day onset provides a minimal preparation buffer."
            if s["time_to_impact"] < 30
            else f"{s['time_to_impact']}-day onset provides moderate lead time."
        )
        + " "
        + (
            f"Recovery of {s['recovery_time']} days indicates a prolonged disruption window."
            if s["recovery_time"] > 90
            else f"Recovery of {s['recovery_time']} days is relatively contained."
        )
    )

    # Risk breakdown narrative
    risk_breakdown = (
        f"risk = impact({scores['impact']:.2f}) "
        f"x exposure({scores['exposure']:.4f}) "
        f"x temporal({scores['temporal']:.4f}) "
        f"x policy_mult({POLICY_MULTIPLIER_MAP[s['policy_impact']]}) "
        f"= {scores['risk']:.2f}. "
        f"Fragility adds {final_breakdown['fragility_contribution']:.2f} points "
        f"(fragility {scores['fragility']:.4f} x 20). "
        f"Adversarial penalty deducts {final_breakdown['adversarial_penalty']:.0f} points "
        f"(manipulation_risk='{s['manipulation_risk']}'). "
        f"Final = {final_breakdown['final_score']:.2f} — {_tier_label(final_breakdown['final_score'])}."
    )

    return {
        "key_drivers":      key_drivers,
        "dependency_effect": dep_effect,
        "temporal_effect":   temporal_effect,
        "risk_breakdown":    risk_breakdown,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Section 5: Public API
# ─────────────────────────────────────────────────────────────────────────────

def compute_scores(scenario: dict) -> dict:
    """
    Main entry point. Accepts a raw scenario dict, runs the full pipeline,
    returns structured scores + explainability.

    Args:
        scenario: dict — see module docstring for required fields

    Returns:
        dict with keys: scores, explanation
    """
    # Validate and normalise
    s = validate_scenario(scenario)

    # Step 1: Impact Score
    impact = compute_impact(
        direct=s["direct_impact_score"],
        indirect=s["indirect_impact_score"],
    )

    # Step 2: Exposure Score
    dep_weight, exposure = compute_exposure(
        dependency_level=s["dependency_level"],
        hidden_dependency_percentage=s["hidden_dependency_percentage"],
    )

    # Step 3: Temporal Factor
    temporal = compute_temporal_factor(
        time_to_impact=s["time_to_impact"],
        recovery_time=s["recovery_time"],
    )

    # Step 4: Risk Score
    risk = compute_risk(
        impact=impact,
        exposure=exposure,
        temporal=temporal,
        policy_impact=s["policy_impact"],
    )

    # Step 5: Fragility Score
    fragility = compute_fragility(
        indirect=s["indirect_impact_score"],
        dependency_weight=dep_weight,
        confidence_score=s["confidence_score"],
    )

    # Step 6: Final Score
    final_breakdown = compute_final_score(
        risk=risk,
        fragility=fragility,
        manipulation_risk=s["manipulation_risk"],
    )

    scores = {
        "impact":    round(impact, 2),
        "exposure":  round(exposure, 4),
        "temporal":  round(temporal, 4),
        "risk":      round(risk, 2),
        "fragility": round(fragility, 4),
        "final":     final_breakdown["final_score"],
        "tier":      _tier_label(final_breakdown["final_score"]),
    }

    explanation = build_explanation(
        s=s,
        scores=scores,
        dep_weight=dep_weight,
        final_breakdown=final_breakdown,
    )

    return {
        "scenario_id": s.get("scenario_id", "unknown"),
        "event_type":  s["event_type"],
        "region":      s["region"],
        "industry":    s["industry"],
        "scores":      scores,
        "breakdown":   {
            "risk_component":          final_breakdown["risk_component"],
            "fragility_contribution":  final_breakdown["fragility_contribution"],
            "adversarial_penalty":     final_breakdown["adversarial_penalty"],
        },
        "explanation": explanation,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Section 6: Utilities
# ─────────────────────────────────────────────────────────────────────────────

def _clamp(value: float, lo: float, hi: float) -> float:
    """Clamp value to the range [lo, hi]."""
    return max(lo, min(hi, value))


def _tier_label(score: float) -> str:
    """Map a 0-100 score to a human-readable risk tier."""
    if score >= 75: return "CRITICAL"
    if score >= 50: return "HIGH"
    if score >= 25: return "MODERATE"
    return "LOW"


# ─────────────────────────────────────────────────────────────────────────────
# Section 7: Demo
# ─────────────────────────────────────────────────────────────────────────────

SAMPLE_SCENARIO = {
    "scenario_id":                "SCN-V1-001",
    "event_type":                 "oil_shock",
    "region":                     "global",
    "industry":                   "manufacturing",
    "direct_impact_score":        70,
    "indirect_impact_score":      60,
    "dependency_level":           "high",
    "hidden_dependency_percentage": 40,
    "time_to_impact":             5,
    "recovery_time":              60,
    "confidence_score":           0.7,
    "manipulation_risk":          "medium",
    "policy_impact":              "moderate",
}


def _print_result(result: dict) -> None:
    """Print formatted scoring output to stdout."""
    sep  = "-" * 55
    sep2 = "=" * 55

    print(sep2)
    print("  DIRE-X Scoring Engine  v1")
    print(sep2)
    print(f"  Event    : {result['event_type']}")
    print(f"  Region   : {result['region']}")
    print(f"  Industry : {result['industry']}")
    print(sep)

    s = result["scores"]
    print("  SCORES")
    print(sep)
    print(f"  Impact Score     : {s['impact']:>7.2f} / 100")
    print(f"  Exposure Score   : {s['exposure']:>7.4f}  ({s['exposure']*100:.1f}%)")
    print(f"  Temporal Factor  : {s['temporal']:>7.4f}")
    print(f"  Risk Score       : {s['risk']:>7.2f} / 100")
    print(f"  Fragility Score  : {s['fragility']:>7.4f}")
    print(sep)

    b = result["breakdown"]
    print("  FINAL SCORE BREAKDOWN")
    print(sep)
    print(f"  Risk component          : +{b['risk_component']:>6.2f}")
    print(f"  Fragility (x20)         : +{b['fragility_contribution']:>6.2f}")
    print(f"  Adversarial penalty     : -{b['adversarial_penalty']:>6.0f}")
    print(f"  -------------------------   ------")
    print(f"  FINAL SCORE             :  {s['final']:>6.2f} / 100")
    print(f"  TIER                    :  {s['tier']}")
    print(sep)

    e = result["explanation"]
    print("  KEY DRIVERS")
    print(sep)
    for d in e["key_drivers"]:
        sign = "+" if d["value"] >= 0 else ""
        print(f"  {d['factor']:<22} {sign}{d['value']:>7.2f}  ({d['direction']})")
    print(sep)

    print("  DEPENDENCY EFFECT")
    # Wrap text at 55 chars
    _wrap_print(e["dependency_effect"], width=53, indent="  ")
    print(sep)

    print("  TEMPORAL EFFECT")
    _wrap_print(e["temporal_effect"], width=53, indent="  ")
    print(sep)

    print("  RISK BREAKDOWN")
    _wrap_print(e["risk_breakdown"], width=53, indent="  ")
    print(sep2)


def _wrap_print(text: str, width: int = 60, indent: str = "") -> None:
    """Simple word-wrap printer."""
    words = text.split()
    line  = indent
    for word in words:
        if len(line) + len(word) + 1 > width + len(indent):
            print(line)
            line = indent + word + " "
        else:
            line += word + " "
    if line.strip():
        print(line)


if __name__ == "__main__":
    import json

    result = compute_scores(SAMPLE_SCENARIO)

    # Formatted console output
    _print_result(result)

    # Raw JSON
    print("\nFull JSON output:")
    print(json.dumps(result, indent=2))
