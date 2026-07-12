const {
  SCENARIO_LIFECYCLE,
  SCENARIO_INTERACTIONS,
  SCENARIO_MULTIPLIERS,
} = require('../config/constants');

class ScenarioLifecycleEngine {
  constructor() {
    this.activeScenarios = new Map(); // id -> scenario state
  }

  /**
   * Add a new scenario to the world.
   * @param {string} type - One of the SCENARIO_LIFECYCLE keys
   * @param {number} initialIntensity - Starting intensity (0-1)
   * @returns {string} The generated scenario id
   */
  triggerScenario(type, initialIntensity = 0.1) {
    const id = `${type}-${Date.now()}`;
    const config = SCENARIO_LIFECYCLE[type];
    if (!config) {
      throw new Error(`Unknown scenario type: ${type}`);
    }
    this.activeScenarios.set(id, {
      id,
      type,
      stage: 'emerging',
      intensity: initialIntensity,
      day: 0,
      maxDuration: config.maxDuration,
      growthRate: config.growth,
      decayRate: config.decay,
      peakThreshold: config.peakThreshold,
    });
    return id;
  }

  /**
   * Evolve all scenarios by one tick (one simulation day).
   * @returns {Array} Current state of all active scenarios
   */
  tick() {
    for (const [id, scenario] of this.activeScenarios) {
      scenario.day++;

      // Calculate new intensity based on stage
      if (scenario.stage === 'emerging' || scenario.stage === 'growth') {
        scenario.intensity = Math.min(
          1,
          scenario.intensity + scenario.growthRate * (1 - scenario.intensity)
        );
        if (scenario.intensity >= scenario.peakThreshold) {
          scenario.stage = 'peak';
        } else if (scenario.intensity > 0.3) {
          scenario.stage = 'growth';
        }
      } else if (scenario.stage === 'peak') {
        // Stay at peak for a period then decline
        if (scenario.day > scenario.maxDuration * 0.6) {
          scenario.stage = 'decline';
        }
      } else if (scenario.stage === 'decline') {
        scenario.intensity = Math.max(0, scenario.intensity - scenario.decayRate);
        if (scenario.intensity <= 0.05) {
          scenario.stage = 'ended';
        }
      }

      // Check if exceeded max duration
      if (scenario.day >= scenario.maxDuration) {
        scenario.stage = 'ended';
      }

      // Remove ended scenarios
      if (scenario.stage === 'ended') {
        this.activeScenarios.delete(id);
      }
    }

    // Check for cascading scenario triggers
    this.checkCascades();

    return this.getState();
  }

  /**
   * Check if active scenarios should trigger new cascading ones.
   */
  checkCascades() {
    for (const [id, scenario] of this.activeScenarios) {
      const interactions = SCENARIO_INTERACTIONS[scenario.type] || {};
      for (const [targetType, probability] of Object.entries(interactions)) {
        const alreadyActive = [...this.activeScenarios.values()].some(
          (s) => s.type === targetType
        );
        if (
          !alreadyActive &&
          scenario.intensity > 0.5 &&
          Math.random() < probability * scenario.intensity * 0.3
        ) {
          this.triggerScenario(targetType, 0.15);
        }
      }
    }
  }

  /**
   * Compute combined multipliers from all active scenarios.
   * @returns {{ supply: number, geo: number, env: number, demand: number }}
   */
  getCombinedMultipliers() {
    let supply = 1;
    let geo = 1;
    let env = 1;
    let demand = 1;

    for (const [id, scenario] of this.activeScenarios) {
      const mult =
        SCENARIO_MULTIPLIERS[scenario.type] || SCENARIO_MULTIPLIERS.stable;
      const intensity = scenario.intensity;
      supply += (mult.supply - 1) * intensity;
      geo += ((mult.geopolitical || mult.geo || 1) - 1) * intensity;
      env += ((mult.environmental || mult.env || 1) - 1) * intensity;
      demand += (mult.demand - 1) * intensity;
    }

    // Cap combined multipliers to prevent unrecoverable death spirals
    const CAP = 2.5;
    return {
      supply: Math.min(CAP, supply),
      geo: Math.min(CAP, geo),
      env: Math.min(CAP, env),
      demand: Math.min(CAP, demand),
    };
  }

  /**
   * Get full state for API response.
   * @returns {Array} Array of scenario state objects
   */
  getState() {
    return [...this.activeScenarios.values()].map((s) => ({
      id: s.id,
      type: s.type,
      stage: s.stage,
      intensity: Math.round(s.intensity * 100) / 100,
      day: s.day,
      maxDuration: s.maxDuration,
    }));
  }

  /**
   * Check system stress and potentially trigger new scenarios.
   * @param {{ supply: number, economy: number, environment: number, stability: number }} metrics
   * @returns {string|null} New scenario id if triggered, null otherwise
   */
  evaluateStress(metrics) {
    const avgStress =
      (metrics.supply + metrics.economy + metrics.environment + metrics.stability) / 4;
    if (avgStress > 70 && Math.random() < 0.15) {
      const types = ['supply_crisis', 'trade_war', 'drought', 'pandemic', 'war'];
      const activeTypes = new Set(
        [...this.activeScenarios.values()].map((s) => s.type)
      );
      const available = types.filter((t) => !activeTypes.has(t));
      if (available.length > 0) {
        const type = available[Math.floor(Math.random() * available.length)];
        return this.triggerScenario(type);
      }
    }
    return null;
  }

  /**
   * Get the dominant (highest intensity) active scenario type.
   * @returns {string} Scenario type or 'stable'
   */
  getDominantScenario() {
    let maxIntensity = 0;
    let dominant = 'stable';
    for (const scenario of this.activeScenarios.values()) {
      if (scenario.intensity > maxIntensity) {
        maxIntensity = scenario.intensity;
        dominant = scenario.type;
      }
    }
    return dominant;
  }

  /**
   * Reset engine state, clearing all active scenarios.
   */
  reset() {
    this.activeScenarios.clear();
  }
}

module.exports = { ScenarioLifecycleEngine };
