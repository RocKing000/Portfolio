-- =============================================================================
-- DIRE-X Data Product Layer — Database Schema
-- Extends existing schema.sql without modifying any existing tables.
-- Run after the main schema.sql has been applied.
-- =============================================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE api_tier AS ENUM ('starter', 'professional', 'enterprise', 'oem');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE exposure_level AS ENUM ('Low', 'Medium', 'High', 'Critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE policy_impact_level AS ENUM ('None', 'Moderate', 'High');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE manipulation_risk_level AS ENUM ('Low', 'Medium', 'High');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trust_tier AS ENUM ('synthetic', 'validated', 'live_calibrated', 'expert_reviewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE source_type AS ENUM ('synthetic', 'validated', 'live');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── API Keys ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash        VARCHAR(64) UNIQUE NOT NULL,   -- SHA-256 hex of raw key, never store plaintext
  key_prefix      VARCHAR(8) NOT NULL,           -- first 8 chars of raw key for display (e.g. "dx_live_")
  owner_email     VARCHAR(256) NOT NULL,
  owner_name      VARCHAR(256),
  tier            api_tier NOT NULL DEFAULT 'starter',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Rate limits (requests per hour, -1 = unlimited)
  rate_limit_per_hour    INTEGER NOT NULL DEFAULT 500,
  -- Monthly simulate-scenario calls (-1 = unlimited)
  simulate_quota_monthly INTEGER NOT NULL DEFAULT 0,
  -- Max suppliers in validate-exposure (-1 = unlimited)
  validate_exposure_limit INTEGER NOT NULL DEFAULT 0,

  -- Billing
  stripe_customer_id  VARCHAR(64),
  stripe_sub_id       VARCHAR(64),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ  -- NULL = never expires
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_email ON api_keys(owner_email);

-- ─── Usage Logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id              BIGSERIAL PRIMARY KEY,
  api_key_id      UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint        VARCHAR(128) NOT NULL,
  method          VARCHAR(8) NOT NULL,
  status_code     SMALLINT NOT NULL,
  response_ms     INTEGER,
  request_body    JSONB,                        -- sanitized, no PII
  ip_hash         VARCHAR(64),                  -- hashed client IP
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_key_time ON api_usage_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_endpoint  ON api_usage_logs(endpoint, created_at DESC);

-- Rate limit counters (rolling 1-hour windows, in-memory preferred; this is the durable fallback)
CREATE TABLE IF NOT EXISTS api_rate_limit_counters (
  api_key_id   UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  call_count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_id, window_start)
);

-- ─── Data Product Scenarios ───────────────────────────────────────────────────
-- Separate from the game's `scenarios` table (which tracks active game scenarios).
-- This is the sellable dataset — the 100-scenario catalog and all future additions.

