/**
 * api/services/dependencyService.js
 *
 * Multi-tier supplier dependency graph traversal.
 * Reads from dp_supplier_nodes and dp_supplier_edges tables.
 *
 * Reuses:
 *   - supplyDepthEngine.js logic for concentration risk
 *   - riskEngine.js NATION_BASELINES for country-level risk
 */

'use strict';

const supabase = require('../../config/supabase');
const { NATION_BASELINES } = require('../../engines/riskEngine');

const TIER_DECAY = 0.75;   // concentration risk decays by 25% per tier

// ─── Graph traversal ──────────────────────────────────────────────────────────

/**
 * Build a multi-tier dependency graph rooted at a given node.
 *
 * @param {string} rootNodeId       e.g. 'CO-TSMC-001'
 * @param {object} options
 * @param {number}   options.maxDepth        default 3
 * @param {string}   [options.filterResource] only traverse edges for this resource
 * @returns {{ nodes, edges, metrics }}
 */
async function buildDependencyMap(rootNodeId, options = {}) {
  const { maxDepth = 3, filterResource = null } = options;

  // BFS traversal
  const visitedNodes = new Map();   // nodeId → node record
  const allEdges     = [];
  const queue        = [{ nodeId: rootNodeId, tier: 0 }];

  // Fetch root
  const root = await fetchNode(rootNodeId);
  if (!root) throw Object.assign(new Error(`Node not found: ${rootNodeId}`), { status: 404 });
  visitedNodes.set(rootNodeId, { ...root, tier: 0 });

  while (queue.length > 0) {
    const { nodeId, tier } = queue.shift();
    if (tier >= maxDepth) continue;

    const edges = await fetchEdges(nodeId, filterResource);
    for (const edge of edges) {
      allEdges.push(edge);

      if (!visitedNodes.has(edge.supplier_id)) {
        const supplierNode = await fetchNode(edge.supplier_id);
        if (supplierNode) {
          visitedNodes.set(edge.supplier_id, { ...supplierNode, tier: tier + 1 });
          queue.push({ nodeId: edge.supplier_id, tier: tier + 1 });
        }
      }
    }
  }

  const nodes = Array.from(visitedNodes.values());

  // Compute graph-level metrics
  const metrics = computeGraphMetrics(nodes, allEdges, rootNodeId);

  return { nodes, edges: allEdges, metrics };
}

// ─── DB fetchers ──────────────────────────────────────────────────────────────

async function fetchNode(nodeId) {
  const { data, error } = await supabase
    .from('dp_supplier_nodes')
    .select('*')
    .eq('node_id', nodeId)
    .single();
  if (error) return null;
  return data;
}

async function fetchEdges(buyerId, filterResource) {
  let query = supabase
    .from('dp_supplier_edges')
    .select('*')
    .eq('buyer_id', buyerId);

  if (filterResource) {
    query = query.ilike('resource_name', `%${filterResource}%`);
  }

  const { data, error } = await query;
  return error ? [] : (data || []);
}

// ─── Metrics computation ──────────────────────────────────────────────────────

