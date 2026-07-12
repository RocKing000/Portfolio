const express = require('express');
const router = express.Router();
const { runSimulation } = require('../services/simulationOrchestrator');
const { worldState } = require('../services/worldState');
const { requireOwnership } = require('../middleware/auth');
const { analyzeSupplyDepth } = require('../engines/supplyDepthEngine');
const { computeChokepointDependency } = require('../engines/logisticsEngine');
const { REFINING_PROFILES } = require('../config/constants');

// POST /simulate — run a full simulation step
router.post('/', requireOwnership('companyId'), async (req, res, next) => {
  try {
    const { companyId, decision, scenario, currentDay, mode } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required', code: 'MISSING_FIELD' });
    }
    if (!decision || decision.length < 5) {
      return res.status(400).json({ error: 'decision is required (min 5 chars)', code: 'MISSING_FIELD' });
    }

    // In open_world mode, derive the scenario from the world state
    let effectiveScenario = scenario || 'stable';
    let openWorldContext = null;

    if (mode === 'open_world' || !scenario) {
      const activeScenarios = worldState.scenarioEngine.getState();
      if (activeScenarios.length > 0) {
        const primary = activeScenarios.reduce((max, s) =>
          s.intensity > max.intensity ? s : max
        );
        effectiveScenario = primary.type;
        openWorldContext = {
          activeScenarios,
          multipliers: worldState.scenarioEngine.getCombinedMultipliers(),
          worldDay: worldState.currentDay,
        };
      }
    }

    const result = await runSimulation({
      companyId,
      decision,
      scenario: effectiveScenario,
      currentDay: currentDay || worldState.currentDay || 1,
    });

    // Enrich with supply depth analysis
    const company = worldState.companies.get(companyId);
    if (company) {
      const refiningProfile = REFINING_PROFILES[company.industry] || REFINING_PROFILES.electronics;
      result.supplyDepth = analyzeSupplyDepth(company.resources || [], refiningProfile);
      result.logistics = {
        chokepointDependency: computeChokepointDependency(company.resources || []),
      };

      // Record consequence graph
      worldState.consequenceGraph.recordSimulation(companyId, result);

      // Get attribution
      result.attribution = worldState.consequenceGraph.getAttribution(companyId);

      // Write simulation impact back to world state (FIX: unify paths)
      if (result.impact) {
        const scale = (result.decision?.intensity || 5) / 10;
        company.metrics.supply = Math.min(100, Math.max(0,
          company.metrics.supply + (result.impact.supply || 0) * scale * 3));
        company.metrics.economy = Math.min(100, Math.max(0,
          company.metrics.economy + (result.impact.economy || 0) * scale * 3));
        company.metrics.environment = Math.min(100, Math.max(0,
          company.metrics.environment + (result.impact.environment || 0) * scale * 2));
        company.metrics.stability = Math.min(100, Math.max(0,
          company.metrics.stability + (result.impact.stability || 0) * scale * 2));
      }

      // Push events to world history (FIX: events now cascade)
      worldState.pushEvents(result.events);

      // Track decision for leaderboard engagement scoring (cap at 100)
      if (!company.decisionHistory) company.decisionHistory = [];
      company.decisionHistory.push({
        day: worldState.currentDay,
        intent: result.decision?.intent || 'general',
        intensity: result.decision?.intensity || 5,
      });
      if (company.decisionHistory.length > 100) {
        company.decisionHistory = company.decisionHistory.slice(-100);
      }
    }

    if (openWorldContext) {
      result.openWorldContext = openWorldContext;
    }

    // Attach input trust metadata
    result.metadata = result.metadata || {};
    result.metadata.input_trust_score = 1.0 - (req.inputTrustPenalty || 0);
    result.metadata.input_flags = req.inputFlags || [];
    result.metadata.data_source = company ? 'memory' : 'database';

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
