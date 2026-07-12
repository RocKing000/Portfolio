const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const { SRES_WEIGHTS, SCENARIO_MULTIPLIERS } = require('../config/constants');
const { computeSRES, computeCompanySRES, applyScenarioModifiers } = require('../engines/sresEngine');
const { calculateImpact, calculateDimensionalImpact, aggregateImpacts } = require('../engines/impactEngine');
const { generateEvents } = require('../engines/eventEngine');
const { generateNarration } = require('../services/aiNarration');

// ---------- Decision parsing ----------

const INTENT_KEYWORDS = {
  ban: { intent: 'ban', intensity: 9, direction: 'restrictive' },
  restrict: { intent: 'restrict', intensity: 7, direction: 'restrictive' },
  sanction: { intent: 'sanction', intensity: 8, direction: 'restrictive' },
  diversify: { intent: 'diversify', intensity: 5, direction: 'neutral' },
  stockpile: { intent: 'stockpile', intensity: 6, direction: 'protective' },
  invest: { intent: 'invest', intensity: 5, direction: 'expansive' },
  reduce: { intent: 'reduce', intensity: 6, direction: 'restrictive' },
  increase: { intent: 'increase', intensity: 5, direction: 'expansive' },
  shift: { intent: 'shift', intensity: 5, direction: 'neutral' },
  import: { intent: 'import', intensity: 4, direction: 'expansive' },
  export: { intent: 'export', intensity: 4, direction: 'expansive' },
  trade: { intent: 'trade', intensity: 4, direction: 'neutral' },
};

const RESOURCE_KEYWORDS = {
  oil: { category: 'energy', resources: ['oil'] },
  gas: { category: 'energy', resources: ['natural_gas'] },
  coal: { category: 'energy', resources: ['coal'] },
  uranium: { category: 'energy', resources: ['uranium'] },
  solar: { category: 'energy', resources: ['solar'] },
  energy: { category: 'energy', resources: ['oil', 'natural_gas', 'coal', 'uranium'] },
  lithium: { category: 'minerals', resources: ['lithium'] },
  cobalt: { category: 'minerals', resources: ['cobalt'] },
  copper: { category: 'minerals', resources: ['copper'] },
  rare_earth: { category: 'minerals', resources: ['rare_earth'] },
  rare: { category: 'minerals', resources: ['rare_earth'] },
  iron: { category: 'minerals', resources: ['iron_ore'] },
  mineral: { category: 'minerals', resources: ['lithium', 'cobalt', 'copper', 'rare_earth', 'iron_ore'] },
  wheat: { category: 'food', resources: ['wheat'] },
  rice: { category: 'food', resources: ['rice'] },
  corn: { category: 'food', resources: ['corn'] },
  soybean: { category: 'food', resources: ['soybeans'] },
  food: { category: 'food', resources: ['wheat', 'rice', 'corn', 'soybeans'] },
  grain: { category: 'food', resources: ['wheat', 'rice', 'corn'] },
  semiconductor: { category: 'tech', resources: ['semiconductors'] },
  chip: { category: 'tech', resources: ['semiconductors'] },
  battery: { category: 'tech', resources: ['batteries'] },
  batteries: { category: 'tech', resources: ['batteries'] },
  tech: { category: 'tech', resources: ['semiconductors', 'batteries'] },
};

/**
 * Parse the user's decision text into a structured intent object.
 */
function parseDecisionIntent(decisionText) {
  const lower = decisionText.toLowerCase();
  const words = lower.split(/\s+/);

  let matchedIntent = null;
  for (const word of words) {
    for (const [keyword, data] of Object.entries(INTENT_KEYWORDS)) {
      // Match exact word or common English inflections
      // Handles: ban/banning/banned, invest/investing/invested, reduce/reducing/reduced
      const lastChar = keyword[keyword.length - 1];
      const doubled = keyword + lastChar; // "ban" -> "bann" for "banning"
      if (
        word === keyword ||
        word === keyword + 'ing' ||
        word === keyword + 'ed' ||
        word === keyword + 's' ||
        word === keyword + 'tion' ||
        word === keyword + 'ment' ||
        word === doubled + 'ing' ||  // banning, shipping
        word === doubled + 'ed' ||   // banned, shipped
        word === keyword + 'ting' || // restricting, exporting
        word === keyword.slice(0, -1) + 'ing' || // reducing -> reduc+ing (for -e endings: reduce -> reducing)
        word === keyword + 'ation' || // diversification
        word === keyword + 'ment'     // investment
      ) {
        matchedIntent = data;
        break;
      }
    }
    if (matchedIntent) break;
  }

  if (!matchedIntent) {
    matchedIntent = { intent: 'general', intensity: 5, direction: 'neutral' };
  }

  return {
    ...matchedIntent,
    rawText: decisionText,
  };
}

/**
 * Map the decision text to affected resource categories and specific resources.
 */
