'use strict';

/**
 * routes/validateScenario.js
 *
 * Validation API endpoints — admin-only.
 * All routes are mounted under /api/admin/validation by server/src/index.js.
 *
 * Endpoints:
 *   POST   /api/admin/validation/run/:scenarioId      — run validation on one scenario
 *   POST   /api/admin/validation/batch                — run on multiple scenarios
 *   GET    /api/admin/validation/results/:scenarioId  — get latest validation result
 *   GET    /api/admin/validation/queue                — pending correction queue
 *   POST   /api/admin/validation/corrections/:id/apply   — apply a queued correction
 *   POST   /api/admin/validation/corrections/:id/reject  — reject a queued correction
 *   GET    /api/admin/validation/stats                — aggregate validation health stats
 */

const { Router } = require('express');
const ValidationPipeline = require('../validation/index');
const supabase = require('../../config/supabase');

const router = Router();
const pipeline = new ValidationPipeline(supabase);

// ─── POST /run/:scenarioId ────────────────────────────────────────────────────
// Run full validation pipeline on a single scenario.
// Query params:
//   auto_correct=true   — queue auto-corrections if found
//   dry_run=true        — return result without persisting
router.post('/run/:scenarioId', async (req, res) => {
  const { scenarioId } = req.params;
  const autoCorrect = req.query.auto_correct === 'true';
  const persist     = req.query.dry_run !== 'true';

  if (!scenarioId) {
    return res.status(400).json({ error: 'scenario_id is required', code: 'MISSING_PARAM' });
  }

  const result = await pipeline.run(scenarioId, {
    autoCorrect,
    persist,
    triggeredBy: 'manual',
  });

  if (result.error === 'SCENARIO_NOT_FOUND') {
    return res.status(404).json({ error: result.message, code: 'SCENARIO_NOT_FOUND' });
  }

  const statusCode = result.status === 'validated'    ? 200
                   : result.status === 'needs_review' ? 200
                   : /* rejected */                     422;

  return res.status(statusCode).json(result);
});

// ─── POST /batch ──────────────────────────────────────────────────────────────
// Run validation on up to 100 scenarios.
// Body: { scenario_ids: string[], auto_correct?: boolean }
router.post('/batch', async (req, res) => {
  const { scenario_ids, auto_correct = false } = req.body || {};

  if (!Array.isArray(scenario_ids) || scenario_ids.length === 0) {
    return res.status(400).json({ error: 'scenario_ids must be a non-empty array', code: 'MISSING_PARAM' });
  }

  if (scenario_ids.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 scenarios per batch', code: 'BATCH_LIMIT_EXCEEDED' });
  }

  const results = await pipeline.runBatch(scenario_ids, { autoCorrect: auto_correct, persist: true });

  const summary = {
    total:        results.length,
    validated:    results.filter(r => r.status === 'validated').length,
    needs_review: results.filter(r => r.status === 'needs_review').length,
    rejected:     results.filter(r => r.status === 'rejected').length,
    errors:       results.filter(r => r.error).length,
  };

  return res.status(200).json({ summary, results });
});

// ─── GET /results/:scenarioId ─────────────────────────────────────────────────
// Retrieve the most recent validation result for a scenario.
// Query params: history=true — return all historical results
router.get('/results/:scenarioId', async (req, res) => {
  const { scenarioId } = req.params;
  const history = req.query.history === 'true';

  let query = supabase
    .from('dp_validation_results')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('validated_at', { ascending: false });

  if (!history) query = query.limit(1);

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message, code: 'DB_ERROR' });
  if (!data || data.length === 0) {
    return res.status(404).json({ error: `No validation results found for scenario '${scenarioId}'`, code: 'NOT_FOUND' });
  }

  return res.status(200).json(history ? { results: data } : data[0]);
});

