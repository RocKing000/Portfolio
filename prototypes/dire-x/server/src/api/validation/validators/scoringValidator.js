'use strict';

/**
 * scoringValidator.js
 *
 * Stage 4: Internal score coherence checks.
 * Validates the risk/confidence/trust_tier triangle and SRES recompute drift.
 *
 * Returns: { issues: Issue[], corrections: object[] }
 */

const { computeSRES } = require('../../../engines/sresEngine');
const { SRES_WEIGHTS } = require('../../../config/constants');

const TRUST_TIER_CEILING = {
  synthetic:       0.92,
  validated:       0.87,
  live_calibrated: 0.93,
  expert_reviewed: 0.97,
};

function issue(ruleId, severity, field, message, observed, expected, autoCorrectable = false) {
  return { rule_id: ruleId, severity, field, message, observed_value: observed, expected_range: expected, auto_correctable: autoCorrectable };
}

/**
 * @param {object} scenario
 * @returns {{ issues: object[], corrections: object[] }}
 */
function runScoringValidator(scenario) {
  const issues = [];
  const corrections = [];

  // ── SCV-001: Confidence ceiling must match trust_tier ────────────────────
  const ceiling = TRUST_TIER_CEILING[scenario.trust_tier];
  if (ceiling !== undefined && scenario.confidence_score > ceiling) {
    issues.push(issue('SCV-001', 'MODERATE', 'confidence_score',
      `confidence_score ${scenario.confidence_score} exceeds the maximum for trust_tier '${scenario.trust_tier}' (ceiling: ${ceiling}).`,
      scenario.confidence_score, { max: ceiling, reason: `trust_tier=${scenario.trust_tier}` }, true));
    corrections.push({ rule_id: 'SCV-001', patch: { confidence_score: ceiling } });
  }

  // ── SCV-002: SRES recompute drift ─────────────────────────────────────────
  // Only run if we have enough components to reconstruct SRES inputs.
  // We approximate:
  //   demand       → direct_impact_score
  //   supply       → 100 - supply_disruption * 100 (supply health, not disruption)
  //   geopolitical → diplomatic_tension || (country_risk proxy)
  //   environmental → infrastructure_damage_score || 50
  if (
    scenario.sres_score !== undefined &&
    scenario.direct_impact_score !== undefined &&
    scenario.indirect_impact_score !== undefined
  ) {
    try {
      const metrics = {
        demand:        scenario.direct_impact_score,
        supply:        scenario.supply_disruption !== undefined
                         ? (1 - scenario.supply_disruption) * 100
                         : 50,
        geopolitical:  scenario.diplomatic_tension !== undefined
                         ? scenario.diplomatic_tension
                         : scenario.indirect_impact_score,
        environmental: scenario.infrastructure_damage_score !== undefined
                         ? scenario.infrastructure_damage_score
                         : 50,
      };

      const recomputedSRES = computeSRES(null, metrics, SRES_WEIGHTS);
      const delta = Math.abs(recomputedSRES - scenario.sres_score);

      if (delta > 8) {
        issues.push(issue('SCV-002', 'MODERATE', 'sres_score',
          `SRES recomputed from stored parameters: ${recomputedSRES.toFixed(1)} vs stored ${scenario.sres_score} (delta: ${delta.toFixed(1)} > 8 tolerance). Score may have been manually edited.`,
          scenario.sres_score,
          { expected_value: recomputedSRES, tolerance: 8 }, true));
        corrections.push({ rule_id: 'SCV-002', patch: { sres_score: recomputedSRES } });
      }
    } catch (_) {
      // Recompute failed — skip, don't break
    }
  }

  // ── SCV-003: confidence_score floor for claimable trust tiers ────────────
  const TIER_MIN_CONFIDENCE = {
    validated:       0.50,
    live_calibrated: 0.60,
    expert_reviewed: 0.70,
  };
  const minForTier = TIER_MIN_CONFIDENCE[scenario.trust_tier];
  if (minForTier !== undefined && scenario.confidence_score < minForTier) {
    issues.push(issue('SCV-003', 'MODERATE', 'trust_tier',
      `trust_tier '${scenario.trust_tier}' requires confidence_score ≥ ${minForTier}, but got ${scenario.confidence_score}.`,
      scenario.confidence_score, { min: minForTier, reason: `trust_tier=${scenario.trust_tier}` }, true));
    corrections.push({ rule_id: 'SCV-003', patch: { trust_tier: 'synthetic' } });
  }

  // ── SCV-004: Validation accuracy bounds ───────────────────────────────────
  if (scenario.validation_accuracy_pct !== undefined) {
    if (scenario.validation_accuracy_pct < 0 || scenario.validation_accuracy_pct > 100) {
      issues.push(issue('SCV-004', 'MODERATE', 'validation_accuracy_pct',
        `validation_accuracy_pct ${scenario.validation_accuracy_pct} is out of range [0, 100].`,
        scenario.validation_accuracy_pct, { min: 0, max: 100 }, true));
      corrections.push({
        rule_id: 'SCV-004',
        patch: { validation_accuracy_pct: Math.min(100, Math.max(0, scenario.validation_accuracy_pct)) },
      });
    }
  }

  // ── SCV-005: SYSTEMIC_RISK flag consistency ───────────────────────────────
  const flaggedSystemic = scenario.assumption_manifest &&
    JSON.stringify(scenario.assumption_manifest).includes('SYSTEMIC_RISK');
  if (flaggedSystemic && scenario.risk_score <= 80) {
    issues.push(issue('SCV-005', 'MINOR', 'risk_score',
      `Assumption manifest references SYSTEMIC_RISK but risk_score ${scenario.risk_score} is ≤ 80. SYSTEMIC_RISK flags require risk_score > 80.`,
      scenario.risk_score, { min: 81, reason: 'SYSTEMIC_RISK flag present' }, false));
  }

  return { issues, corrections };
}

module.exports = { runScoringValidator };
