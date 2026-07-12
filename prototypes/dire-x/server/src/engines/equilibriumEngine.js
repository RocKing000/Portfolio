// ============================================
// Equilibrium Engine — Price feedback, mean-reversion, demand destruction
// Replaces random-walk market dynamics with realistic economic behavior
// ============================================

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Price elasticity per resource category.
 * 0 = perfectly inelastic, 1 = perfectly elastic.
 */
const PRICE_ELASTICITY = {
  energy:   { shortTerm: 0.15, longTerm: 0.45 },
  minerals: { shortTerm: 0.25, longTerm: 0.55 },
  food:     { shortTerm: 0.05, longTerm: 0.15 },
  tech:     { shortTerm: 0.30, longTerm: 0.65 },
};

const SCENARIO_PRESSURE = {
  stable:        { sentiment: 0.5,  confidence: 0.3  },
  supply_crisis: { sentiment: -2.0, confidence: -1.5 },
  war:           { sentiment: -3.0, confidence: -2.0 },
  drought:       { sentiment: -1.5, confidence: -1.0 },
  pandemic:      { sentiment: -2.0, confidence: -1.5 },
  trade_war:     { sentiment: -1.5, confidence: -1.5 },
  cyber_attack:  { sentiment: -1.0, confidence: -1.5 },
  energy_crisis: { sentiment: -2.0, confidence: -1.5 },
};

/**
 * Evolve market state with equilibrium feedback.
 * Markets self-correct: high prices → demand destruction → price stabilization.
 *
 * @param {object} prevState - Previous market state
 * @param {Array} events - Day events
 * @param {string} scenario - Dominant scenario type
 * @param {object} economicSignals - { avgCostRatio (current/baseline cost) }
 * @param {object} prng - Seeded PRNG instance (optional, falls back to Math)
 * @returns {object} Updated market state
 */
function evolveMarketWithEquilibrium(prevState, events, scenario, economicSignals, prng) {
  const base = prevState || {
    sentiment: 50, confidence: 50, volatility: 20,
    demand_index: 50, supply_index: 50, baseRate: 2.5,
  };

  const rng = prng || { drift: () => Math.random() - 0.5, next: () => Math.random() };
  const costRatio = economicSignals?.avgCostRatio || 1.0;

  // 1. Mean reversion — markets return toward equilibrium
  const meanReversion = 0.04;
  let sentimentDelta = (50 - base.sentiment) * meanReversion;
  let confidenceDelta = (50 - base.confidence) * meanReversion;
  let demandDelta = (50 - base.demand_index) * 0.03;
  let supplyDelta = (50 - base.supply_index) * 0.02; // supply responds slower

  // 2. Event impact (dampened from v1)
  for (const evt of events || []) {
    const severity = evt.severity || 3;
    sentimentDelta -= severity * 1.0;
    confidenceDelta -= severity * 0.7;
  }

  // 3. Scenario pressure
  const pressure = SCENARIO_PRESSURE[scenario] || SCENARIO_PRESSURE.stable;
  sentimentDelta += pressure.sentiment;
  confidenceDelta += pressure.confidence;

  // 4. DEMAND DESTRUCTION — high prices reduce demand
  if (costRatio > 1.3) {
    demandDelta -= (costRatio - 1.3) * 12;
  }

  // 5. SUPPLY RESPONSE — high prices incentivize new production (slow)
  if (costRatio > 1.5) {
    supplyDelta += (costRatio - 1.5) * 5;
  }

  // 6. Interest rate response
  let rateDelta = 0;
  if (costRatio > 1.4 && base.baseRate < 8) rateDelta += 0.15;
  if (costRatio < 0.8 && base.baseRate > 0.5) rateDelta -= 0.15;
  // Mean-revert rate toward 2.5
  rateDelta += (2.5 - base.baseRate) * 0.02;

  // 7. Small noise (5x smaller than v1 random walk)
  const noise = rng.drift() * 0.8;

  // 8. Volatility: events increase, time decreases
  const eventVolatility = (events || []).length * 0.5;
  const volDecay = 0.3;

  return {
    sentiment: clamp(Math.round((base.sentiment + sentimentDelta + noise) * 10) / 10, 0, 100),
    confidence: clamp(Math.round((base.confidence + confidenceDelta + noise) * 10) / 10, 0, 100),
    volatility: clamp(Math.round((base.volatility + eventVolatility - volDecay) * 10) / 10, 5, 80),
    demand_index: clamp(Math.round((base.demand_index + demandDelta + noise * 0.5) * 10) / 10, 10, 90),
    supply_index: clamp(Math.round((base.supply_index + supplyDelta + noise * 0.5) * 10) / 10, 10, 90),
    baseRate: clamp(Math.round((base.baseRate + rateDelta) * 100) / 100, 0.25, 15),
  };
}

/**
 * Compute cost ratio: current avg cost vs baseline.
 * Used as input signal for equilibrium dynamics.
 */
function computeCostRatio(companies) {
  if (!companies || companies.size === 0) return 1.0;

  let totalCost = 0;
  let totalRevenue = 0;
  let count = 0;

  for (const c of companies.values()) {
    if (c.economics) {
      totalCost += c.economics.total_cost || 0;
      totalRevenue += c.economics.revenue || 1;
      count++;
    }
  }

  if (count === 0 || totalRevenue === 0) return 1.0;
  // Higher cost/revenue ratio = prices are high relative to output
  return Math.round((totalCost / totalRevenue) * 100) / 100;
}

module.exports = {
  evolveMarketWithEquilibrium,
  computeCostRatio,
  PRICE_ELASTICITY,
  SCENARIO_PRESSURE,
};
