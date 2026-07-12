-- =============================================================================
-- DIRE-X Validation System — Database Schema Additions
-- Run AFTER schema.sql has been applied.
-- =============================================================================

-- ─── Validation status enum ───────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE validation_status AS ENUM ('validated', 'needs_review', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Add validation_status column to dp_scenarios ────────────────────────────
-- NULL = never validated

ALTER TABLE dp_scenarios
  ADD COLUMN IF NOT EXISTS validation_status validation_status,
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dp_scenarios_validation_status
  ON dp_scenarios(validation_status);

CREATE INDEX IF NOT EXISTS idx_dp_scenarios_unvalidated
  ON dp_scenarios(scenario_id)
  WHERE validation_status IS NULL;

-- ─── Validation Results ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dp_validation_results (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id          VARCHAR(16) NOT NULL REFERENCES dp_scenarios(scenario_id) ON DELETE CASCADE,
  validated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  validator_version    VARCHAR(16) NOT NULL DEFAULT 'v1.0.0',
  triggered_by         VARCHAR(32) NOT NULL DEFAULT 'manual',
                        -- 'manual' | 'scheduled' | 'post_generate' | 'revalidate'

  -- Score
  validation_score     NUMERIC(5,2) NOT NULL CHECK (validation_score BETWEEN 0 AND 100),
  status               validation_status NOT NULL,

  -- Score breakdown (stored for auditability)
  score_breakdown      JSONB NOT NULL DEFAULT '{}',

  -- Issues
  issues               JSONB NOT NULL DEFAULT '[]',
                        -- Array of Issue objects (rule_id, severity, field, message, etc.)

  -- Corrections
  corrections_applied  JSONB NOT NULL DEFAULT '[]',
  correction_patch     JSONB,           -- Proposed patch (null if no corrections)
  correction_confidence VARCHAR(16),    -- 'high' | 'partial'

  -- Benchmark
  benchmark_results    JSONB,

  -- Flags
  auto_quarantined      BOOLEAN NOT NULL DEFAULT FALSE,
  requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
  human_review_reason   TEXT
);

CREATE INDEX IF NOT EXISTS idx_val_results_scenario
  ON dp_validation_results(scenario_id, validated_at DESC);

CREATE INDEX IF NOT EXISTS idx_val_results_status
  ON dp_validation_results(status);

CREATE INDEX IF NOT EXISTS idx_val_results_triggered
  ON dp_validation_results(triggered_by, validated_at DESC);

-- ─── Correction Queue ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE correction_status AS ENUM ('pending', 'applied', 'rejected_by_human');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS dp_correction_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id  VARCHAR(16) NOT NULL REFERENCES dp_scenarios(scenario_id) ON DELETE CASCADE,
  patch        JSONB NOT NULL,            -- Fields to update on dp_scenarios
  status       correction_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_correction_queue_status
  ON dp_correction_queue(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_correction_queue_scenario
  ON dp_correction_queue(scenario_id);

-- ─── Convenience view: latest validation result per scenario ──────────────────

CREATE OR REPLACE VIEW dp_latest_validation AS
SELECT DISTINCT ON (scenario_id)
  scenario_id,
  validation_score,
  status,
  auto_quarantined,
  requires_human_review,
  validated_at,
  validator_version
FROM dp_validation_results
ORDER BY scenario_id, validated_at DESC;

-- ─── Convenience view: validation health dashboard ───────────────────────────

CREATE OR REPLACE VIEW dp_validation_health AS
SELECT
  ds.event_type,
  ds.region,
  ds.trust_tier,
  ds.validation_status,
  lv.validation_score,
  lv.auto_quarantined,
  lv.validated_at,
  COUNT(*) OVER (PARTITION BY ds.validation_status) AS status_count
FROM dp_scenarios ds
LEFT JOIN dp_latest_validation lv USING (scenario_id);

-- ─── Auto-update last_validated_at on dp_scenarios ───────────────────────────

CREATE OR REPLACE FUNCTION sync_validation_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dp_scenarios
  SET
    validation_status   = NEW.status,
    last_validated_at   = NEW.validated_at,
    updated_at          = NOW()
  WHERE scenario_id = NEW.scenario_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_validation_status ON dp_validation_results;
CREATE TRIGGER trg_sync_validation_status
  AFTER INSERT ON dp_validation_results
  FOR EACH ROW EXECUTE FUNCTION sync_validation_status();
