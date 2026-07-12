const express = require('express');
const router = express.Router();
const { calculateEconomics, evolveMarketState, calculatePublicPressure } = require('../engines/economicEngine');
const { runPipeline } = require('../engines/manufacturingEngine');
const { REFINING_PROFILES, SCALE_MULTIPLIERS, SCENARIO_MULTIPLIERS } = require('../config/constants');

// In-memory market state
let marketState = { sentiment: 50, confidence: 50, volatility: 20, demand_index: 50, supply_index: 50 };

// GET /api/economy/market - Get current market state
router.get('/market', (_req, res) => {
  res.json(marketState);
});

// POST /api/economy/calculate - Full economic calculation for a company
router.post('/calculate', (req, res) => {
  const { resources, industry, scale, scenario, workforce } = req.body;

  const refiningProfile = REFINING_PROFILES[industry] || REFINING_PROFILES.electronics;
  const scaleMod = SCALE_MULTIPLIERS[scale] || SCALE_MULTIPLIERS.medium;
  const scenarioMult = SCENARIO_MULTIPLIERS[scenario] || SCENARIO_MULTIPLIERS.stable;

  // Run manufacturing pipeline
  const pipeline = runPipeline({
    resources: resources || [],
    refiningProfile,
    workforce,
    scenarioMultipliers: scenarioMult,
  });

  // Calculate economics
  const economics = calculateEconomics({
    resources: resources || [],
    refiningProfile,
    workforce,
    marketState,
    scenario: scenario || 'stable',
    scaleMod,
  });

  // Calculate public pressure
  const publicPressure = calculatePublicPressure(
    marketState,
    req.body.metrics || { supply: 50, economy: 50, environment: 50, stability: 50 },
    req.body.events || []
  );

  res.json({ economics, pipeline, marketState, publicPressure });
});

// POST /api/economy/tick - Evolve market state for one tick
router.post('/tick', (req, res) => {
  const { events, scenario } = req.body;
  marketState = evolveMarketState(marketState, events || [], scenario || 'stable');
  res.json(marketState);
});

module.exports = router;
