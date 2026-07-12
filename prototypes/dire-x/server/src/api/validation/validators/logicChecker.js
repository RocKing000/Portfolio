'use strict';

/**
 * logicChecker.js
 *
 * Stage 2: Cross-field logic consistency rules.
 * 15 rules covering dependency, score, directional, and completeness consistency.
 *
 * Each rule returns null (pass) or an Issue object.
 * The checker runs ALL rules and collects all issues — does not short-circuit.
 */

const { getDirectionalExpectations } = require('../data/directionalExpectations');
const { computeRiskScore }           = require('../../services/scoringService');

// ─── Issue factory ────────────────────────────────────────────────────────────

function issue(ruleId, severity, field, message, observed, expected, autoCorrectable = false, correction = null) {
  return { rule_id: ruleId, severity, field, message, observed_value: observed, expected_range: expected, auto_correctable: autoCorrectable, correction_fn: correction };
}

// ─── Rules ────────────────────────────────────────────────────────────────────

const RULES = [

  // DEP-001: High import dependency requires significant impact
  {
    id: 'DEP-001',
    check(s) {
      if (s.import_dependency === undefined) return null;
      if (s.import_dependency > 0.65 && s.impact_score < 0.30) {
        return issue('DEP-001', 'CRITICAL', 'impact_score',
          `Import dependency ${s.import_dependency} (>0.65) is inconsistent with impact_score ${s.impact_score} (<0.30). High dependency means high exposure.`,
          s.impact_score, { min: 0.30, reason: 'import_dependency > 0.65' }, true,
          (sc) => ({ impact_score: Math.max(sc.impact_score, parseFloat((sc.import_dependency * 0.55).toFixed(2))) })
        );
      }
      return null;
    },
  },

  // DEP-002: High supply concentration requires matching disruption score
  {
    id: 'DEP-002',
    check(s) {
      if (s.supply_concentration === undefined) return null;
      if (s.supply_concentration > 0.75 && s.supply_disruption !== undefined && s.supply_disruption < 0.50) {
        return issue('DEP-002', 'MODERATE', 'supply_disruption',
          `Supply concentration ${s.supply_concentration} (>0.75) with supply_disruption ${s.supply_disruption} (<0.50) is inconsistent.`,
          s.supply_disruption, { min: 0.50, reason: 'supply_concentration > 0.75' }, true,
          (sc) => ({ supply_disruption: parseFloat(Math.max(sc.supply_disruption, sc.supply_concentration * 0.70).toFixed(2)) })
        );
      }
      return null;
    },
  },

  // DEP-003: High hidden dependency requires elevated risk
  {
    id: 'DEP-003',
    check(s) {
      if (s.hidden_dependency_pct === undefined) return null;
      if (s.hidden_dependency_pct > 50 && s.risk_score < 60) {
        return issue('DEP-003', 'CRITICAL', 'risk_score',
          `hidden_dependency_pct ${s.hidden_dependency_pct}% (>50%) cannot coexist with risk_score ${s.risk_score} (<60). Unknown exposures increase risk.`,
          s.risk_score,
          { min: 60, reason: 'hidden_dependency_pct > 50' }, true,
          (sc) => ({ risk_score: Math.round(Math.max(sc.risk_score, 62 + (sc.hidden_dependency_pct - 50) * 0.4)) })
        );
      }
      return null;
    },
  },

  // DIR-001: Directional expectations per event type
  {
    id: 'DIR-001',
    check(s) {
      const expectations = getDirectionalExpectations(s.event_type);
      if (!expectations) return null;

      const violations = [];
      for (const [field, constraint] of Object.entries(expectations)) {
        const val = s[field];
        if (val === undefined || val === null) continue;

        let violated = false;
        if (constraint.direction === 'high'     && val < constraint.min) violated = true;
        if (constraint.direction === 'low'      && val > constraint.max) violated = true;
        if (constraint.direction === 'positive' && val <= 0)             violated = true;
        if (constraint.direction === 'negative' && val >= 0)             violated = true;
        if (constraint.min !== undefined && val < constraint.min)        violated = true;
        if (constraint.max !== undefined && val > constraint.max)        violated = true;

        if (violated) {
          violations.push({
            field,
            observed: val,
            constraint,
            message: `Field '${field}' value ${val} violates directional expectation for event_type '${s.event_type}' (${JSON.stringify(constraint)}).`,
          });
        }
      }

      if (violations.length === 0) return null;

      // Return one issue per violation (first violation drives severity)
      return violations.map(v => issue(
        'DIR-001', 'CRITICAL', v.field, v.message, v.observed, v.constraint, false
      ));
    },
  },

  // SCR-001: Overconfidence at high risk
  {
    id: 'SCR-001',
    check(s) {
      if (s.risk_score > 80 && s.confidence_score > 0.75) {
        return issue('SCR-001', 'MODERATE', 'confidence_score',
          `confidence_score ${s.confidence_score} (>0.75) is epistemically overconfident for risk_score ${s.risk_score} (>80). High-severity events carry structural uncertainty.`,
          s.confidence_score, { max: 0.75, reason: 'risk_score > 80' }, true,
          () => ({ confidence_score: 0.72 })
        );
      }
      return null;
    },
  },

  // SCR-002: Impact score cannot materially exceed normalized risk
  {
    id: 'SCR-002',
    check(s) {
      const normalizedRisk = s.risk_score / 100;
      if (s.impact_score > normalizedRisk * 1.25) {
        return issue('SCR-002', 'MINOR', 'impact_score',
          `impact_score ${s.impact_score} materially exceeds normalized risk ${normalizedRisk.toFixed(2)} × 1.25 = ${(normalizedRisk * 1.25).toFixed(2)}. Impact cannot exceed risk ceiling without a cascade multiplier flag.`,
          s.impact_score, { max: parseFloat((normalizedRisk * 1.25).toFixed(2)) }, true,
          (sc) => ({ impact_score: parseFloat((sc.risk_score / 100 * 1.20).toFixed(2)) })
        );
      }
      return null;
    },
  },

  // SCR-003: Risk score recompute drift check
  {
    id: 'SCR-003',
    check(s) {
      if (
        s.direct_impact_score === undefined ||
        s.indirect_impact_score === undefined ||
        s.hidden_dependency_pct === undefined
      ) return null;

      try {
        const recomputed = computeRiskScore({
          directImpact:       s.direct_impact_score,
          indirectImpact:     s.indirect_impact_score,
          hiddenDependencyPct:s.hidden_dependency_pct,
          policyImpact:       s.policy_impact || 'None',
          manipulationRisk:   s.manipulation_risk || 'Low',
          timeToImpactDays:   s.time_to_impact_days || 0,
          countryCode:        (s.country_codes && s.country_codes[0]) || 'US',
        });

        const delta = Math.abs(recomputed.riskScore - s.risk_score);
        if (delta > 8) {
          return issue('SCR-003', 'MODERATE', 'risk_score',
            `Re-running the risk formula with stored parameters produces ${recomputed.riskScore} vs stored ${s.risk_score} (delta: ${delta.toFixed(1)} > 8). Score may have been manually edited post-generation.`,
            s.risk_score,
            { expected_value: recomputed.riskScore, tolerance: 8 }, true,
            () => ({ risk_score: recomputed.riskScore })
          );
        }
      } catch (_) {
        // Engine call failed — skip silently, don't break pipeline
      }
      return null;
    },
  },

  // SCR-004: Trust tier cannot be 'validated' or higher without validation_accuracy_pct
  {
    id: 'SCR-004',
    check(s) {
      const TIER_ORDER = { synthetic: 0, validated: 1, live_calibrated: 2, expert_reviewed: 3 };
      if (TIER_ORDER[s.trust_tier] >= 1 && !s.validation_accuracy_pct) {
        return issue('SCR-004', 'MODERATE', 'trust_tier',
          `trust_tier '${s.trust_tier}' implies backtesting, but validation_accuracy_pct is missing. Cannot claim validated status without accuracy data.`,
          s.trust_tier, { requires: 'validation_accuracy_pct' }, true,
          () => ({ trust_tier: 'synthetic' })
        );
      }
      return null;
    },
  },

  // CMP-001: assumption_manifest key count
  {
    id: 'CMP-001',
    check(s) {
      if (!s.assumption_manifest) return null;
      const keyCount = Object.keys(s.assumption_manifest).length;
      if (keyCount < 3) {
        return issue('CMP-001', 'MODERATE', 'assumption_manifest',
          `assumption_manifest has ${keyCount} key(s). Production scenarios require ≥3 documented assumptions for audit trail.`,
          keyCount, { min_keys: 3 }, false  // cannot auto-correct — requires domain knowledge
        );
      }
      return null;
    },
  },

  // CMP-002: Supply-side events require affected_resources
  {
    id: 'CMP-002',
    check(s) {
      const supplyEvents = new Set([
        'oil_shock', 'rare_earth_export_restriction', 'semiconductor_shortage',
        'lithium_supply_shortage', 'lng_supply_disruption', 'port_shutdown',
        'factory_explosion', 'cyber_attack_infrastructure', 'pandemic_lockdown',
      ]);
      if (supplyEvents.has(s.event_type) && (!s.affected_resources || s.affected_resources.length === 0)) {
        return issue('CMP-002', 'CRITICAL', 'affected_resources',
          `event_type '${s.event_type}' is a supply-side event and must specify at least one affected_resource.`,
          s.affected_resources, { required: true, reason: `event_type: ${s.event_type}` }, false
        );
      }
      return null;
    },
  },

  // CMP-003: High-risk scenarios must have cascade phases
  {
    id: 'CMP-003',
    check(s, phases) {
      if (s.risk_score >= 70 && (!phases || phases.length === 0)) {
        return issue('CMP-003', 'MODERATE', 'cascade_phases',
          `risk_score ${s.risk_score} (≥70) requires cascade phases to model time-phased impact. Buyers cannot act on a risk score without timeline context.`,
          0, { min_phases: 1, reason: 'risk_score >= 70' }, false
        );
      }
      return null;
    },
  },

  // CMP-004: Geopolitical events require diplomatic_tension score
  {
    id: 'CMP-004',
    check(s) {
      const geoEvents = new Set(['sanctions', 'trade_war_tariffs', 'export_controls', 'armed_conflict_regional']);
      if (geoEvents.has(s.event_type) && (s.diplomatic_tension === undefined || s.diplomatic_tension === null)) {
        return issue('CMP-004', 'MODERATE', 'diplomatic_tension',
          `Geopolitical event '${s.event_type}' must include a diplomatic_tension score (0–100).`,
          s.diplomatic_tension, { required: true, range: '0–100' }, false
        );
      }
      return null;
    },
  },

  // DEP-004: Supply disruption > 0.8 triggers CRITICAL exposure floor
  {
    id: 'DEP-004',
    check(s) {
      if (s.supply_disruption === undefined) return null;
      if (s.supply_disruption > 0.80 && s.risk_score < 70) {
        return issue('DEP-004', 'CRITICAL', 'risk_score',
          `supply_disruption ${s.supply_disruption} (>0.80) indicates near-total supply loss, but risk_score is only ${s.risk_score} (<70). Catastrophic supply disruption must reflect in risk score.`,
          s.risk_score, { min: 70, reason: 'supply_disruption > 0.80' }, true,
          (sc) => ({ risk_score: Math.max(sc.risk_score, 72) })
        );
      }
      return null;
    },
  },

  // SCR-005: Financial impact must be positive (losses are expressed as positive USD)
  {
    id: 'SCR-005',
    check(s) {
      if (s.financial_impact_usd !== undefined && s.financial_impact_usd < 0) {
        return issue('SCR-005', 'MINOR', 'financial_impact_usd',
          `financial_impact_usd ${s.financial_impact_usd} is negative. Express disruption costs as positive USD values.`,
          s.financial_impact_usd, { min: 0 }, true,
          (sc) => ({ financial_impact_usd: Math.abs(sc.financial_impact_usd) })
        );
      }
      return null;
    },
  },

  // SCR-006: Low confidence cannot carry high trust tier
  {
    id: 'SCR-006',
    check(s) {
      const TIER_ORDER = { synthetic: 0, validated: 1, live_calibrated: 2, expert_reviewed: 3 };
      if (s.confidence_score < 0.40 && TIER_ORDER[s.trust_tier] >= 1) {
        return issue('SCR-006', 'MODERATE', 'trust_tier',
          `confidence_score ${s.confidence_score} (<0.40) is incompatible with trust_tier '${s.trust_tier}'. Low confidence requires synthetic tier.`,
          s.trust_tier, { expected: 'synthetic', reason: 'confidence_score < 0.40' }, true,
          () => ({ trust_tier: 'synthetic' })
        );
      }
      return null;
    },
  },
];

