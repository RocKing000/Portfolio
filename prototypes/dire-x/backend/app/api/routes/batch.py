"""
api/routes/batch.py

POST /batch/analyze — concurrent batch scenario analysis.

Design:
    - Accepts 1–100 ScenarioInput objects in a single request.
    - Processes them concurrently with asyncio.gather + a Semaphore to bound
      peak parallelism (default: BATCH_CONCURRENCY = 8).
    - Each scenario item creates its own DB session to avoid session-sharing
      conflicts across concurrent coroutines.
    - Failures are per-item: one scenario failing does NOT abort the batch.
    - Score cache is checked per item — identical inputs skip re-scoring.
    - Returns a BatchResponse with per-item outcomes and a top-level summary.

Concurrency model:
    asyncio.gather allows all items to progress concurrently on the single
    event loop thread. The main gains are:
        - DB writes (asyncpg) run concurrently for all items.
        - Redis reads/writes run concurrently for all items.
        - Scoring (pure Python CPU) is sequential behind the GIL but yields
          control at every DB/Redis await, so items interleave efficiently.

    The Semaphore caps how many items are actively scoring+writing at once,
    preventing connection pool exhaustion on large batches.
"""

import asyncio
import time
import uuid as _uuid_mod
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.batch import BatchInput, BatchResponse, BatchItemResult, BatchSummary
from app.models.scenario import ScenarioInput
from app.services import pipeline
from app.utils.errors import ValidationFailedError, ScoringError

router   = APIRouter(prefix="/batch", tags=["batch"])
DBDep    = Annotated[AsyncSession, Depends(get_db)]

# ---------------------------------------------------------------------------
# Concurrency limit
# ---------------------------------------------------------------------------

BATCH_CONCURRENCY = 8   # max simultaneous in-flight scenarios


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/analyze", summary="Concurrent batch scenario analysis (1–100 scenarios)")
async def batch_analyze(payload: BatchInput):
    """
    Submit up to **100 scenarios** for concurrent analysis.

    Each scenario goes through the full pipeline (validate → score → store).
    Results are returned as soon as all items complete.

    **Per-item status values:**
    - `success`           — scored and stored
    - `validation_failed` — failed validation gates (not scored)
    - `error`             — unexpected scoring or DB error

    Cache hits are noted in `summary.cached` — identical inputs are not
    re-scored, they are returned directly from Redis.
    """
    batch_id  = str(_uuid_mod.uuid4())
    semaphore = asyncio.Semaphore(BATCH_CONCURRENCY)
    t_start   = time.monotonic()
    cache_hits = 0
    cache_lock = asyncio.Lock()

    async def _process_one(item: ScenarioInput) -> BatchItemResult:
        nonlocal cache_hits
        scenario_dict = item.model_dump()
        t0 = time.monotonic()

        async with semaphore:
            try:
                result, was_cached = await pipeline.analyze_batch_item(scenario_dict)
                if was_cached:
                    async with cache_lock:
                        cache_hits += 1
                return BatchItemResult(
                    scenario_id=scenario_dict["scenario_id"],
                    status="success",
                    result=result,
                    duration_ms=round((time.monotonic() - t0) * 1000, 1),
                )

            except ValidationFailedError as exc:
                return BatchItemResult(
                    scenario_id=scenario_dict["scenario_id"],
                    status="validation_failed",
                    error={
                        "validation_score": exc.validation_score,
                        "flags":            exc.flags,
                    },
                    duration_ms=round((time.monotonic() - t0) * 1000, 1),
                )

            except (ScoringError, Exception) as exc:
                return BatchItemResult(
                    scenario_id=scenario_dict["scenario_id"],
                    status="error",
                    error={"message": str(exc)},
                    duration_ms=round((time.monotonic() - t0) * 1000, 1),
                )

    # Kick off all items concurrently; gather preserves order
    item_results: list[BatchItemResult] = await asyncio.gather(
        *[_process_one(s) for s in payload.scenarios]
    )

    succeeded = sum(1 for r in item_results if r.status == "success")
    failed    = len(item_results) - succeeded

    return BatchResponse(
        batch_id=batch_id,
        summary=BatchSummary(
            total=len(item_results),
            succeeded=succeeded,
            failed=failed,
            cached=cache_hits,
        ),
        results=item_results,
        duration_ms=round((time.monotonic() - t_start) * 1000, 1),
    )
