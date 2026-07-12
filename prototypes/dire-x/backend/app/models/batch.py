"""
models/batch.py

Pydantic models for the batch analysis endpoint.

POST /batch/analyze accepts a list of ScenarioInput objects and returns
a BatchResponse with per-item outcomes and a summary.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.scenario import ScenarioInput


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class BatchInput(BaseModel):
    """
    Up to 100 scenarios submitted in one request for concurrent analysis.
    """
    scenarios: List[ScenarioInput] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of scenario payloads to analyze (1–100).",
    )

    model_config = {"json_schema_extra": {"example": {
        "scenarios": [
            {
                "scenario_id": "BATCH-001",
                "event_type": "oil_shock",
                "region": "MENA",
                "industry": "energy",
                "direct_impact_score": 75,
                "indirect_impact_score": 55,
                "dependency_level": "high",
                "hidden_dependency_percentage": 60,
                "time_to_impact": 7,
                "recovery_time": 180,
                "confidence_score": 0.65,
                "manipulation_risk": "low",
                "policy_impact": "moderate",
            },
            {
                "scenario_id": "BATCH-002",
                "event_type": "cyberattack",
                "region": "EU",
                "industry": "finance",
                "direct_impact_score": 60,
                "indirect_impact_score": 70,
                "dependency_level": "medium",
                "hidden_dependency_percentage": 45,
                "time_to_impact": 0,
                "recovery_time": 30,
                "confidence_score": 0.80,
                "manipulation_risk": "medium",
                "policy_impact": "high",
            },
        ]
    }}}


# ---------------------------------------------------------------------------
# Per-item result
# ---------------------------------------------------------------------------

class BatchItemResult(BaseModel):
    """Result for a single scenario within a batch."""
    scenario_id: str
    status:      Literal["success", "validation_failed", "error"]
    result:      Optional[dict] = None    # present on success
    error:       Optional[dict] = None    # present on failure
    duration_ms: Optional[float] = None   # wall-clock time for this item


# ---------------------------------------------------------------------------
# Batch summary
# ---------------------------------------------------------------------------

class BatchSummary(BaseModel):
    total:     int
    succeeded: int
    failed:    int
    cached:    int    # items served from score cache (no re-scoring)


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class BatchResponse(BaseModel):
    """Full response from POST /batch/analyze."""
    batch_id:    str
    summary:     BatchSummary
    results:     List[BatchItemResult]
    duration_ms: float
