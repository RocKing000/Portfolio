/**
 * api/routes/validateExposure.js
 *
 * POST /api/v1/validate-exposure
 *
 * Customer uploads their supplier list.
 * DIRE-X cross-references against stored scenarios and returns
 * a risk exposure matrix with spend-at-risk and mitigation options.
 *
 * Tier gate: professional and above.
 * Supplier count limit enforced per tier.
 */

'use strict';

const { Router }             = require('express');
const supabase               = require('../../config/supabase');
const { requireTier }        = require('../middleware/apiKeyAuth');
const { scoreSupplierExposure } = require('../services/dependencyService');

const router = Router();

// ─── POST /validate-exposure ──────────────────────────────────────────────────

router.post('/', requireTier('professional'), async (req, res, next) => {
  try {
    const {
      suppliers,
      scenario_ids,
      min_risk_score = 50,
      output         = 'exposure_matrix',   // 'exposure_matrix' | 'summary' | 'full'
    } = req.body;

    // ── Validate input
    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      return res.status(400).json({
        error: '`suppliers` must be a non-empty array.',
        code:  'VALIDATION_ERROR',
      });
    }

    // Tier-based supplier limit
    const supplierLimit = req.apiKey.validate_exposure_limit;
    if (supplierLimit !== -1 && suppliers.length > supplierLimit) {
      return res.status(400).json({
        error:  `Your ${req.apiKey.tier} tier allows up to ${supplierLimit} suppliers per call. Received: ${suppliers.length}.`,
        code:   'SUPPLIER_LIMIT_EXCEEDED',
        limit:  supplierLimit,
        upgrade_url: 'https://direx.io/pricing',
      });
    }

    // Validate each supplier entry
    const validatedSuppliers = [];
    const inputErrors        = [];

    for (let i = 0; i < suppliers.length; i++) {
      const s = suppliers[i];
      if (!s.name) { inputErrors.push(`suppliers[${i}]: name is required`); continue; }
      validatedSuppliers.push({
        name:         String(s.name).slice(0, 256),
        country_code: s.country_code ? String(s.country_code).slice(0, 2).toUpperCase() : null,
        industry:     s.industry     ? String(s.industry).slice(0, 64)                  : null,
        category:     s.category     ? String(s.category).slice(0, 64)                  : null,
        spend_usd:    s.spend_usd    ? Math.max(0, parseInt(s.spend_usd, 10))            : 0,
        tier:         s.tier         ? Math.min(6, Math.max(1, parseInt(s.tier, 10)))    : 1,
      });
    }

    if (inputErrors.length > 0) {
      return res.status(400).json({ error: 'Supplier validation failed.', code: 'VALIDATION_ERROR', details: inputErrors });
    }

    // ── Fetch relevant scenarios
    let scenarioQuery = supabase
      .from('dp_scenarios')
      .select('scenario_id, event_type, region, industry, country_codes, risk_score, direct_impact_score, indirect_impact_score, confidence_score, time_to_impact_days, recovery_time_days, hidden_dependency_pct, policy_impact, manipulation_risk, affected_resources, scenario_notes')
      .gte('risk_score', min_risk_score)
      .order('risk_score', { ascending: false });

    if (Array.isArray(scenario_ids) && scenario_ids.length > 0) {
      scenarioQuery = scenarioQuery.in('scenario_id', scenario_ids.slice(0, 50));
    } else {
      scenarioQuery = scenarioQuery.limit(50);  // use top-50 by risk if no IDs specified
    }

    const { data: scenarios, error: scError } = await scenarioQuery;
    if (scError) throw scError;
    if (!scenarios || scenarios.length === 0) {
      return res.status(404).json({
        error:  'No scenarios found matching criteria.',
        code:   'NO_SCENARIOS',
        hint:   'Seed dp_scenarios or use /api/v1/simulate-scenario to generate scenarios first.',
      });
    }

    // ── Score exposure matrix
    const exposureMatrix = scoreSupplierExposure(validatedSuppliers, scenarios);

    // ── Compute summary statistics
    const summary = buildSummary(validatedSuppliers, exposureMatrix, scenarios);

    // ── Build response by output format
    let responseData;
    if (output === 'summary') {
      responseData = { summary };
    } else if (output === 'full') {
      responseData = { summary, exposure_matrix: exposureMatrix, scenarios_used: scenarios.length };
    } else {
      // Default: exposure_matrix (top 50 results)
      responseData = {
        summary,
        exposure_matrix: exposureMatrix.slice(0, 100),
        total_exposure_records: exposureMatrix.length,
      };
    }

    res.json({
      ...responseData,
      meta: {
        suppliers_analyzed:   validatedSuppliers.length,
        scenarios_analyzed:   scenarios.length,
        min_risk_filter:      min_risk_score,
        output_format:        output,
        quota_remaining:      req.apiKey.validate_exposure_limit === -1
                                ? 'unlimited'
                                : `${Math.max(0, req.apiKey.validate_exposure_limit - validatedSuppliers.length)} suppliers`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(suppliers, matrix, scenarios) {
  if (matrix.length === 0) {
    return { total_spend_usd: 0, spend_at_risk_usd: 0, risk_pct: 0, top_threats: [] };
  }

  const totalSpend = suppliers.reduce((s, sup) => s + (sup.spend_usd || 0), 0);

  // Highest exposure record per supplier
  const perSupplier = new Map();
  for (const row of matrix) {
    const existing = perSupplier.get(row.supplier_name);
    if (!existing || row.exposure_score > existing.exposure_score) {
      perSupplier.set(row.supplier_name, row);
    }
  }

  const topExposures  = Array.from(perSupplier.values()).sort((a, b) => b.exposure_score - a.exposure_score);
  const spendAtRisk   = topExposures.reduce((s, r) => s + (r.spend_at_risk_usd || 0), 0);
  const highRiskCount = topExposures.filter(r => r.exposure_score >= 70).length;
  const medRiskCount  = topExposures.filter(r => r.exposure_score >= 40 && r.exposure_score < 70).length;

  // Top scenario threats across all suppliers
  const scenarioRiskMap = new Map();
  for (const row of matrix) {
    const existing = scenarioRiskMap.get(row.scenario_id) || { count: 0, total_exposure: 0, event_type: row.event_type };
    existing.count          += 1;
    existing.total_exposure += row.exposure_score;
    scenarioRiskMap.set(row.scenario_id, existing);
  }
  const topThreats = Array.from(scenarioRiskMap.entries())
    .map(([sid, v]) => ({
      scenario_id:       sid,
      event_type:        v.event_type,
      suppliers_exposed: v.count,
      avg_exposure:      Math.round(v.total_exposure / v.count),
    }))
    .sort((a, b) => b.avg_exposure - a.avg_exposure)
    .slice(0, 5);

  return {
    total_spend_analyzed_usd:  totalSpend,
    spend_at_risk_usd:         spendAtRisk,
    spend_at_risk_pct:         totalSpend > 0 ? Math.round(spendAtRisk / totalSpend * 1000) / 10 : 0,
    suppliers_analyzed:        suppliers.length,
    high_risk_suppliers:       highRiskCount,
    medium_risk_suppliers:     medRiskCount,
    low_risk_suppliers:        suppliers.length - highRiskCount - medRiskCount,
    top_exposed_suppliers:     topExposures.slice(0, 5).map(r => ({
      name:           r.supplier_name,
      country:        r.supplier_country,
      exposure_score: r.exposure_score,
      spend_at_risk:  r.spend_at_risk_usd,
    })),
    top_threat_scenarios:      topThreats,
    recommended_priority_actions: topExposures
      .filter(r => r.exposure_score >= 70)
      .slice(0, 3)
      .flatMap(r => r.mitigation_options.slice(0, 1).map(m => ({
        supplier: r.supplier_name,
        ...m,
      }))),
  };
}

module.exports = router;
