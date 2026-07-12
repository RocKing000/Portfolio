const router = require('express').Router();
const { worldState } = require('../services/worldState');

// GET /api/leaderboard
router.get('/', (req, res) => {
  res.json({
    day: worldState.currentDay,
    leaderboard: worldState.leaderboard,
    totalCompanies: worldState.companies.size,
  });
});

module.exports = router;
