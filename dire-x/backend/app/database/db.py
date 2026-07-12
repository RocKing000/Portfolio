"""
database/db.py

SQLAlchemy async setup for DIRE-X.

Provides:
    engine              — async engine (asyncpg driver)
    AsyncSessionLocal   — session factory
    Base                — declarative base for ORM models
    ScenarioORM         — ORM table definition for `scenarios`
    get_db()            — FastAPI dependency yielding an AsyncSession
    init_db()           — creates tables on startup (idempotent)
"""

import os
import uuid
from typing import AsyncGenerator

from sqlalchemy import (
    Column, String, Float, DateTime, JSON, func, Index,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import (
    create_async_engine, AsyncSession, async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:password@localhost:5432/direx",
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ---------------------------------------------------------------------------
# ORM base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# scenarios table
# ---------------------------------------------------------------------------

class ScenarioORM(Base):
    """
    Stores every scenario that passes validation and is scored.

    input_data      — original JSON payload as submitted
    validation_*    — output of the validation engine
    *_score / tier  — output of the scoring engine (V2)
    scoring_detail  — full explainability dict from the scorer
    shocks_triggered — V2 threshold shock events that fired
    v2_flags         — boolean summary of V2 non-linear events
    """
    __tablename__ = "scenarios"

    id              = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id     = Column(String(100), unique=True, nullable=False)

    # Identifiers
    event_type  = Column(String(100))
    region      = Column(String(100))
    industry    = Column(String(100))

    # Raw input
    input_data  = Column(JSON, nullable=False)

    # Validation
    validation_score  = Column(Float)
    validation_status = Column(String(50))
    validation_flags  = Column(JSON)

    # Scores
    impact_score    = Column(Float)
    exposure_score  = Column(Float)
    temporal_factor = Column(Float)
    risk_score      = Column(Float)
    fragility_score = Column(Float)
    final_score     = Column(Float)
    final_tier      = Column(String(20))

    # V2 non-linear events
    shocks_triggered = Column(JSON)
    v2_flags         = Column(JSON)

    # Full explainability
    scoring_detail = Column(JSON)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                        onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_scenarios_scenario_id", "scenario_id"),
        Index("ix_scenarios_final_tier",  "final_tier"),
        Index("ix_scenarios_created_at",  "created_at"),
    )


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async DB session; roll back on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

async def init_db() -> None:
    """Create all tables if they don't exist. Safe to call on every startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
