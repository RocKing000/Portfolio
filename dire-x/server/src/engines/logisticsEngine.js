// ============================================
// Logistics Engine — Trade route disruptions, shipping costs, chokepoints
// Wires TRADE_ROUTES into actual economic impact
// ============================================

const { TRADE_ROUTES } = require('../config/constants');

/**
 * Which trade routes carry which resources.
 * Derived from TRADE_ROUTES data but structured for fast lookup.
 */
const ROUTE_USAGE = {
  'Crude Oil':           ['hormuz', 'suez', 'persian_gulf'],
  'Natural Gas':         ['hormuz', 'baltic', 'persian_gulf', 'us_eu'],
  'Semiconductors':      ['malacca', 'china_us'],
  'Rare Earth Elements': ['malacca', 'china_us', 'myanmar_cn'],
  'Lithium':             ['chile_china', 'aus_china', 'panama'],
  'Cobalt':              ['drc_china', 'suez'],
  'Copper':              ['chile_china', 'brazil_eu', 'panama'],
  'Nickel':              ['aus_china', 'brazil_eu'],
  'Graphite':            ['myanmar_cn', 'china_us'],
  'Aluminum':            ['brazil_eu', 'aus_china'],
  'Steel':               ['china_us', 'brazil_eu', 'us_eu'],
  'Advanced Alloys':     ['china_us', 'us_eu'],
  'Silicon':             ['china_us', 'malacca'],
  'Uranium':             ['suez', 'us_eu'],
  'Water':               [],  // non-mobile resource
};

const STATUS_COST_MULT = { stable: 1.0, stressed: 1.4, disrupted: 2.5 };
const STATUS_DELAY_DAYS = { stable: 0, stressed: 3, disrupted: 12 };

/**
 * Compute logistics cost modifier and delay for a resource.
 * @param {string} resourceName
 * @param {object} [routeOverrides] — { routeId: 'disrupted' }
 * @returns {{ costMultiplier, delayDays, routeUsed, alternativeRoutes }}
 */
function computeLogisticsCost(resourceName, routeOverrides = {}) {
  const routes = ROUTE_USAGE[resourceName] || [];
  if (routes.length === 0) {
    return { costMultiplier: 1.0, delayDays: 0, routeUsed: 'direct', alternativeRoutes: 0 };
  }

  // Build route status map (live overrides > base data)
  const routeMap = {};
  for (const r of TRADE_ROUTES) {
    routeMap[r.id] = routeOverrides[r.id] || r.status;
  }

  // Find best available route (lowest cost)
  let bestCost = Infinity;
  let bestDelay = 0;
  let bestRoute = null;

  for (const routeId of routes) {
    const status = routeMap[routeId] || 'stable';
    const cost = STATUS_COST_MULT[status] || 1.0;
    if (cost < bestCost) {
      bestCost = cost;
      bestDelay = STATUS_DELAY_DAYS[status] || 0;
      const route = TRADE_ROUTES.find((r) => r.id === routeId);
      bestRoute = route ? route.name : routeId;
    }
  }

  return {
    costMultiplier: bestCost === Infinity ? 1.0 : bestCost,
    delayDays: bestDelay,
    routeUsed: bestRoute || 'direct',
    alternativeRoutes: Math.max(0, routes.length - 1),
  };
}

/**
 * Compute aggregate logistics cost for all resources of a company.
 * Returns weighted average cost multiplier.
 */
function computeCompanyLogistics(companyResources, routeOverrides = {}) {
  let totalWeight = 0;
  let weightedCost = 0;
  let maxDelay = 0;
  const disruptions = [];

  for (const r of companyResources || []) {
    const logistics = computeLogisticsCost(r.name, routeOverrides);
    const weight = r.dependency || 0.5;
    totalWeight += weight;
    weightedCost += logistics.costMultiplier * weight;
    maxDelay = Math.max(maxDelay, logistics.delayDays);

    if (logistics.costMultiplier > 1.0) {
      disruptions.push({
        resource: r.name,
        route: logistics.routeUsed,
        costMultiplier: logistics.costMultiplier,
        delayDays: logistics.delayDays,
        alternatives: logistics.alternativeRoutes,
      });
    }
  }

  const avgCostMult = totalWeight > 0 ? weightedCost / totalWeight : 1.0;

  return {
    avgCostMultiplier: Math.round(avgCostMult * 100) / 100,
    maxDelayDays: maxDelay,
    disruptions,
    disruptionCount: disruptions.length,
  };
}

/**
 * Compute Chokepoint Dependency Score (CDS) for a company.
 * Measures what % of resource imports pass through a single chokepoint.
 */
function computeChokepointDependency(companyResources) {
  const exposure = {}; // routeId → total dependency weight

  for (const r of companyResources || []) {
    const routes = ROUTE_USAGE[r.name] || [];
    for (const routeId of routes) {
      exposure[routeId] = (exposure[routeId] || 0) + (r.dependency || 0.5);
    }
  }

  const totalDep =
    (companyResources || []).reduce((s, r) => s + (r.dependency || 0.5), 0) || 1;
  const maxExposure = Math.max(...Object.values(exposure), 0);

  // Find the critical chokepoint
  let criticalRoute = null;
  let criticalExposure = 0;
  for (const [routeId, exp] of Object.entries(exposure)) {
    if (exp > criticalExposure) {
      criticalExposure = exp;
      criticalRoute = routeId;
    }
  }

  return {
    score: Math.round((maxExposure / totalDep) * 100) / 100,
    criticalChokepoint: criticalRoute,
    exposure,
  };
}

/**
 * Apply scenario effects to trade route statuses.
 * Returns route overrides map.
 */
function getScenarioRouteOverrides(activeScenarios) {
  const overrides = {};

  for (const scenario of activeScenarios || []) {
    const intensity = scenario.intensity || 0;
    if (intensity < 0.3) continue; // too weak to affect routes

    if (scenario.type === 'war') {
      // War degrades all routes near conflict zones
      overrides['china_us'] = intensity > 0.6 ? 'disrupted' : 'stressed';
      overrides['baltic'] = intensity > 0.5 ? 'disrupted' : 'stressed';
    }
    if (scenario.type === 'energy_crisis') {
      overrides['hormuz'] = intensity > 0.5 ? 'disrupted' : 'stressed';
      overrides['persian_gulf'] = intensity > 0.5 ? 'disrupted' : 'stressed';
    }
    if (scenario.type === 'trade_war') {
      overrides['china_us'] = intensity > 0.4 ? 'stressed' : overrides['china_us'];
      overrides['myanmar_cn'] = intensity > 0.6 ? 'stressed' : overrides['myanmar_cn'];
    }
    if (scenario.type === 'supply_crisis') {
      overrides['suez'] = intensity > 0.6 ? 'stressed' : overrides['suez'];
      overrides['malacca'] = intensity > 0.7 ? 'stressed' : overrides['malacca'];
    }
    if (scenario.type === 'cyber_attack') {
      // Cyber attacks target port logistics
      overrides['malacca'] = intensity > 0.5 ? 'stressed' : overrides['malacca'];
    }
  }

  return overrides;
}

module.exports = {
  computeLogisticsCost,
  computeCompanyLogistics,
  computeChokepointDependency,
  getScenarioRouteOverrides,
  ROUTE_USAGE,
};
