/**
 * api/routes/scoringEngine.js
 *
 * Admin routes for the DIRE-X Python Scoring Engine.
 *
 * GET  /api/v1/scoring-engine/health     — check if engine is reachable
 * POST /api/v1/scoring-engine/score      — score a single scenario
 * POST /api/v1/scoring-engine/calibrate  — trigger weight calibration
 *
 * All routes require admin key.
 */

'use strict';

const { Router } = require('express');
const { apiKeyAuth: requireAdminKey } = require('../middleware/apiKeyAuth');
const client = require('../services/scoringEngineClient');

const router = Router();

// ── GET /health ──────────────────────────────────────────────────────────────

router.get('/health', requireAdminKey, async (req, res, next) => {
  try {
    const healthy = await client.isHealthy();
    res.status(healthy ? 200 : 503).json({
      scoring_engine: healthy ? 'online' : 'offline',
      url: process.env.SCORING_ENGINE_URL || 'http://localhost:8001',
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /score ──────────────────────────────────────────────────────────────

router.post('/score', requireAdminKey, async (req, res, next) => {
  try {
    const result = await client.scoreScenario(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ── POST /calibrate ──────────────────────────────────────────────────────────

router.post('/calibrate', requireAdminKey, async (req, res, next) => {
  try {
    const result = await client.calibrate(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
