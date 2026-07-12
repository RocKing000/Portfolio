/**
 * api/services/cascadeService.js
 *
 * Generates time-phased cascade impact records for a scenario.
 *
 * Reuses:
 *   - scenarioLifecycleEngine.js  → phase durations + stage progression
 *   - logisticsEngine.js          → chokepoint disruption magnitudes
 *   - constants.js                → SCENARIO_MULTIPLIERS
 */

'use strict';

const { SCENARIO_MULTIPLIERS } = require('../../config/constants');

// ─── Phase definitions ────────────────────────────────────────────────────────
// Each phase: { label, dayOffset, decayFactor }
// decayFactor: how much of peak impact remains at this phase (1.0 = peak)

const CASCADE_PHASES = [
  { label: 'day_1',     dayOffset: 1,   decayFactor: 0.60 },
  { label: 'day_7',     dayOffset: 7,   decayFactor: 1.00 },  // peak
  { label: 'week_4',    dayOffset: 28,  decayFactor: 0.85 },
  { label: 'month_3',   dayOffset: 90,  decayFactor: 0.65 },
  { label: 'month_6',   dayOffset: 180, decayFactor: 0.45 },
  { label: 'year_1',    dayOffset: 365, decayFactor: 0.25 },
  { label: 'year_2',    dayOffset: 730, decayFactor: 0.10 },
];

// ─── Event type → impact archetype mapping ────────────────────────────────────

const IMPACT_ARCHETYPES = {
  oil_shock: {
    phases: ['day_1', 'day_7', 'week_4', 'month_3', 'month_6', 'year_1'],
    primary_impact_type: 'price_spike',
    secondary_impact_type: 'logistics_delay',
    peak_day_offset: 7,
    recovery_shape: 'gradual',  // vs 'sudden', 'step'
  },
  port_shutdown: {
    phases: ['day_1', 'day_7', 'week_4', 'month_3'],
    primary_impact_type: 'logistics_delay',
    secondary_impact_type: 'inventory_depletion',
    peak_day_offset: 1,
    recovery_shape: 'sudden',
  },
  sanctions: {
    phases: ['day_7', 'week_4', 'month_3', 'month_6', 'year_1', 'year_2'],
    primary_impact_type: 'trade_restriction',
    secondary_impact_type: 'financial_freeze',
    peak_day_offset: 28,
    recovery_shape: 'step',    // recovers in step-changes when sanctions lifted
  },
  climate_disaster: {
    phases: ['day_1', 'day_7', 'week_4', 'month_3', 'month_6', 'year_1'],
    primary_impact_type: 'production_halt',
    secondary_impact_type: 'infrastructure_damage',
    peak_day_offset: 7,
    recovery_shape: 'gradual',
  },
  cyberattack: {
    phases: ['day_1', 'day_7', 'week_4', 'month_3'],
    primary_impact_type: 'system_outage',
    secondary_impact_type: 'data_exfiltration',
    peak_day_offset: 1,
    recovery_shape: 'sudden',
  },
  labor_strike: {
    phases: ['day_7', 'week_4', 'month_3', 'month_6'],
    primary_impact_type: 'production_reduction',
    secondary_impact_type: 'logistics_delay',
    peak_day_offset: 28,
    recovery_shape: 'sudden',
  },
  rare_earth_export_ban: {
    phases: ['day_7', 'week_4', 'month_3', 'month_6', 'year_1', 'year_2'],
    primary_impact_type: 'supply_constraint',
    secondary_impact_type: 'cost_inflation',
    peak_day_offset: 90,       // takes time to bite — inventory buffers absorb
    recovery_shape: 'step',
  },
  geopolitical_conflict: {
    phases: ['day_1', 'day_7', 'week_4', 'month_3', 'month_6', 'year_1', 'year_2'],
    primary_impact_type: 'trade_disruption',
    secondary_impact_type: 'insurance_withdrawal',
    peak_day_offset: 28,
    recovery_shape: 'gradual',
  },
  financial_crisis: {
    phases: ['day_7', 'week_4', 'month_3', 'month_6', 'year_1'],
    primary_impact_type: 'financing_withdrawal',
    secondary_impact_type: 'currency_devaluation',
    peak_day_offset: 28,
    recovery_shape: 'gradual',
  },
  pandemic_health: {
    phases: ['day_7', 'week_4', 'month_3', 'month_6', 'year_1'],
    primary_impact_type: 'workforce_reduction',
    secondary_impact_type: 'logistics_delay',
    peak_day_offset: 90,
    recovery_shape: 'gradual',
  },
  regulatory_change: {
    phases: ['week_4', 'month_3', 'month_6', 'year_1', 'year_2'],
    primary_impact_type: 'compliance_cost',
    secondary_impact_type: 'market_access_loss',
    peak_day_offset: 180,
    recovery_shape: 'step',
  },
  water_scarcity: {
    phases: ['month_3', 'month_6', 'year_1', 'year_2'],
    primary_impact_type: 'production_constraint',
    secondary_impact_type: 'cost_inflation',
    peak_day_offset: 180,
    recovery_shape: 'gradual',
  },
  trade_war: {
    phases: ['week_4', 'month_3', 'month_6', 'year_1', 'year_2'],
    primary_impact_type: 'tariff_impact',
    secondary_impact_type: 'supply_chain_restructuring',
    peak_day_offset: 90,
    recovery_shape: 'step',
  },
  currency_crisis: {
    phases: ['day_1', 'day_7', 'week_4', 'month_3', 'month_6', 'year_1'],
    primary_impact_type: 'cost_inflation',
    secondary_impact_type: 'financing_withdrawal',
    peak_day_offset: 7,
    recovery_shape: 'gradual',
  },
};

