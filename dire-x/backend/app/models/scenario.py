"""
models/scenario.py

Pydantic v2 request and response models for the DIRE-X scenario API.

Request:
    ScenarioInput       — inbound payload for POST /scenario/analyze

Response shapes:
    ValidationFlag      — single flag emitted by the validation engine
    ValidationSummary   — validation result block inside AnalysisResponse
    ScoreOutput         — score block inside AnalysisResponse
    AnalysisResponse    — full response from POST /scenario/analyze
    StoredScenario      — response from GET /scenario/{id}
    ScenarioListResponse — response from GET /scenario/list
"""

from __future__ import annotations

from typing import List, Optional, Literal
from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class ScenarioInput(BaseModel):
    """Inbound scenario payload. All fields are required."""

    scenario_id: str = Field(..., min_length=1, max_length=100,
                             description="Unique identifier for this scenario.")
    event_type:  str = Field(..., description="Event type (e.g. oil_shock, cyberattack).")
    region:      str = Field(..., description="Affected geographic region.")
    industry:    str = Field(..., description="Target industry sector.")

    direct_impact_score:   float = Field(..., ge=0, le=100,
                                         description="Direct impact severity 0-100.")
    indirect_impact_score: float = Field(..., ge=0, le=100,
                                         description="Indirect/downstream impact severity 0-100.")

    dependency_level:             Literal["low", "medium", "high"]
    hidden_dependency_percentage: float = Field(..., ge=0, le=100,
                                                description="% of supply chain dependencies that are non-transparent.")

    time_to_impact: int = Field(..., ge=0, description="Days until event materializes.")
    recovery_time:  int = Field(..., ge=0, description="Days to full recovery.")

    confidence_score:  float = Field(..., ge=0, le=1,
                                     description="Data confidence/reliability [0-1].")
    manipulation_risk: Literal["low", "medium", "high"]
    policy_impact:     Literal["none", "moderate", "high"]

    model_config = {"json_schema_extra": {"example": {
        "scenario_id":                  "SCN-V2-001",
        "event_type":                   "oil_shock",
        "region":                       "MENA",
        "industry":                     "energy",
        "direct_impact_score":          75,
        "indirect_impact_score":        55,
        "dependency_level":             "high",
        "hidden_dependency_percentage": 60,
        "time_to_impact":               7,
        "recovery_time":                180,
        "confidence_score":             0.65,
        "manipulation_risk":            "low",
        "policy_impact":                "moderate",
    }}}


# ---------------------------------------------------------------------------
# Validation sub-models
# ---------------------------------------------------------------------------

class ValidationFlag(BaseModel):
    code:     str
    severity: Literal["info", "warning", "error"]
    message:  str
    field:    Optional[str] = None


class ValidationSummary(BaseModel):
    validation_score:  float
    validation_status: Literal["valid", "warning", "invalid"]
    flags:             List[ValidationFlag]
    passed:            bool


# ---------------------------------------------------------------------------
# Score sub-model
# ---------------------------------------------------------------------------

class ScoreOutput(BaseModel):
    impact_score:     float
    exposure_score:   float
    temporal_factor:  float
    risk_score:       float
    fragility_score:  float
    final_score:      float
    final_tier:       str
    shocks_triggered: List[dict]
    v2_flags:         dict


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------

class AnalysisResponse(BaseModel):
    """Full result returned by POST /scenario/analyze."""
    stored_id:   str
    scenario_id: str
    created_at:  str
    validation:  dict          # ValidationSummary dict
    scores:      ScoreOutput
    explanation: dict


class StoredScenario(BaseModel):
    """Stored record returned by GET /scenario/{id}."""
    stored_id:         str
    scenario_id:       str
    event_type:        Optional[str]
    region:            Optional[str]
    industry:          Optional[str]
    validation_score:  Optional[float]
    validation_status: Optional[str]
    validation_flags:  Optional[list]
    risk_score:        Optional[float]
    impact_score:      Optional[float]
    exposure_score:    Optional[float]
    temporal_factor:   Optional[float]
    fragility_score:   Optional[float]
    final_score:       Optional[float]
    final_tier:        Optional[str]
    shocks_triggered:  Optional[list]
    v2_flags:          Optional[dict]
    scoring_detail:    Optional[dict]
    created_at:        Optional[str]
    updated_at:        Optional[str]


class ScenarioListResponse(BaseModel):
    scenarios: List[StoredScenario]
    count:     int
    limit:     int
    offset:    int
