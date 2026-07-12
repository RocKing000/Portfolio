-- ============================================================
-- DIRE-X  —  Complete Database Setup (fresh install)
-- ============================================================
-- Run this ONCE in Supabase Dashboard → SQL Editor → Run
-- After running, execute: npm run seed  (from dire-x/)
-- ============================================================

-- 1. Companies
CREATE TABLE IF NOT EXISTS companies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  sector      TEXT        NOT NULL,
  country     TEXT        NOT NULL,
  strategy    TEXT        DEFAULT 'balanced',
  scale       TEXT        DEFAULT 'medium',
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Strategic Resources  (no food, no agriculture)
CREATE TABLE IF NOT EXISTS resources (
  id                       UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT           NOT NULL UNIQUE,
  category                 TEXT           NOT NULL CHECK (category IN (
                             'critical_minerals',
                             'energy_resources',
                             'industrial_metals',
                             'technology_materials',
                             'strategic_environmental'
                           )),
  unit                     TEXT,
  description              TEXT,
  strategic_importance     DECIMAL(4,3)   DEFAULT 0.50,
  supply_risk              DECIMAL(4,3)   DEFAULT 0.50,
  geopolitical_sensitivity DECIMAL(4,3)   DEFAULT 0.50,
  refining_dependency      TEXT,
  created_at               TIMESTAMPTZ    DEFAULT now()
);

-- 3. Company ↔ Resource dependency mappings
CREATE TABLE IF NOT EXISTS company_resources (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID         NOT NULL REFERENCES companies(id)  ON DELETE CASCADE,
  resource_id      UUID         NOT NULL REFERENCES resources(id)  ON DELETE CASCADE,
  dependency_score DECIMAL(4,3) NOT NULL DEFAULT 0.50,
  usage_context    TEXT,
  created_at       TIMESTAMPTZ  DEFAULT now(),
  UNIQUE(company_id, resource_id)
);

-- 4. Risk metrics per resource
CREATE TABLE IF NOT EXISTS risk_metrics (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id         UUID         NOT NULL UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
  demand_index        DECIMAL(5,2) DEFAULT 50,
  supply_index        DECIMAL(5,2) DEFAULT 50,
  geopolitical_index  DECIMAL(5,2) DEFAULT 50,
  environmental_index DECIMAL(5,2) DEFAULT 50,
  updated_at          TIMESTAMPTZ  DEFAULT now()
);

-- 5. Ingestion audit snapshots
CREATE TABLE IF NOT EXISTS data_snapshots (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source     TEXT        NOT NULL,
  data       JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_company_resources_company_id  ON company_resources(company_id);
CREATE INDEX IF NOT EXISTS idx_company_resources_resource_id ON company_resources(resource_id);
CREATE INDEX IF NOT EXISTS idx_risk_metrics_resource_id      ON risk_metrics(resource_id);
CREATE INDEX IF NOT EXISTS idx_companies_country             ON companies(country);

-- Verify
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
