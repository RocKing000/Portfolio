const { ScenarioLifecycleEngine } = require('../engines/scenarioLifecycleEngine');
const { calculateEconomics, calculatePublicPressure } = require('../engines/economicEngine');
const { runPipeline } = require('../engines/manufacturingEngine');
const { evolveWorkforce } = require('../engines/workforceEngine');
const { processStrategicActions, evaluateGovernanceResponse } = require('../engines/strategicEngine');
const { generateEvents } = require('../engines/eventEngine');
const { evolveMarketWithEquilibrium, computeCostRatio } = require('../engines/equilibriumEngine');
const { ConsequenceGraph } = require('../engines/consequenceGraph');
const { computeCompanyLogistics, computeChokepointDependency, getScenarioRouteOverrides } = require('../engines/logisticsEngine');
const { toFullName } = require('../utils/countryResolver');
const { createCompanyPRNG, createDayPRNG } = require('../utils/prng');
const { maybeSnapshot } = require('./statePersistence');
const {
  LEADERBOARD_WEIGHTS, REFINING_PROFILES, SCALE_MULTIPLIERS,
  SCENARIO_MULTIPLIERS, GOVERNANCE_STYLES,
} = require('../config/constants');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

class WorldState {
  constructor() {
    this.scenarioEngine = new ScenarioLifecycleEngine();
    this.consequenceGraph = new ConsequenceGraph();
    this.companies = new Map();
    this.currentDay = 0;
    this.mode = 'open_world';
    this.events = [];          // rolling event history (last 200)
    this.leaderboard = [];
    this.marketState = {
      sentiment: 50, confidence: 50, volatility: 20,
      demand_index: 50, supply_index: 50, baseRate: 2.5,
    };
    this.publicPressure = {
      price_pressure: 25, environmental_pressure: 25,
      shortage_pressure: 20, total_pressure: 25,
    };
    this.governancePolicies = [];
    this.populationStates = new Map();
    this.environmentalDebt = 0; // cumulative environmental damage
  }

  addCompany(company) {
    if (!company.economics) {
      company.economics = { output_units: 100, total_cost: 500, revenue: 750, profit: 250, profit_margin: 33.3 };
    }
    if (!company.workforce) {
      company.workforce = { size: 2000, skill_level: 0.6, productivity: 0.7, cost_per_worker: 50, morale: 0.7 };
    }
    if (!company.strategicActions) company.strategicActions = [];
    if (!company.pipeline) company.pipeline = { pipelineHealth: 0.75, bottlenecks: [] };
    if (!company.decisionHistory) company.decisionHistory = [];
    if (!company.crisesSurvived) company.crisesSurvived = 0;
    this.companies.set(company.id, company);
  }

  /**
   * Push events from simulation results into world event history.
   * These feed into subsequent workforce/market evolution.
   */
  pushEvents(events) {
    if (!events || events.length === 0) return;
    this.events.push(...events);
    // Keep rolling buffer of last 200 events
    if (this.events.length > 200) {
      this.events = this.events.slice(-200);
    }
  }