CREATE TABLE IF NOT EXISTS dp_scenarios (
  -- Identity
  scenario_id       VARCHAR(16) PRIMARY KEY,               -- SCN-001, SCN-DYN-20260601-001
  scenario_version  SMALLINT NOT NULL DEFAULT 1,

  -- Classification
  event_type        VARCHAR(64) NOT NULL,
  event_subtype     VARCHAR(64),
  region            VARCHAR(64) NOT NULL,
  country_codes     TEXT[],                                 -- ISO 3166-1 array
  industry          VARCHAR(64) NOT NULL,
  industry_code     VARCHAR(16),                           -- NAICS-aligned

  -- Trigger
  trigger_condition TEXT,
  trigger_date      DATE,                                   -- NULL = hypothetical

  -- Scores
  company_exposure_level  exposure_level NOT NULL DEFAULT 'Medium',
  direct_impact_score     SMALLINT NOT NULL CHECK (direct_impact_score BETWEEN 0 AND 100),
  indirect_impact_score   SMALLINT NOT NULL CHECK (indirect_impact_score BETWEEN 0 AND 100),
  risk_score              SMALLINT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  confidence_score        NUMERIC(4,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),

  -- Timeline
  time_to_impact_days   INTEGER NOT NULL DEFAULT 0,
  recovery_time_days    INTEGER NOT NULL,

  -- Hidden dependency
  hidden_dependency_pct  SMALLINT NOT NULL CHECK (hidden_dependency_pct BETWEEN 0 AND 100),

  -- Policy + manipulation
  policy_impact       policy_impact_level NOT NULL DEFAULT 'None',
  manipulation_risk   manipulation_risk_level NOT NULL DEFAULT 'Low',

  -- Financial
  financial_impact_usd  BIGINT,

  -- Text
  scenario_notes      TEXT,
  score_explanation   TEXT,
  assumption_manifest JSONB,                               -- key assumptions + exclusions

  -- Trust
  trust_tier          trust_tier NOT NULL DEFAULT 'synthetic',
  source_type         source_type NOT NULL DEFAULT 'synthetic',
  is_live             BOOLEAN NOT NULL DEFAULT FALSE,

  -- Validation
  comparable_real_events  TEXT[],                          -- e.g. ['CN gallium ban 2023']
  validation_accuracy_pct NUMERIC(4,1),                    -- NULL until backtested

  -- Relations (denormalized for query speed)
  affected_companies  TEXT[],                              -- company names
  affected_resources  TEXT[],                              -- resource names

  -- Metadata
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dp_scenarios_event_type   ON dp_scenarios(event_type);
CREATE INDEX IF NOT EXISTS idx_dp_scenarios_region       ON dp_scenarios(region);
CREATE INDEX IF NOT EXISTS idx_dp_scenarios_industry     ON dp_scenarios(industry);
CREATE INDEX IF NOT EXISTS idx_dp_scenarios_risk_score   ON dp_scenarios(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_dp_scenarios_is_live      ON dp_scenarios(is_live) WHERE is_live = TRUE;
CREATE INDEX IF NOT EXISTS idx_dp_scenarios_trust_tier   ON dp_scenarios(trust_tier);
-- Full-text search on notes
CREATE INDEX IF NOT EXISTS idx_dp_scenarios_fts ON dp_scenarios
  USING GIN(to_tsvector('english', COALESCE(scenario_notes,'') || ' ' || COALESCE(trigger_condition,'')));

-- ─── Cascade Phases ───────────────────────────────────────────────────────────
-- Time-phased impact records for each scenario.

CREATE TABLE IF NOT EXISTS dp_cascade_phases (
  id              BIGSERIAL PRIMARY KEY,
  scenario_id     VARCHAR(16) NOT NULL REFERENCES dp_scenarios(scenario_id) ON DELETE CASCADE,
  phase_label     VARCHAR(24) NOT NULL,         -- 'day_1', 'week_1', 'month_1', 'quarter_1', 'year_1'
  phase_days      INTEGER NOT NULL,             -- absolute days from trigger
  impact_type     VARCHAR(48),                  -- 'production_halt', 'price_spike', 'logistics_delay'
  impact_magnitude NUMERIC(7,2),               -- % change or absolute value
  affected_entity  VARCHAR(128),               -- company name or region
  entity_type      VARCHAR(16),                -- 'company' | 'region' | 'resource'
  reversal_probability NUMERIC(3,2),           -- 0–1
  phase_notes     TEXT
);

CREATE INDEX IF NOT EXISTS idx_dp_cascade_scenario ON dp_cascade_phases(scenario_id, phase_days);

-- ─── Supplier Graph ───────────────────────────────────────────────────────────
-- Multi-tier dependency graph. Nodes are companies/entities.

CREATE TABLE IF NOT EXISTS dp_supplier_nodes (
  node_id       VARCHAR(32) PRIMARY KEY,        -- CO-TSMC-001
  display_name  VARCHAR(256) NOT NULL,
  ticker        VARCHAR(16),
  country_code  CHAR(2),
  industry      VARCHAR(64),
  is_single_source BOOLEAN NOT NULL DEFAULT FALSE,
  annual_revenue_usd BIGINT,
  sres_score    NUMERIC(5,2),
  resource_dependencies JSONB,                  -- [{"resource":"gallium","pct_of_cogs":0.18}]
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dp_supplier_edges (
  edge_id           BIGSERIAL PRIMARY KEY,
  buyer_id          VARCHAR(32) NOT NULL REFERENCES dp_supplier_nodes(node_id) ON DELETE CASCADE,
  supplier_id       VARCHAR(32) NOT NULL REFERENCES dp_supplier_nodes(node_id) ON DELETE CASCADE,
  tier              SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 6),
  resource_name     VARCHAR(128),
  annual_value_usd  BIGINT,
  concentration     NUMERIC(4,2),               -- % of buyer's supply from this supplier
  lead_time_alt_days INTEGER,                   -- days to switch to alternative
  contract_type     VARCHAR(32),                -- 'spot' | 'long_term' | 'sole_source'
  geo_overlap       BOOLEAN,                    -- buyer + supplier in same risk zone?
  UNIQUE (buyer_id, supplier_id, resource_name)
);

CREATE INDEX IF NOT EXISTS idx_dp_edges_buyer    ON dp_supplier_edges(buyer_id);
CREATE INDEX IF NOT EXISTS idx_dp_edges_supplier ON dp_supplier_edges(supplier_id);
CREATE INDEX IF NOT EXISTS idx_dp_edges_resource ON dp_supplier_edges(resource_name);

-- ─── Country Risk (extended from existing country data) ───────────────────────

CREATE TABLE IF NOT EXISTS dp_country_risk (
  country_code    CHAR(2) PRIMARY KEY,
  country_name    VARCHAR(128) NOT NULL,

  -- Dimension scores (0–10, 10 = best/safest)
  political_stability   NUMERIC(4,2) NOT NULL DEFAULT 5.0,
  rule_of_law           NUMERIC(4,2) NOT NULL DEFAULT 5.0,
  trade_openness        NUMERIC(4,2) NOT NULL DEFAULT 5.0,
  infrastructure        NUMERIC(4,2) NOT NULL DEFAULT 5.0,
  climate_vulnerability NUMERIC(4,2) NOT NULL DEFAULT 5.0,  -- 10 = highly vulnerable

  -- Sanctions
  sanctions_active      BOOLEAN NOT NULL DEFAULT FALSE,
  sanctions_risk_level  VARCHAR(16) NOT NULL DEFAULT 'none', -- none|moderate|high|critical

  -- Composite (0–100, 100 = highest risk)
  composite_risk        NUMERIC(4,2),

  -- Sources
  source_wbgi_year      SMALLINT,    -- World Bank Governance Indicators year
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Live Alerts ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dp_live_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     VARCHAR(16) REFERENCES dp_scenarios(scenario_id),
  alert_type      VARCHAR(32) NOT NULL,          -- 'live_event_match', 'score_delta', 'threshold_breach'
  headline        TEXT NOT NULL,
  description     TEXT,
  source_url      VARCHAR(512),
  risk_score_delta SMALLINT,                     -- change vs pre-event score
  recommended_actions TEXT[],
  is_processed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tier limits view (convenience) ──────────────────────────────────────────

CREATE OR REPLACE VIEW api_tier_limits AS
SELECT
  'starter'::api_tier      AS tier, 500  AS rate_limit_per_hour, 0   AS simulate_quota_monthly, 0   AS validate_exposure_limit
UNION ALL SELECT
  'professional'::api_tier,          5000, 100,  50
UNION ALL SELECT
  'enterprise'::api_tier,            -1,   500,  -1
UNION ALL SELECT
  'oem'::api_tier,                   -1,   -1,   -1;

-- ─── Triggers: auto-update updated_at ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_dp_scenarios_updated ON dp_scenarios;
CREATE TRIGGER trg_dp_scenarios_updated
  BEFORE UPDATE ON dp_scenarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_dp_nodes_updated ON dp_supplier_nodes;
CREATE TRIGGER trg_dp_nodes_updated
  BEFORE UPDATE ON dp_supplier_nodes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
