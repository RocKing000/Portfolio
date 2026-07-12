const express = require('express');
const router = express.Router();
const { createStrategicAction, getAvailableActions, processStrategicActions } = require('../engines/strategicEngine');
const { requireOwnership } = require('../middleware/auth');

// In-memory store for strategic actions (per company)
const companyActions = new Map();

// GET /api/strategic/:companyId - Get available and active actions
router.get('/:companyId', (req, res) => {
  const { companyId } = req.params;
  const metrics = req.query;
  const active = companyActions.get(companyId) || [];

  const available = getAvailableActions(
    { id: companyId },
    active,
    {
      supply: parseFloat(metrics.supply) || 50,
      economy: parseFloat(metrics.economy) || 50,
      environment: parseFloat(metrics.environment) || 50,
      stability: parseFloat(metrics.stability) || 50,
    }
  );

  res.json({ available, active });
});

// POST /api/strategic - Create a new strategic action (ownership required)
router.post('/', requireOwnership('companyId'), (req, res) => {
  const { companyId, actionType, title, description, target, currentDay } = req.body;

  if (!companyId || !actionType) {
    return res.status(400).json({ error: 'companyId and actionType are required' });
  }

  try {
    const action = createStrategicAction({
      companyId,
      actionType,
      title,
      description,
      target,
      currentDay: currentDay || 0,
    });

    const existing = companyActions.get(companyId) || [];
    existing.push(action);
    companyActions.set(companyId, existing);

    res.json({ action, message: `${action.title} initiated. Effects begin in ${action.delay_days} days.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/strategic/process - Process actions for a tick
router.post('/process', (req, res) => {
  const { companyId, currentDay } = req.body;
  const actions = companyActions.get(companyId) || [];

  const { adjustments, updatedActions } = processStrategicActions(actions, currentDay || 0);
  companyActions.set(companyId, updatedActions);

  res.json({ adjustments, actions: updatedActions });
});

module.exports = router;
