const express = require('express');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');

dotenv.config();

// Middleware
const { playerSession, requireAdmin, ADMIN_KEY } = require('./middleware/auth');
const { rateLimiter } = require('./middleware/rateLimiter');
const { sanitizerMiddleware } = require('./middleware/inputSanitizer');

// Routes
const companiesRoutes = require('./routes/companies');
const riskRoutes = require('./routes/risk');
const simulateRoutes = require('./routes/simulate');
const worldRoutes = require('./routes/world');
const createCompanyRoutes = require('./routes/createCompany');
const leaderboardRoutes = require('./routes/leaderboard');
const strategicRoutes = require('./routes/strategic');
const economyRoutes = require('./routes/economy');
const workforceRoutes = require('./routes/workforce');
const ideasRoutes = require('./routes/ideas');
const geoRoutes = require('./routes/geo');
const gdpRoutes = require('./routes/gdp');
const geopoliticalRoutes = require('./routes/geopolitical');
const healthRoutes = require('./routes/health');
const complianceRoutes = require('./routes/compliance');
const competitionRoutes = require('./routes/competition');
const countriesRoutes = require('./routes/countries');
const nationsRoutes = require('./routes/nations');
const strategicResourcesRoutes = require('./routes/strategic-resources');
const aiRoutes = require('./routes/ai');
const { startScheduler } = require('./jobs/scheduler');

// ─── Data Product API (v1) ─────────────────────────────────────────────────────
const dataProductRouter = require('./api/index');
const adminKeysRouter   = require('./api/routes/adminKeys');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Global middleware ─────────────────────────────────────────────
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Session management (auto-creates sessions for new clients)
app.use(playerSession);

// Input sanitization (strips XSS, prompt injection, etc.)
app.use(sanitizerMiddleware);

// Global rate limit: 60 requests/minute per session
app.use(rateLimiter('default'));

// ─── Health check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dire-x', version: '2.0.0', timestamp: new Date().toISOString() });
});

// ─── Core routes ───────────────────────────────────────────────────
app.use('/api/companies', companiesRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/simulate', rateLimiter('simulate'), simulateRoutes);
app.use('/api/world-state', worldRoutes);
app.use('/api/create-company', rateLimiter('createCompany'), createCompanyRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Feature routes
app.use('/api/strategic', rateLimiter('strategicAction'), strategicRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/workforce', workforceRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/gdp', gdpRoutes);
app.use('/api/geopolitical', geopoliticalRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/competition', competitionRoutes);
app.use('/api/countries', countriesRoutes);
app.use('/api/nations', nationsRoutes);
app.use('/api/strategic-resources', strategicResourcesRoutes);
app.use('/api/ai', rateLimiter('aiInsight'), aiRoutes);

// ─── Data Product Layer ────────────────────────────────────────────────────────
// /api/v1/  — externally sellable API (API key auth, usage tracking, tier gates)
// /api/admin/keys — API key provisioning (admin key required)
// /api/admin/validation — validation pipeline (admin key required)
app.use('/api/v1', dataProductRouter);
app.use('/api/admin/keys', requireAdmin, adminKeysRouter);
app.use('/api/admin/validation', requireAdmin, require('./api/routes/validateScenario'));
app.use('/api/admin/scoring-engine', requireAdmin, require('./api/routes/scoringEngine'));

// ─── Consequence graph endpoint (new) ──────────────────────────────
app.get('/api/consequences/:companyId', (req, res) => {
  const { worldState } = require('./services/worldState');
  const companyId = req.params.companyId;
  const attribution = worldState.consequenceGraph.getAttribution(companyId);
  const recentChain = worldState.consequenceGraph.getRecentChain(companyId, 20);
  res.json({
    companyId,
    attribution,
    recentChain,
    edgeCount: worldState.consequenceGraph.size,
  });
});

// ─── Admin endpoints (require admin key) ───────────────────────────
app.post('/api/admin/trigger-pipeline', requireAdmin, rateLimiter('pipeline'), async (_req, res) => {
  const { runDataPipeline } = require('./services/dataIngestion');
  try {
    const result = await runDataPipeline();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Error handler ─────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[DIRE-X ERROR]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  });
});

// ─── Startup ───────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   DIRE-X  Decision Intelligence      ║');
  console.log('║   v2.0 — Production Upgrade          ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Port     : ${PORT}`);
  console.log(`  Env      : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Supabase : ${process.env.SUPABASE_URL ? '✓ configured' : '✗ not set (degraded mode)'}`);
  console.log(`  OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✓ configured' : '✗ not set (AI insights disabled)'}`);
  console.log(`  Auth     : ✓ session + ownership + admin`);
  console.log(`  Rate Limit: ✓ per-session sliding window`);
  console.log(`  Sanitizer: ✓ XSS + prompt injection defense`);
  console.log(`  Admin Key: ${ADMIN_KEY.slice(0, 8)}...`);
  console.log(`  Health   : http://localhost:${PORT}/health`);
  console.log(`  ScoringEngine: ${process.env.SCORING_ENGINE_URL || 'http://localhost:8001'}`);
  console.log('');

  // Attempt to restore previous state from Supabase
  const { hydrateState } = require('./services/statePersistence');
  const { worldState } = require('./services/worldState');
  const restored = await hydrateState(worldState).catch(() => false);
  if (!restored) {
    console.log('[Startup] Starting with fresh world state');
  }

  startScheduler();

  // Seed GDP engine from DB on startup (non-blocking)
  const { syncGDPFromDB } = require('./engines/gdpEngine');
  syncGDPFromDB().catch(() => {});
});

module.exports = app;
