const express = require('express');
const router = express.Router();
const {
  getCountryRelations,
  getGlobalRelationsSnapshot,
  computeSupplyRiskModifier,
  computeTariffMultiplier,
} = require('../engines/geopoliticalEngine');
const { worldState } = require('../services/worldState');

// GET /api/geopolitical/relations/:country — relations for a specific country
router.get('/relations/:country', (req, res) => {
  try {
    const state = worldState.getState();
    const country = decodeURIComponent(req.params.country);
    const relations = getCountryRelations(country, state.activeScenarios || [], state.day || 0);
    res.json({ country, relations, simulationDay: state.day });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/geopolitical/snapshot — global relations heatmap
router.get('/snapshot', (req, res) => {
  try {
    const state = worldState.getState();
    const pairs = getGlobalRelationsSnapshot(state.activeScenarios || [], state.day || 0);
    res.json({ pairs, simulationDay: state.day, pairCount: pairs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/geopolitical/supply-risk — supply risk modifier for a company's country
router.get('/supply-risk/:country', (req, res) => {
  try {
    const state = worldState.getState();
    const country = decodeURIComponent(req.params.country);
    const producers = (req.query.producers || '').split(',').filter(Boolean);
    const riskModifier = computeSupplyRiskModifier(country, producers, state.activeScenarios || [], state.day || 0);
    res.json({ country, riskModifier, producers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
