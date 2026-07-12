'use strict';

/**
 * api/validation/index.js
 *
 * ValidationPipeline — orchestrates all 5 validator stages end-to-end.
 *
 * Usage:
 *   const pipeline = new ValidationPipeline(supabase);
 *   const result   = await pipeline.run(scenarioId, { autoCorrect: true });
 *
 * Pipeline stages (in order):
 *   1. InputValidator        — schema, types, required fields
 *   2. LogicChecker          — 15 cross-field rules
 *   3. TemporalValidator     — cascade phase ordering + timing
 *   4. ScoringValidator      — score coherence + SRES drift
 *   5. BenchmarkComparator   — z-score vs historical distributions
 *   → FeedbackEngine         — aggregate → ValidationResult
 *   → AutoCorrector          — merge patches
 *   → Persist                — write to dp_validation_results, update dp_scenarios
 */

const { runInputValidator }      = require('./validators/inputValidator');
const { runLogicChecker }        = require('./validators/logicChecker');
const { runTemporalValidator }   = require('./validators/temporalValidator');
const { runScoringValidator }    = require('./validators/scoringValidator');
const { runBenchmarkComparator } = require('./validators/benchmarkComparator');
const { mergeCorrections, sanityCheckPatch } = require('./services/autoCorrector');
const { buildValidationResult }  = require('./services/feedbackEngine');
const supabaseClient             = require('../../config/supabase');

const VALIDATOR_VERSION = 'v1.0.0';

