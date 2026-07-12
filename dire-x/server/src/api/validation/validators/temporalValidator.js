'use strict';

/**
 * temporalValidator.js
 *
 * Stage 3: Cascade phase ordering and timing realism.
 * Validates that the time-series of phase impacts follows physical/economic constraints.
 *
 * Returns: { issues: Issue[], corrections: object[] }
 */

function issue(ruleId, severity, field, message, observed, expected, autoCorrectable = false) {
  return { rule_id: ruleId, severity, field, message, observed_value: observed, expected_range: expected, auto_correctable: autoCorrectable };
}

/**
 * @param {object}   scenario - dp_scenarios row
 * @param {object[]} phases   - dp_cascade_phases rows sorted by phase_days ASC
 * @returns {{ issues: object[], corrections: object[] }}
 */
function runTemporalValidator(scenario, phases = []) {
  const issues = [];
  const corrections = [];

  if (!phases || phases.length === 0) {
    // No phases to validate — CMP-003 in logicChecker handles missing phases
    return { issues, corrections };
  }

  // Sort defensively — should already be sorted but don't trust caller
  const sorted = [...phases].sort((a, b) => a.phase_days - b.phase_days);

  // ── TMP-001: Phase 1 cannot be day 0 (nothing propagates instantly) ──────
  if (sorted[0].phase_days === 0) {
    issues.push(issue('TMP-001', 'CRITICAL', 'cascade_phases[0].phase_days',
      'Phase 1 delay of 0 days is physically impossible. Minimum supply chain propagation lag is 1 day.',
      0, { min: 1 }, true));
    corrections.push({
      rule_id: 'TMP-001',
      patch: { cascade_phases: sorted.map((p, i) => i === 0 ? { ...p, phase_days: Math.max(p.phase_days, 1) } : p) },
    });
  }

  // ── TMP-002: Sanctions minimum 7-day implementation lag ───────────────────
  if (scenario.event_type === 'sanctions' && sorted[0].phase_days < 7) {
    issues.push(issue('TMP-002', 'MODERATE', 'cascade_phases[0].phase_days',
      `Sanctions require a minimum 7-day implementation lag (legal/regulatory processing). Phase 1 has ${sorted[0].phase_days} days.`,
      sorted[0].phase_days, { min: 7, reason: 'event_type=sanctions' }, true));
    corrections.push({
      rule_id: 'TMP-002',
      patch: { cascade_phases: [{ ...sorted[0], phase_days: Math.max(sorted[0].phase_days, 7) }, ...sorted.slice(1)] },
    });
  }

  // ── TMP-003: Phase days must be strictly increasing ───────────────────────
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].phase_days <= sorted[i - 1].phase_days) {
      issues.push(issue('TMP-003', 'CRITICAL',
        `cascade_phases[${i}].phase_days`,
        `Phase ${i + 1} (day ${sorted[i].phase_days}) is not strictly after phase ${i} (day ${sorted[i - 1].phase_days}). Cascade phases must be ordered in time.`,
        sorted[i].phase_days, { must_be_greater_than: sorted[i - 1].phase_days }, false));
    }
  }

  // ── TMP-004: Recovery time must exceed total cascade span ─────────────────
  const cascadeSpan = sorted[sorted.length - 1].phase_days;
  if (scenario.recovery_time_days < cascadeSpan) {
    issues.push(issue('TMP-004', 'MODERATE', 'recovery_time_days',
      `recovery_time_days ${scenario.recovery_time_days} is shorter than total cascade span ${cascadeSpan} days. Recovery cannot complete before the disruption cascade does.`,
      scenario.recovery_time_days, { min: cascadeSpan + 14 }, true));
    corrections.push({
      rule_id: 'TMP-004',
      patch: { recovery_time_days: cascadeSpan + 14 },
    });
  }

  // ── TMP-005: Impact must not monotonically increase without re-escalation ─
  if (sorted.length >= 3) {
    const magnitudes = sorted.map(p => p.impact_magnitude).filter(m => m !== undefined && m !== null);
    const isMonotonic = magnitudes.every((v, i) => i === 0 || v >= magnitudes[i - 1]);
    if (isMonotonic && !scenario.has_re_escalation_tag) {
      issues.push(issue('TMP-005', 'MINOR', 'cascade_phases[last].impact_magnitude',
        'All cascade phases show non-decreasing impact with no re-escalation tag. Final phase should reflect mitigation beginning.',
        magnitudes[magnitudes.length - 1],
        { should_be: `< ${magnitudes[magnitudes.length - 2]}` }, true));
      // Correction: apply 0.75x to final phase magnitude
      const correctedPhases = [...sorted];
      const lastIdx = correctedPhases.length - 1;
      correctedPhases[lastIdx] = {
        ...correctedPhases[lastIdx],
        impact_magnitude: parseFloat((correctedPhases[lastIdx].impact_magnitude * 0.75).toFixed(3)),
      };
      corrections.push({ rule_id: 'TMP-005', patch: { cascade_phases: correctedPhases } });
    }
  }

  // ── TMP-006: Port shutdowns cannot span > 180 days without military tag ───
  if (scenario.event_type === 'port_shutdown') {
    const hasMilitaryTag = scenario.assumption_manifest &&
      JSON.stringify(scenario.assumption_manifest).toLowerCase().includes('military');
    if (cascadeSpan > 180 && !hasMilitaryTag) {
      issues.push(issue('TMP-006', 'MODERATE', 'cascade_phases',
        `Port shutdown cascade spans ${cascadeSpan} days (>180) without a military_blockade assumption. Civilian port closures resolve within 6 months.`,
        cascadeSpan, { max: 180, unless: 'military_blockade documented in assumption_manifest' }, false));
    }
  }

  // ── TMP-007: Climate events require minimum recovery time ─────────────────
  const climateEvents = new Set(['flood', 'hurricane', 'drought', 'wildfire']);
  if (climateEvents.has(scenario.event_type) && scenario.recovery_time_days < 30) {
    issues.push(issue('TMP-007', 'MODERATE', 'recovery_time_days',
      `Climate event '${scenario.event_type}' with recovery_time_days ${scenario.recovery_time_days} (<30) is unrealistic. Infrastructure rebuild takes at minimum 30 days.`,
      scenario.recovery_time_days, { min: 30, reason: `event_type=${scenario.event_type}` }, true));
    corrections.push({
      rule_id: 'TMP-007',
      patch: { recovery_time_days: Math.max(scenario.recovery_time_days, 30) },
    });
  }

  // ── TMP-008: time_to_impact_days must be < recovery_time_days ────────────
  if (scenario.time_to_impact_days > 0 && scenario.time_to_impact_days >= scenario.recovery_time_days) {
    issues.push(issue('TMP-008', 'MODERATE', 'time_to_impact_days',
      `time_to_impact_days ${scenario.time_to_impact_days} is ≥ recovery_time_days ${scenario.recovery_time_days}. Impact must precede full recovery.`,
      scenario.time_to_impact_days,
      { max: scenario.recovery_time_days - 1 }, false));
  }

  return { issues, corrections };
}

module.exports = { runTemporalValidator };
