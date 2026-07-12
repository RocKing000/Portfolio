"""
models.py

Data structures for the DIRE-X V1 Scoring Engine.
Validates and normalizes raw scenario input before it reaches calculators.
"""

from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Valid categorical values
# ---------------------------------------------------------------------------

VALID_DEPENDENCY_LEVELS  = {"low", "medium", "high"}
VALID_MANIPULATION_RISKS = {"low", "medium", "high"}
VALID_POLICY_IMPACTS     = {"none", "moderate", "high"}
VALID_EVENT_TYPES = {
    "oil_shock", "sanctions", "cyberattack", "financial_crisis",
    "natural_disaster", "pandemic_health", "trade_war",
    "rare_earth_export_ban", "geopolitical_conflict", "climate_disaster",
    "labor_strike", "regulatory_change", "DEFAULT",
}


@dataclass
class Scenario:
    """
    Validated scenario ready for scoring.
    All fields are normalized to their expected types and ranges.
    """

    # Identifiers
    scenario_id:   str
    event_type:    str
    region:        str
    industry:      str

    # Impact scores (0–100)
    direct_impact_score:   float
    indirect_impact_score: float

    # Dependency fields
    dependency_level:            str    # low | medium | high
    hidden_dependency_percentage: float  # 0–100

    # Temporal fields
    time_to_impact:  int    # days
    recovery_time:   int    # days

    # Risk modifiers
    confidence_score:  float   # 0–1
    manipulation_risk: str     # low | medium | high
    policy_impact:     str     # none | moderate | high

    @classmethod
    def from_dict(cls, data: dict) -> "Scenario":
        """
        Construct a Scenario from a raw dictionary.
        Applies type coercion and range clamping.
        Raises ValueError for missing required fields.
        """
        required = [
            "scenario_id", "event_type", "region", "industry",
            "direct_impact_score", "indirect_impact_score",
            "dependency_level", "hidden_dependency_percentage",
            "time_to_impact", "recovery_time",
            "confidence_score", "manipulation_risk", "policy_impact",
        ]
        for field_name in required:
            if field_name not in data:
                raise ValueError(f"Missing required field: '{field_name}'")

        dep_level  = str(data["dependency_level"]).lower()
        manip_risk = str(data["manipulation_risk"]).lower()
        pol_impact = str(data["policy_impact"]).lower()

        if dep_level not in VALID_DEPENDENCY_LEVELS:
            raise ValueError(f"dependency_level must be one of {VALID_DEPENDENCY_LEVELS}")
        if manip_risk not in VALID_MANIPULATION_RISKS:
            raise ValueError(f"manipulation_risk must be one of {VALID_MANIPULATION_RISKS}")
        if pol_impact not in VALID_POLICY_IMPACTS:
            raise ValueError(f"policy_impact must be one of {VALID_POLICY_IMPACTS}")

        return cls(
            scenario_id=str(data["scenario_id"]),
            event_type=str(data.get("event_type", "DEFAULT")),
            region=str(data.get("region", "DEFAULT")),
            industry=str(data.get("industry", "DEFAULT")),

            direct_impact_score=_clamp(float(data["direct_impact_score"]), 0.0, 100.0),
            indirect_impact_score=_clamp(float(data["indirect_impact_score"]), 0.0, 100.0),

            dependency_level=dep_level,
            hidden_dependency_percentage=_clamp(float(data["hidden_dependency_percentage"]), 0.0, 100.0),

            time_to_impact=max(0, int(data["time_to_impact"])),
            recovery_time=max(0, int(data["recovery_time"])),

            confidence_score=_clamp(float(data["confidence_score"]), 0.0, 1.0),
            manipulation_risk=manip_risk,
            policy_impact=pol_impact,
        )


@dataclass
class ScoreResult:
    """
    Full scoring output for a single scenario.
    """
    scenario_id: str

    # Core scores
    impact_score:    float
    exposure_score:  float
    temporal_factor: float
    risk_score:      float
    fragility_score: float
    final_score:     float

    # Explainability
    explanation: dict

    def to_dict(self) -> dict:
        return {
            "scenario_id":    self.scenario_id,
            "impact_score":   round(self.impact_score, 2),
            "exposure_score": round(self.exposure_score, 2),
            "temporal_factor": round(self.temporal_factor, 4),
            "risk_score":     round(self.risk_score, 2),
            "fragility_score": round(self.fragility_score, 4),
            "final_score":    round(self.final_score, 2),
            "explanation":    self.explanation,
        }


# ---------------------------------------------------------------------------
# Shared helper (used by models and calculators)
# ---------------------------------------------------------------------------

def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))
