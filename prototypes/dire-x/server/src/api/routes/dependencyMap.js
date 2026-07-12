/**
 * api/routes/dependencyMap.js
 *
 * GET /api/v1/dependency-map
 *
 * Returns the multi-tier supplier dependency graph.
 *
 * Modes:
 *   ?root=CO-TSMC-001                → graph rooted at a specific company node
 *   ?scenario_id=SCN-032             → graph for companies affected by a scenario
 *   ?resource=gallium                → all suppliers of a specific resource
 *
 * Tier gate: professional and above for full graph; starter gets depth=1 only.
 */

'use strict';

const { Router }           = require('express');
const supabase             = require('../../config/supabase');
const { buildDependencyMap } = require('../services/dependencyService');

const router = Router();

const cache    = new Map();
const CACHE_MS = 10 * 60 * 1000;  // 10 min — graphs are expensive to build
function cGet(k)    { const e = cache.get(k); return e && (Date.now()-e.t) < CACHE_MS ? e.v : null; }
function cSet(k, v) { cache.set(k, { v, t: Date.now() }); }

// ─── GET /dependency-map ──────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const {
      root,
      scenario_id,
      resource,
      depth  = '3',
      format = 'graph',   // 'graph' | 'adjacency' | 'flat'
    } = req.query;

    // Tier-based depth limit
    const tier      = req.apiKey.tier;
    const maxAllowed = tier === 'starter' ? 1 : tier === 'professional' ? 3 : 6;
    const depthNum  = Math.min(maxAllowed, Math.max(1, parseInt(depth, 10) || 3));

    if (tier === 'starter' && parseInt(depth, 10) > 1) {
      res.setHeader('X-DireX-Depth-Limited', 'true');
      res.setHeader('X-DireX-Upgrade', 'Upgrade to Professional for depth up to 3 tiers.');
    }

    // ── Mode: scenario_id → find affected company nodes
    if (scenario_id && !root) {
      return await mapByScenario({ scenario_id, depthNum, resource, format, res });
    }

    // ── Mode: resource → all suppliers of this resource
    if (resource && !root) {
      return await mapByResource({ resource, depthNum, format, res });
    }

    // ── Mode: specific root node
    if (root) {
      const ck = `depmap:${root}:${depthNum}:${resource || ''}:${format}`;
      const cached = cGet(ck);
      if (cached) return res.json(cached);

      const { nodes, edges, metrics } = await buildDependencyMap(root, {
        maxDepth: depthNum,
        filterResource: resource || null,
      });

      const response = formatGraph({ root, nodes, edges, metrics, format, depthNum });
      cSet(ck, response);
      return res.json(response);
    }

    return res.status(400).json({
      error: 'Provide one of: root | scenario_id | resource',
      code:  'MISSING_PARAMS',
      examples: [
        '/api/v1/dependency-map?root=CO-TSMC-001&depth=3',
        '/api/v1/dependency-map?scenario_id=SCN-032&resource=gallium',
        '/api/v1/dependency-map?resource=cobalt&depth=2',
      ],
    });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message, code: 'NODE_NOT_FOUND' });
    next(err);
  }
});

// ─── Mode handlers ────────────────────────────────────────────────────────────

async function mapByScenario({ scenario_id, depthNum, resource, format, res }) {
  const { data: scenario, error } = await supabase
    .from('dp_scenarios')
    .select('scenario_id, event_type, region, industry, affected_companies, affected_resources, risk_score')
    .eq('scenario_id', scenario_id)
    .single();

  if (error || !scenario) {
    return res.status(404).json({ error: `Scenario ${scenario_id} not found.`, code: 'SCENARIO_NOT_FOUND' });
  }

  const companies = scenario.affected_companies || [];
  const targetResource = resource || (scenario.affected_resources || [])[0] || null;

  // Look up node IDs for affected company names
  let nodeIds = [];
  if (companies.length > 0) {
    const { data: nodes } = await supabase
      .from('dp_supplier_nodes')
      .select('node_id, display_name')
      .in('display_name', companies.slice(0, 5));  // limit to 5 to avoid huge graphs
    nodeIds = (nodes || []).map(n => n.node_id);
  }

  if (nodeIds.length === 0) {
    return res.json({
      scenario_id,
      message: 'No supplier graph nodes found for affected companies in this scenario. Seed dp_supplier_nodes to enable graph queries.',
      affected_companies: companies,
      affected_resources: scenario.affected_resources,
      _links: { seed_docs: '/api/v1/docs#seeding-supplier-graph' },
    });
  }

  // Build graph for first matching node (primary affected company)
  const { nodes, edges, metrics } = await buildDependencyMap(nodeIds[0], {
    maxDepth: depthNum,
    filterResource: targetResource,
  });

  const response = {
    ...formatGraph({ root: nodeIds[0], nodes, edges, metrics, format, depthNum }),
    scenario_context: {
      scenario_id,
      event_type:    scenario.event_type,
      risk_score:    scenario.risk_score,
      region:        scenario.region,
    },
  };
  return res.json(response);
}

