const {
  INDUSTRY_RESOURCE_MAP,
  STRATEGY_MODIFIERS,
  SCALE_MULTIPLIERS,
  COUNTRY_RISK_MAP,
} = require('../config/constants');

/**
 * Map a resource name to its category.
 * @param {string} resourceName
 * @returns {string} One of 'energy', 'minerals', 'food', 'tech'
 */
function getCategory(resourceName) {
  const name = resourceName.toLowerCase();

  const energyResources = ['crude oil', 'natural gas', 'uranium'];
  const mineralResources = [
    'lithium',
    'cobalt',
    'copper',
    'rare earth elements',
    'iron ore',
  ];
  const foodResources = ['wheat', 'rice', 'corn', 'soybeans'];
  const techResources = ['semiconductors', 'batteries'];

  if (energyResources.some((r) => name.includes(r))) return 'energy';
  if (mineralResources.some((r) => name.includes(r))) return 'minerals';
  if (foodResources.some((r) => name.includes(r))) return 'food';
  if (techResources.some((r) => name.includes(r))) return 'tech';

  return 'minerals'; // default fallback
}

/**
 * Create a fully formed company profile with computed resources, metrics, and SRES.
 *
 * @param {{ industry: string, country: string, strategy: string, scale: string, name?: string }} params
 * @returns {Promise<Object>} The company profile
 */
async function createCompany({ industry, country, strategy, scale, name }) {
  // 1. Get base resources from INDUSTRY_RESOURCE_MAP
  const baseResources =
    INDUSTRY_RESOURCE_MAP[industry] || INDUSTRY_RESOURCE_MAP.electronics;

  // 2. Apply STRATEGY_MODIFIERS to dependencies
  const stratMod = STRATEGY_MODIFIERS[strategy] || STRATEGY_MODIFIERS.balanced;

  // 3. Apply SCALE_MULTIPLIERS
  const scaleMod = SCALE_MULTIPLIERS[scale] || SCALE_MULTIPLIERS.medium;

  // 4. Apply COUNTRY_RISK_MAP to geopolitical scores
  const countryRisk = COUNTRY_RISK_MAP[country] || 0.5;

  const resources = baseResources.map((r) => {
    let dep = r.dep * stratMod.dependency * scaleMod.dependency;
    dep = Math.min(1, Math.max(0, dep));
    return {
      name: r.resource,
      dependency: Math.round(dep * 100) / 100,
      category: getCategory(r.resource),
    };
  });

  // 5. Compute initial metrics based on country risk and strategy
  const baseSupply = 50 + countryRisk * 30;
  const baseEconomy = 45 + countryRisk * 20;
  const baseEnv =
    40 + (strategy === 'sustainable' ? -15 : strategy === 'cost' ? 20 : 0);
  const baseStability = 50 + countryRisk * 25;

  // 6. Compute SRES for each resource
  let totalSRES = 0;
  let totalWeight = 0;

  const resourceDetails = resources.map((r) => {
    const d = baseSupply * stratMod.supply_risk;
    const s = baseSupply;
    const g = countryRisk * 100 * stratMod.geo_risk;
    const e = baseEnv * stratMod.env_risk;
    const sres = Math.min(
      100,
      Math.max(0, 0.35 * d + 0.3 * s + 0.2 * g + 0.15 * e)
    );
    totalSRES += r.dependency * sres;
    totalWeight += r.dependency;
    return { ...r, sres: Math.round(sres * 10) / 10 };
  });

  // 7. Compute company SRES
  const companySRES =
    totalWeight > 0
      ? Math.round((totalSRES / totalWeight) * 10) / 10
      : 50;

  // 8. Return full company profile
  return {
    id: `company-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name || `${industry.toUpperCase()} Corp`,
    industry,
    country,
    strategy,
    scale,
    resources: resourceDetails,
    metrics: {
      supply: Math.round(baseSupply * 10) / 10,
      economy: Math.round(baseEconomy * 10) / 10,
      environment: Math.round(baseEnv * 10) / 10,
      stability: Math.round(baseStability * 10) / 10,
    },
    sresScore: companySRES,
    scores: {
      growth: 50,
      sustainability: strategy === 'sustainable' ? 65 : 45,
      stability: 50,
      supplyHealth: 50,
    },
    createdAt: new Date().toISOString(),
  };
}

module.exports = { createCompany, getCategory };
