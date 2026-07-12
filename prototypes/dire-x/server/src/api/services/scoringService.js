/**
 * api/services/scoringService.js
 *
 * Wraps the existing DIRE-X simulation engines to produce data-product-grade
 * risk scores with full explainability.
 *
 * Reuses (does NOT reimplement):
 *   - engines/sresEngine.js   → computeSRES, applyScenarioModifiers
 *   - engines/riskEngine.js   → computeBaseRiskScore
 *   - config/constants.js     → SRES_WEIGHTS, SCENARIO_MULTIPLIERS
 */

'use strict';

const { computeSRES, applyScenarioModifiers } = require('../../engines/sresEngine');
const { computeBaseRiskScore }                = require('../../engines/riskEngine');
const { SRES_WEIGHTS }                        = require('../../config/constants');

// ─── Weight profiles per customer vertical ────────────────────────────────────

const WEIGHT_PROFILES = {
  default: {
    direct:   0.35,
    indirect: 0.30,
    hidden:   0.20,
    policy:   0.10,
    time:     0.05,
  },
  defense: {
    direct:   0.40,
    indirect: 0.25,
    hidden:   0.25,  // defense supply chains have higher hidden exposure
    policy:   0.08,
    time:     0.02,
  },
  insurance: {
    direct:   0.30,
    indirect: 0.35,  // insurers price downstream cascades
    hidden:   0.15,
    policy:   0.12,
    time:     0.08,
  },
  finance: {
    direct:   0.30,
    indirect: 0.30,
    hidden:   0.15,
    policy:   0.15,
    time:     0.10,  // finance cares more about timing
  },
};

// ─── Policy + manipulation constants ─────────────────────────────────────────

const POLICY_MULTIPLIERS = { None: 1.00, Moderate: 1.08, High: 1.18 };
const MANIPULATION_DISCOUNTS = { Low: 1.00, Medium: 0.95, High: 0.88 };

// ─── Core scoring function ────────────────────────────────────────────────────

/**
 * Compute a complete risk score package for a scenario.
 *
 * @param {object} params
 * @param {number}  params.directImpact       0–100
 * @param {number}  params.indirectImpact     0–100
 * @param {number}  params.hiddenDependencyPct 0–100
 * @param {string}  params.policyImpact       'None'|'Moderate'|'High'
 * @param {string}  params.manipulationRisk   'Low'|'Medium'|'High'
 * @param {number}  params.timeToImpactDays   integer ≥ 0
 * @param {string}  params.countryCode        ISO-2 (for geopolitical amplifier)
 * @param {string}  [params.vertical]         weight profile key
 * @returns {object} { riskScore, confidence, explanation, components }
 */