class ValidationPipeline {
  /**
   * @param {object} [db] - Supabase client (defaults to shared client)
   */
  constructor(db = supabaseClient) {
    this.db = db;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Run the full validation pipeline on a single scenario.
   *
   * @param {string}  scenarioId
   * @param {object}  [opts]
   * @param {boolean} [opts.autoCorrect=false]   - If true, writes correction_patch to dp_correction_queue
   * @param {boolean} [opts.persist=true]        - If false, returns result without DB writes (dry-run)
   * @param {string}  [opts.triggeredBy='manual']
   * @returns {Promise<object>} ValidationResult
   */
  async run(scenarioId, opts = {}) {
    const { autoCorrect = false, persist = true, triggeredBy = 'manual' } = opts;

    // ── 1. Fetch scenario + cascade phases ──────────────────────────────────
    const { scenario, phases, fetchError } = await this._fetchScenario(scenarioId);

    if (fetchError || !scenario) {
      return {
        error:      'SCENARIO_NOT_FOUND',
        scenario_id: scenarioId,
        message:    fetchError || `No scenario found with id '${scenarioId}'.`,
      };
    }

    // ── 2. Run pipeline stages ───────────────────────────────────────────────
    const allIssues      = [];
    const allCorrections = [];

    // Stage 1: Input
    const inputResult = runInputValidator(scenario);
    allIssues.push(...inputResult.issues);

    if (inputResult.hardFail) {
      // Cannot proceed — save partial result and return
      const result = this._buildPartialResult(scenarioId, allIssues, 'rejected', triggeredBy);
      if (persist) await this._persist(result, scenario, autoCorrect);
      return result;
    }

    // Stage 2: Logic
    const logicResult = runLogicChecker(scenario, phases);
    allIssues.push(...logicResult.issues);
    allCorrections.push(...logicResult.corrections);

    // Stage 3: Temporal
    const temporalResult = runTemporalValidator(scenario, phases);
    allIssues.push(...temporalResult.issues);
    allCorrections.push(...temporalResult.corrections);

    // Stage 4: Scoring
    const scoringResult = runScoringValidator(scenario);
    allIssues.push(...scoringResult.issues);
    allCorrections.push(...scoringResult.corrections);

    // Stage 5: Benchmark
    const benchmarkResult = runBenchmarkComparator(scenario);
    allIssues.push(...benchmarkResult.issues);
    allCorrections.push(...benchmarkResult.corrections);

    // ── 3. Merge corrections ─────────────────────────────────────────────────
    const correctionResult = mergeCorrections(allCorrections, allIssues);
    if (correctionResult.scalarPatch && Object.keys(correctionResult.scalarPatch).length > 0) {
      const { sanitizedPatch } = sanityCheckPatch(scenario, correctionResult.scalarPatch);
      correctionResult.scalarPatch = sanitizedPatch;
    }

    // ── 4. Build final result ────────────────────────────────────────────────
    const validationResult = buildValidationResult(
      allIssues,
      benchmarkResult.benchmarkResults,
      correctionResult,
      scenario
    );

    validationResult.validator_version = VALIDATOR_VERSION;
    validationResult.triggered_by      = triggeredBy;
    validationResult.validated_at      = new Date().toISOString();

    // ── 5. Persist ───────────────────────────────────────────────────────────
    if (persist) {
      await this._persist(validationResult, scenario, autoCorrect);
    }

    return validationResult;
  }

  /**
   * Run validation on multiple scenarios (batch).
   * Processes sequentially to avoid overwhelming Supabase.
   *
   * @param {string[]} scenarioIds
   * @param {object}   [opts]
   * @returns {Promise<object[]>} Array of ValidationResults
   */
  async runBatch(scenarioIds, opts = {}) {
    const results = [];
    for (const id of scenarioIds) {
      try {
        const result = await this.run(id, { ...opts, triggeredBy: 'scheduled' });
        results.push(result);
      } catch (err) {
        results.push({
          error:       'PIPELINE_ERROR',
          scenario_id: id,
          message:     err.message,
        });
      }
    }
    return results;
  }

  /**
   * Apply a queued correction to the scenario (admin-triggered).
   * Writes to dp_scenarios and marks dp_correction_queue entry as applied.
   *
   * @param {string} scenarioId
   * @param {string} correctionQueueId
   * @returns {Promise<{ applied: boolean, error?: string }>}
   */
  async applyCorrection(scenarioId, correctionQueueId) {
    const { data: queueRow, error: qErr } = await this.db
      .from('dp_correction_queue')
      .select('patch, status')
      .eq('id', correctionQueueId)
      .eq('scenario_id', scenarioId)
      .single();

    if (qErr || !queueRow) {
      return { applied: false, error: 'Correction queue entry not found.' };
    }

    if (queueRow.status !== 'pending') {
      return { applied: false, error: `Correction already in status '${queueRow.status}'.` };
    }

    const patch = queueRow.patch;
    const { cascade_phases, ...scalarPatch } = patch;

    // Apply scalar fields
    if (Object.keys(scalarPatch).length > 0) {
      const { error: updateErr } = await this.db
        .from('dp_scenarios')
        .update({ ...scalarPatch, updated_at: new Date().toISOString() })
        .eq('scenario_id', scenarioId);
      if (updateErr) return { applied: false, error: updateErr.message };
    }

    // Apply cascade phases (delete + re-insert)
    if (cascade_phases && cascade_phases.length > 0) {
      await this.db.from('dp_cascade_phases').delete().eq('scenario_id', scenarioId);
      const rows = cascade_phases.map(p => ({ ...p, scenario_id: scenarioId }));
      await this.db.from('dp_cascade_phases').insert(rows);
    }

    // Mark queue entry as applied
    await this.db
      .from('dp_correction_queue')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', correctionQueueId);

    return { applied: true };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  async _fetchScenario(scenarioId) {
    const [scenarioRes, phasesRes] = await Promise.all([
      this.db.from('dp_scenarios').select('*').eq('scenario_id', scenarioId).single(),
      this.db.from('dp_cascade_phases').select('*').eq('scenario_id', scenarioId).order('phase_days', { ascending: true }),
    ]);

    if (scenarioRes.error) {
      return { scenario: null, phases: [], fetchError: scenarioRes.error.message };
    }

    return { scenario: scenarioRes.data, phases: phasesRes.data || [], fetchError: null };
  }

  async _persist(result, scenario, autoCorrect) {
    const { correction_patch, benchmark_results, corrections_applied, ...coreResult } = result;

    // Write validation result
    const { error: insertErr } = await this.db
      .from('dp_validation_results')
      .insert({
        scenario_id:         result.scenario_id,
        validated_at:        result.validated_at,
        validation_score:    result.validation_score,
        status:              result.status,
        issues:              result.issues,
        corrections_applied: corrections_applied || [],
        correction_patch:    correction_patch || null,
        benchmark_results:   benchmark_results || null,
        validator_version:   result.validator_version,
        triggered_by:        result.triggered_by,
      });

    if (insertErr) {
      console.error(`[ValidationPipeline] Failed to persist result for ${result.scenario_id}:`, insertErr.message);
    }

    // Update dp_scenarios.validation_status + trust_tier adjustment
    const scenarioUpdate = {
      validation_status: result.status,
      updated_at: new Date().toISOString(),
    };

    // If rejected, downgrade trust_tier to synthetic
    if (result.status === 'rejected' && scenario.trust_tier !== 'synthetic') {
      scenarioUpdate.trust_tier = 'synthetic';
    }

    await this.db
      .from('dp_scenarios')
      .update(scenarioUpdate)
      .eq('scenario_id', result.scenario_id);

    // Queue correction if available and auto_correct enabled
    if (autoCorrect && correction_patch && Object.keys(correction_patch).length > 0) {
      await this.db
        .from('dp_correction_queue')
        .insert({
          scenario_id: result.scenario_id,
          patch:       correction_patch,
          status:      'pending',
          created_at:  new Date().toISOString(),
        });
    }
  }

  _buildPartialResult(scenarioId, issues, status, triggeredBy) {
    const critCount = issues.filter(i => i.severity === 'CRITICAL').length;
    return {
      scenario_id:          scenarioId,
      validated_at:         new Date().toISOString(),
      validator_version:    VALIDATOR_VERSION,
      triggered_by:         triggeredBy,
      validation_score:     0,
      status,
      auto_quarantined:     true,
      requires_human_review:true,
      human_review_reason:  `Hard validation failure: ${critCount} critical issue(s) in input stage.`,
      issues,
      corrections_applied:  [],
      correction_patch:     null,
      benchmark_results:    { overall_benchmark_flag: 'SKIPPED' },
      score_breakdown: {
        starting_score: 100,
        critical_count: critCount,
        moderate_count: 0,
        minor_count:    0,
        critical_deduction: critCount * 25,
        moderate_deduction: 0,
        minor_deduction:    0,
        total_deduction:    critCount * 25,
        final_score:        0,
      },
    };
  }
}

module.exports = ValidationPipeline;