// ─── GET /queue ───────────────────────────────────────────────────────────────
// Get pending corrections queue.
// Query params: status=pending|applied|rejected_by_human (default: pending)
//               limit=50 (default), offset=0
router.get('/queue', async (req, res) => {
  const status = req.query.status || 'pending';
  const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;

  const { data, error, count } = await supabase
    .from('dp_correction_queue')
    .select('*, dp_scenarios(scenario_id, event_type, risk_score, trust_tier)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message, code: 'DB_ERROR' });

  return res.status(200).json({
    total: count,
    limit,
    offset,
    queue: data || [],
  });
});

// ─── POST /corrections/:id/apply ─────────────────────────────────────────────
// Apply a queued correction to its scenario.
// Body: { scenario_id: string }
router.post('/corrections/:id/apply', async (req, res) => {
  const correctionId = req.params.id;
  const { scenario_id } = req.body || {};

  if (!scenario_id) {
    return res.status(400).json({ error: 'scenario_id is required in body', code: 'MISSING_PARAM' });
  }

  const result = await pipeline.applyCorrection(scenario_id, correctionId);

  if (!result.applied) {
    return res.status(400).json({ error: result.error, code: 'CORRECTION_FAILED' });
  }

  // Trigger re-validation after applying correction
  setImmediate(() => {
    pipeline.run(scenario_id, { autoCorrect: false, persist: true, triggeredBy: 'revalidate' })
      .catch(err => console.error('[ValidationPipeline] Re-validation after correction failed:', err.message));
  });

  return res.status(200).json({
    applied: true,
    correction_id: correctionId,
    scenario_id,
    note: 'Re-validation queued asynchronously.',
  });
});

// ─── POST /corrections/:id/reject ────────────────────────────────────────────
// Reject a queued correction (human disagrees with auto-correction).
// Body: { reason: string }
router.post('/corrections/:id/reject', async (req, res) => {
  const correctionId = req.params.id;
  const { reason } = req.body || {};

  const { error } = await supabase
    .from('dp_correction_queue')
    .update({ status: 'rejected_by_human', applied_at: new Date().toISOString() })
    .eq('id', correctionId);

  if (error) return res.status(500).json({ error: error.message, code: 'DB_ERROR' });

  // Log reason if provided
  if (reason) {
    console.log(`[Validation] Correction ${correctionId} rejected by human. Reason: ${reason}`);
  }

  return res.status(200).json({ rejected: true, correction_id: correctionId });
});

// ─── GET /stats ───────────────────────────────────────────────────────────────
// Aggregate validation health stats across the scenario catalog.
// Query params: since=2026-01-01 (ISO date, default: 30 days ago)
router.get('/stats', async (req, res) => {
  const since = req.query.since
    ? new Date(req.query.since).toISOString()
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Latest validation status per scenario
  const { data: statusData, error: statusErr } = await supabase
    .from('dp_scenarios')
    .select('validation_status, event_type, risk_score, trust_tier');

  if (statusErr) return res.status(500).json({ error: statusErr.message, code: 'DB_ERROR' });

  // Recent validation results (score distribution)
  const { data: recentResults, error: recentErr } = await supabase
    .from('dp_validation_results')
    .select('validation_score, status, triggered_by, validated_at')
    .gte('validated_at', since)
    .order('validated_at', { ascending: false })
    .limit(500);

  if (recentErr) return res.status(500).json({ error: recentErr.message, code: 'DB_ERROR' });

  // Pending correction queue count
  const { count: pendingCount } = await supabase
    .from('dp_correction_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Compute status distribution
  const statusCounts = { validated: 0, needs_review: 0, rejected: 0, unvalidated: 0 };
  for (const row of statusData || []) {
    const s = row.validation_status || 'unvalidated';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  // Average score of recent validations
  const scored = (recentResults || []).filter(r => typeof r.validation_score === 'number');
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((sum, r) => sum + r.validation_score, 0) / scored.length * 10) / 10
    : null;

  return res.status(200).json({
    since,
    catalog: {
      total_scenarios: (statusData || []).length,
      by_status: statusCounts,
    },
    recent_runs: {
      count: (recentResults || []).length,
      avg_score: avgScore,
      by_trigger: _groupBy(recentResults || [], 'triggered_by'),
    },
    pending_corrections: pendingCount || 0,
  });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function _groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

module.exports = router;
