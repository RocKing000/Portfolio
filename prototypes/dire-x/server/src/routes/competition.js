const express = require('express');
const router = express.Router();
const { computeCompetition, getSectorSnapshot, SECTOR_COMPETITION } = require('../engines/competitionEngine');
const { worldState } = require('../services/worldState');

// GET /api/competition/:companyId
// Returns competition profile for the given company
router.get('/:companyId', (req, res) => {
  try {
    const { companyId } = req.params;
    const day = worldState.currentDay || 0;

    // Try to find company in world state
    const company = worldState.companies?.get(companyId);

    if (company) {
      const competition = computeCompetition(company, day);
      return res.json({ companyId, day, ...competition });
    }

    // Return generic data by industry query param
    const industry = req.query.industry || 'electronics';
    const country = req.query.country || 'United States';
    const scale = req.query.scale || 'medium';
    const strategy = req.query.strategy || 'balanced';
    const sresScore = parseFloat(req.query.sresScore) || 50;

    const mockCompany = { id: companyId, industry, country, scale, strategy, sresScore };
    const competition = computeCompetition(mockCompany, day);
    res.json({ companyId, day, ...competition });
  } catch (err) {
    console.error('[Competition] Error:', err.message);
    res.status(500).json({ error: 'Failed to compute competition data' });
  }
});

// GET /api/competition/sector/:industry
// Returns sector-level competition snapshot
router.get('/sector/:industry', (req, res) => {
  try {
    const { industry } = req.params;
    const day = worldState.instance?.currentDay || 0;
    const snapshot = getSectorSnapshot(industry, day);
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get sector snapshot' });
  }
});

// GET /api/competition/overview/all
// Returns competition overview for all sectors
router.get('/overview/all', (req, res) => {
  try {
    const day = worldState.currentDay || 0;
    const overview = Object.keys(SECTOR_COMPETITION).map((industry) =>
      getSectorSnapshot(industry, day)
    );
    res.json({ day, sectors: overview });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get competition overview' });
  }
});

module.exports = router;
