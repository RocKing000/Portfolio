const { SRES_WEIGHTS, SCENARIO_MULTIPLIERS } = require('../config/constants');

/**
 * Compute SRES for a single resource.
 * SRES_r = 0.35*D + 0.30*S + 0.20*G + 0.15*E, clamped to [0, 100].
 */
function computeSRES(resource, metrics, weights) {
  const w = weights || SRES_WEIGHTS;
  const d = clamp(metrics.demand || 0, 0, 100);
  const s = clamp(metrics.supply || 0, 0, 100);
  const g = clamp(metrics.geopolitical || 0, 0, 100);
  const e = clamp(metrics.environmental || 0, 0, 100);

  const raw = w.demand * d + w.supply * s + w.geopolitical * g + w.environmental * e;
  return clamp(Math.round(raw * 100) / 100, 0, 100);
}

/**
 * Compute company-level SRES as a dependency-weighted sum of resource SRES values.
 * companySRES = sum(dependency_i * sres_i) / sum(dependency_i)
 */
function computeCompanySRES(resources, companyResources) {
  if (!companyResources || companyResources.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const cr of companyResources) {
    const dep = cr.dependency || 0;
    const sres = cr.sres || 0;
    weightedSum += dep * sres;
    totalWeight += dep;
  }

  if (totalWeight === 0) return 0;
  return clamp(Math.round((weightedSum / totalWeight) * 100) / 100, 0, 100);
}

/**
 * Apply scenario modifiers to base metrics.
 * Each dimension is multiplied by its scenario multiplier, then clamped to [0, 100].
 */
function applyScenarioModifiers(metrics, scenario) {
  const multipliers = SCENARIO_MULTIPLIERS[scenario] || SCENARIO_MULTIPLIERS.stable;

  return {
    demand: clamp(Math.round((metrics.demand || 50) * (multipliers.demand || 1.0) * 100) / 100, 0, 100),
    supply: clamp(Math.round((metrics.supply || 50) * (multipliers.supply || 1.0) * 100) / 100, 0, 100),
    geopolitical: clamp(Math.round((metrics.geopolitical || 50) * (multipliers.geo || 1.0) * 100) / 100, 0, 100),
    environmental: clamp(Math.round((metrics.environmental || 50) * (multipliers.env || 1.0) * 100) / 100, 0, 100),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

module.exports = {
  computeSRES,
  computeCompanySRES,
  applyScenarioModifiers,
};
