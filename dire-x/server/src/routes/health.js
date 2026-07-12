const express = require('express');
const router = express.Router();
const {
  getCountryHealth, getCountryLiteracy, getSocialIndex, getAllSocialIndicators,
  getCountryPopulation, getGovernmentBudget,
} = require('../engines/healthLiteracyEngine');
const { worldState } = require('../services/worldState');

// GET /api/health/all — all countries social indicators
router.get('/all', (req, res) => {
  try {
    const state = worldState.getState();
    const indicators = getAllSocialIndicators(state.activeScenarios || [], state.day || 0);
    res.json({ indicators, simulationDay: state.day });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/health/population/:country — full population breakdown
router.get('/population/:country', (req, res) => {
  try {
    const state = worldState.getState();
    const country = decodeURIComponent(req.params.country);
    const metrics = state.companies?.find(c => c.country === country)?.metrics || {};
    const population = getCountryPopulation(country, metrics, state.day || 0);
    res.json(population);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/health/budget/:country — government budget allocation
router.get('/budget/:country', (req, res) => {
  try {
    const state = worldState.getState();
    const country = decodeURIComponent(req.params.country);
    const metrics = state.companies?.find(c => c.country === country)?.metrics || {};
    const budget = getGovernmentBudget(country, metrics, state.day || 0);
    res.json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/health/:country — health + literacy for a country
router.get('/:country', (req, res) => {
  try {
    const state = worldState.getState();
    const country = decodeURIComponent(req.params.country);
    const data = getSocialIndex(country, state.activeScenarios || [], state.day || 0);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
