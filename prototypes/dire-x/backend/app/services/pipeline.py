"""
services/pipeline.py

Orchestrates the full analysis pipeline:
    validate -> (cache check) -> score -> store -> (cache set) -> return

V2 additions vs original pipeline:
    - Score cache:   identical inputs are returned from Redis without re-scoring.
    - Record cache:  GET /scenario/{id} is served from Redis on cache hit.
    - Background persist: single-scenario analyze() stores to DB via a
      FastAPI BackgroundTask so the HTTP response is returned immediately
      after scoring. A pre-generated UUID means stored_id is known upfront.
    - analyze_batch_item(): self-contained variant that creates its own
      AsyncSession — required for safe concurrent use in asyncio.gather.
    - Upsert via INSERT ON CONFLICT: eliminates the SELECT-then-insert
      pattern, halving DB round-trips on new records.

Public functions:
    analyze(scenario_dict, background_tasks)     -> dict
    analyze_batch_item(scenario_dict)            -> (dict, bool)   # (result, was_cached)
    fetch(scenario_id, db)                       -> dict
    list_scenarios(db, limit, offset, tier)      -> list[dict]
"""

import logging
import uuid as _uuid_mod
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import BackgroundTasks
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services import validation_engine, scoring_engine
from app.services.cache import cache
from app.database.db import ScenarioORM, AsyncSessionLocal
from app.utils.errors import (
    ValidationFailedError,
    ScenarioNotFoundError,
)

logger = logging.getLogger("dire-x.pipeline")


# ---------------------------------------------------------------------------
# Single-scenario analysis  (used by POST /scenario/analyze)
# ---------------------------------------------------------------------------

async def analyze(
    scenario_dict:    dict,
    background_tasks: Optional[BackgroundTasks] = None,
) -> dict:
    """
    Full analysis pipeline for a single scenario.

    DB write is dispatched as a BackgroundTask (if provided) so the HTTP
    response is returned immediately after scoring. The stored_id is
    pre-generated as a UUID so it can be included in the response without
    waiting for the insert to complete.

    If no background_tasks is provided (e.g. called from a test or batch
    helper) the DB write is awaited synchronously.

    Score cache:
        If Redis holds a result for this exact input hash, scoring is
        skipped entirely. A fresh DB upsert is still dispatched in the
        background so the record stays current.

    Args:
        scenario_dict:    raw scenario dict from the API layer
        background_tasks: FastAPI BackgroundTasks injected by the route

    Returns:
        Full analysis response dict.

    Raises:
        ValidationFailedError: scenario validation score < 0.50
        ScoringError:          scoring engine failure
    """
    # ── Step 1: Validate ────────────────────────────────────────────────────
    val_result = validation_engine.validate(scenario_dict)
    if not val_result.passed:
        raise ValidationFailedError(
            flags=[
                {"code": f.code, "severity": f.severity,
                 "message": f.message, "field": f.field}
                for f in val_result.flags
            ],
            validation_score=val_result.validation_score,
        )

    # ── Step 2: Score cache check ────────────────────────────────────────────
    cached = await cache.get_score(scenario_dict)
    if cached:
        logger.debug(f"Score cache hit: {scenario_dict.get('scenario_id')}")
        # Still persist in background to keep DB current
        if background_tasks:
            background_tasks.add_task(
                _background_persist,
                scenario_dict, val_result, cached.get("_score_result", {}),
                cached["stored_id"],
            )
        return {k: v for k, v in cached.items() if not k.startswith("_")}

    # ── Step 3: Score ────────────────────────────────────────────────────────
    score_result = scoring_engine.score(scenario_dict)

    # ── Step 4: Build response (pre-generate ID) ────────────────────────────
    stored_id = str(_uuid_mod.uuid4())
    response  = _build_response(stored_id, scenario_dict, val_result, score_result)

    # ── Step 5: Persist + cache ─────────────────────────────────────────────
    # Store the raw score_result alongside the response in cache (prefixed _)
    # so a cache hit can still re-persist without re-scoring.
    cache_payload = {**response, "_score_result": score_result}

    if background_tasks:
        background_tasks.add_task(
            _background_persist_and_cache,
            scenario_dict, val_result, score_result, stored_id, cache_payload,
        )
    else:
        async with AsyncSessionLocal() as db:
            await _upsert(db, scenario_dict, val_result, score_result, stored_id)
        await cache.set_score(scenario_dict, cache_payload)

    return response


# ---------------------------------------------------------------------------
# Batch item  (used by POST /batch/analyze — creates its own session)
# ---------------------------------------------------------------------------

