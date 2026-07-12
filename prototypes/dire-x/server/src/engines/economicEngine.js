/**
 * Economic Engine
 * Handles output calculation, costs, pricing, revenue, and profit.
 * AI does NOT generate numbers - all calculations are deterministic.
 */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Calculate raw material costs based on resource dependencies and market conditions.
 */
function calculateRawMaterialCost(resources, marketState) {
  let total = 0;
  // Interest rate affects financing costs for commodity procurement
  const ratePressure = 1 + ((marketState?.baseRate || 2.5) - 2.5) * 0.03;
  for (const r of resources) {
    const baseCost = 10 + r.dependency * 40;
    const supplyPressure = (marketState?.supply_index || 50) / 50;
    const demandPressure = (marketState?.demand_index || 50) / 50;
    total += baseCost * supplyPressure * demandPressure * ratePressure * 0.85;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Calculate refining costs based on refining profile.
 */
function calculateRefiningCost(refiningStages, efficiency) {
  let total = 0;
  for (const stage of refiningStages) {
    const baseCost = 15 * stage.costMultiplier;
    const efficiencyPenalty = 1 + (1 - (efficiency || stage.efficiency)) * 0.5;
    total += baseCost * efficiencyPenalty;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Calculate manufacturing costs.
 */
function calculateManufacturingCost(manufacturingStages, workforce) {
  let total = 0;
  for (const stage of manufacturingStages) {
    const baseCost = 20 * (1 + stage.energyIntensity / 100);
    const laborCost = (workforce?.cost_per_worker || 50) * (workforce?.size || 1000) / 10000;
    const wastePenalty = 1 + stage.waste * 2;
    total += (baseCost + laborCost) * wastePenalty;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Calculate total output based on manufacturing capacity and efficiency.
 */
function calculateOutput(manufacturingStages, workforce, scaleMod) {
  let baseOutput = 100 * (scaleMod?.output || 1.0);

  for (const stage of manufacturingStages) {
    baseOutput *= stage.efficiency;
  }

  // Workforce modifier
  if (workforce) {
    const productivityMod = workforce.productivity || 0.7;
    const moraleMod = workforce.morale || 0.7;
    baseOutput *= (productivityMod * 0.6 + moraleMod * 0.4);
  }

  return Math.round(baseOutput * 100) / 100;
}

/**
 * Calculate market price based on supply/demand dynamics.
 */
function calculateMarketPrice(baseCost, marketState, scenario) {
  const demandFactor = (marketState?.demand_index || 50) / 50;
  const supplyFactor = 2 - (marketState?.supply_index || 50) / 50; // inverse: low supply = high price
  const sentimentFactor = (marketState?.sentiment || 50) / 100 + 0.5;

  const scenarioMultiplier = {
    stable: 1.0,
    supply_crisis: 1.3,
    war: 1.5,
    drought: 1.2,
    pandemic: 1.1,
    trade_war: 1.2,
  }[scenario] || 1.0;

  const price = baseCost * 1.3 * demandFactor * supplyFactor * sentimentFactor * scenarioMultiplier;
  return Math.round(price * 100) / 100;
}

/**
 * Full economic calculation for a company in a given simulation tick.
 */
function calculateEconomics({ resources, refiningProfile, workforce, marketState, scenario, scaleMod }) {
  const refiningStages = refiningProfile?.stages || [];
  const manufacturingStages = refiningProfile?.manufacturing || [];

  const rawMaterialCost = calculateRawMaterialCost(resources, marketState);
  const refiningCost = calculateRefiningCost(refiningStages);
  const manufacturingCost = calculateManufacturingCost(manufacturingStages, workforce);
  const totalCost = rawMaterialCost + refiningCost + manufacturingCost;

  const outputUnits = calculateOutput(manufacturingStages, workforce, scaleMod);
  const marketPrice = calculateMarketPrice(totalCost / Math.max(outputUnits, 1), marketState, scenario);
  const revenue = outputUnits * marketPrice;
  const profit = revenue - totalCost;
  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    output_units: outputUnits,
    raw_material_cost: rawMaterialCost,
    refining_cost: refiningCost,
    manufacturing_cost: manufacturingCost,
    total_cost: Math.round(totalCost * 100) / 100,
    market_price: marketPrice,
    revenue: Math.round(revenue * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    profit_margin: Math.round(profitMargin * 10) / 10,
  };
}

/**
 * Update market state based on events and scenario.
 */
function evolveMarketState(prevState, events, scenario) {
  const base = prevState || { sentiment: 50, confidence: 50, volatility: 20, demand_index: 50, supply_index: 50 };

  let sentimentDelta = (Math.random() - 0.5) * 3;
  let confidenceDelta = (Math.random() - 0.5) * 2;
  let volatilityDelta = (Math.random() - 0.5) * 2;

  // Events impact market
  for (const evt of (events || [])) {
    const severity = evt.severity || 3;
    sentimentDelta -= severity * 1.5;
    confidenceDelta -= severity * 1.0;
    volatilityDelta += severity * 0.8;
  }

  // Scenario pressure
  const scenarioPressure = {
    stable: { sentiment: 0.5, confidence: 0.3 },
    supply_crisis: { sentiment: -2, confidence: -1.5 },
    war: { sentiment: -3, confidence: -2 },
    drought: { sentiment: -1.5, confidence: -1 },
    pandemic: { sentiment: -2, confidence: -1.5 },
    trade_war: { sentiment: -1.5, confidence: -1.5 },
  }[scenario] || { sentiment: 0, confidence: 0 };

  return {
    sentiment: clamp(base.sentiment + sentimentDelta + scenarioPressure.sentiment, 0, 100),
    confidence: clamp(base.confidence + confidenceDelta + scenarioPressure.confidence, 0, 100),
    volatility: clamp(base.volatility + volatilityDelta, 5, 80),
    demand_index: clamp(base.demand_index + (Math.random() - 0.5) * 4, 10, 90),
    supply_index: clamp(base.supply_index + (Math.random() - 0.5) * 4, 10, 90),
  };
}

/**
 * Calculate public pressure.
 */
function calculatePublicPressure(marketState, metrics, events) {
  const pricePressure = Math.max(0, (100 - (marketState?.sentiment || 50)) * 0.6);
  const envPressure = (metrics?.environment || 50) * 0.5;
  const shortagePressure = (metrics?.supply || 50) * 0.4;

  // Events amplify pressure
  let eventAmplifier = 0;
  for (const evt of (events || [])) {
    eventAmplifier += (evt.severity || 3) * 2;
  }

  const total = clamp((pricePressure + envPressure + shortagePressure + eventAmplifier) / 3, 0, 100);

  return {
    price_pressure: Math.round(pricePressure * 10) / 10,
    environmental_pressure: Math.round(envPressure * 10) / 10,
    shortage_pressure: Math.round(shortagePressure * 10) / 10,
    total_pressure: Math.round(total * 10) / 10,
  };
}

module.exports = {
  calculateEconomics,
  calculateRawMaterialCost,
  calculateRefiningCost,
  calculateManufacturingCost,
  calculateOutput,
  calculateMarketPrice,
  evolveMarketState,
  calculatePublicPressure,
};
