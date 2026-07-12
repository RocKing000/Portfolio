/**
 * api/index.js
 *
 * Assembles the /api/v1/ data product router.
 * Mounted in the main server/src/index.js at /api/v1.
 *
 * Middleware order:
 *   apiKeyAuth → usageTracker → route handler
 *
 * All routes under /api/v1/ require a valid API key.
 * Tier-specific feature gates are enforced per-route via requireTier().
 */

'use strict';

const { Router }       = require('express');
const { apiKeyAuth }   = require('./middleware/apiKeyAuth');
const { usageTracker } = require('./middleware/usageTracker');

const scenariosRouter        = require('./routes/scenarios');
const riskScoreRouter        = require('./routes/riskScore');
const dependencyMapRouter    = require('./routes/dependencyMap');
const simulateScenarioRouter = require('./routes/simulateScenario');
const validateExposureRouter = require('./routes/validateExposure');

const router = Router();

// ── Auth + usage tracking on every /api/v1/ request ──────────────────────────
router.use(apiKeyAuth);
router.use(usageTracker);

// ── Routes ────────────────────────────────────────────────────────────────────
router.use('/scenarios',          scenariosRouter);
router.use('/risk-score',         riskScoreRouter);
router.use('/dependency-map',     dependencyMapRouter);
router.use('/simulate-scenario',  simulateScenarioRouter);
router.use('/validate-exposure',  validateExposureRouter);

// ── Version + status ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({
    service:     'DIRE-X Intelligence Feed',
    version:     'v1',
    tier:        req.apiKey.tier,
    owner:       req.apiKey.owner_email,
    rate_limit:  req.apiKey.rate_limit_per_hour === -1 ? 'unlimited' : `${req.apiKey.rate_limit_per_hour}/hour`,
    endpoints: [
      { method: 'GET',  path: '/api/v1/scenarios',                tier_required: 'starter',      description: 'List and filter scenario catalog' },
      { method: 'GET',  path: '/api/v1/scenarios/:id',            tier_required: 'starter',      description: 'Full scenario detail + cascade phases' },
      { method: 'GET',  path: '/api/v1/scenarios/search',         tier_required: 'starter',      description: 'Full-text scenario search' },
      { method: 'GET',  path: '/api/v1/risk-score',               tier_required: 'starter',      description: 'Risk score by scenario, company, or resource' },
      { method: 'GET',  path: '/api/v1/dependency-map',           tier_required: 'starter',      description: 'Supplier dependency graph (depth limited on starter)' },
      { method: 'POST', path: '/api/v1/simulate-scenario',        tier_required: 'professional', description: 'Run a new simulation through the DIRE-X engine' },
      { method: 'POST', path: '/api/v1/validate-exposure',        tier_required: 'professional', description: 'Score your supplier list against scenarios' },
    ],
    docs: 'https://docs.direx.io/api/v1',
  });
});

// ── 404 fallback within /api/v1/ ─────────────────────────────────────────────
router.use((req, res) => {
  res.status(404).json({
    error: `Endpoint not found: ${req.method} /api/v1${req.path}`,
    code:  'ENDPOINT_NOT_FOUND',
    docs:  'https://docs.direx.io/api/v1',
  });
});

module.exports = router;
