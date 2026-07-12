-- =============================================================================
-- countries_master: Unified country macroeconomic data table
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query → Paste → Run
-- =============================================================================

CREATE TABLE IF NOT EXISTS countries_master (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT         NOT NULL,
  code         TEXT         NOT NULL,        -- ISO 3166-1 alpha-3 (e.g. "USA")
  code2        TEXT         DEFAULT '',      -- ISO 3166-1 alpha-2 (e.g. "US")
  gdp          NUMERIC,                      -- GDP in USD billions
  population   NUMERIC,                      -- Population in millions
  literacy     NUMERIC,                      -- Adult literacy rate 0-100
  health_index NUMERIC,                      -- Normalized health index 0-100
  growth_rate  NUMERIC,                      -- GDP annual growth %
  gdp_norm     NUMERIC      DEFAULT 0,       -- GDP / maxGDP ratio (0-1)
  eco_score    NUMERIC      DEFAULT 0,       -- Economic strength index 0-100
  demand       NUMERIC      DEFAULT 0,       -- Demand proxy (pop * consumption rate)
  workforce    NUMERIC      DEFAULT 0,       -- Workforce proxy in millions
  region       TEXT         DEFAULT 'Unknown',
  last_updated TIMESTAMPTZ  DEFAULT NOW(),

  CONSTRAINT countries_master_code_key UNIQUE (code)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_countries_master_region
  ON countries_master (region);

CREATE INDEX IF NOT EXISTS idx_countries_master_gdp
  ON countries_master (gdp DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_countries_master_updated
  ON countries_master (last_updated DESC);