function mapDecisionToResources(decisionText) {
  const lower = decisionText.toLowerCase();
  const matched = new Set();
  const categories = new Set();

  for (const [keyword, data] of Object.entries(RESOURCE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      categories.add(data.category);
      for (const r of data.resources) {
        matched.add(r);
      }
    }
  }

  // If no specific resources detected, assume broad economic impact
  if (matched.size === 0) {
    return {
      categories: ['energy', 'minerals'],
      resources: ['oil', 'natural_gas', 'copper'],
      isDefault: true,
    };
  }

  return {
    categories: [...categories],
    resources: [...matched],
    isDefault: false,
  };
}

/**
 * Core simulation function. Orchestrates the full pipeline.
 */
async function runSimulation({ companyId, decision, scenario, currentDay }) {
  const simulationId = uuidv4();
  const startTime = Date.now();

  // 1. Parse intent
  const intent = parseDecisionIntent(decision);

  // 2. Map to resources
  const affectedResources = mapDecisionToResources(decision);

  // 3. Fetch company data and latest metrics from DB
  let company = null;
  let companyResources = [];
  let riskMetrics = [];

  try {
    const { data: comp } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();
    company = comp;

    const { data: cr } = await supabase
      .from('company_resources')
      .select(`
        resource_id,
        dependency_score,
        resources (id, name, category)
      `)
      .eq('company_id', companyId);
    companyResources = cr || [];

    const resourceIds = companyResources.map((c) => c.resource_id);
    if (resourceIds.length > 0) {
      const { data: metrics } = await supabase
        .from('risk_metrics')
        .select('*')
        .in('resource_id', resourceIds);
      riskMetrics = metrics || [];
    }
  } catch (dbErr) {
    console.warn('[SimOrchestrator] DB fetch failed, using fallback data:', dbErr.message);
    company = { id: companyId, name: 'Unknown Company', sector: 'general', country: 'US' };
    companyResources = generateFallbackCompanyResources(affectedResources);
    riskMetrics = generateFallbackMetrics(companyResources);
  }

  // Build a lookup of metrics by resource_id
  const metricsMap = {};
  for (const m of riskMetrics) {
    metricsMap[m.resource_id] = {
      demand: m.demand_index || 50,
      supply: m.supply_index || 50,
      geopolitical: m.geopolitical_index || 50,
      environmental: m.environmental_index || 50,
    };
  }

  // 4. Apply scenario multipliers to base metrics
  const adjustedMetrics = {};
  for (const [resId, baseMetrics] of Object.entries(metricsMap)) {
    adjustedMetrics[resId] = applyScenarioModifiers(baseMetrics, scenario);
  }

  // Apply decision impact: adjust metrics based on intent
  for (const cr of companyResources) {
    const resName = (cr.resources?.name || '').toLowerCase().replace(/\s+/g, '_');
    const resId = cr.resource_id;

    if (!adjustedMetrics[resId]) {
      adjustedMetrics[resId] = applyScenarioModifiers(
        { demand: 50, supply: 50, geopolitical: 50, environmental: 50 },
        scenario
      );
    }

    const isDirectlyAffected = affectedResources.resources.some(
      (r) => resName.includes(r) || r.includes(resName)
    );

    if (isDirectlyAffected) {
      const mod = adjustedMetrics[resId];
      const intensityFactor = intent.intensity / 10;

      if (intent.direction === 'restrictive') {
        mod.supply = Math.min(100, mod.supply + 15 * intensityFactor);
        mod.geopolitical = Math.min(100, mod.geopolitical + 10 * intensityFactor);
        mod.demand = Math.min(100, mod.demand + 5 * intensityFactor);
      } else if (intent.direction === 'expansive') {
        mod.demand = Math.min(100, mod.demand + 10 * intensityFactor);
        mod.supply = Math.max(0, mod.supply - 5 * intensityFactor);
      } else {
        mod.supply = Math.min(100, mod.supply + 5 * intensityFactor);
        mod.demand = Math.min(100, mod.demand + 5 * intensityFactor);
      }
    }
  }

  // 5. Recompute SRES with adjusted metrics
  const resourceSRES = [];
  for (const cr of companyResources) {
    const resId = cr.resource_id;
    const metrics = adjustedMetrics[resId] || { demand: 50, supply: 50, geopolitical: 50, environmental: 50 };
    const sres = computeSRES(cr.resources?.name || 'unknown', metrics, SRES_WEIGHTS);
    resourceSRES.push({
      resource_id: resId,
      resource_name: cr.resources?.name || 'Unknown',
      category: cr.resources?.category || 'unknown',
      dependency: cr.dependency_score,
      sres,
      metrics,
    });
  }

  const companySRES = computeCompanySRES(
    resourceSRES,
    resourceSRES.map((r) => ({ resource_id: r.resource_id, sres: r.sres, dependency: r.dependency }))
  );

  // 6. Calculate dimensional impact
  const impacts = [];
  for (const rs of resourceSRES) {
    const isAffected = affectedResources.resources.some(
      (r) => (rs.resource_name || '').toLowerCase().replace(/\s+/g, '_').includes(r) || r.includes((rs.resource_name || '').toLowerCase().replace(/\s+/g, '_'))
    );

    if (isAffected) {
      const baseImpact = calculateImpact(intent.intensity, rs.dependency, rs.sres);
      const dimImpact = calculateDimensionalImpact(baseImpact, intent.direction === 'restrictive' ? 'supply' : 'economy');
      impacts.push(dimImpact);
    }
  }

  const aggregated = aggregateImpacts(impacts.length > 0 ? impacts : [{ supply: 1, economy: 1, environment: 0.5, stability: 0.5 }]);

  // 7. Generate events based on stress
  const scenarioMult = SCENARIO_MULTIPLIERS[scenario] || SCENARIO_MULTIPLIERS.stable;
  const avgScenarioMult = (scenarioMult.supply + scenarioMult.demand + (scenarioMult.geo || 1) + (scenarioMult.env || 1)) / 4;
  const stress = aggregated.total * companySRES * avgScenarioMult / 10;

  // Pass recent event history for cascade mechanic (FIX: was empty array)
  const { worldState } = require('./worldState');
  const recentHistory = (worldState.events || []).slice(-20);
  const events = generateEvents(stress, scenario, currentDay, recentHistory);

  // 8. Generate AI narration
  let narration = '';
  try {
    narration = await generateNarration({
      events,
      metrics: {
        companySRES,
        aggregatedImpact: aggregated,
        resourceSRES: resourceSRES.slice(0, 5),
      },
      scenario,
      decision,
    });
  } catch (narErr) {
    console.warn('[SimOrchestrator] Narration generation failed:', narErr.message);
    narration = buildFallbackNarration(intent, affectedResources, companySRES, scenario, events);
  }

  // 9. Build and return the full result
  const elapsed = Date.now() - startTime;

  return {
    simulation_id: simulationId,
    company_id: companyId,
    company_name: company?.name || 'Unknown',
    day: currentDay,
    scenario,
    decision: {
      raw: decision,
      intent: intent.intent,
      intensity: intent.intensity,
      direction: intent.direction,
      affected_resources: affectedResources,
    },
    sres: {
      company: companySRES,
      resources: resourceSRES,
    },
    impact: aggregated,
    events,
    narration,
    metadata: {
      computed_at: new Date().toISOString(),
      elapsed_ms: elapsed,
      stress_level: Math.round(stress * 100) / 100,
    },
  };
}

