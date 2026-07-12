/**
 * api/routes/simulateScenario.js
 *
 * POST /api/v1/simulate-scenario
 *
 * Accepts scenario parameters, runs them through the DIRE-X scoring and
 * cascade engines, and returns a complete scenario record.
 *
 * Also persists the result to dp_scenarios for future retrieval.
 *
 * Tier gate: professional and above.
 */

'use strict';

const { Router }              = require('express');
const { v4: uuid }            = require('uuid');
const supabase                = require('../../config/supabase');
const { requireTier }         = require('../middleware/apiKeyAuth');
const { checkSimulateQuota }  = require('../middleware/usageTracker');
const {
  computeRiskScore,
  computeConfidence,
  applyNonLinearThresholds,
  adjustRecoveryTime,
}                             = require('../services/scoringService');
const { generateCascadePhases } = require('../services/cascadeService');

const router = Router();

// ─── Valid enum values ────────────────────────────────────────────────────────

const VALID_EVENT_TYPES = [
  'oil_shock', 'port_shutdown', 'sanctions', 'climate_disaster', 'cyberattack',
  'labor_strike', 'regulatory_change', 'pandemic_health', 'geopolitical_conflict',
  'currency_crisis', 'infrastructure_failure', 'rare_earth_export_ban',
  'water_scarcity', 'food_security_failure', 'defense_procurement_disruption',
  'data_manipulation_fraud', 'trade_war', 'natural_disaster', 'financial_crisis',
  'technology_disruption',
];

const VALID_INTENSITIES  = ['low', 'medium', 'high', 'extreme'];
const VALID_POLICY       = ['None', 'Moderate', 'High'];
const VALID_MANIP_RISK   = ['Low', 'Medium', 'High'];
const VALID_EXPOSURE     = ['Low', 'Medium', 'High', 'Critical'];

// ─── POST /simulate-scenario ──────────────────────────────────────────────────

