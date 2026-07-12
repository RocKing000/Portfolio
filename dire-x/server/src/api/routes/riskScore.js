/**
 * api/routes/riskScore.js
 *
 * GET /api/v1/risk-score
 *
 * Returns the current (time-decay-adjusted) risk score for:
 *   - A stored scenario     → ?scenario_id=SCN-001
 *   - A company entity      → ?entity=company&entity_id=CO-TSMC-001&event_type=port_shutdown
 *   - A resource            → ?entity=resource&resource_name=gallium
 *
 * Available to all tiers.
 */

'use strict';

const { Router } = require('express');
const supabase   = require('../../config/supabase');
const {
  computeRiskScore,
  computeConfidence,
  applyTimeDecay,
}                = require('../services/scoringService');
const { computeBaseRiskScore } = require('../../engines/riskEngine');

const router = Router();

const cache    = new Map();
const CACHE_MS = 3 * 60 * 1000;  // 3 min (shorter TTL — scores change with live events)
function cGet(k)      { const e = cache.get(k); return e && (Date.now()-e.t) < CACHE_MS ? e.v : null; }
function cSet(k, v)   { cache.set(k, { v, t: Date.now() }); }

// ─── GET /risk-score ──────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { scenario_id, entity, entity_id, event_type, resource_name, vertical } = req.query;
    const ck = `risk:${JSON.stringify(req.query)}`;
    const cached = cGet(ck);
    if (cached) return res.json(cached);

    // ── Branch 1: Lookup by scenario_id
    if (scenario_id) {
      return await scoreByScenarioId({ scenario_id, vertical, res, ck });
    }

    // ── Branch 2: Company entity
    if (entity === 'company' && entity_id) {
      return await scoreByCompany({ entity_id, event_type, vertical, res, ck });
    }

    // ── Branch 3: Resource
    if (entity === 'resource' && resource_name) {
      return await scoreByResource({ resource_name, vertical, res, ck });
    }

    return res.status(400).json({
      error:   'Provide one of: scenario_id | (entity + entity_id) | (entity=resource + resource_name)',
      code:    'MISSING_PARAMS',
      examples: [
        '/api/v1/risk-score?scenario_id=SCN-001',
        '/api/v1/risk-score?entity=company&entity_id=CO-TSMC-001&event_type=port_shutdown',
        '/api/v1/risk-score?entity=resource&resource_name=gallium',
      ],
    });
  } catch (err) {
    next(err);
  }
});

// ─── Branch handlers ──────────────────────────────────────────────────────────

async function scoreByScenarioId({ scenario_id, vertical, res, ck }) {
  const { data, error } = await supabase
    .from('dp_scenarios')
    .select('*')
    .eq('scenario_id', scenario_id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: `Scenario ${scenario_id} not found.`, code: 'NOT_FOUND' });
  }

  const decay = applyTimeDecay(data.risk_score, data.created_at);

  const recomputed = vertical ? computeRiskScore({
    directImpact:       data.direct_impact_score,
    indirectImpact:     data.indirect_impact_score,
    hiddenDependencyPct: data.hidden_dependency_pct,
    policyImpact:        data.policy_impact,
    manipulationRisk:    data.manipulation_risk,
    timeToImpactDays:    data.time_to_impact_days,
    countryCode:         (data.country_codes || [])[0] || 'US',
    vertical,
  }) : null;

  const response = {
    scenario_id:            data.scenario_id,
    event_type:             data.event_type,
    region:                 data.region,
    industry:               data.industry,
    company_exposure_level: data.company_exposure_level,
    risk_score:             data.risk_score,
    risk_score_live:        decay.adjustedScore,
    direct_impact_score:    data.direct_impact_score,
    indirect_impact_score:  data.indirect_impact_score,
    confidence_score:       data.confidence_score,
    hidden_dependency_pct:  data.hidden_dependency_pct,
    time_to_impact_days:    data.time_to_impact_days,
    recovery_time_days:     data.recovery_time_days,
    trust_tier:             data.trust_tier,
    is_live:                data.is_live,
    days_since_generation:  decay.daysSinceGeneration,
    stale_flag:             decay.staleFlag,
    score_explanation:      data.score_explanation,
    ...(recomputed ? { vertical_recomputed: { vertical, risk_score: Math.round(recomputed.riskScore), explanation: recomputed.explanation } } : {}),
    _links: { self: `/api/v1/scenarios/${scenario_id}` },
  };

  cSet(ck, response);
  return res.json(response);
}

