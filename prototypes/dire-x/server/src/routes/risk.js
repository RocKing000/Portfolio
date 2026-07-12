const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { computeSRES, computeCompanySRES } = require('../engines/sresEngine');
const { SRES_WEIGHTS, COUNTRY_COORDS } = require('../config/constants');
const { computeBaseRiskScore, applyAIAdjustment, NATION_BASELINES } = require('../engines/riskEngine');
const { getRiskAdjustment } = require('../services/aiInsights.service');

/**
 * Build ISO2 → { name, lat, lng } from countries_master + COUNTRY_COORDS.
 * Called once per heatmap request (result is merged into the 5-min cache).
 */
async function buildNationMeta(iso2Codes) {
  const { data, error } = await supabase
    .from('countries_master')
    .select('code2, name')
    .in('code2', iso2Codes);

  if (error) {
    console.warn('[risk/heatmap] countries_master lookup failed:', error.message);
  }

  const meta = {};
  for (const row of data || []) {
    const coords = COUNTRY_COORDS[row.name];
    if (coords) {
      meta[row.code2] = { name: row.name, lat: coords.lat, lng: coords.lng };
    }
  }
  return meta;
}

const { CACHE_TTL_HEATMAP } = require('../config/server');

// Full heatmap cache (recomputed every 5 min)
let heatmapCache = null;
let heatmapCachedAt = 0;
const HEATMAP_TTL_MS = CACHE_TTL_HEATMAP;