async def analyze_batch_item(scenario_dict: dict) -> Tuple[dict, bool]:
    """
    Self-contained analysis pipeline for use in asyncio.gather.

    Creates its own AsyncSession so concurrent batch items don't share
    a session (SQLAlchemy AsyncSession is not concurrency-safe).

    Returns:
        (result_dict, was_cached)
    """
    # ── Validate ─────────────────────────────────────────────────────────────
    val_result = validation_engine.validate(scenario_dict)
    if not val_result.passed:
        raise ValidationFailedError(
            flags=[
                {"code": f.code, "severity": f.severity,
                 "message": f.message, "field": f.field}
                for f in val_result.flags
            ],
            validation_score=val_result.validation_score,
        )

    # ── Score cache check ─────────────────────────────────────────────────────
    cached = await cache.get_score(scenario_dict)
    if cached:
        logger.debug(f"[batch] Score cache hit: {scenario_dict.get('scenario_id')}")
        clean = {k: v for k, v in cached.items() if not k.startswith("_")}
        # Still upsert to keep DB current
        async with AsyncSessionLocal() as db:
            await _upsert(
                db, scenario_dict, val_result,
                cached.get("_score_result", {}),
                cached["stored_id"],
            )
        return clean, True

    # ── Score ─────────────────────────────────────────────────────────────────
    score_result = scoring_engine.score(scenario_dict)
    stored_id    = str(_uuid_mod.uuid4())
    response     = _build_response(stored_id, scenario_dict, val_result, score_result)
    cache_payload = {**response, "_score_result": score_result}

    # ── Persist + cache ───────────────────────────────────────────────────────
    async with AsyncSessionLocal() as db:
        await _upsert(db, scenario_dict, val_result, score_result, stored_id)

    await cache.set_score(scenario_dict, cache_payload)

    return response, False


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

async def fetch(scenario_id: str, db: AsyncSession) -> dict:
    """
    Fetch a stored scenario by scenario_id string or UUID.

    Read-through cache: checks Redis first, falls back to DB, then caches
    the DB result for subsequent reads.

    Raises:
        ScenarioNotFoundError: no matching record
    """
    # ── Cache check ───────────────────────────────────────────────────────────
    cached_record = await cache.get_record(scenario_id)
    if cached_record:
        logger.debug(f"Record cache hit: {scenario_id}")
        return cached_record

    # ── DB lookup ─────────────────────────────────────────────────────────────
    try:
        uid  = _uuid_mod.UUID(scenario_id)
        stmt = select(ScenarioORM).where(ScenarioORM.id == uid)
    except ValueError:
        stmt = select(ScenarioORM).where(ScenarioORM.scenario_id == scenario_id)

    result = await db.execute(stmt)
    record = result.scalar_one_or_none()

    if record is None:
        raise ScenarioNotFoundError(f"Scenario '{scenario_id}' not found.")

    record_dict = _orm_to_dict(record)

    # ── Populate cache ────────────────────────────────────────────────────────
    await cache.set_record(scenario_id, record_dict)

    return record_dict


async def list_scenarios(
    db:     AsyncSession,
    limit:  int          = 50,
    offset: int          = 0,
    tier:   Optional[str] = None,
) -> list:
    """
    Return stored scenarios ordered by created_at DESC.
    Optionally filter by final_tier.
    """
    stmt = select(ScenarioORM).order_by(ScenarioORM.created_at.desc())
    if tier:
        stmt = stmt.where(ScenarioORM.final_tier == tier.upper())
    stmt    = stmt.limit(limit).offset(offset)
    result  = await db.execute(stmt)
    records = result.scalars().all()
    return [_orm_to_dict(r) for r in records]


# ---------------------------------------------------------------------------
# Background task helpers
# ---------------------------------------------------------------------------

async def _background_persist(
    scenario_dict: dict,
    val_result,
    score_result:  dict,
    stored_id:     str,
) -> None:
    """Persist scenario to DB in the background (no cache update)."""
    async with AsyncSessionLocal() as db:
        try:
            await _upsert(db, scenario_dict, val_result, score_result, stored_id)
        except Exception as exc:
            logger.error(
                f"Background persist failed [{scenario_dict.get('scenario_id')}]: {exc}"
            )


