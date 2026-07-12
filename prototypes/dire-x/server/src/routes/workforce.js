const express = require('express');
const router = express.Router();
const { initializeWorkforce, evolveWorkforce, evolvePopulation, calculateWorkforceCost } = require('../engines/workforceEngine');
const { WORKFORCE_PROFILES, COUNTRY_RISK_MAP } = require('../config/constants');

// In-memory workforce store
const companyWorkforces = new Map();
const populationStates = new Map();

// POST /api/workforce/init - Initialize workforce for a company
router.post('/init', (req, res) => {
  const { companyId, industry, scale, country } = req.body;

  if (!companyId || !industry) {
    return res.status(400).json({ error: 'companyId and industry are required' });
  }

  const countryRisk = COUNTRY_RISK_MAP[country] || 0.5;
  const workforce = initializeWorkforce(industry, scale || 'medium', country, WORKFORCE_PROFILES, countryRisk);

  companyWorkforces.set(companyId, workforce);

  res.json({ workforce, totalCost: calculateWorkforceCost(workforce) });
});

// GET /api/workforce/:companyId - Get current workforce state
router.get('/:companyId', (req, res) => {
  const workforce = companyWorkforces.get(req.params.companyId);
  if (!workforce) {
    return res.status(404).json({ error: 'Workforce not initialized for this company' });
  }
  res.json({ workforce, totalCost: calculateWorkforceCost(workforce) });
});

// POST /api/workforce/tick - Evolve workforce for one tick
router.post('/tick', (req, res) => {
  const { companyId, metrics, events, strategicActions } = req.body;

  let workforce = companyWorkforces.get(companyId);
  if (!workforce) {
    // Auto-initialize with defaults
    workforce = initializeWorkforce('electronics', 'medium', 'United States', WORKFORCE_PROFILES, 0.3);
  }

  const evolved = evolveWorkforce(workforce, metrics, events, strategicActions);
  companyWorkforces.set(companyId, evolved);

  res.json({ workforce: evolved, totalCost: calculateWorkforceCost(evolved) });
});

// POST /api/workforce/population - Evolve population state
router.post('/population', (req, res) => {
  const { country, metrics, events } = req.body;
  const prev = populationStates.get(country);
  const evolved = evolvePopulation(prev, metrics, events, country);
  populationStates.set(country, evolved);

  res.json(evolved);
});

module.exports = router;
