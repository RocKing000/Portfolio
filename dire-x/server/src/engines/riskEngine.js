/**
 * engines/riskEngine.js
 * 5-factor weighted strategic risk scoring model (0–100).
 *
 * Factors:
 *   1. Resource Criticality        30%
 *   2. Geopolitical Stability      25%
 *   3. Supply Chain Concentration  20%
 *   4. Conflict Exposure           15%
 *   5. Trade Dependency            10%
 */

// ─── Static baselines ────────────────────────────────────────────────────────

/** Nation-level conflict/trade-dependency baselines (0–100, higher = more risk) */
const NATION_BASELINES = {
  US: { conflict: 15, trade: 20 },
  CN: { conflict: 55, trade: 60 },
  RU: { conflict: 82, trade: 45 },
  KR: { conflict: 40, trade: 55 },
  TW: { conflict: 72, trade: 65 },
  AU: { conflict: 10, trade: 28 },
  JP: { conflict: 14, trade: 50 },
  DE: { conflict: 10, trade: 45 },
  IN: { conflict: 36, trade: 40 },
  GB: { conflict: 14, trade: 35 },
  FR: { conflict: 20, trade: 40 },
  IL: { conflict: 76, trade: 50 },
  SA: { conflict: 50, trade: 55 },
  IR: { conflict: 78, trade: 60 },
  UA: { conflict: 90, trade: 55 },
};

const DEFAULT_BASELINE = { conflict: 40, trade: 40 };

/** Base criticality scores (0–100) for known strategic resources */
const RESOURCE_CRITICALITY = {
  'rare earth elements': 95,
  'semiconductors': 92,
  'lithium': 86,
  'cobalt': 83,
  'uranium': 81,
  'advanced alloys': 78,
  'titanium': 76,
  'crude oil': 72,
  'nickel': 68,
  'natural gas': 65,
  'copper': 60,
  'graphite': 58,
  'silicon': 55,
  'aluminum': 45,
  'steel': 40,
  'water': 35,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

function resourceCriticality(name) {
  return RESOURCE_CRITICALITY[(name || '').toLowerCase().trim()] ?? 50;
}

// ─── Core scorer ─────────────────────────────────────────────────────────────

/**
 * Compute a 0–100 base strategic risk score.
 *
 * @param {object}   params
 * @param {string}   params.nationCode  - ISO-2 country code (e.g. 'US')
 * @param {Array}    params.resources   - Resource rows with fields:
 *   { name, dependency_score, supply_risk, strategic_importance,
 *     geopolitical_index, supply_index }
 * @returns {object} { baseScore, factors }
 */
function computeBaseRiskScore({ nationCode, resources = [] }) {
  const baseline = NATION_BASELINES[nationCode] || DEFAULT_BASELINE;
  const totalWeight = resources.reduce((s, r) => s + (parseFloat(r.dependency_score) || 0.5), 0) || 1;

  // Factor 1: Resource Criticality (30%)
  const f1 = resources.length > 0
    ? resources.reduce((s, r) => {
        const w = parseFloat(r.dependency_score) || 0.5;
        return s + resourceCriticality(r.name) * w;
      }, 0) / totalWeight
    : 50;

  // Factor 2: Geopolitical Stability (25%)
  // Use live geopolitical_index from risk_metrics; fall back to nation baseline
  const f2 = resources.length > 0
    ? resources.reduce((s, r) => s + (parseFloat(r.geopolitical_index) || baseline.conflict), 0) / resources.length
    : baseline.conflict;

  // Factor 3: Supply Chain Concentration (20%)
  // supply_risk from resources table (0–1); supply_index from risk_metrics (0–100)
  const f3 = resources.length > 0
    ? resources.reduce((s, r) => {
        const supplyRisk = parseFloat(r.supply_risk) > 1
          ? parseFloat(r.supply_risk)                     // already 0–100
          : (parseFloat(r.supply_risk) || 0.5) * 100;    // 0–1 → 0–100
        // supply_index represents current supply pressure (higher = worse)
        const supplyIdx = parseFloat(r.supply_index) || supplyRisk;
        return s + (supplyRisk * 0.5 + supplyIdx * 0.5);
      }, 0) / resources.length
    : 50;

  // Factor 4: Conflict Exposure (15%) — pure nation baseline
  const f4 = baseline.conflict;

  // Factor 5: Trade Dependency (10%) — nation baseline
  const f5 = baseline.trade;

  const baseScore = clamp(
    f1 * 0.30 +
    f2 * 0.25 +
    f3 * 0.20 +
    f4 * 0.15 +
    f5 * 0.10
  );

  return {
    baseScore: Math.round(baseScore * 10) / 10,
    factors: {
      resource_criticality: Math.round(f1 * 10) / 10,
      geopolitical_stability: Math.round(f2 * 10) / 10,
      supply_concentration: Math.round(f3 * 10) / 10,
      conflict_exposure: Math.round(f4 * 10) / 10,
      trade_dependency: Math.round(f5 * 10) / 10,
    },
  };
}

/**
 * Apply AI adjustment delta to base score.
 * @param {number} baseScore   0–100
 * @param {number} adjustment  -10 to +10
 * @returns {number}           final clamped score
 */
function applyAIAdjustment(baseScore, adjustment = 0) {
  return clamp(Math.round((baseScore + adjustment) * 10) / 10);
}

module.exports = {
  computeBaseRiskScore,
  applyAIAdjustment,
  resourceCriticality,
  NATION_BASELINES,
};