async def _background_persist_and_cache(
    scenario_dict: dict,
    val_result,
    score_result:  dict,
    stored_id:     str,
    cache_payload: dict,
) -> None:
    """Persist to DB and populate the score cache, both in the background."""
    async with AsyncSessionLocal() as db:
        try:
            await _upsert(db, scenario_dict, val_result, score_result, stored_id)
        except Exception as exc:
            logger.error(
                f"Background persist failed [{scenario_dict.get('scenario_id')}]: {exc}"
            )
            return   # don't cache if DB write failed

    try:
        await cache.set_score(scenario_dict, cache_payload)
        await cache.set_record(scenario_dict["scenario_id"], {
            k: v for k, v in cache_payload.items() if not k.startswith("_")
        })
    except Exception as exc:
        logger.warning(f"Background cache set failed: {exc}")


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

async def _upsert(
    db:            AsyncSession,
    scenario_dict: dict,
    val_result,
    score_result:  dict,
    stored_id:     str,
) -> None:
    """
    INSERT ... ON CONFLICT (scenario_id) DO UPDATE.
    Single round-trip; no prior SELECT needed.
    The pre-generated stored_id is used only for brand-new rows.
    """
    tier = (
        score_result
        .get("explanation", {})
        .get("risk_breakdown", {})
        .get("final_tier", "")
    )
    val_flags = [
        {"code": f.code, "severity": f.severity,
         "message": f.message, "field": f.field}
        for f in val_result.flags
    ]

    values = dict(
        id               = _uuid_mod.UUID(stored_id),
        scenario_id      = scenario_dict["scenario_id"],
        event_type       = scenario_dict.get("event_type"),
        region           = scenario_dict.get("region"),
        industry         = scenario_dict.get("industry"),
        input_data       = scenario_dict,
        validation_score  = val_result.validation_score,
        validation_status = val_result.validation_status,
        validation_flags  = val_flags,
        impact_score     = score_result.get("impact_score"),
        exposure_score   = score_result.get("exposure_score"),
        temporal_factor  = score_result.get("temporal_factor"),
        risk_score       = score_result.get("risk_score"),
        fragility_score  = score_result.get("fragility_score"),
        final_score      = score_result.get("final_score"),
        final_tier       = tier,
        shocks_triggered = score_result.get("shocks_triggered", []),
        v2_flags         = score_result.get("v2_flags", {}),
        scoring_detail   = score_result.get("explanation", {}),
    )

    stmt = (
        pg_insert(ScenarioORM)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["scenario_id"],
            set_={
                k: values[k]
                for k in values
                if k not in ("id", "scenario_id")
            },
        )
    )
    await db.execute(stmt)
    await db.commit()


def _build_response(
    stored_id:     str,
    scenario_dict: dict,
    val_result,
    score_result:  dict,
) -> dict:
    """Construct the unified API response dict."""
    tier = (
        score_result
        .get("explanation", {})
        .get("risk_breakdown", {})
        .get("final_tier", "")
    )
    return {
        "stored_id":   stored_id,
        "scenario_id": scenario_dict["scenario_id"],
        "created_at":  datetime.now(timezone.utc).isoformat(),
        "validation":  val_result.to_dict(),
        "scores": {
            "impact_score":     score_result.get("impact_score"),
            "exposure_score":   score_result.get("exposure_score"),
            "temporal_factor":  score_result.get("temporal_factor"),
            "risk_score":       score_result.get("risk_score"),
            "fragility_score":  score_result.get("fragility_score"),
            "final_score":      score_result.get("final_score"),
            "final_tier":       tier,
            "shocks_triggered": score_result.get("shocks_triggered", []),
            "v2_flags":         score_result.get("v2_flags", {}),
        },
        "explanation": score_result.get("explanation", {}),
    }


def _orm_to_dict(record: ScenarioORM) -> dict:
    return {
        "stored_id":         str(record.id),
        "scenario_id":       record.scenario_id,
        "event_type":        record.event_type,
        "region":            record.region,
        "industry":          record.industry,
        "validation_score":  record.validation_score,
        "validation_status": record.validation_status,
        "validation_flags":  record.validation_flags,
        "risk_score":        record.risk_score,
        "impact_score":      record.impact_score,
        "exposure_score":    record.exposure_score,
        "temporal_factor":   record.temporal_factor,
        "fragility_score":   record.fragility_score,
        "final_score":       record.final_score,
        "final_tier":        record.final_tier,
        "shocks_triggered":  record.shocks_triggered,
        "v2_flags":          record.v2_flags,
        "scoring_detail":    record.scoring_detail,
        "created_at":        record.created_at.isoformat() if record.created_at else None,
        "updated_at":        record.updated_at.isoformat() if record.updated_at else None,
    }
