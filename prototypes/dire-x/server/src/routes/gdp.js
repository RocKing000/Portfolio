const express = require('express');
const router = express.Router();
const { computeGDPRanking, computeCompanyGDPContribution, computeGlobalTradeVolume } = require('../engines/gdpEngine');
const { worldState } = require('../services/worldState');

const { CACHE_TTL_GDP } = require('../config/server');

let _gdpCache = null;
let _gdpCacheTs = 0;
const GDP_TTL = CACHE_TTL_GDP;

// GET /api/gdp — full global GDP ranking
router.get('/', (req, res) => {
  try {
    if (_gdpCache && Date.now() - _gdpCacheTs < GDP_TTL) {
      res.set('Cache-Control', 'private, max-age=10');
      return res.json(_gdpCache);
    }

    const state = worldState.getState();
    const activeScenarios = state.activeScenarios || [];
    const simulationDay = state.day || 0;
    const multipliers = state.multipliers || {};

    const ranking = computeGDPRanking(multipliers, simulationDay, activeScenarios);
    const tradeVolume = computeGlobalTradeVolume(ranking, multipliers);

    _gdpCache = {
      ranking: ranking.slice(0, 30),
      tradeVolume,
      simulationDay,
      activeScenarioCount: activeScenarios.length,
      generatedAt: new Date().toISOString(),
    };
    _gdpCacheTs = Date.now();

    res.set('Cache-Control', 'private, max-age=10');
    res.json(_gdpCache);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gdp/company/:companyId — company GDP contribution
router.get('/company/:companyId', (req, res) => {
  try {
    const state = worldState.getState();
    const company = state.companies.find(c => c.id === req.params.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const contribution = computeCompanyGDPContribution(company);
    res.json(contribution);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
