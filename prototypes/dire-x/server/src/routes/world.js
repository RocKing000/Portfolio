const router = require('express').Router();
const { worldState } = require('../services/worldState');
const { requireAdmin } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { snapshotState } = require('../services/statePersistence');

// GET /api/world-state - Get current world state
router.get('/', (req, res) => {
  res.json(worldState.getState());
});

// POST /api/world-state/tick - Advance world by one day
router.post('/tick', rateLimiter('tick'), (req, res) => {
  const state = worldState.tick();
  res.json(state);
});

// POST /api/world-state/trigger-scenario - Manually trigger a scenario (admin only)
router.post('/trigger-scenario', requireAdmin, rateLimiter('triggerScenario'), (req, res) => {
  const { type } = req.body;
  if (!type) {
    return res.status(400).json({ error: 'type is required' });
  }
  try {
    const id = worldState.triggerScenario(type);
    res.json({ scenarioId: id, state: worldState.getState() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/world-state/reset (admin only, auto-snapshots before reset)
router.post('/reset', requireAdmin, rateLimiter('reset'), async (req, res) => {
  // Auto-backup before destructive operation
  const snapshotTime = await snapshotState(worldState).catch(() => null);
  worldState.reset();
  res.json({
    success: true,
    previousStateBackedUp: !!snapshotTime,
    backedUpAt: snapshotTime,
  });
});

module.exports = router;
