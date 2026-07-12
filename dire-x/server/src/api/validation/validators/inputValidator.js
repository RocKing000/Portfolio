'use strict';

/**
 * inputValidator.js
 *
 * Stage 1 of the validation pipeline.
 * Checks schema completeness, type correctness, range bounds, enum membership.
 *
 * Returns: { pass: boolean, issues: Issue[], hardFail: boolean }
 * hardFail = true stops the pipeline immediately (no further validators run).
 */

const VALID_EVENT_TYPES = new Set([
  'oil_shock', 'lng_supply_disruption', 'rare_earth_export_restriction',
  'lithium_supply_shortage', 'semiconductor_shortage', 'sanctions',
  'trade_war_tariffs', 'export_controls', 'armed_conflict_regional',
  'port_shutdown', 'shipping_route_disruption', 'flood', 'hurricane',
  'drought', 'factory_explosion', 'labor_strike', 'cyber_attack_infrastructure',
  'pandemic_lockdown', 'financial_crisis_sovereign',
]);

const VALID_TRUST_TIERS = new Set([
  'synthetic', 'validated', 'live_calibrated', 'expert_reviewed',
]);

const VALID_POLICY_IMPACTS = new Set(['None', 'Moderate', 'High']);
const VALID_MANIP_RISKS    = new Set(['Low', 'Medium', 'High']);
const VALID_EXPOSURE_LEVELS = new Set(['Low', 'Medium', 'High', 'Critical']);

// Required fields for ALL scenarios
const BASE_REQUIRED = [
  'scenario_id', 'event_type', 'region', 'industry',
  'risk_score', 'impact_score', 'confidence_score',
  'recovery_time_days', 'trust_tier', 'assumption_manifest',
];

// Additional required fields per event category
const REQUIRED_BY_CATEGORY = {
  supply_chain: ['supply_disruption', 'import_dependency', 'affected_resources'],
  geopolitical: ['diplomatic_tension', 'trade_flow_impact'],
  climate:      ['infrastructure_damage_score'],
  logistics:    ['logistics_delay_days'],
};