// GET /risk/heatmap — nation-level strategic risk scores for map overlay
router.get('/heatmap', async (req, res, next) => {
  try {
    const { resource } = req.query; // optional resource filter (name)

    // Serve cache if fresh and no resource filter is forcing a refresh
    if (!resource && heatmapCache && Date.now() - heatmapCachedAt < HEATMAP_TTL_MS) {
      return res.json({ data: heatmapCache, cached: true, computed_at: new Date(heatmapCachedAt).toISOString() });
    }

    // ── 1. Fetch companies ──
    const { data: companies, error: compErr } = await supabase
      .from('companies')
      .select('id, name, country');

    if (compErr) throw compErr;
    if (!companies || companies.length === 0) {
      return res.json({ data: [], cached: false, computed_at: new Date().toISOString() });
    }

    // ── 2. Fetch all company_resources with resource + risk_metrics ──
    let crQuery = supabase
      .from('company_resources')
      .select(`
        company_id,
        dependency_score,
        resources (
          id, name, category,
          supply_risk, strategic_importance, geopolitical_sensitivity
        )
      `);

    if (resource) {
      // Filter to companies that use this resource
      crQuery = crQuery.ilike('resources.name', `%${resource}%`);
    }

    const { data: companyResources, error: crErr } = await crQuery;
    if (crErr) throw crErr;

    // ── 3. Fetch risk_metrics for all resource IDs ──
    const resourceIds = [...new Set((companyResources || [])
      .map(cr => cr.resources?.id)
      .filter(Boolean))];

    let metricsMap = {};
    if (resourceIds.length > 0) {
      const { data: metrics } = await supabase
        .from('risk_metrics')
        .select('resource_id, demand_index, supply_index, geopolitical_index, environmental_index')
        .in('resource_id', resourceIds);

      for (const m of metrics || []) {
        metricsMap[m.resource_id] = m;
      }
    }

    // ── 4. Build enriched resource list per company ──
    const crByCompany = {};
    for (const cr of companyResources || []) {
      if (!cr.resources) continue;
      const cid = cr.company_id;
      if (!crByCompany[cid]) crByCompany[cid] = [];
      const metrics = metricsMap[cr.resources.id] || {};
      crByCompany[cid].push({
        name: cr.resources.name,
        dependency_score: parseFloat(cr.dependency_score) || 0.5,
        supply_risk: parseFloat(cr.resources.supply_risk) || 0.5,
        strategic_importance: parseFloat(cr.resources.strategic_importance) || 0.5,
        geopolitical_sensitivity: parseFloat(cr.resources.geopolitical_sensitivity) || 0.5,
        geopolitical_index: parseFloat(metrics.geopolitical_index) || null,
        supply_index: parseFloat(metrics.supply_index) || null,
      });
    }

    // ── 5. Group companies by nation ──
    const nationMap = {};
    for (const company of companies) {
      const code = company.country;
      if (!code) continue;
      if (!nationMap[code]) {
        nationMap[code] = { companyIds: [], resources: [] };
      }
      nationMap[code].companyIds.push(company.id);
      const compResources = crByCompany[company.id] || [];
      for (const r of compResources) {
        // Deduplicate by name, keep highest dependency
        const existing = nationMap[code].resources.find(x => x.name === r.name);
        if (!existing) {
          nationMap[code].resources.push({ ...r });
        } else if (r.dependency_score > existing.dependency_score) {
          Object.assign(existing, r);
        }
      }
    }

    // ── 6. Resolve nation metadata from DB + COUNTRY_COORDS ──
    const nationCodes = Object.keys(nationMap);
    const nationMeta = await buildNationMeta(nationCodes);

    const heatmapEntries = await Promise.all(
      nationCodes.map(async (code) => {
        const meta = nationMeta[code];
        if (!meta) return null; // no DB record or no coordinates yet

        const { resources: nResources } = nationMap[code];
        const { baseScore, factors } = computeBaseRiskScore({ nationCode: code, resources: nResources });

        // AI adjustment (cached per nation; graceful fallback)
        const aiResult = await getRiskAdjustment({
          nationCode: code,
          nationName: meta.name,
          baseScore,
          resources: nResources.map(r => r.name),
        });

        const finalScore = applyAIAdjustment(baseScore, aiResult.adjustment);

        return {
          code,
          nation: meta.name,
          lat: meta.lat,
          lng: meta.lng,
          riskScore: finalScore,
          baseScore,
          aiAdjustment: aiResult.adjustment,
          factors,
          risks: aiResult.key_risks,
          aiSummary: aiResult.summary,
          confidence: aiResult.confidence,
          resourceCount: nResources.length,
          companyCount: nationMap[code].companyIds.length,
          trend: aiResult.adjustment > 2 ? 'increasing' : aiResult.adjustment < -2 ? 'decreasing' : 'stable',
        };
      })
    );

    const filtered = heatmapEntries.filter(Boolean).sort((a, b) => b.riskScore - a.riskScore);

    // Cache (only when no resource filter)
    if (!resource) {
      heatmapCache = filtered;
      heatmapCachedAt = Date.now();
    }

    res.json({
      data: filtered,
      cached: false,
      computed_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /risk/global — aggregated risk overview
router.get('/global', async (_req, res, next) => {
  try {
    const { data: metrics, error: metError } = await supabase
      .from('risk_metrics')
      .select(`
        *,
        resources (
          id,
          name,
          category
        )
      `)
      .order('updated_at', { ascending: false });

    if (metError) throw metError;

    const dedupedMetrics = [];
    const seenResources = new Set();
    for (const m of metrics || []) {
      if (!seenResources.has(m.resource_id)) {
        seenResources.add(m.resource_id);
        dedupedMetrics.push(m);
      }
    }

    const resourceScores = dedupedMetrics.map((m) => {
      const sres = computeSRES(
        m.resources?.name || 'unknown',
        {
          demand: m.demand_index,
          supply: m.supply_index,
          geopolitical: m.geopolitical_index,
          environmental: m.environmental_index,
        },
        SRES_WEIGHTS
      );
      return {
        resource_id: m.resource_id,
        resource_name: m.resources?.name || 'Unknown',
        category: m.resources?.category || 'unknown',
        sres,
        demand: m.demand_index,
        supply: m.supply_index,
        geopolitical: m.geopolitical_index,
        environmental: m.environmental_index,
      };
    });

    const totalSRES =
      resourceScores.length > 0
        ? resourceScores.reduce((sum, r) => sum + r.sres, 0) / resourceScores.length
        : 0;

    const byCategory = {};
    for (const rs of resourceScores) {
      if (!byCategory[rs.category]) {
        byCategory[rs.category] = { scores: [], count: 0 };
      }
      byCategory[rs.category].scores.push(rs.sres);
      byCategory[rs.category].count += 1;
    }

    const categoryAverages = {};
    for (const [cat, data] of Object.entries(byCategory)) {
      categoryAverages[cat] = {
        average_sres: data.scores.reduce((a, b) => a + b, 0) / data.count,
        count: data.count,
      };
    }

    const highRisk = resourceScores.filter((r) => r.sres >= 65).sort((a, b) => b.sres - a.sres);

    res.json({
      data: {
        global_sres: Math.round(totalSRES * 100) / 100,
        resource_count: resourceScores.length,
        category_averages: categoryAverages,
        high_risk_resources: highRisk,
        all_resources: resourceScores.sort((a, b) => b.sres - a.sres),
        computed_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /risk/:companyId — compute SRES for a specific company
router.get('/:companyId', async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const { data: company, error: compError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (compError) {
      if (compError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Company not found', code: 'NOT_FOUND' });
      }
      throw compError;
    }

    const { data: companyResources, error: crError } = await supabase
      .from('company_resources')
      .select(`
        resource_id,
        dependency_score,
        resources (
          id,
          name,
          category
        )
      `)
      .eq('company_id', companyId);

    if (crError) throw crError;

    const resourceIds = (companyResources || []).map((cr) => cr.resource_id);

    let riskMetrics = [];
    if (resourceIds.length > 0) {
      const { data: metrics, error: metError } = await supabase
        .from('risk_metrics')
        .select('*')
        .in('resource_id', resourceIds)
        .order('updated_at', { ascending: false });

      if (metError) throw metError;
      riskMetrics = metrics || [];
    }

    const dedupedMetrics = {};
    for (const m of riskMetrics) {
      if (!dedupedMetrics[m.resource_id]) {
        dedupedMetrics[m.resource_id] = m;
      }
    }

    const resourceBreakdown = (companyResources || []).map((cr) => {
      const metric = dedupedMetrics[cr.resource_id];
      const metrics = metric
        ? {
            demand: metric.demand_index,
            supply: metric.supply_index,
            geopolitical: metric.geopolitical_index,
            environmental: metric.environmental_index,
          }
        : { demand: 50, supply: 50, geopolitical: 50, environmental: 50 };

      const sres = computeSRES(cr.resources?.name || 'unknown', metrics, SRES_WEIGHTS);

      return {
        resource_id: cr.resource_id,
        resource_name: cr.resources?.name || 'Unknown',
        category: cr.resources?.category || 'unknown',
        dependency_score: cr.dependency_score,
        sres,
        metrics,
      };
    });

    const companyResourcesForCalc = resourceBreakdown.map((r) => ({
      resource_id: r.resource_id,
      sres: r.sres,
      dependency: r.dependency_score,
    }));

    const companySRES = computeCompanySRES(resourceBreakdown, companyResourcesForCalc);

    res.json({
      data: {
        company_id: companyId,
        company_name: company.name,
        company_sres: Math.round(companySRES * 100) / 100,
        resource_breakdown: resourceBreakdown.sort((a, b) => b.sres - a.sres),
        computed_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
