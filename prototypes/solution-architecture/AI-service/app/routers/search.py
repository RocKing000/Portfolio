import asyncio
import time
import logging
from datetime import datetime, timezone
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import get_settings
from app.search_models import (
    SearchRequest, SearchResponse, ErrorResult,
    SearchDiagnostic, SearchSuggestions, CorrectionEntry, ExpansionEntry,
)

router = APIRouter(tags=["Search"])
logger = logging.getLogger(__name__)
settings = get_settings()

# Backward-compat reference set by main.py at startup
_engine = None


def _get_engine(request: Request):
    engine = getattr(request.app.state, "search_engine", None) or _engine
    if engine is None:
        raise HTTPException(status_code=503, detail="Search engine not ready")
    return engine


def _get_model(request: Request):
    return getattr(request.app.state, "embedding_model", None)


async def _encode_query(model, query: str) -> Optional[np.ndarray]:
    if model is None:
        return None
    return await asyncio.to_thread(model.encode, query, False, True)


def _build_error_results(engine, results):
    out = []
    for error_id, score in results:
        error = engine.get_error_by_id(error_id)
        if error is None:
            continue
        kw = error.get('auto_keywords')
        if isinstance(kw, str):
            import json
            try:
                kw = json.loads(kw)
            except Exception:
                kw = None
        out.append(ErrorResult(
            error_id=error['error_id'],
            error_code=error['error_code'],
            error_title=error['error_title'],
            error_description=error.get('error_description') or '',
            solution=error.get('solution') or '',
            root_cause=error.get('root_cause'),
            severity=error['severity'],
            category=error.get('category') or '',
            similarity_score=round(score, 4),
            module_name=error.get('module_name'),
            product_name=error.get('product_name'),
            auto_keywords=kw,
            search_impressions=error.get('search_impressions', 0),
            search_clicks=error.get('search_clicks', 0),
            click_through_rate=error.get('click_through_rate', 0.0),
            avg_result_position=error.get('avg_result_position'),
        ))
    return out


async def _run_search(engine, model, query: str, top_n: int):
    """
    Encodes the query embedding (async, off main thread) then runs the
    synchronous search pipeline.
    """
    embedding = await _encode_query(model, query)
    if embedding is not None:
        engine.set_query_embedding(embedding)
    else:
        engine.set_query_embedding(None)

    return await asyncio.to_thread(engine.search, query, top_n)


def _parse_diagnostic(raw: dict) -> SearchDiagnostic:
    return SearchDiagnostic(
        raw_query=raw["raw_query"],
        processed_query=raw["processed_query"],
        corrected_query=raw["corrected_query"],
        expanded_query=raw["expanded_query"],
        input_type=raw["input_type"],
        corrections=[CorrectionEntry(**c) for c in raw.get("corrections", [])],
        expansions=[ExpansionEntry(**e) for e in raw.get("expansions", [])],
        arms_executed=raw.get("arms_executed", []),
        arms_failed=raw.get("arms_failed", []),
        bm25_weight=raw["bm25_weight"],
        semantic_weight=raw["semantic_weight"],
        rrf_k=raw["rrf_k"],
        total_candidates=raw["total_candidates"],
        results_returned=raw["results_returned"],
        low_confidence=raw.get("low_confidence", False),
        no_match=raw.get("no_match", False),
        no_match_reason=raw.get("no_match_reason"),
        processing_ms=raw["processing_ms"],
    )


def _parse_suggestions(raw: Optional[dict]) -> Optional[SearchSuggestions]:
    if raw is None:
        return None
    return SearchSuggestions(
        did_you_mean=raw.get("did_you_mean", []),
        try_keywords=raw.get("try_keywords", []),
        input_received=raw.get("input_received", ""),
    )


@router.post("/search", response_model=SearchResponse, tags=["Search"])
async def search_errors(request: SearchRequest, http_request: Request):
    start_time = time.time()
    try:
        engine = _get_engine(http_request)
        model = _get_model(http_request)

        outcome = await _run_search(engine, model, request.query, request.max_results)

        raw_results = outcome["results"]
        diagnostic_raw = outcome["diagnostic"]
        suggestions_raw = outcome.get("suggestions")

        error_results = _build_error_results(engine, raw_results)
        diagnostic = _parse_diagnostic(diagnostic_raw)
        suggestions = _parse_suggestions(suggestions_raw)

        return SearchResponse(
            success=True,
            results=error_results,
            query=request.query,
            total_results=len(error_results),
            processing_time_ms=(time.time() - start_time) * 1000,
            cached=False,
            search_method=request.search_method or "HYBRID",
            query_expansion_used=len(diagnostic_raw.get("expansions", [])) > 0,
            expanded_terms=[
                t for e in diagnostic_raw.get("expansions", [])
                for t in e.get("expanded_to", [])
            ],
            search_diagnostic=diagnostic,
            suggestions=suggestions,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


class _V2SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    tenantCode: str = Field(default="FEDERAL", alias="tenantCode")
    tenant_code: Optional[str] = Field(default=None)
    top_n: int = Field(default=5, ge=1, le=50)

    def resolved_tenant(self) -> str:
        return self.tenantCode or self.tenant_code or "FEDERAL"

    class Config:
        populate_by_name = True


@router.post("/api/v2/search", tags=["Search"])
async def search_v2(request: _V2SearchRequest, http_request: Request):
    start_time = time.time()
    try:
        engine = _get_engine(http_request)
        model = _get_model(http_request)

        outcome = await _run_search(engine, model, request.query, request.top_n)

        raw_results = outcome["results"]
        diagnostic_raw = outcome["diagnostic"]
        suggestions_raw = outcome.get("suggestions")

        data = []
        for error_id, score in raw_results:
            error = engine.get_error_by_id(error_id)
            if error is None:
                continue
            data.append({
                "errorId":          error["error_id"],
                "errorCode":        error["error_code"],
                "errorTitle":       error["error_title"],
                "errorDescription": error.get("error_description") or "",
                "solution":         error.get("solution") or "",
                "rootCause":        error.get("root_cause"),
                "severity":         error["severity"],
                "category":         error.get("category") or "",
                "similarityScore":  round(score, 4),
                "moduleName":       error.get("module_name"),
                "productName":      error.get("product_name"),
            })

        corrected = diagnostic_raw.get("corrected_query", request.query)
        elapsed = (time.time() - start_time) * 1000
        logger.info(
            f"[v2] '{request.query}' → '{corrected}' → {len(data)} results ({elapsed:.0f}ms)"
        )

        return {
            "success":          True,
            "data":             data,
            "message":          f"Found {len(data)} result(s)" + (
                f" (interpreted as: '{corrected}')" if corrected != request.query else ""
            ),
            "corrected_query":  corrected if corrected != request.query else None,
            "timestamp":        datetime.now(timezone.utc).isoformat(),
            "search_diagnostic": diagnostic_raw,
            "suggestions":      suggestions_raw,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"v2 search error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/reload-cache", tags=["Admin"])
async def reload_cache(http_request: Request, tenant_code: Optional[str] = None):
    try:
        from app.main import _initialise_engine
        await asyncio.to_thread(_initialise_engine, http_request.app)
        return {
            "success": True,
            "message": f"Search index reloaded for tenant: {tenant_code or 'FEDERAL'}",
            "timestamp": time.time(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reload failed: {str(e)}")
