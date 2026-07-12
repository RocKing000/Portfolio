'use strict';

/**
 * autoCorrector.js
 *
 * Merges all correction patches emitted by validators into one coherent patch.
 * Handles conflicts (same field corrected by multiple rules) via priority order.
 * Returns a safe patch that can be applied to the scenario without side effects.
 *
 * Rule priority (higher overwrites lower on same field):
 *   CRITICAL rules > MODERATE rules > MINOR rules > BENCH rules
 */

const PRIORITY_PREFIX = { 'INP': 5, 'DEP': 4, 'DIR': 4, 'CMP': 4, 'SCR': 3, 'SCV': 3, 'TMP': 3, 'BENCH': 2 };

function getRulePriority(ruleId) {
  const prefix = ruleId.split('-')[0];
  return PRIORITY_PREFIX[prefix] || 1;
}

/**
 * Merge all corrections from all validator stages into one flat patch.
 * Only flat scalar fields are merged — cascade_phases patches are handled separately.
 *
 * @param {object[]} allCorrections - Array of { rule_id, patch, strategy? }
 * @returns {{ scalarPatch: object, phasesPatch: object[]|null, appliedRules: string[], requiresHumanReview: boolean, uncorrectableIssues: string[] }}
 */
function mergeCorrections(allCorrections, allIssues) {
  const scalarPatch = {};                  // scalar field → corrected value
  const fieldPriority = {};               // field → highest priority rule that set it
  let   phasesPatch = null;               // last cascade_phases patch wins
  const appliedRules = [];

  for (const { rule_id, patch } of allCorrections) {
    if (!patch) continue;
    const priority = getRulePriority(rule_id);

    for (const [field, value] of Object.entries(patch)) {
      if (field === 'cascade_phases') {
        // Take the highest-priority phases correction
        const existing = fieldPriority['cascade_phases'] || 0;
        if (priority >= existing) {
          phasesPatch = value;
          fieldPriority['cascade_phases'] = priority;
        }
        continue;
      }

      const existing = fieldPriority[field] || 0;
      if (priority >= existing) {
        scalarPatch[field] = value;
        fieldPriority[field] = priority;
      }
    }

    appliedRules.push(rule_id);
  }

  // Identify uncorrectable issues (auto_correctable = false)
  const uncorrectableIssues = allIssues
    .filter(i => !i.auto_correctable && i.severity !== 'MINOR')
    .map(i => `${i.rule_id}: ${i.field} — ${i.message.slice(0, 80)}`);

  const requiresHumanReview = uncorrectableIssues.length > 0;

  return {
    scalarPatch,
    phasesPatch,
    appliedRules: [...new Set(appliedRules)],
    requiresHumanReview,
    uncorrectableIssues,
    confidence: requiresHumanReview ? 'partial' : 'high',
  };
}

/**
 * Validate that a proposed patch does not introduce new violations.
 * Returns { safe: boolean, warnings: string[] }
 *
 * Sanity checks only — full re-validation happens via re-run.
 */
function sanityCheckPatch(originalScenario, patch) {
  const warnings = [];

  if (patch.risk_score !== undefined) {
    if (patch.risk_score < 0 || patch.risk_score > 100) {
      warnings.push(`risk_score correction ${patch.risk_score} is out of [0, 100] — clamped.`);
      patch.risk_score = Math.min(100, Math.max(0, patch.risk_score));
    }
  }

  if (patch.confidence_score !== undefined) {
    if (patch.confidence_score < 0 || patch.confidence_score > 1) {
      warnings.push(`confidence_score correction ${patch.confidence_score} is out of [0, 1] — clamped.`);
      patch.confidence_score = Math.min(1, Math.max(0, patch.confidence_score));
    }
  }

  if (patch.impact_score !== undefined) {
    if (patch.impact_score < 0 || patch.impact_score > 1) {
      warnings.push(`impact_score correction ${patch.impact_score} is out of [0, 1] — clamped.`);
      patch.impact_score = Math.min(1, Math.max(0, patch.impact_score));
    }
  }

  if (patch.recovery_time_days !== undefined && patch.recovery_time_days < 1) {
    warnings.push(`recovery_time_days correction ${patch.recovery_time_days} < 1 — set to 1.`);
    patch.recovery_time_days = 1;
  }

  return { safe: warnings.length === 0, warnings, sanitizedPatch: patch };
}

module.exports = { mergeCorrections, sanityCheckPatch };
