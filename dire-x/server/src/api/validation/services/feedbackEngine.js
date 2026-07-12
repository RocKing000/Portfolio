'use strict';

/**
 * feedbackEngine.js
 *
 * Final stage of the validation pipeline.
 * Aggregates all issues from all validators into a ValidationResult.
 *
 * Scoring:
 *   Start at 100.
 *   CRITICAL issues: -25 each (uncapped)
 *   MODERATE issues: -8 each (max -40 from moderate)
 *   MINOR issues:    -2 each (max -10 from minor)
 *
 * Status thresholds:
 *   score 90–100  → 'validated'
 *   score 50–89   → 'needs_review'
 *   score 0–49    → 'rejected'
 *   2+ CRITICAL   → 'rejected' regardless of score
 */

const SEVERITY_PENALTY = { CRITICAL: 25, MODERATE: 8, MINOR: 2 };
const MODERATE_CAP     = 40;
const MINOR_CAP        = 10;

/**
 * @param {object[]} allIssues       - Flat array of Issue objects from all validators
 * @param {object}   benchmarkResults
 * @param {object}   correctionResult - Output from autoCorrector.mergeCorrections
 * @param {object}   scenario
 * @returns {object} ValidationResult (matches dp_validation_results schema)
 */
function buildValidationResult(allIssues, benchmarkResults, correctionResult, scenario) {
  const criticalIssues  = allIssues.filter(i => i.severity === 'CRITICAL');
  const moderateIssues  = allIssues.filter(i => i.severity === 'MODERATE');
  const minorIssues     = allIssues.filter(i => i.severity === 'MINOR');

  // ── Score calculation ──────────────────────────────────────────────────────
  const criticalDeduction  = criticalIssues.length  * SEVERITY_PENALTY.CRITICAL;
  const moderateDeduction  = Math.min(moderateIssues.length * SEVERITY_PENALTY.MODERATE, MODERATE_CAP);
  const minorDeduction     = Math.min(minorIssues.length    * SEVERITY_PENALTY.MINOR,    MINOR_CAP);
  const totalDeduction     = criticalDeduction + moderateDeduction + minorDeduction;
  const validationScore    = Math.max(0, 100 - totalDeduction);

  // ── Status determination ───────────────────────────────────────────────────
  let status;
  if (criticalIssues.length >= 2 || validationScore < 50) {
    status = 'rejected';
  } else if (validationScore >= 90 && benchmarkResults.overall_benchmark_flag !== 'FAIL') {
    status = 'validated';
  } else {
    status = 'needs_review';
  }

  // ── Auto-quarantine ────────────────────────────────────────────────────────
  const autoQuarantined = status === 'rejected' || criticalIssues.length >= 1;

  // ── Corrections summary ────────────────────────────────────────────────────
  const { scalarPatch, phasesPatch, appliedRules, requiresHumanReview, uncorrectableIssues, confidence } = correctionResult;

  const fullPatch = { ...scalarPatch };
  if (phasesPatch) fullPatch.cascade_phases = phasesPatch;
  const hasPatch = Object.keys(fullPatch).length > 0;

  // ── Corrections applied list (for audit trail) ────────────────────────────
  const correctionsApplied = appliedRules.map(ruleId => {
    const issue = allIssues.find(i => i.rule_id === ruleId);
    return {
      rule_id:  ruleId,
      field:    issue ? issue.field : 'unknown',
      from:     issue ? issue.observed_value : null,
      to:       fullPatch[issue ? issue.field : null],
      strategy: 'auto_correction',
    };
  });

  return {
    scenario_id:         scenario.scenario_id,
    validation_score:    validationScore,
    status,
    auto_quarantined:    autoQuarantined,
    requires_human_review: requiresHumanReview,
    human_review_reason: requiresHumanReview
      ? uncorrectableIssues.join('; ')
      : null,

    issues:   allIssues.map(({ correction_fn, ...rest }) => rest), // strip internal fn refs

    corrections_applied: correctionsApplied,
    correction_patch:    hasPatch ? fullPatch : null,
    correction_confidence: confidence,

    benchmark_results: benchmarkResults,

    score_breakdown: {
      starting_score:         100,
      critical_count:         criticalIssues.length,
      moderate_count:         moderateIssues.length,
      minor_count:            minorIssues.length,
      critical_deduction:     criticalDeduction,
      moderate_deduction:     moderateDeduction,
      minor_deduction:        minorDeduction,
      total_deduction:        totalDeduction,
      final_score:            validationScore,
    },
  };
}

module.exports = { buildValidationResult };
