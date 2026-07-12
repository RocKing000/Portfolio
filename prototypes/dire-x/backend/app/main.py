"""
main.py

DIRE-X Backend — FastAPI application entry point.

V2 additions:
    - Redis connected on startup, disconnected on shutdown
    - GZipMiddleware for large JSON responses (>1 KB)
    - /health includes Redis and scoring engine status
    - Batch router mounted at /batch

Run:
    cd dire-x/backend
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import sys
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Path setup — must happen before local imports
# ---------------------------------------------------------------------------
# dire-x/backend/app/main.py  ->  ../.. = dire-x/
_DIREX_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _DIREX_ROOT not in sys.path:
    sys.path.insert(0, _DIREX_ROOT)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

LOG_LEVEL = os.getenv("LOG_LEVEL", "info").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("dire-x")

REDIS_URL  = os.getenv("REDIS_URL", "redis://localhost:6379/0")
APP_HOST   = os.getenv("APP_HOST", "0.0.0.0")
APP_PORT   = int(os.getenv("APP_PORT", "8000"))

# ---------------------------------------------------------------------------
# Local imports (after path setup)
# ---------------------------------------------------------------------------
from app.database.db import init_db, engine
from app.services.cache import cache
from app.services.scoring_engine import is_available as engine_available
from app.api.routes.scenarios import router as scenario_router
from app.api.routes.batch import router as batch_router


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("DIRE-X backend starting up...")

    # Connect Redis (non-fatal if unavailable)
    await cache.connect(REDIS_URL)
    redis_status = "connected" if cache.connected else "unavailable"
    logger.info(f"Redis: {redis_status}")

    # Ensure DB tables exist
    await init_db()
    logger.info("Database ready.")

    logger.info(f"Scoring engine (V2): {'available' if engine_available() else 'UNAVAILABLE'}")
    logger.info(f"Listening on {APP_HOST}:{APP_PORT}")

    yield

    logger.info("DIRE-X backend shutting down.")
    await cache.disconnect()
    await engine.dispose()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="DIRE-X Backend API",
    description=(
        "Supply chain disruption risk analysis platform. "
        "Validates, scores, and stores scenario assessments using the DIRE-X V2 engine. "
        "Supports single-scenario and batch (up to 100) concurrent processing with Redis caching."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# GZip: compress responses larger than 1 KB (helps with large explanation blobs)
app.add_middleware(GZipMiddleware, minimum_size=1024)

# CORS — restrict allow_origins in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(scenario_router)
app.include_router(batch_router)


# ---------------------------------------------------------------------------
# System endpoints
# ---------------------------------------------------------------------------

@app.get("/health", tags=["system"], summary="Health check")
async def health():
    """
    Returns service liveness plus the status of Redis and the scoring engine.
    A healthy system shows `redis: connected` and `scoring_engine: v2`.
    """
    return {
        "status":         "ok",
        "service":        "dire-x-backend",
        "version":        "2.0.0",
        "scoring_engine": "v2"          if engine_available() else "unavailable",
        "redis":          "connected"   if await cache.ping() else "disconnected",
    }


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error [{request.method} {request.url}]: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error":   "INTERNAL_ERROR",
            "message": "An unexpected error occurred. Check server logs.",
        },
    )