async function scoreByCompany({ entity_id, event_type, vertical, res, ck }) {
  // Try dp_supplier_nodes first
  const { data: nodeData } = await supabase
    .from('dp_supplier_nodes')
    .select('*')
    .eq('node_id', entity_id)
    .single();

  // Also look up any stored scenarios for this entity
  const { data: relatedScenarios } = await supabase
    .from('dp_scenarios')
    .select('scenario_id, event_type, risk_score, direct_impact_score, indirect_impact_score, confidence_score, hidden_dependency_pct, time_to_impact_days, created_at')
    .contains('affected_companies', [nodeData?.display_name || entity_id])
    .order('risk_score', { ascending: false })
    .limit(5);

  // Compute a baseline risk score using riskEngine
  const countryCode = nodeData?.country_code || 'US';
  const { baseScore, factors } = computeBaseRiskScore({ nationCode: countryCode, resources: [] });

  // Filter by event_type if provided
  const filteredScenarios = event_type
    ? (relatedScenarios || []).filter(s => s.event_type.includes(event_type.toLowerCase()))
    : relatedScenarios || [];

  const topScenario = filteredScenarios[0];
  const decay = topScenario ? applyTimeDecay(topScenario.risk_score, topScenario.created_at) : null;

  const response = {
    entity_id,
    entity_name:         nodeData?.display_name || entity_id,
    entity_type:        'company',
    country_code:        countryCode,
    industry:            nodeData?.industry,
    sres_score:          nodeData?.sres_score,
    is_single_source:    nodeData?.is_single_source ?? false,
    baseline_risk_score: Math.round(baseScore),
    baseline_factors:    factors,
    event_type_filter:   event_type || null,
    top_matched_scenario: topScenario ? {
      scenario_id:       topScenario.scenario_id,
      event_type:        topScenario.event_type,
      risk_score:        topScenario.risk_score,
      risk_score_live:   decay?.adjustedScore,
      confidence:        topScenario.confidence_score,
      hidden_dep_pct:    topScenario.hidden_dependency_pct,
      time_to_impact:    topScenario.time_to_impact_days,
    } : null,
    all_related_scenarios: filteredScenarios.map(s => ({
      scenario_id: s.scenario_id,
      event_type:  s.event_type,
      risk_score:  s.risk_score,
    })),
    resource_dependencies: nodeData?.resource_dependencies || [],
    _links: { dependency_map: `/api/v1/dependency-map?root=${entity_id}` },
  };

  cSet(ck, response);
  return res.json(response);
}

async function scoreByResource({ resource_name, vertical, res, ck }) {
  // Find scenarios affecting this resource
  const { data: scenarios } = await supabase
    .from('dp_scenarios')
    .select('scenario_id, event_type, region, industry, risk_score, confidence_score, hidden_dependency_pct, time_to_impact_days, recovery_time_days, created_at')
    .contains('affected_resources', [resource_name])
    .order('risk_score', { ascending: false })
    .limit(10);

  const matched = scenarios || [];

  const avgRisk = matched.length > 0
    ? Math.round(matched.reduce((s, r) => s + r.risk_score, 0) / matched.length)
    : null;

  const maxRisk = matched.length > 0 ? Math.max(...matched.map(s => s.risk_score)) : null;

  const response = {
    resource_name,
    entity_type:       'resource',
    matched_scenario_count: matched.length,
    avg_risk_score:     avgRisk,
    max_risk_score:     maxRisk,
    risk_assessment:    riskLabel(maxRisk),
    top_scenarios:      matched.slice(0, 5).map(s => {
      const decay = applyTimeDecay(s.risk_score, s.created_at);
      return {
        scenario_id:      s.scenario_id,
        event_type:       s.event_type,
        region:           s.region,
        risk_score:       s.risk_score,
        risk_score_live:  decay.adjustedScore,
        stale_flag:       decay.staleFlag,
        hidden_dep_pct:   s.hidden_dependency_pct,
      };
    }),
  };

  cSet(ck, response);
  return res.json(response);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskLabel(score) {
  if (score === null) return 'UNKNOWN';
  if (score >= 85) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'ELEVATED';
  if (score >= 30) return 'MODERATE';
  return 'LOW';
}

module.exports = router;