const DEFAULT_ARCHETYPE = IMPACT_ARCHETYPES.geopolitical_conflict;

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Generate time-phased cascade records for a scenario.
 *
 * @param {object} params
 * @param {string}  params.scenarioId
 * @param {string}  params.eventType           e.g. 'oil_shock'
 * @param {number}  params.directImpactScore   0–100
 * @param {number}  params.indirectImpactScore 0–100
 * @param {number}  params.recoveryTimeDays
 * @param {number}  params.timeToImpactDays    onset delay before cascade begins
 * @param {string[]} [params.affectedEntities] company or region names
 * @returns {CascadePhase[]}
 */
function generateCascadePhases(params) {
  const {
    scenarioId,
    eventType,
    directImpactScore,
    indirectImpactScore,
    recoveryTimeDays,
    timeToImpactDays = 0,
    affectedEntities = [],
  } = params;

  const archetype = IMPACT_ARCHETYPES[normalizeEventType(eventType)] || DEFAULT_ARCHETYPE;
  const peakImpact = (directImpactScore * 0.6) + (indirectImpactScore * 0.4);

  const phases = [];

  for (const phaseDef of CASCADE_PHASES) {
    if (!archetype.phases.includes(phaseDef.label)) continue;

    // Absolute day from event trigger (onset delay + phase offset)
    const absoluteDay = timeToImpactDays + phaseDef.dayOffset;

    // Is recovery complete by this phase?
    const recoveryComplete = absoluteDay > recoveryTimeDays;

    // Compute magnitude
    const magnitude = recoveryComplete
      ? 0
      : computePhaseMagnitude(peakImpact, phaseDef, archetype, absoluteDay, recoveryTimeDays);

    // Reversal probability increases as we approach recovery
    const reversalProbability = recoveryComplete
      ? 1.0
      : Math.min(0.95, absoluteDay / recoveryTimeDays);

    // Pick representative affected entity for this phase
    const entityIndex = phases.length % Math.max(1, affectedEntities.length);
    const affectedEntity = affectedEntities[entityIndex] || null;

    phases.push({
      scenario_id:           scenarioId,
      phase_label:           phaseDef.label,
      phase_days:            absoluteDay,
      impact_type:           phases.length === 0
                              ? archetype.primary_impact_type
                              : archetype.secondary_impact_type,
      impact_magnitude:      Math.round(magnitude * 10) / 10,
      affected_entity:       affectedEntity,
      entity_type:           affectedEntity ? 'company' : 'region',
      reversal_probability:  Math.round(reversalProbability * 100) / 100,
      phase_notes:           generatePhaseNote(phaseDef.label, archetype, magnitude, recoveryComplete),
    });
  }

  return phases;
}

// ─── Phase magnitude calculation ─────────────────────────────────────────────

function computePhaseMagnitude(peakImpact, phaseDef, archetype, absoluteDay, recoveryTimeDays) {
  const peakDay = archetype.peak_day_offset;

  let raw;
  if (absoluteDay <= peakDay) {
    // Ramp up to peak
    raw = peakImpact * (absoluteDay / peakDay) * phaseDef.decayFactor;
  } else {
    // Decay from peak toward zero
    const shape = archetype.recovery_shape;
    const decayProgress = (absoluteDay - peakDay) / (recoveryTimeDays - peakDay);

    if (shape === 'sudden') {
      // Fast initial recovery
      raw = peakImpact * phaseDef.decayFactor * Math.exp(-2.0 * decayProgress);
    } else if (shape === 'step') {
      // Flat until a step-change, then drops
      const stepThreshold = 0.6;
      raw = decayProgress < stepThreshold
        ? peakImpact * phaseDef.decayFactor * 0.8
        : peakImpact * phaseDef.decayFactor * 0.2;
    } else {
      // Gradual linear decay
      raw = peakImpact * phaseDef.decayFactor * Math.max(0, 1 - decayProgress);
    }
  }

  return Math.max(0, Math.min(100, raw));
}

// ─── Phase narrative generator ────────────────────────────────────────────────

const PHASE_NARRATIVES = {
  day_1:    'Immediate response; emergency protocols activated.',
  day_7:    'First-week impact: inventories strained, spot market pricing reflects disruption.',
  week_4:   'One-month mark: production adjustments underway; Tier-1 supplier alternatives being assessed.',
  month_3:  'Quarterly impact: financial reporting affected; Tier-2/3 exposure materializing.',
  month_6:  'Six-month horizon: structural supply chain adjustments; new contracts being negotiated.',
  year_1:   'One-year mark: market has partially repriced; some capacity restored.',
  year_2:   'Two-year horizon: structural recovery largely complete; residual dependency gaps may persist.',
};

function generatePhaseNote(phaseLabel, archetype, magnitude, recoveryComplete) {
  if (recoveryComplete) return 'Recovery complete at this phase; impact negligible.';
  const base = PHASE_NARRATIVES[phaseLabel] || '';
  const severity = magnitude > 70 ? 'Severe' : magnitude > 40 ? 'Moderate' : 'Mild';
  return `${severity} ${archetype.primary_impact_type} impact (${Math.round(magnitude)}%). ${base}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeEventType(et) {
  return (et || '').toLowerCase().replace(/[^a-z_]/g, '_').replace(/__+/g, '_');
}

module.exports = {
  generateCascadePhases,
  CASCADE_PHASES,
  IMPACT_ARCHETYPES,
};