  tick() {
    this.currentDay++;
    const scenarioState = this.scenarioEngine.tick();
    const multipliers = this.scenarioEngine.getCombinedMultipliers();
    const dominantScenario = this.scenarioEngine.getDominantScenario();
    const dayPRNG = createDayPRNG(this.currentDay);

    // Get route overrides from active scenarios
    const activeScenarios = this.scenarioEngine.getState();
    const routeOverrides = getScenarioRouteOverrides(activeScenarios);

    // Collect events generated THIS tick from all companies
    const dayEvents = [];

    // Track environmental debt from active scenarios
    if (dominantScenario === 'drought' || dominantScenario === 'energy_crisis') {
      this.environmentalDebt = Math.min(15, this.environmentalDebt + 0.3);
    }
    // Slow environmental debt recovery
    this.environmentalDebt = Math.max(0, this.environmentalDebt - 0.05);

    for (const [id, company] of this.companies) {
     try {
      const prng = createCompanyPRNG(id, this.currentDay);

      // 1. Update base metrics from scenario multipliers (seeded randomness)
      const supplyDelta = (multipliers.supply - 1) * 5 + prng.drift() * 3;
      const economyDelta = (multipliers.demand - 1) * 4 + prng.drift() * 2;
      // Environmental debt has nonlinear impact: gentle below 5, harsh above 10
      const debtImpact = this.environmentalDebt <= 5
        ? this.environmentalDebt * 0.15
        : this.environmentalDebt * 0.5;
      const envDelta = (multipliers.env - 1) * 3 + prng.drift() * 2 + debtImpact;
      const stabilityDelta = (multipliers.geo - 1) * 4 + prng.drift() * 2;

      company.metrics.supply = clamp(company.metrics.supply + supplyDelta, 0, 100);
      company.metrics.economy = clamp(company.metrics.economy + economyDelta, 0, 100);
      company.metrics.environment = clamp(company.metrics.environment + envDelta, 0, 100);
      company.metrics.stability = clamp(company.metrics.stability + stabilityDelta, 0, 100);

      // Record in consequence graph
      this.consequenceGraph.recordTick(id, this.currentDay, 'scenario', 'supply', supplyDelta);
      this.consequenceGraph.recordTick(id, this.currentDay, 'scenario', 'stability', stabilityDelta);

      // 2. Process strategic actions (filter out completed)
      if (company.strategicActions && company.strategicActions.length > 0) {
        const { adjustments, updatedActions } = processStrategicActions(company.strategicActions, this.currentDay);
        company.strategicActions = updatedActions.filter(a => a.status !== 'completed');
        company.metrics.supply = clamp(company.metrics.supply + adjustments.supply, 0, 100);
        company.metrics.economy = clamp(company.metrics.economy + adjustments.economy, 0, 100);
        company.metrics.environment = clamp(company.metrics.environment + adjustments.environment, 0, 100);
        company.metrics.stability = clamp(company.metrics.stability + adjustments.stability, 0, 100);
      }

      // 3. Generate events based on company stress
      const avgStress = (company.metrics.supply + company.metrics.economy +
        company.metrics.environment + company.metrics.stability) / 4;
      const stressForEvents = avgStress * (multipliers.supply + multipliers.geo) / 2 / 10;
      // Use only THIS company's recent events for cascade (not global pool)
      const companyHistory = this.events.filter(e => e._companyId === id).slice(-10);
      const companyEvents = generateEvents(stressForEvents, dominantScenario, this.currentDay, companyHistory);
      // Tag events with company ID for cascade isolation
      for (const evt of companyEvents) { evt._companyId = id; }
      dayEvents.push(...companyEvents);

      // 4. Evolve workforce WITH events (FIX: was getting empty array)
      if (company.workforce) {
        company.workforce = evolveWorkforce(
          company.workforce, company.metrics, companyEvents, company.strategicActions
        );

        // Workforce morale crisis: attrition when morale stays low
        if (company.workforce.morale < 0.25) {
          company.workforce.size = Math.round(company.workforce.size * 0.998); // 0.2% attrition per tick
        }
      }

      // 5. Run manufacturing pipeline with logistics
      const refiningProfile = REFINING_PROFILES[company.industry] || REFINING_PROFILES.electronics;
      const scenarioMult = SCENARIO_MULTIPLIERS[dominantScenario] || SCENARIO_MULTIPLIERS.stable;

      // Apply logistics disruption to scenario multipliers
      const logistics = computeCompanyLogistics(company.resources || [], routeOverrides);
      const adjustedScenarioMult = {
        ...scenarioMult,
        supply: (scenarioMult.supply || 1) * logistics.avgCostMultiplier,
      };

      company.pipeline = runPipeline({
        resources: company.resources || [],
        refiningProfile,
        workforce: company.workforce,
        scenarioMultipliers: adjustedScenarioMult,
      });

      // 6. Calculate economics
      const scaleMod = SCALE_MULTIPLIERS[company.scale] || SCALE_MULTIPLIERS.medium;
      company.economics = calculateEconomics({
        resources: company.resources || [],
        refiningProfile,
        workforce: company.workforce,
        marketState: this.marketState,
        scenario: dominantScenario,
        scaleMod,
      });

      // 7. Compute logistics metadata
      company.logistics = logistics;
      company.chokepointDependency = computeChokepointDependency(company.resources || []);

      // 8. Update scores
      company.scores.growth = clamp(
        50 + (100 - company.metrics.supply) * 0.2 + (100 - company.metrics.economy) * 0.2 +
        (company.economics.profit_margin > 0 ? company.economics.profit_margin * 0.3 : -10),
        0, 100
      );

      // Sustainability: sustainable strategy gets bonus BUT cost strategy is cheaper
      const sustainCost = company.strategy === 'sustainable' ? 0.3 : -0.1;
      const envPenalty = company.metrics.environment > 60 ? 0.3 : 0;
      company.scores.sustainability = clamp(
        company.scores.sustainability + sustainCost - envPenalty,
        0, 100
      );

      company.scores.stability = clamp(100 - company.metrics.stability * 0.8, 0, 100);
      company.scores.supplyHealth = clamp(
        100 - company.metrics.supply * 0.5 - (company.pipeline?.bottlenecks?.length || 0) * 5,
        0, 100
      );

      // Track crisis survival
      if (dominantScenario !== 'stable' && avgStress > 60) {
        company._inCrisis = true;
      } else if (company._inCrisis && (dominantScenario === 'stable' || avgStress < 50)) {
        company.crisesSurvived = (company.crisesSurvived || 0) + 1;
        company._inCrisis = false;
      }
     } catch (companyErr) {
      console.error(`[WorldState] Tick error for company ${id}:`, companyErr.message);
      // Continue processing other companies — don't let one crash kill the world
     }
    }

    // Push day events into history
    this.pushEvents(dayEvents);

    // Evolve market state with equilibrium feedback (FIX: replaces random walk)
    const costRatio = computeCostRatio(this.companies);
    this.marketState = evolveMarketWithEquilibrium(
      this.marketState,
      dayEvents,
      dominantScenario,
      { avgCostRatio: costRatio },
      dayPRNG
    );

    // Calculate public pressure
    const avgMetrics = this.getAverageMetrics();
    this.publicPressure = calculatePublicPressure(this.marketState, avgMetrics, dayEvents);

    // Evaluate governance (FIX: resolve country name for lookup)
    for (const [id, company] of this.companies) {
      const countryName = toFullName(company.country);
      const style = GOVERNANCE_STYLES[countryName] || GOVERNANCE_STYLES[company.country] || 'responsive';
      const policies = evaluateGovernanceResponse(countryName, style, company.metrics, this.publicPressure);
      if (policies.length > 0) {
        this.governancePolicies = [...this.governancePolicies.slice(-10), ...policies];
      }
    }

    // Check stress for new scenario triggers
    this.scenarioEngine.evaluateStress(avgMetrics);
    this.updateLeaderboard();

    // Auto-snapshot to Supabase every 5 ticks
    maybeSnapshot(this, 5);

    return this.getState();
  }