router.post('/', requireTier('professional'), async (req, res, next) => {
  try {
    // ── 1. Quota check
    const quota = await checkSimulateQuota(req.apiKey);
    if (!quota.allowed) {
      return res.status(429).json({
        error: `Monthly simulate-scenario quota exhausted (${quota.quota} calls/month on ${req.apiKey.tier} tier).`,
        code:  'QUOTA_EXHAUSTED',
        used:  quota.used,
        quota: quota.quota,
        upgrade_url: 'https://direx.io/pricing',
      });
    }

    // ── 2. Input validation
    const {
      event_type,
      event_subtype,
      region,
      country_codes          = [],
      industry,
      intensity              = 'high',
      trigger_condition,
      trigger_date,
      direct_impact_override,
      indirect_impact_override,
      time_to_impact_days    = 0,
      base_recovery_days     = 180,
      hidden_dependency_pct  = 30,
      policy_impact          = 'Moderate',
      manipulation_risk      = 'Low',
      affected_companies     = [],
      affected_resources     = [],
      vertical,                          // scoring weight profile
      options                = {},
    } = req.body;

    const errors = [];
    if (!event_type)                           errors.push('event_type is required');
    if (event_type && !VALID_EVENT_TYPES.includes(event_type)) {
      errors.push(`event_type must be one of: ${VALID_EVENT_TYPES.join(', ')}`);
    }
    if (!region)                               errors.push('region is required');
    if (!industry)                             errors.push('industry is required');
    if (!VALID_INTENSITIES.includes(intensity)) errors.push(`intensity must be one of: ${VALID_INTENSITIES.join(', ')}`);
    if (!VALID_POLICY.includes(policy_impact)) errors.push(`policy_impact must be: ${VALID_POLICY.join(', ')}`);
    if (!VALID_MANIP_RISK.includes(manipulation_risk)) errors.push(`manipulation_risk must be: ${VALID_MANIP_RISK.join(', ')}`);

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed.', code: 'VALIDATION_ERROR', details: errors });
    }

    const startMs = Date.now();

    // ── 3. Derive impact scores from intensity if not overridden
    const INTENSITY_BASE = { low: 30, medium: 55, high: 75, extreme: 92 };
    const INTENSITY_VARIANCE = 10;  // ± randomness around base

    const intensityBase = INTENSITY_BASE[intensity];

    const directImpact = direct_impact_override !== undefined
      ? Math.min(100, Math.max(0, parseInt(direct_impact_override, 10)))
      : clamp(intensityBase + (Math.random() * INTENSITY_VARIANCE - INTENSITY_VARIANCE / 2), 0, 100);

    const indirectImpact = indirect_impact_override !== undefined
      ? Math.min(100, Math.max(0, parseInt(indirect_impact_override, 10)))
      : clamp(directImpact * 0.85 + (Math.random() * 15 - 7), 0, 100);  // indirect slightly lower

    // ── 4. Compute risk score using scoring service
    const primaryCountry = country_codes[0] || 'US';
    const scoring = computeRiskScore({
      directImpact:       Math.round(directImpact),
      indirectImpact:     Math.round(indirectImpact),
      hiddenDependencyPct: hidden_dependency_pct,
      policyImpact:        policy_impact,
      manipulationRisk:    manipulation_risk,
      timeToImpactDays:    time_to_impact_days,
      countryCode:         primaryCountry,
      vertical,
    });

    // ── 5. Compute confidence score
    const confidence = computeConfidence({
      dataQuality:        options.data_quality        ?? 0.75,
      modelValidity:      options.model_validity       ?? 0.80,
      externalValidation: options.external_validation  ?? 0.65,
      dataAgeYears:       options.data_age_years       ?? 0,
      trustTier:          'synthetic',
    });

    // ── 6. Non-linear thresholds
    const nonLinear = applyNonLinearThresholds(scoring.riskScore, hidden_dependency_pct);
    const finalRiskScore = nonLinear.multiplier > 1
      ? Math.round(Math.min(100, scoring.riskScore * nonLinear.multiplier))
      : Math.round(scoring.riskScore);

    // ── 7. Adjusted recovery time
    const recovery = adjustRecoveryTime(base_recovery_days, finalRiskScore);

    // ── 8. Determine company exposure level
    const companyExposure = deriveExposureLevel(finalRiskScore, hidden_dependency_pct);

    // ── 9. Generate cascade phases
    const scenarioId = `SCN-DYN-${Date.now()}-${uuid().slice(0, 6).toUpperCase()}`;
    const cascadePhases = generateCascadePhases({
      scenarioId,
      eventType:           event_type,
      directImpactScore:   Math.round(directImpact),
      indirectImpactScore: Math.round(indirectImpact),
      recoveryTimeDays:    recovery.adjusted,
      timeToImpactDays:    time_to_impact_days,
      affectedEntities:    affected_companies,
    });

    // ── 10. Build assumption manifest
    const assumptionManifest = buildAssumptionManifest({
      event_type, region, country_codes, intensity, policy_impact,
      manipulation_risk, vertical,
    });

    // ── 11. Persist to dp_scenarios
    const scenarioRecord = {
      scenario_id:             scenarioId,
      event_type,
      event_subtype:           event_subtype || null,
      region,
      country_codes:           country_codes.length > 0 ? country_codes : null,
      industry,
      trigger_condition:       trigger_condition || null,
      trigger_date:            trigger_date || null,
      company_exposure_level:  companyExposure,
      direct_impact_score:     Math.round(directImpact),
      indirect_impact_score:   Math.round(indirectImpact),
      risk_score:              finalRiskScore,
      confidence_score:        confidence.confidence,
      time_to_impact_days:     time_to_impact_days,
      recovery_time_days:      recovery.adjusted,
      hidden_dependency_pct:   hidden_dependency_pct,
      policy_impact,
      manipulation_risk,
      scenario_notes:          trigger_condition || `Dynamic simulation: ${event_type} in ${region}`,
      score_explanation:       scoring.explanation,
      assumption_manifest:     assumptionManifest,
      trust_tier:              'synthetic',
      source_type:             'synthetic',
      is_live:                 false,
      affected_companies:      affected_companies.length > 0 ? affected_companies : null,
      affected_resources:      affected_resources.length > 0 ? affected_resources : null,
    };

    // Persist (non-blocking — respond immediately, write async)
    const persistPromise = supabase
      .from('dp_scenarios')
      .insert(scenarioRecord)
      .then(({ error }) => {
        if (!error && cascadePhases.length > 0) {
          return supabase.from('dp_cascade_phases').insert(cascadePhases);
        }
      })
      .then(() => {
        // Trigger post-generate validation (fire-and-forget, never blocks response)
        const ValidationPipeline = require('../validation/index');
        const pipeline = new ValidationPipeline(supabase);
        return pipeline.run(scenarioId, { autoCorrect: true, persist: true, triggeredBy: 'post_generate' });
      })
      .catch(() => {});  // fail-open: don't break response on DB write or validation failure

    const processingMs = Date.now() - startMs;

    // ── 12. Build response
    const response = {
      scenario_id:            scenarioId,
      status:                 'completed',
      processing_time_ms:     processingMs,

      input: {
        event_type, region, industry, intensity, country_codes,
        policy_impact, manipulation_risk, vertical: vertical || 'default',
      },

      scores: {
        direct_impact:   Math.round(directImpact),
        indirect_impact: Math.round(indirectImpact),
        risk_score:      finalRiskScore,
        confidence:      confidence.confidence,
        confidence_explanation: confidence.explanation,
        score_explanation:      scoring.explanation,
        score_components:       scoring.components,
      },

      timeline: {
        time_to_impact_days: time_to_impact_days,
        recovery_time_days:  recovery.adjusted,
        recovery_multiplier: recovery.multiplier,
      },

      hidden_dependency: {
        percentage:  hidden_dependency_pct,
        explanation: `${hidden_dependency_pct}% of exposure comes from non-obvious Tier 2+ dependencies.`,
      },

      non_linear: nonLinear.flag ? {
        flag:         nonLinear.flag,
        multiplier:   nonLinear.multiplier,
        explanation:  nonLinear.explanation,
      } : null,

      cascade_phases: options.include_cascade_phases !== false ? cascadePhases : undefined,

      trust_tier:          'synthetic',
      assumption_manifest: assumptionManifest,

      quota_status: {
        used:    quota.used + 1,
        quota:   quota.quota,
        remaining: quota.quota === -1 ? 'unlimited' : Math.max(0, quota.quota - quota.used - 1),
      },

      _links: {
        self:           `/api/v1/scenarios/${scenarioId}`,
        dependency_map: `/api/v1/dependency-map?scenario_id=${scenarioId}`,
      },
    };

    await persistPromise;
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

function deriveExposureLevel(riskScore, hiddenPct) {
  const composite = riskScore * 0.7 + hiddenPct * 0.3;
  if (composite >= 80) return 'Critical';
  if (composite >= 65) return 'High';
  if (composite >= 45) return 'Medium';
  return 'Low';
}

function buildAssumptionManifest({ event_type, region, country_codes, intensity, policy_impact, manipulation_risk, vertical }) {
  return {
    model_version: 'DIRE-X v2.1',
    scoring_engine: 'deterministic (sresEngine + riskEngine)',
    weight_profile: vertical || 'default',
    key_assumptions: [
      `Event intensity classified as '${intensity}' based on user input.`,
      `Primary affected country: ${country_codes[0] || 'unspecified'} — geopolitical baseline from NATION_BASELINES.`,
      `Policy response: ${policy_impact} — multiplier applied to composite score.`,
      `Manipulation risk: ${manipulation_risk} — confidence discount applied.`,
      'Recovery curve assumes no second-order geopolitical escalation.',
      'Tier-decay factor 0.75 applied per supply chain tier.',
    ],
    key_exclusions: [
      'Model does not account for coordinated multi-event scenarios unless explicitly parameterized.',
      'Financial market reactions (equities, FX) not modeled.',
      'Regulatory response timelines are assumed based on historical averages, not country-specific legislative calendars.',
    ],
    data_sources: [
      'USGS Mineral Commodity Summaries (latest)',
      'World Bank Governance Indicators (WBGI)',
      'IEA Critical Minerals Report',
      'DIRE-X NATION_BASELINES (calibrated against historical events)',
    ],
    generated_at: new Date().toISOString(),
  };
}

module.exports = router;
