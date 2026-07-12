"""
api/routes/scenarios.py

FastAPI route handlers for the DIRE-X scenario API.

V2 changes vs original:
    - POST /scenario/analyze uses FastAPI BackgroundTasks so the HTTP response
      is returned immediately after scoring; DB write + cache set run after.
    - GET  /scenario/{id} is served from Redis cache on hit (read-through).
    - GET  /scenario/list unchanged (dynamic queries, no caching).
"""

from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.scenario import ScenarioInput
from app.services import pipeline
from app.utils.errors import (
    ValidationFailedError,
    ScoringError,
    ScenarioNotFoundError,
)

router = APIRouter(prefix="/scenario", tags=["scenarios"])
DBDep  = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# POST /scenario/analyze
# ---------------------------------------------------------------------------

@router.post("/analyze", summary="Validate, score, and store a scenario")
async def analyze_scenario(
    payload:          ScenarioInput,
    background_tasks: BackgroundTasks,
    db:               DBDep,
):
    """
    Full analysis pipeline in a single call.

    **Performance (V2):**
    The HTTP response is returned immediately after scoring. The DB write
    and cache population happen as a background task, reducing p50 latency
    significantly for write-heavy workloads.

    Identical inputs (same field values) are served from Redis cache
    without re-scoring, reducing p99 to a single Redis GET.

    **Steps:**
    1. Validate — plausibility, consistency, business-rule checks
    2. Cache check — return from Redis if input hash matches
    3. Score — DIRE-X V2 engine
    4. Return response (background: store to DB + populate cache)

    **Returns 422** when validation blocks scoring (score < 0.50).
    **Returns 200** for valid and warning scenarios.
    """
    try:
        return await pipeline.analyze(payload.model_dump(), background_tasks)

    except ValidationFailedError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "error":            "VALIDATION_FAILED",
                "message":          "Scenario failed validation. Scoring blocked.",
                "validation_score": exc.validation_score,
                "flags":            exc.flags,
            },
        )
    except ScoringError as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "SCORING_ENGINE_ERROR", "message": str(exc)},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "INTERNAL_ERROR", "message": str(exc)},
        )


# ---------------------------------------------------------------------------
# GET /scenario/list  (defined before /{scenario_id} to avoid route conflict)
# ---------------------------------------------------------------------------

@router.get("/list", summary="List stored scenarios (newest first)")
async def list_scenarios(
    db:     DBDep,
    limit:  int           = Query(default=50,  ge=1, le=200),
    offset: int           = Query(default=0,   ge=0),
    tier:   Optional[str] = Query(default=None,
                                  description="Filter by tier: LOW, MODERATE, HIGH, CRITICAL"),
):
    try:
        records = await pipeline.list_scenarios(db, limit=limit, offset=offset, tier=tier)
        return {"scenarios": records, "count": len(records), "limit": limit, "offset": offset}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "INTERNAL_ERROR", "message": str(exc)},
        )


# ---------------------------------------------------------------------------
# GET /scenario/{scenario_id}
# ---------------------------------------------------------------------------

@router.get("/{scenario_id}", summary="Fetch a stored scenario by ID (cache-first)")
async def get_scenario(scenario_id: str, db: DBDep):
    """
    Retrieve a stored scenario by **scenario_id** string or **UUID**.

    **V2 caching:** result is served from Redis on cache hit (TTL: 1 h),
    falling back to a DB query and populating the cache on miss.
    """
    try:
        return await pipeline.fetch(scenario_id, db)
    except ScenarioNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail={"error": "NOT_FOUND", "message": str(exc)},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "INTERNAL_ERROR", "message": str(exc)},
        )
