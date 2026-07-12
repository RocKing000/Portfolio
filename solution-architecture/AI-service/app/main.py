"""
FedMithra AI Service — Dynamic Hybrid Search (English)
Port 8000 — BM25 + semantic search via sentence-transformers
"""
import asyncio
import logging
import pickle
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

from app.config import get_settings
from app.database import Database
from app.routers import search as search_router
from app.search.search_engine import HybridSearchEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


def _build_bm25(corpus: List[str], k1: float, b: float) -> Optional[BM25Okapi]:
    try:
        tokenized = [doc.lower().split() for doc in corpus]
        return BM25Okapi(tokenized, k1=k1, b=b)
    except Exception as e:
        logger.error(f"BM25 build failed: {e}")
        return None


def _load_embeddings_matrix(
    errors: List[Dict[str, Any]],
    model: SentenceTransformer,
    batch_size: int,
) -> Optional[np.ndarray]:
    """Load embeddings from DB or generate fresh ones."""
    stored = Database.load_embeddings()
    error_ids = [e['error_id'] for e in errors]
    corpus = [
        ' '.join(filter(None, [
            e.get('error_title', ''),
            e.get('error_description', ''),
            e.get('solution', ''),
            e.get('category', ''),
            e.get('error_code', ''),
        ]))
        for e in errors
    ]

    if stored:
        embs = []
        missing_idx = []
        for i, eid in enumerate(error_ids):
            if eid in stored:
                embs.append(pickle.loads(stored[eid]))
            else:
                missing_idx.append(i)
                embs.append(None)
        if missing_idx:
            logger.info(f"Generating {len(missing_idx)} missing embeddings")
            texts = [corpus[i] for i in missing_idx]
            fresh = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
            for j, i in enumerate(missing_idx):
                embs[i] = fresh[j]
        return np.array(embs)

    # Generate all
    logger.info("Generating all embeddings from scratch")
    all_embs = []
    for i in range(0, len(corpus), batch_size):
        batch = corpus[i:i + batch_size]
        batch_embs = model.encode(batch, show_progress_bar=False, convert_to_numpy=True)
        all_embs.extend(batch_embs)
    matrix = np.array(all_embs)

    # Persist
    if settings.embedding_cache_enabled:
        to_save = [(eid, pickle.dumps(matrix[i])) for i, eid in enumerate(error_ids)]
        Database.save_embeddings_batch(to_save)

    return matrix


def _load_synonyms() -> Dict[str, List[str]]:
    """Load synonym_mappings from DB into a dict keyed by primary_term."""
    try:
        from app.database import Database as DB
        import pymssql
        conn = DB.get_connection()
        cursor = conn.cursor(as_dict=True)
        cursor.execute(
            "SELECT primary_term, synonym_term FROM kb.synonym_mappings WHERE is_active = 1"
        )
        rows = cursor.fetchall()
        conn.close()
        result: Dict[str, List[str]] = {}
        for row in rows:
            pt = row['primary_term'].lower()
            result.setdefault(pt, []).append(row['synonym_term'].lower())
        logger.info(f"Loaded {len(result)} synonym entries")
        return result
    except Exception as e:
        logger.warning(f"Synonym load failed (non-fatal): {e}")
        return {}


def _initialise_engine(app: FastAPI) -> None:
    logger.info("Loading errors from database …")
    errors = Database.load_all_errors("FEDERAL")
    logger.info(f"Loaded {len(errors)} errors")

    corpus = [
        ' '.join(filter(None, [
            e.get('error_title', ''),
            e.get('error_description', ''),
            e.get('solution', ''),
            e.get('category', ''),
            e.get('error_code', ''),
        ]))
        for e in errors
    ]

    bm25 = _build_bm25(corpus, k1=settings.bm25_k1, b=settings.bm25_b)

    from app.config import get_active_embedding_model
    model_name = get_active_embedding_model()
    logger.info(f"Loading embedding model: {model_name}")
    model = SentenceTransformer(model_name)

    embeddings = _load_embeddings_matrix(errors, model, settings.embedding_batch_size)

    synonyms = _load_synonyms()

    engine = HybridSearchEngine(config=settings)
    engine.index(errors=errors, embeddings=embeddings, bm25_index=bm25, synonyms=synonyms)

    # Store on app.state so the router can access them
    app.state.search_engine = engine
    app.state.embedding_model = model

    # Keep backward-compat reference used by old router
    search_router._engine = engine  # type: ignore[attr-defined]

    logger.info("Search engine ready")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info(f"FEDMITHRA AI SERVICE v{settings.service_version} STARTING")
    logger.info("=" * 60)

    try:
        await asyncio.to_thread(_initialise_engine, app)
        logger.info("✅ Search index ready")
    except Exception as e:
        logger.warning(f"⚠️  Search pre-warm failed: {e}", exc_info=True)

    logger.info("SERVICE READY — port 8000")
    logger.info("=" * 60)

    yield

    logger.info("Shutting down FedMithra AI Service")


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="English-only dynamic hybrid search for FedMithra",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router.router)


@app.get("/", tags=["Health"])
@app.get("/health", tags=["Health"])
async def health(request_obj=None):
    from fastapi import Request
    db_status = "connected" if Database.test_connection() else "disconnected"
    engine = getattr(app.state, "search_engine", None)
    return {
        "service":      settings.service_name,
        "version":      settings.service_version,
        "status":       "healthy" if db_status == "connected" else "degraded",
        "database":     db_status,
        "search_ready": engine is not None and len(engine.errors_data) > 0,
        "errors_indexed": len(engine.errors_data) if engine else 0,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(exc), "type": type(exc).__name__},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.api_host, port=settings.api_port, reload=True)