async function mapByResource({ resource, depthNum, format, res }) {
  // Find all edges for this resource
  const { data: edges, error } = await supabase
    .from('dp_supplier_edges')
    .select('buyer_id, supplier_id, tier, resource_name, annual_value_usd, concentration, contract_type')
    .ilike('resource_name', `%${resource}%`)
    .order('tier', { ascending: true })
    .limit(200);  // cap to avoid enormous graphs

  if (error) throw error;
  if (!edges || edges.length === 0) {
    return res.status(404).json({
      error:    `No supplier graph edges found for resource: ${resource}`,
      code:     'RESOURCE_NOT_FOUND',
      hint:     'Seed dp_supplier_edges with resource-level dependency data.',
    });
  }

  // Collect unique node IDs
  const nodeIds = [...new Set([
    ...edges.map(e => e.buyer_id),
    ...edges.map(e => e.supplier_id),
  ])];

  const { data: nodes } = await supabase
    .from('dp_supplier_nodes')
    .select('*')
    .in('node_id', nodeIds);

  const nodeMap = Object.fromEntries((nodes || []).map(n => [n.node_id, n]));

  // Count single-source suppliers for this resource
  const singleSource = edges.filter(e => e.contract_type === 'sole_source');

  const response = {
    resource_name:      resource,
    total_nodes:        (nodes || []).length,
    total_edges:        edges.length,
    single_source_count: singleSource.length,
    single_source_flag:  singleSource.length > 0,
    nodes: (nodes || []).map(n => ({
      node_id:      n.node_id,
      display_name: n.display_name,
      country_code: n.country_code,
      industry:     n.industry,
      is_single_source: n.is_single_source,
    })),
    edges: edges.map(e => ({
      from:              e.buyer_id,
      from_name:         nodeMap[e.buyer_id]?.display_name,
      to:                e.supplier_id,
      to_name:           nodeMap[e.supplier_id]?.display_name,
      tier:              e.tier,
      resource:          e.resource_name,
      concentration:     e.concentration,
      annual_value_usd:  e.annual_value_usd,
      contract_type:     e.contract_type,
    })),
    risk_summary: {
      highest_concentration_edge: edges.reduce((a, b) => (a.concentration || 0) > (b.concentration || 0) ? a : b, {}),
      avg_concentration: Math.round(edges.reduce((s, e) => s + (e.concentration || 0), 0) / edges.length * 100) / 100,
    },
  };

  return res.json(response);
}

// ─── Format adapters ──────────────────────────────────────────────────────────

function formatGraph({ root, nodes, edges, metrics, format, depthNum }) {
  const base = {
    root_node_id: root,
    depth:        depthNum,
    metrics,
  };

  if (format === 'adjacency') {
    // Adjacency list format: { nodeId: [neighborId, ...] }
    const adj = {};
    for (const e of edges) {
      if (!adj[e.buyer_id])    adj[e.buyer_id]    = [];
      if (!adj[e.supplier_id]) adj[e.supplier_id] = [];
      adj[e.buyer_id].push(e.supplier_id);
    }
    return { ...base, adjacency: adj, node_count: nodes.length };
  }

  if (format === 'flat') {
    // Flat list of nodes with tier info — useful for table display
    return {
      ...base,
      nodes: nodes.map(n => ({
        node_id:      n.node_id,
        display_name: n.display_name,
        country_code: n.country_code,
        tier:         n.tier,
        is_single_source: n.is_single_source,
        sres_score:   n.sres_score,
      })),
    };
  }

  // Default: full graph format
  return {
    ...base,
    root: nodes.find(n => n.node_id === root) || { node_id: root },
    nodes: nodes.map(n => ({
      id:           n.node_id,
      display_name: n.display_name,
      ticker:       n.ticker,
      country_code: n.country_code,
      industry:     n.industry,
      tier:         n.tier,
      is_single_source: n.is_single_source,
      sres_score:   n.sres_score,
      annual_revenue_usd: n.annual_revenue_usd,
      resource_dependencies: n.resource_dependencies,
    })),
    edges: edges.map(e => ({
      from:               e.buyer_id,
      to:                 e.supplier_id,
      tier:               e.tier,
      resource:           e.resource_name,
      annual_value_usd:   e.annual_value_usd,
      concentration:      e.concentration,
      lead_time_alt_days: e.lead_time_alt_days,
      contract_type:      e.contract_type,
      geo_overlap:        e.geo_overlap,
    })),
    hidden_dependency_flag: metrics.hidden_dependency_flag,
    hidden_dependency_explanation: metrics.hidden_dependency_flag
      ? `${metrics.hidden_dependency_pct}% of supply dependencies involve Tier 2+ suppliers with concentration > 40% — these are non-obvious exposure points not visible in standard Tier-1 audits.`
      : null,
  };
}

module.exports = router;
