/**
 * Workforce Engine
 * Manages workforce size, skill, productivity, cost, morale.
 * Also handles population dynamics that affect demand and labor pool.
 */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Initialize workforce based on industry and scale.
 */
function initializeWorkforce(industry, scale, country, profiles, countryRisk) {
  const profile = profiles[industry] || profiles.electronics;
  const scaleMod = { small: 0.5, medium: 1.0, large: 2.0 }[scale] || 1.0;
  const riskFactor = countryRisk || 0.5;

  return {
    size: Math.round(profile.baseSize * scaleMod),
    skill_level: clamp(profile.avgSkill * (1 - riskFactor * 0.2), 0.2, 1.0),
    productivity: clamp(profile.avgProductivity * (1 - riskFactor * 0.15), 0.2, 1.0),
    cost_per_worker: Math.round(profile.costPerWorker * (1 + riskFactor * 0.3) * 100) / 100,
    morale: clamp(0.7 - riskFactor * 0.1, 0.3, 1.0),
  };
}

/**
 * Evolve workforce for one simulation tick.
 */
function evolveWorkforce(prev, metrics, events, strategicActions) {
  const workforce = { ...prev };

  // Base drift
  workforce.productivity = clamp(
    workforce.productivity + (Math.random() - 0.5) * 0.02,
    0.2, 1.0
  );

  // Morale affected by stability and economy
  const stabilityEffect = ((metrics?.stability || 50) - 50) / 500;
  const economyEffect = ((metrics?.economy || 50) - 50) / 500;
  workforce.morale = clamp(
    workforce.morale + stabilityEffect + economyEffect + (Math.random() - 0.5) * 0.02,
    0.1, 1.0
  );

  // Events impact workforce
  for (const evt of (events || [])) {
    const severity = evt.severity || 3;
    if (evt.type === 'stability') {
      workforce.morale = clamp(workforce.morale - severity * 0.02, 0.1, 1.0);
      workforce.productivity = clamp(workforce.productivity - severity * 0.01, 0.2, 1.0);
    }
    if (evt.type === 'economy') {
      workforce.cost_per_worker *= (1 + severity * 0.01);
    }
  }

  // Strategic actions boost workforce
  for (const action of (strategicActions || [])) {
    if (action.status === 'in_progress') {
      if (action.action_type === 'rd') {
        workforce.skill_level = clamp(workforce.skill_level + 0.005, 0.2, 1.0);
      }
      if (action.action_type === 'collaboration') {
        workforce.productivity = clamp(workforce.productivity + 0.003, 0.2, 1.0);
      }
    }
  }

  // Productivity linked to morale and skill
  const moraleProdBonus = (workforce.morale - 0.5) * 0.1;
  workforce.productivity = clamp(
    workforce.productivity + moraleProdBonus * 0.05,
    0.2, 1.0
  );

  // Round
  workforce.skill_level = Math.round(workforce.skill_level * 1000) / 1000;
  workforce.productivity = Math.round(workforce.productivity * 1000) / 1000;
  workforce.morale = Math.round(workforce.morale * 1000) / 1000;
  workforce.cost_per_worker = Math.round(workforce.cost_per_worker * 100) / 100;

  return workforce;
}

/**
 * Calculate workforce impact on output.
 */
function getWorkforceOutputModifier(workforce) {
  if (!workforce) return 0.7;
  const skillWeight = 0.3;
  const productivityWeight = 0.4;
  const moraleWeight = 0.3;
  return clamp(
    workforce.skill_level * skillWeight +
    workforce.productivity * productivityWeight +
    workforce.morale * moraleWeight,
    0.2, 1.0
  );
}

/**
 * Calculate total workforce cost.
 */
function calculateWorkforceCost(workforce) {
  if (!workforce) return 0;
  return Math.round(workforce.size * workforce.cost_per_worker * 100) / 100;
}

/**
 * Population state evolution.
 */
function evolvePopulation(prev, metrics, events, country) {
  const pop = prev || { demand_factor: 50, stability_index: 50, labor_pool_health: 0.7 };

  const stabilityDelta = ((metrics?.stability || 50) - 50) / 100;
  const economyDelta = ((metrics?.economy || 50) - 50) / 100;

  let eventImpact = 0;
  for (const evt of (events || [])) {
    eventImpact -= (evt.severity || 3) * 0.5;
  }

  return {
    demand_factor: clamp(pop.demand_factor + economyDelta * 3 + (Math.random() - 0.5) * 2, 10, 90),
    stability_index: clamp(pop.stability_index + stabilityDelta * 5 + eventImpact + (Math.random() - 0.5) * 2, 5, 95),
    labor_pool_health: clamp(pop.labor_pool_health + stabilityDelta * 0.02 + (Math.random() - 0.5) * 0.01, 0.2, 1.0),
  };
}

module.exports = {
  initializeWorkforce,
  evolveWorkforce,
  getWorkforceOutputModifier,
  calculateWorkforceCost,
  evolvePopulation,
};
