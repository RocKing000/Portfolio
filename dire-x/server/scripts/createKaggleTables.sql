-- =============================================================================
-- DIRE-X: Extended tables for Kaggle real-world data enrichment
-- Run in Supabase SQL Editor after the base tables exist
-- =============================================================================

-- ─── Kaggle Ingestion Log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kaggle_ingestion_log (
  id           BIGSERIAL PRIMARY KEY,
  dataset_slug TEXT NOT NULL,
  module       TEXT NOT NULL,          -- gdp, minerals, trade, risk, etc.
  rows_parsed  INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  status       TEXT DEFAULT 'pending', -- pending, success, failed
  error_msg    TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ─── Country Economic History (time series from Kaggle) ──────────────────────
CREATE TABLE IF NOT EXISTS country_economics_ts (
  id           BIGSERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,
  year         SMALLINT NOT NULL,
  gdp_usd_b   NUMERIC,           -- GDP in billions USD
  gdp_growth   NUMERIC,           -- Annual GDP growth %
  inflation    NUMERIC,           -- CPI inflation %
  unemployment NUMERIC,           -- Unemployment rate %
  population_m NUMERIC,           -- Population in millions
  public_debt  NUMERIC,           -- Public debt as % of GDP
  trade_balance_b NUMERIC,        -- Trade balance in billions USD
  military_spend_b NUMERIC,       -- Military spending in billions USD
  co2_mt       NUMERIC,           -- CO2 emissions in megatons
  fsi_total    NUMERIC,           -- Fragile State Index total (0-120)
  fsi_security NUMERIC,           -- FSI security apparatus score
  fsi_economy  NUMERIC,           -- FSI economic decline score
  source       TEXT,              -- kaggle dataset slug
  ingested_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (country_code, year)
);

CREATE INDEX IF NOT EXISTS idx_econ_ts_code ON country_economics_ts (country_code);
CREATE INDEX IF NOT EXISTS idx_econ_ts_year ON country_economics_ts (year DESC);

-- ─── Commodity Price History ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commodity_prices_ts (
  id           BIGSERIAL PRIMARY KEY,
  commodity    TEXT NOT NULL,       -- Copper, Nickel, Crude Oil, etc.
  resource_name TEXT,              -- Maps to our resource name
  date         DATE NOT NULL,
  price_usd    NUMERIC NOT NULL,
  unit         TEXT,               -- per tonne, per barrel, etc.
  source       TEXT,
  ingested_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (commodity, date)
);

CREATE INDEX IF NOT EXISTS idx_commodity_name ON commodity_prices_ts (commodity, date DESC);
CREATE INDEX IF NOT EXISTS idx_commodity_resource ON commodity_prices_ts (resource_name);

-- ─── Mining Production by Country ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mining_production (
  id            BIGSERIAL PRIMARY KEY,
  mineral       TEXT NOT NULL,
  resource_name TEXT,              -- Maps to our resource name
  country_code  TEXT NOT NULL,
  country_name  TEXT,
  year          SMALLINT NOT NULL,
  production    NUMERIC,           -- In standard unit (tonnes typically)
  unit          TEXT,
  share_pct     NUMERIC,           -- Share of global production
  source        TEXT,
  ingested_at   TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (mineral, country_code, year)
);

CREATE INDEX IF NOT EXISTS idx_mining_mineral ON mining_production (mineral);
CREATE INDEX IF NOT EXISTS idx_mining_country ON mining_production (country_code);

-- ─── Trade Flow Data ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_flows (
  id             BIGSERIAL PRIMARY KEY,
  reporter_code  TEXT NOT NULL,
  partner_code   TEXT,
  year           SMALLINT NOT NULL,
  export_usd_k   NUMERIC,         -- Exports in thousands USD
  import_usd_k   NUMERIC,         -- Imports in thousands USD
  balance_usd_k  NUMERIC,         -- Trade balance
  product_group  TEXT,             -- Product category
  source         TEXT,
  ingested_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (reporter_code, partner_code, year)
);

CREATE INDEX IF NOT EXISTS idx_trade_reporter ON trade_flows (reporter_code, year DESC);

-- ─── Company Benchmarks (Fortune 500 etc.) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS company_benchmarks (
  id             BIGSERIAL PRIMARY KEY,
  company_name   TEXT NOT NULL,
  direx_company_id UUID,           -- FK to our companies table (nullable)
  fortune_rank   SMALLINT,
  revenue_m      NUMERIC,          -- Revenue in millions USD
  profit_m       NUMERIC,          -- Profit in millions USD
  employees      INTEGER,
  country        TEXT,
  industry       TEXT,
  year           SMALLINT NOT NULL,
  source         TEXT,
  ingested_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (company_name, year)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_company ON company_benchmarks (company_name);

-- ─── Update countries_master: fill literacy and health_index from Kaggle ─────
-- (These columns already exist but are NULL — Kaggle data will populate them)