// ---------- Fallback helpers ----------

function generateFallbackCompanyResources(affectedResources) {
  const fallbackResources = {
    oil: { id: 'res_oil', name: 'Oil', category: 'energy' },
    natural_gas: { id: 'res_gas', name: 'Natural Gas', category: 'energy' },
    lithium: { id: 'res_lithium', name: 'Lithium', category: 'minerals' },
    cobalt: { id: 'res_cobalt', name: 'Cobalt', category: 'minerals' },
    copper: { id: 'res_copper', name: 'Copper', category: 'minerals' },
    rare_earth: { id: 'res_rare', name: 'Rare Earth', category: 'minerals' },
    wheat: { id: 'res_wheat', name: 'Wheat', category: 'food' },
    semiconductors: { id: 'res_semi', name: 'Semiconductors', category: 'tech' },
    iron_ore: { id: 'res_iron', name: 'Iron Ore', category: 'minerals' },
    uranium: { id: 'res_uranium', name: 'Uranium', category: 'energy' },
  };

  return affectedResources.resources
    .filter((r) => fallbackResources[r])
    .map((r) => ({
      resource_id: fallbackResources[r].id,
      dependency_score: 0.5 + Math.random() * 0.4,
      resources: fallbackResources[r],
    }));
}

function generateFallbackMetrics(companyResources) {
  return companyResources.map((cr) => ({
    resource_id: cr.resource_id,
    demand_index: 40 + Math.round(Math.random() * 30),
    supply_index: 35 + Math.round(Math.random() * 35),
    geopolitical_index: 30 + Math.round(Math.random() * 40),
    environmental_index: 25 + Math.round(Math.random() * 35),
  }));
}

function buildFallbackNarration(intent, resources, sres, scenario, events) {
  const scenarioLabel = {
    stable: 'current baseline conditions',
    supply_crisis: 'an ongoing supply chain crisis',
    war: 'escalating geopolitical conflict',
    drought: 'severe environmental stress from drought conditions',
    pandemic: 'an active pandemic disrupting global supply chains',
    trade_war: 'intensifying trade tensions and tariff escalation',
    cyber_attack: 'coordinated cyber attacks on critical infrastructure',
    energy_crisis: 'a deepening global energy crisis',
  };

  const eventSummary =
    events.length > 0
      ? `${events.length} significant event${events.length > 1 ? 's' : ''} triggered: ${events.map((e) => e.title).join('; ')}.`
      : 'No significant events were triggered at current stress levels.';

  return (
    `Under ${scenarioLabel[scenario] || 'current conditions'}, the decision to ${intent.intent} ` +
    `${resources.resources.join(', ')} has shifted the company's risk profile to an SRES of ${Math.round(sres)}. ` +
    `This ${intent.direction} action primarily affects ${resources.categories.join(' and ')} supply chains. ` +
    `${eventSummary} ` +
    `Analysts recommend monitoring downstream dependencies closely in the coming cycle.`
  );
}

module.exports = {
  runSimulation,
  parseDecisionIntent,
  mapDecisionToResources,
};
