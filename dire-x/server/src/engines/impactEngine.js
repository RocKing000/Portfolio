/**
 * Calculate base impact from intensity, dependency, and SRES.
 * Impact = intensity * dependency * (sres / 100)
 */
function calculateImpact(intensity, dependency, sres) {
  const safeIntensity = Math.max(0, Math.min(10, intensity || 0));
  const safeDependency = Math.max(0, Math.min(1, dependency || 0));
  const safeSres = Math.max(0, Math.min(100, sres || 0));

  return Math.round(safeIntensity * safeDependency * (safeSres / 100) * 1000) / 1000;
}

/**
 * Split a base impact value into dimensional components based on event type.
 * Each event type has a distribution profile across the four dimensions.
 */
function calculateDimensionalImpact(baseImpact, eventType) {
  const distributions = {
    supply: { supply: 0.45, economy: 0.25, environment: 0.10, stability: 0.20 },
    economy: { supply: 0.15, economy: 0.45, environment: 0.10, stability: 0.30 },
    environment: { supply: 0.20, economy: 0.15, environment: 0.45, stability: 0.20 },
    stability: { supply: 0.15, economy: 0.25, environment: 0.10, stability: 0.50 },
  };

  const dist = distributions[eventType] || distributions.supply;

  return {
    supply: Math.round(baseImpact * dist.supply * 1000) / 1000,
    economy: Math.round(baseImpact * dist.economy * 1000) / 1000,
    environment: Math.round(baseImpact * dist.environment * 1000) / 1000,
    stability: Math.round(baseImpact * dist.stability * 1000) / 1000,
  };
}

/**
 * Aggregate an array of dimensional impact objects into a single combined impact.
 * Uses diminishing-returns formula: combined = 1 - product(1 - impact_i) for each dimension.
 * Then scales to a 0-10 range.
 */
function aggregateImpacts(impacts) {
  if (!impacts || impacts.length === 0) {
    return { supply: 0, economy: 0, environment: 0, stability: 0, total: 0 };
  }

  const dimensions = ['supply', 'economy', 'environment', 'stability'];
  const result = {};

  for (const dim of dimensions) {
    const values = impacts.map((imp) => Math.min(1, Math.max(0, (imp[dim] || 0) / 10)));
    const product = values.reduce((acc, v) => acc * (1 - v), 1);
    result[dim] = Math.round((1 - product) * 10 * 1000) / 1000;
  }

  result.total =
    Math.round(
      ((result.supply + result.economy + result.environment + result.stability) / 4) * 1000
    ) / 1000;

  return result;
}

module.exports = {
  calculateImpact,
  calculateDimensionalImpact,
  aggregateImpacts,
};