function computeRiskScore(params) {
  const {
    directImpact,
    indirectImpact,
    hiddenDependencyPct,
    policyImpact    = 'None',
    manipulationRisk = 'Low',
    timeToImpactDays = 0,
    countryCode      = 'US',
    vertical         = 'default',
  } = params;

  const W = WEIGHT_PROFILES[vertical] || WEIGHT_PROFILES.default;

  // Time urgency: e^(-0.01 * days), 100 at day 0, decays exponentially
  const timeUrgency = 100 * Math.exp(-0.01 * Math.max(0, timeToImpactDays));

  // Hidden dependency normalized to 0–100 scale component
  const hiddenComponent = hiddenDependencyPct;

  // Policy multiplier
  const policyMult = POLICY_MULTIPLIERS[policyImpact] ?? 1.00;

  // Geopolitical amplifier from riskEngine baselines
  const { computeBaseRiskScore: rbr } = require('../../engines/riskEngine');
  const { baseScore: geoBase } = rbr({ nationCode: countryCode, resources: [] });
  const geoAmplifier = 1 + (geoBase / 100) * 0.20;

  // Manipulation discount
  const manipDiscount = MANIPULATION_DISCOUNTS[manipulationRisk] ?? 1.00;

  // Raw weighted sum
  const raw = (
    W.direct   * directImpact    +
    W.indirect * indirectImpact  +
    W.hidden   * hiddenComponent +
    W.policy   * (policyMult * 50) +  // policy contributes as a 0–59 score
    W.time     * timeUrgency
  );

  const riskScore = Math.round(
    clamp(raw * geoAmplifier * manipDiscount, 0, 100) * 10
  ) / 10;

  // Build explanation
  const explanation = buildExplanation({
    riskScore, directImpact, indirectImpact, hiddenDependencyPct,
    policyImpact, manipulationRisk, timeToImpactDays, timeUrgency,
    geoAmplifier, manipDiscount, policyMult, W,
  });

  return {
    riskScore,
    explanation,
    components: {
      direct_contribution:   Math.round(W.direct   * directImpact    * 10) / 10,
      indirect_contribution: Math.round(W.indirect * indirectImpact  * 10) / 10,
      hidden_contribution:   Math.round(W.hidden   * hiddenComponent * 10) / 10,
      policy_contribution:   Math.round(W.policy   * policyMult * 50 * 10) / 10,
      time_contribution:     Math.round(W.time     * timeUrgency     * 10) / 10,
      geo_amplifier:         Math.round(geoAmplifier  * 1000) / 1000,
      manipulation_discount: Math.round(manipDiscount * 1000) / 1000,
    },
    weights_used: W,
    vertical_applied: vertical,
  };
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

/**
 * Compute confidence score (0–1) for a scenario data point.
 *
 * @param {object} params
 * @param {number}  params.dataQuality     0–1, completeness of input data
 * @param {number}  params.modelValidity   0–1, how well model fits event type
 * @param {number}  params.externalValidation 0–1, % match to real comparable events
 * @param {number}  params.dataAgeYears    years since calibration data was collected
 * @param {string}  [params.trustTier]     'synthetic'|'validated'|'live_calibrated'|'expert_reviewed'
 * @returns {{ confidence: number, breakdown: object, explanation: string }}
 */
function computeConfidence(params) {
  const {
    dataQuality          = 0.75,
    modelValidity        = 0.80,
    externalValidation   = 0.70,
    dataAgeYears         = 1,
    trustTier            = 'synthetic',
  } = params;

  const W = { quality: 0.30, validity: 0.30, validation: 0.25, recency: 0.15 };

  // Recency decay: e^(-0.35 * years)
  const recencyScore = Math.exp(-0.35 * Math.max(0, dataAgeYears));

  const raw = (
    W.quality     * dataQuality          +
    W.validity    * modelValidity        +
    W.validation  * externalValidation   +
    W.recency     * recencyScore
  );

  // Ceiling by trust tier
  const TIER_CEILING = {
    synthetic:       0.92,
    validated:       0.87,  // intentionally lower ceiling — validated means backtested, not live
    live_calibrated: 0.93,
    expert_reviewed: 0.97,
  };

  const ceiling     = TIER_CEILING[trustTier] ?? 0.92;
  const floor       = 0.50;
  const confidence  = Math.round(Math.min(ceiling, Math.max(floor, raw)) * 100) / 100;

  return {
    confidence,
    breakdown: {
      data_quality:         Math.round(dataQuality        * 100) / 100,
      model_validity:       Math.round(modelValidity      * 100) / 100,
      external_validation:  Math.round(externalValidation * 100) / 100,
      recency_score:        Math.round(recencyScore       * 100) / 100,
    },
    explanation:
      `Data quality ${(dataQuality * 100).toFixed(0)}%. ` +
      `Model validity ${(modelValidity * 100).toFixed(0)}%. ` +
      `External validation ${(externalValidation * 100).toFixed(0)}%. ` +
      `Recency score ${(recencyScore * 100).toFixed(0)}% (data ${dataAgeYears.toFixed(1)} years old). ` +
      `Trust tier ceiling: ${ceiling}. Final: ${confidence}.`,
  };
}

// ─── Time-decay applied to stored scores ─────────────────────────────────────

/**
 * Adjust a stored risk score for age.
 * Scores decay at 0.5%/day; triggers re-simulation flag after 90 days.
 *
 * @param {number} storedScore
 * @param {Date|string} generatedAt
 * @returns {{ adjustedScore: number, daysSinceGeneration: number, staleFlag: boolean }}
 */
function applyTimeDecay(storedScore, generatedAt) {
  const days = Math.floor(
    (Date.now() - new Date(generatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const adjustedScore = Math.round(storedScore * Math.exp(-0.005 * days) * 10) / 10;

  return {
    adjustedScore: clamp(adjustedScore, 0, 100),
    daysSinceGeneration: days,
    staleFlag: days >= 90,
  };
}

// ─── SRES wrapper ─────────────────────────────────────────────────────────────

/**
 * Compute scenario-adjusted SRES using the existing engine.
 * @param {object} baseMetrics  { demand, supply, geopolitical, environmental } 0–100
 * @param {string} scenarioType e.g. 'trade_war', 'supply_crisis'
 * @param {object} [customWeights]
 */
function computeScenarioSRES(baseMetrics, scenarioType, customWeights) {
  const adjusted = applyScenarioModifiers(baseMetrics, scenarioType);
  return computeSRES(null, adjusted, customWeights || SRES_WEIGHTS);
}

// ─── Non-linear thresholds ────────────────────────────────────────────────────

/**
 * Apply cascade acceleration multiplier when both risk + hidden dep are high.
 * Represents non-linear blowup zones in the supply graph.
 */
function applyNonLinearThresholds(riskScore, hiddenDependencyPct) {
  if (riskScore > 80 && hiddenDependencyPct > 50) {
    return {
      multiplier:     1.25,
      flag:          'SYSTEMIC_RISK',
      explanation:   `Non-linear threshold crossed: Risk ${riskScore} > 80 AND hidden dependency ${hiddenDependencyPct}% > 50. Cascade acceleration multiplier 1.25 applied.`,
    };
  }
  return { multiplier: 1.0, flag: null, explanation: null };
}

// ─── Recovery time with non-linearity ────────────────────────────────────────

/**
 * Adjusts base recovery time upward for high-severity events.
 * recovery = base * (1 + (riskScore/100)^2)
 */
function adjustRecoveryTime(baseRecoveryDays, riskScore) {
  const multiplier = 1 + Math.pow(riskScore / 100, 2);
  return {
    adjusted: Math.round(baseRecoveryDays * multiplier),
    multiplier: Math.round(multiplier * 100) / 100,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

function buildExplanation({
  riskScore, directImpact, indirectImpact, hiddenDependencyPct,
  policyImpact, manipulationRisk, timeToImpactDays, timeUrgency,
  geoAmplifier, manipDiscount, policyMult, W,
}) {
  const parts = [
    `Direct impact (${directImpact}) contributes ${Math.round(W.direct * directImpact * 10) / 10} pts (weight ${W.direct}).`,
    `Indirect impact (${indirectImpact}) contributes ${Math.round(W.indirect * indirectImpact * 10) / 10} pts.`,
    `Hidden dependency (${hiddenDependencyPct}%) contributes ${Math.round(W.hidden * hiddenDependencyPct * 10) / 10} pts.`,
    `Policy impact (${policyImpact}, multiplier ${policyMult}x) adds ${Math.round(W.policy * policyMult * 50 * 10) / 10} pts.`,
    `Time urgency at day ${timeToImpactDays}: ${Math.round(timeUrgency)} (e^-0.01t decay).`,
    `Geopolitical amplifier: ${Math.round(geoAmplifier * 1000) / 1000}x.`,
    manipulationRisk !== 'Low'
      ? `Manipulation risk (${manipulationRisk}) discount: ${manipDiscount}x — treat as upper bound.`
      : `Manipulation risk: Low — full confidence applied.`,
    `Final risk score: ${riskScore}.`,
  ];
  return parts.join(' ');
}

module.exports = {
  computeRiskScore,
  computeConfidence,
  applyTimeDecay,
  computeScenarioSRES,
  applyNonLinearThresholds,
  adjustRecoveryTime,
  WEIGHT_PROFILES,
};