function computeGraphMetrics(nodes, edges, rootNodeId) {
  const singleSourceEdges  = edges.filter(e => e.contract_type === 'sole_source');
  const highConcentration  = edges.filter(e => (e.concentration || 0) > 0.6);
  const foreignNodes       = nodes.filter(n => n.node_id !== rootNodeId && n.country_code !== null);

  // Weighted concentration risk: sum(concentration * tier_decay^tier) / node count
  let concentrationRisk = 0;
  for (const edge of edges) {
    const supplierNode = nodes.find(n => n.node_id === edge.supplier_id);
    if (!supplierNode) continue;
    const tier = supplierNode.tier || 1;
    concentrationRisk += (edge.concentration || 0.5) * Math.pow(TIER_DECAY, tier - 1);
  }
  concentrationRisk = edges.length > 0
    ? Math.round((concentrationRisk / edges.length) * 100)
    : 0;

  // Geopolitical exposure: average country risk of all non-root nodes
  const geoScores = foreignNodes.map(n => {
    const baseline = NATION_BASELINES[n.country_code] || { conflict: 40, trade: 40 };
    return (baseline.conflict + baseline.trade) / 2;
  });
  const avgGeoExposure = geoScores.length > 0
    ? Math.round(geoScores.reduce((a, b) => a + b, 0) / geoScores.length)
    : 0;

  // Hidden dependency: % of edges where supplier tier > 1 and concentration > 0.4
  const hiddenHighConc = edges.filter(e => {
    const node = nodes.find(n => n.node_id === e.supplier_id);
    return node && node.tier > 1 && (e.concentration || 0) > 0.4;
  });
  const hiddenDependencyPct = edges.length > 0
    ? Math.round((hiddenHighConc.length / edges.length) * 100)
    : 0;

  return {
    total_nodes:            nodes.length,
    total_edges:            edges.length,
    max_depth_reached:      nodes.length > 0 ? Math.max(...nodes.map(n => n.tier || 0)) : 0,
    single_source_count:    singleSourceEdges.length,
    high_concentration_count: highConcentration.length,
    concentration_risk:     concentrationRisk,
    avg_geo_exposure:       avgGeoExposure,
    hidden_dependency_pct:  hiddenDependencyPct,
    risk_concentration_score: Math.round((concentrationRisk * 0.5 + avgGeoExposure * 0.3 + hiddenDependencyPct * 0.2)),
    single_source_flag:     singleSourceEdges.length > 0,
    hidden_dependency_flag: hiddenDependencyPct > 30,
  };
}

// ─── Exposure validation (POST /validate-exposure) ────────────────────────────

/**
 * Score a customer's supplier list against a set of scenarios.
 *
 * @param {SupplierInput[]} suppliers   Customer-provided list
 * @param {ScenarioRecord[]} scenarios  Scenario records from dp_scenarios
 * @returns {ExposureResult[]}
 */
function scoreSupplierExposure(suppliers, scenarios) {
  const results = [];

  for (const supplier of suppliers) {
    for (const scenario of scenarios) {
      // Check if supplier's country overlaps with scenario's affected region
      const countryMatch = (scenario.country_codes || []).includes(supplier.country_code);
      const industryMatch = supplier.industry
        ? scenario.industry.toLowerCase().includes(supplier.industry.toLowerCase())
        : false;

      // Exposure score: risk_score × country match × industry match
      let exposureScore = scenario.risk_score * 0.3;  // base exposure just from being a supplier
      if (countryMatch)  exposureScore += scenario.risk_score * 0.45;
      if (industryMatch) exposureScore += scenario.risk_score * 0.25;

      const spendAtRisk = countryMatch || industryMatch
        ? Math.round((supplier.spend_usd || 0) * (exposureScore / 100))
        : 0;

      results.push({
        supplier_name:      supplier.name,
        supplier_country:   supplier.country_code,
        scenario_id:        scenario.scenario_id,
        event_type:         scenario.event_type,
        exposure_score:     Math.round(Math.min(100, exposureScore)),
        spend_at_risk_usd:  spendAtRisk,
        time_to_impact_days: scenario.time_to_impact_days,
        country_match:      countryMatch,
        industry_match:     industryMatch,
        mitigation_options: generateMitigationOptions(supplier, scenario),
      });
    }
  }

  // Sort by exposure_score descending
  return results.sort((a, b) => b.exposure_score - a.exposure_score);
}

function generateMitigationOptions(supplier, scenario) {
  const options = [];

  if (scenario.risk_score > 70) {
    options.push({
      action: 'Dual-source qualification',
      description: `Qualify an alternative supplier outside ${scenario.region} for ${supplier.category || 'this category'}.`,
      lead_time_days: 90,
      cost_premium_pct: 15,
    });
  }

  if (scenario.time_to_impact_days <= 30) {
    options.push({
      action: 'Increase safety stock',
      description: `Build 90-day buffer inventory to absorb initial disruption window.`,
      lead_time_days: 30,
      cost_premium_pct: 8,
    });
  }

  if (scenario.recovery_time_days > 365) {
    options.push({
      action: 'Long-term contract renegotiation',
      description: `Add force majeure and geographic substitution clauses to supplier contracts.`,
      lead_time_days: 60,
      cost_premium_pct: 3,
    });
  }

  return options;
}

module.exports = {
  buildDependencyMap,
  scoreSupplierExposure,
  computeGraphMetrics,
};