  getAverageMetrics() {
    if (this.companies.size === 0) {
      return { supply: 50, economy: 50, environment: 50, stability: 50 };
    }
    let s = 0, e = 0, en = 0, st = 0;
    for (const c of this.companies.values()) {
      s += c.metrics.supply;
      e += c.metrics.economy;
      en += c.metrics.environment;
      st += c.metrics.stability;
    }
    const n = this.companies.size;
    return { supply: s / n, economy: e / n, environment: en / n, stability: st / n };
  }

  updateLeaderboard() {
    const W = LEADERBOARD_WEIGHTS;
    this.leaderboard = [...this.companies.values()]
      .map((c) => {
        // Base score (existing formula)
        const baseScore =
          c.scores.growth * W.growth +
          c.scores.sustainability * W.sustainability +
          c.scores.stability * W.stability +
          c.scores.supplyHealth * W.supplyHealth;

        // Engagement bonus: reward active decision-making
        const decisions = (c.decisionHistory || []).length;
        const engagementBonus = Math.min(15, decisions * 1.5);

        // Crisis navigation bonus
        const crisisBonus = (c.crisesSurvived || 0) * 3;

        // Passivity penalty: no decisions in last 20 ticks
        const lastDecisionDay = (c.decisionHistory || []).slice(-1)[0]?.day || 0;
        const ticksSinceDecision = this.currentDay - lastDecisionDay;
        // Penalty: no decisions ever (pure parasite) OR long gap since last
        const passivityPenalty = decisions === 0 && this.currentDay > 10
          ? Math.min(15, this.currentDay * 0.3)  // grows with time if never acted
          : ticksSinceDecision > 20
            ? Math.min(10, (ticksSinceDecision - 20) * 0.5)
            : 0;

        const finalScore = Math.max(0,
          Math.round((baseScore + engagementBonus + crisisBonus - passivityPenalty) * 10) / 10
        );

        return {
          id: c.id,
          name: c.name,
          industry: c.industry,
          country: c.country,
          score: finalScore,
          breakdown: {
            base: Math.round(baseScore * 10) / 10,
            engagement: Math.round(engagementBonus * 10) / 10,
            crisisNavigation: crisisBonus,
            passivityPenalty: Math.round(passivityPenalty * 10) / 10,
          },
          scores: { ...c.scores },
          sresScore: c.sresScore,
          profit: c.economics?.profit || 0,
          pipelineHealth: c.pipeline?.pipelineHealth || 0.5,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  getState() {
    return {
      day: this.currentDay,
      mode: this.mode,
      activeScenarios: this.scenarioEngine.getState(),
      multipliers: this.scenarioEngine.getCombinedMultipliers(),
      marketState: this.marketState,
      publicPressure: this.publicPressure,
      governancePolicies: this.governancePolicies.slice(-5),
      environmentalDebt: Math.round(this.environmentalDebt * 100) / 100,
      companies: [...this.companies.values()].map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        country: c.country,
        strategy: c.strategy,
        metrics: { ...c.metrics },
        sresScore: c.sresScore,
        scores: { ...c.scores },
        economics: c.economics || {},
        workforce: c.workforce ? {
          size: c.workforce.size,
          productivity: c.workforce.productivity,
          morale: c.workforce.morale,
        } : null,
        pipelineHealth: c.pipeline?.pipelineHealth || 0.5,
        bottleneckCount: c.pipeline?.bottlenecks?.length || 0,
        chokepointDependency: c.chokepointDependency?.score || 0,
        logisticsDisruptions: c.logistics?.disruptionCount || 0,
      })),
      leaderboard: this.leaderboard,
      eventCount: this.events.length,
    };
  }

  triggerScenario(type) {
    return this.scenarioEngine.triggerScenario(type);
  }

  reset() {
    this.scenarioEngine.reset();
    this.consequenceGraph.clear();
    this.companies.clear();
    this.currentDay = 0;
    this.events = [];
    this.leaderboard = [];
    this.marketState = {
      sentiment: 50, confidence: 50, volatility: 20,
      demand_index: 50, supply_index: 50, baseRate: 2.5,
    };
    this.publicPressure = { price_pressure: 25, environmental_pressure: 25, shortage_pressure: 20, total_pressure: 25 };
    this.governancePolicies = [];
    this.environmentalDebt = 0;
  }
}

const worldState = new WorldState();

module.exports = { worldState, WorldState };