// ─── Main runner ──────────────────────────────────────────────────────────────

/**
 * Run all 15 logic rules against a scenario + its cascade phases.
 * @param {object}   scenario
 * @param {object[]} phases   - dp_cascade_phases rows for this scenario
 * @returns {{ issues: object[], corrections: object[] }}
 */
function runLogicChecker(scenario, phases = []) {
  const issues = [];
  const corrections = [];

  for (const rule of RULES) {
    let result;
    try {
      result = rule.check(scenario, phases);
    } catch (err) {
      // Rule threw unexpectedly — emit a MINOR internal error, never crash pipeline
      issues.push({
        rule_id: rule.id,
        severity: 'MINOR',
        field: 'unknown',
        message: `Rule ${rule.id} threw an error during evaluation: ${err.message}`,
        observed_value: null,
        expected_range: null,
        auto_correctable: false,
        internal_error: true,
      });
      continue;
    }

    if (!result) continue;

    // Rules may return a single issue or an array
    const resultArr = Array.isArray(result) ? result : [result];
    for (const iss of resultArr) {
      if (!iss) continue;

      const { correction_fn, ...cleanIssue } = iss;
      issues.push(cleanIssue);

      if (correction_fn) {
        const patch = correction_fn(scenario, phases);
        if (patch && Object.keys(patch).length > 0) {
          corrections.push({ rule_id: rule.id, patch });
        }
      }
    }
  }

  return { issues, corrections };
}

module.exports = { runLogicChecker, RULES };
