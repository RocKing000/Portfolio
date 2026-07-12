/**
 * Strategic Actions Engine
 * Handles long-term decisions: diplomacy, collaboration, R&D, diversification, vertical integration.
 * Each action has delay, trade-offs, and persistent effects.
 */

const { STRATEGIC_ACTION_TYPES } = require('../config/constants');

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Create a new strategic action for a company.
 */
function createStrategicAction({ companyId, actionType, title, description, target, currentDay }) {
  const config = STRATEGIC_ACTION_TYPES[actionType];
  if (!config) {
    throw new Error(`Unknown strategic action type: ${actionType}`);
  }

  return {
    company_id: companyId,
    action_type: actionType,
    title: title || config.label,
    description: description || `Initiating ${config.label} strategy`,
    target: target || {},
    delay_days: config.delayDays,
    duration_days: config.durationDays,
    cost: config.costMultiplier * 1000,
    effects: config.effects,
    tradeoffs: config.tradeoffs,
    status: 'pending',
    started_day: currentDay,
    completion_day: currentDay + config.delayDays + config.durationDays,
  };
}

/**
 * Process all active strategic actions for a tick.
 * Returns metric adjustments to apply.
 */
function processStrategicActions(actions, currentDay) {
  const adjustments = { supply: 0, economy: 0, environment: 0, stability: 0 };
  const updatedActions = [];

  for (const action of actions) {
    const config = STRATEGIC_ACTION_TYPES[action.action_type];
    if (!config) continue;

    const newAction = { ...action };

    if (action.status === 'pending') {
      const daysSinceStart = currentDay - action.started_day;
      if (daysSinceStart >= config.delayDays) {
        newAction.status = 'in_progress';
      }
    }

    if (action.status === 'in_progress') {
      // Apply gradual effects
      const totalDays = config.durationDays;
      const progressFraction = 1 / totalDays;

      for (const [key, value] of Object.entries(config.effects)) {
        if (adjustments[key] !== undefined) {
          adjustments[key] += value * progressFraction;
        }
      }

      // Apply trade-offs (negative effects)
      for (const [key, value] of Object.entries(config.tradeoffs)) {
        if (adjustments[key] !== undefined) {
          adjustments[key] += value * progressFraction;
        }
      }

      // Check completion
      if (currentDay >= action.completion_day) {
        newAction.status = 'completed';
      }
    }

    updatedActions.push(newAction);
  }

  // Round adjustments
  for (const key of Object.keys(adjustments)) {
    adjustments[key] = Math.round(adjustments[key] * 100) / 100;
  }

  return { adjustments, updatedActions };
}

/**
 * Get available strategic actions for a company based on current state.
 */
function getAvailableActions(company, activeActions, metrics) {
  const available = [];

  for (const [type, config] of Object.entries(STRATEGIC_ACTION_TYPES)) {
    // Don't allow duplicate active actions of same type
    const hasActive = activeActions.some(a => a.action_type === type && (a.status === 'pending' || a.status === 'in_progress'));
    if (hasActive) continue;

    // Context-specific availability
    let relevance = 50;
    if (type === 'diversification' && metrics.supply > 60) relevance = 85;
    if (type === 'rd' && metrics.economy > 55) relevance = 80;
    if (type === 'diplomacy' && metrics.stability > 60) relevance = 75;
    if (type === 'vertical_integration' && metrics.supply > 70) relevance = 90;
    if (type === 'collaboration' && metrics.economy > 50) relevance = 70;

    available.push({
      type,
      label: config.label,
      delay: config.delayDays,
      duration: config.durationDays,
      cost: config.costMultiplier * 1000,
      effects: config.effects,
      tradeoffs: config.tradeoffs,
      relevance,
    });
  }

  return available.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Evaluate governance response based on metrics and country style.
 */
function evaluateGovernanceResponse(country, governanceStyle, metrics, publicPressure) {
  const policies = [];
  const style = governanceStyle || 'responsive';

  const thresholds = {
    responsive: { action: 60, strength: 0.7 },
    centralized: { action: 50, strength: 1.0 },
    interventionist: { action: 45, strength: 1.2 },
    market_driven: { action: 70, strength: 0.5 },
  };

  const t = thresholds[style] || thresholds.responsive;

  if (metrics.supply > t.action) {
    policies.push({
      type: 'export_ban',
      label: `${country} considers export restrictions`,
      strength: t.strength,
      trigger: 'supply_stress',
    });
  }

  if ((publicPressure?.environmental_pressure || 0) > t.action) {
    policies.push({
      type: 'regulation',
      label: `${country} tightens environmental regulations`,
      strength: t.strength,
      trigger: 'environmental_pressure',
    });
  }

  if (metrics.economy > t.action + 10) {
    policies.push({
      type: 'subsidy',
      label: `${country} announces economic stimulus`,
      strength: t.strength,
      trigger: 'economic_stress',
    });
  }

  return policies;
}

module.exports = {
  createStrategicAction,
  processStrategicActions,
  getAvailableActions,
  evaluateGovernanceResponse,
};
