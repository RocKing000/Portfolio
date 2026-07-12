-- DIRE-X PostgreSQL Schema
-- Reference file — tables are created automatically by SQLAlchemy on startup.
-- Use this for manual setup, migrations, or documentation.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS scenarios (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id      VARCHAR(100) UNIQUE NOT NULL,

    -- Identifiers
    event_type       VARCHAR(100),
    region           VARCHAR(100),
    industry         VARCHAR(100),

    -- Original payload
    input_data       JSONB        NOT NULL,

    -- Validation engine output
    validation_score  FLOAT,
    validation_status VARCHAR(50),
    validation_flags  JSONB,

    -- Scoring engine output (V2)
    impact_score     FLOAT,
    exposure_score   FLOAT,
    temporal_factor  FLOAT,
    risk_score       FLOAT,
    fragility_score  FLOAT,
    final_score      FLOAT,
    final_tier       VARCHAR(20),

    -- V2 non-linear events
    shocks_triggered JSONB,
    v2_flags         JSONB,

    -- Full explainability
    scoring_detail   JSONB,

    -- Timestamps
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS ix_scenarios_scenario_id ON scenarios (scenario_id);
CREATE INDEX IF NOT EXISTS ix_scenarios_final_tier  ON scenarios (final_tier);
CREATE INDEX IF NOT EXISTS ix_scenarios_created_at  ON scenarios (created_at DESC);

-- Optional: GIN index for full-text search over input_data
-- CREATE INDEX IF NOT EXISTS ix_scenarios_input_gin ON scenarios USING GIN (input_data);