const EVENT_CATEGORY_MAP = {
  oil_shock:                    'supply_chain',
  lng_supply_disruption:        'supply_chain',
  rare_earth_export_restriction:'supply_chain',
  lithium_supply_shortage:      'supply_chain',
  semiconductor_shortage:       'supply_chain',
  sanctions:                    'geopolitical',
  trade_war_tariffs:            'geopolitical',
  export_controls:              'geopolitical',
  armed_conflict_regional:      'geopolitical',
  port_shutdown:                'logistics',
  shipping_route_disruption:    'logistics',
  flood:                        'climate',
  hurricane:                    'climate',
  drought:                      'climate',
  factory_explosion:            'supply_chain',
  labor_strike:                 'logistics',
  cyber_attack_infrastructure:  'supply_chain',
  pandemic_lockdown:            'supply_chain',
  financial_crisis_sovereign:   'geopolitical',
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function issue(ruleId, severity, field, message, observedValue, expectedRange, autoCorrectable = false) {
  return { rule_id: ruleId, severity, field, message, observed_value: observedValue, expected_range: expectedRange, auto_correctable: autoCorrectable };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function runInputValidator(scenario) {
  const issues = [];
  let hardFail = false;

  // ── 1. scenario_id must exist ────────────────────────────────────────────
  if (!scenario.scenario_id || typeof scenario.scenario_id !== 'string') {
    issues.push(issue('INP-001', 'CRITICAL', 'scenario_id',
      'scenario_id is missing or not a string.', scenario.scenario_id, { type: 'string' }));
    hardFail = true;
    return { pass: false, issues, hardFail };
  }

  // ── 2. Base required fields ──────────────────────────────────────────────
  for (const field of BASE_REQUIRED) {
    if (scenario[field] === undefined || scenario[field] === null || scenario[field] === '') {
      issues.push(issue('INP-002', 'CRITICAL', field,
        `Required field '${field}' is missing or null.`, scenario[field], { required: true }));
      hardFail = true;
    }
  }

  if (hardFail) return { pass: false, issues, hardFail };

  // ── 3. Event type valid ──────────────────────────────────────────────────
  if (!VALID_EVENT_TYPES.has(scenario.event_type)) {
    issues.push(issue('INP-003', 'CRITICAL', 'event_type',
      `Unknown event_type '${scenario.event_type}'.`, scenario.event_type,
      { one_of: [...VALID_EVENT_TYPES] }));
    hardFail = true;
  }

  // ── 4. Trust tier valid ──────────────────────────────────────────────────
  if (!VALID_TRUST_TIERS.has(scenario.trust_tier)) {
    issues.push(issue('INP-004', 'CRITICAL', 'trust_tier',
      `Invalid trust_tier '${scenario.trust_tier}'.`, scenario.trust_tier,
      { one_of: [...VALID_TRUST_TIERS] }));
  }

  // ── 5. Enum fields ────────────────────────────────────────────────────────
  if (scenario.policy_impact && !VALID_POLICY_IMPACTS.has(scenario.policy_impact)) {
    issues.push(issue('INP-005', 'MODERATE', 'policy_impact',
      `Invalid policy_impact value '${scenario.policy_impact}'.`, scenario.policy_impact,
      { one_of: [...VALID_POLICY_IMPACTS] }, true));
  }

  if (scenario.manipulation_risk && !VALID_MANIP_RISKS.has(scenario.manipulation_risk)) {
    issues.push(issue('INP-006', 'MODERATE', 'manipulation_risk',
      `Invalid manipulation_risk value '${scenario.manipulation_risk}'.`, scenario.manipulation_risk,
      { one_of: [...VALID_MANIP_RISKS] }, true));
  }

  if (scenario.company_exposure_level && !VALID_EXPOSURE_LEVELS.has(scenario.company_exposure_level)) {
    issues.push(issue('INP-007', 'MINOR', 'company_exposure_level',
      `Invalid company_exposure_level '${scenario.company_exposure_level}'.`, scenario.company_exposure_level,
      { one_of: [...VALID_EXPOSURE_LEVELS] }, true));
  }

  // ── 6. Numeric range checks ───────────────────────────────────────────────
  const numericRanges = [
    { field: 'risk_score',           min: 0,    max: 100 },
    { field: 'direct_impact_score',  min: 0,    max: 100 },
    { field: 'indirect_impact_score',min: 0,    max: 100 },
    { field: 'impact_score',         min: 0,    max: 1   },
    { field: 'confidence_score',     min: 0,    max: 1   },
    { field: 'hidden_dependency_pct',min: 0,    max: 100 },
    { field: 'recovery_time_days',   min: 1,    max: 3650 },
    { field: 'time_to_impact_days',  min: 0,    max: 3650 },
  ];

  for (const { field, min, max } of numericRanges) {
    const val = scenario[field];
    if (val === undefined || val === null) continue; // optional fields skipped
    if (typeof val !== 'number' || isNaN(val)) {
      issues.push(issue('INP-008', 'CRITICAL', field,
        `Field '${field}' must be a number, got ${typeof val}.`, val, { type: 'number' }));
      hardFail = true;
    } else if (val < min || val > max) {
      issues.push(issue('INP-009', 'CRITICAL', field,
        `Field '${field}' value ${val} is out of bounds [${min}, ${max}].`, val, { min, max }));
      hardFail = true;
    }
  }

  if (hardFail) return { pass: false, issues, hardFail };

  // ── 7. Category-specific required fields ─────────────────────────────────
  const category = EVENT_CATEGORY_MAP[scenario.event_type];
  if (category && REQUIRED_BY_CATEGORY[category]) {
    for (const field of REQUIRED_BY_CATEGORY[category]) {
      const val = scenario[field];
      if (val === undefined || val === null || (Array.isArray(val) && val.length === 0)) {
        issues.push(issue('INP-010', 'CRITICAL', field,
          `Field '${field}' is required for event category '${category}' (event_type: ${scenario.event_type}).`,
          val, { required_for_category: category }));
        hardFail = true;
      }
    }
  }

  // ── 8. assumption_manifest must be a non-empty object ────────────────────
  const manifest = scenario.assumption_manifest;
  if (typeof manifest !== 'object' || Array.isArray(manifest) || Object.keys(manifest).length === 0) {
    issues.push(issue('INP-011', 'CRITICAL', 'assumption_manifest',
      'assumption_manifest must be a non-empty object. Scenarios without documented assumptions cannot be trusted.',
      manifest, { type: 'object', min_keys: 1 }));
    hardFail = true;
  }

  // ── 9. country_codes must be a non-empty array ────────────────────────────
  if (!Array.isArray(scenario.country_codes) || scenario.country_codes.length === 0) {
    issues.push(issue('INP-012', 'MODERATE', 'country_codes',
      'country_codes must be a non-empty array of ISO-2 country codes.',
      scenario.country_codes, { type: 'array', min_length: 1 }));
  }

  const passed = issues.filter(i => i.severity === 'CRITICAL').length === 0;
  return { pass: passed, issues, hardFail: hardFail || !passed };
}

module.exports = { runInputValidator, EVENT_CATEGORY_MAP };
