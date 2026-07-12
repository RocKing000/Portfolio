#!/usr/bin/env node
// ============================================
// DIRE-X Multi-Agent Training Data Generator v2
//
// NEW in v2:
//   - Different scenario patterns: cascading crises, recovery cycles,
//     regional conflicts, economic booms/busts
//   - New metrics: supply chain depth, workforce evolution, compliance
//     stress, economic cycles, health impact, population shifts
//   - Master workbook with module-to-sheet mapping index
//   - Imports previous v1 training data
//   - Per-company economy calculations (cost, revenue, profit)
//   - Country-level social indicators under stress
//   - Geopolitical relation CHANGES (delta tracking)
//
// Agents:
//   1. CascadeAgent    — triggers multi-stage cascading crises
//   2. RecoveryAgent   — tests recovery patterns after peak crisis
//   3. RegionalAgent   — targets specific regions with focused scenarios
//   4. BoomBustAgent   — creates economic boom/bust cycles
//   5. StressTestAgent — pushes companies to breaking point
//   6. SocialAgent     — tracks health/literacy/population under stress
//   7. DeepObserver    — captures deep metrics not in v1
//
// Output: DIRE-X_Training_Master.xlsx (single master workbook)
// ============================================

require('dotenv').config();
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4000';
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'direx-admin-2026-secure-key';
const ROUNDS = parseInt(process.argv[2] || '20', 10);
const TICKS_PER_ROUND = 7; // more days per round for richer data

const api = axios.create({ baseURL: BASE, timeout: 30000 });
const adminH = { 'x-admin-key': ADMIN_KEY };

// ─── Master data store ───────────────────────────────────────────────────────
const D = {
  // === Module: Simulation Core ===
  sim_world_timeline: [],       // per-round world snapshot with deltas
  sim_scenario_cascade: [],     // scenario cascade chains

  // === Module: Economic Analysis ===
  econ_company_pnl: [],         // per-company P&L per round
  econ_market_cycles: [],       // market boom/bust tracking
  econ_gdp_delta: [],           // GDP changes between rounds

  // === Module: Supply Chain ===
  supply_resource_stress: [],   // resource stress under scenarios
  supply_route_disruption: [],  // trade route disruption patterns
  supply_concentration: [],     // HHI / concentration risk per resource

  // === Module: Geopolitical ===
  geo_relation_delta: [],       // relation score CHANGES per round
  geo_conflict_intensity: [],   // conflict escalation tracking
  geo_sanctions_impact: [],     // supply risk by country

  // === Module: Risk Scoring ===
  risk_nation_evolution: [],    // nation risk score evolution over time
  risk_company_sres: [],        // company SRES evolution
  risk_global_trend: [],        // global risk trend line

  // === Module: Social Impact ===
  social_health_under_stress: [],  // health/literacy under crisis
  social_workforce_evolution: [],  // workforce metrics over time
  social_population_shifts: [],    // population/employment changes

  // === Module: Competition ===
  comp_sector_dynamics: [],     // sector competition evolution
  comp_company_rankings: [],    // leaderboard evolution

  // === Module: Strategic Decisions ===
  strat_actions_outcomes: [],   // strategic actions and their effects
  strat_ideas_innovation: [],   // innovation/idea scoring over time
  strat_compliance_stress: [],  // compliance under regulatory pressure
};

const log = (agent, msg) => console.log(`  [${agent}] ${msg}`);

// ─── Scenario patterns for v2 ────────────────────────────────────────────────
const CASCADE_PATTERNS = [
  // Pattern 1: War → Supply Crisis → Energy Crisis (military escalation)
  { sequence: ['war', 'supply_crisis', 'energy_crisis'], name: 'Military Escalation', delay: [0, 2, 4] },
  // Pattern 2: Pandemic → Supply Crisis → Trade War (health crisis)
  { sequence: ['pandemic', 'supply_crisis', 'trade_war'], name: 'Health Crisis Chain', delay: [0, 3, 5] },
  // Pattern 3: Cyber → Energy Crisis → Supply Crisis (infrastructure attack)
  { sequence: ['cyber_attack', 'energy_crisis', 'supply_crisis'], name: 'Infrastructure Attack', delay: [0, 1, 3] },
  // Pattern 4: Drought → Energy Crisis → Trade War (climate cascade)
  { sequence: ['drought', 'energy_crisis', 'trade_war'], name: 'Climate Cascade', delay: [0, 2, 5] },
  // Pattern 5: Trade War → Supply Crisis → Cyber Attack (economic warfare)
  { sequence: ['trade_war', 'supply_crisis', 'cyber_attack'], name: 'Economic Warfare', delay: [0, 3, 6] },
];

const REGIONS = {
  asia_pacific: { countries: ['CN', 'JP', 'KR', 'IN', 'AU', 'TW', 'SG'], focus: 'semiconductors' },
  europe: { countries: ['DE', 'FR', 'GB', 'IT', 'PL', 'SE', 'NO'], focus: 'energy' },
  americas: { countries: ['US', 'CA', 'BR', 'MX', 'AR', 'CL'], focus: 'mining' },
  middle_east: { countries: ['SA', 'AE', 'IL', 'IR', 'QA'], focus: 'energy' },
  africa: { countries: ['ZA', 'NG', 'KE', 'CD', 'EG'], focus: 'minerals' },
};

let sessionTokens = {};
let playerCompanies = [];
let prevWorldState = null;
let prevGDPMap = new Map();
let prevRelationMap = new Map();

// ─── Agent: Cascade (multi-stage crises) ─────────────────────────────────────
let activeCascade = null;
let cascadeStep = 0;

async function cascadeAgent(round) {
  // Start new cascade every 4 rounds
  if (round % 4 === 1) {
    activeCascade = CASCADE_PATTERNS[Math.floor(Math.random() * CASCADE_PATTERNS.length)];
    cascadeStep = 0;
    log('Cascade', `Starting pattern: "${activeCascade.name}" → [${activeCascade.sequence.join(' → ')}]`);
  }

  if (activeCascade && cascadeStep < activeCascade.sequence.length) {
    const delay = activeCascade.delay[cascadeStep];
    if ((round - 1) % 4 >= delay / 2) {
      const type = activeCascade.sequence[cascadeStep];
      try {
        const { data: result } = await api.post('/api/world-state/trigger-scenario', { type }, { headers: adminH });
        log('Cascade', `Step ${cascadeStep + 1}: ${type} (${activeCascade.name})`);
        D.sim_scenario_cascade.push({
          round, pattern: activeCascade.name, step: cascadeStep + 1,
          type, scenario_id: result.scenarioId || '',
          chain: activeCascade.sequence.join(' → '),
        });
        cascadeStep++;
      } catch (e) {}
    }
  }
}

// ─── Agent: Recovery (test bounce-back) ──────────────────────────────────────
async function recoveryAgent(round) {
  // In recovery rounds (after cascade completes), do nothing — let the world heal
  // This creates "breathing room" data showing recovery dynamics
  if (round % 4 === 0) {
    log('Recovery', `Recovery round — no new scenarios, observing heal rate`);
    D.sim_world_timeline.push({ round, phase: 'recovery', note: 'No scenarios triggered, measuring recovery' });
  }
}

// ─── Agent: Regional (focused regional stress) ───────────────────────────────
async function regionalAgent(round) {
  const regionNames = Object.keys(REGIONS);
  const targetRegion = regionNames[round % regionNames.length];
  const region = REGIONS[targetRegion];

  // Track supply risk for each country in the target region
  for (const code of region.countries.slice(0, 3)) {
    try {
      const { data: sr } = await api.get(`/api/geopolitical/supply-risk/${code}`);
      D.geo_sanctions_impact.push({
        round, region: targetRegion, country: code,
        risk_modifier: sr.riskModifier,
        producers_count: sr.producers?.length || 0,
        focus_sector: region.focus,
      });
    } catch (e) {}
  }
  log('Regional', `Tracking ${targetRegion}: ${region.countries.slice(0, 3).join(', ')}`);
}

// ─── Agent: Boom/Bust (economic cycles) ──────────────────────────────────────
async function boomBustAgent(round) {
  // Alternate between triggering crises (bust) and letting economy grow (boom)
  const isBust = round % 6 < 3;

  if (isBust && Math.random() > 0.5) {
    const bustTypes = ['trade_war', 'energy_crisis', 'supply_crisis'];
    const type = bustTypes[Math.floor(Math.random() * bustTypes.length)];
    try {
      await api.post('/api/world-state/trigger-scenario', { type }, { headers: adminH });
      log('BoomBust', `BUST phase: triggered ${type}`);
    } catch (e) {}
  } else {
    log('BoomBust', `BOOM phase: economy recovering`);
  }

  // Capture market cycle data
  try {
    const { data: market } = await api.get('/api/economy/market');
    const { data: ws } = await api.get('/api/world-state');
    D.econ_market_cycles.push({
      round, phase: isBust ? 'bust' : 'boom',
      sentiment: market.sentiment, confidence: market.confidence,
      volatility: market.volatility, demand: market.demand_index,
      supply: market.supply_index, base_rate: market.baseRate,
      active_crises: ws.activeScenarios?.length || 0,
      scenario_types: ws.activeScenarios?.map(s => s.type).join(';') || '',
      total_intensity: ws.activeScenarios?.reduce((s, sc) => s + (sc.intensity || 0), 0)?.toFixed(2) || '0',
    });
  } catch (e) {}
}

// ─── Agent: StressTest (push companies to limits) ────────────────────────────
const V2_INDUSTRIES = ['ev', 'defense', 'semiconductors', 'energy', 'mining', 'pharma', 'agriculture'];
const V2_COUNTRIES = ['US', 'CN', 'DE', 'JP', 'IN', 'KR', 'BR', 'AU', 'GB', 'ZA', 'IL', 'TW'];

async function stressTestAgent(round) {
  // Create diverse companies in first 5 rounds
  if (round <= 5) {
    const industry = V2_INDUSTRIES[round % V2_INDUSTRIES.length];
    const country = V2_COUNTRIES[Math.floor(Math.random() * V2_COUNTRIES.length)];
    const strategies = ['cost', 'balanced', 'sustainable'];
    const scales = ['small', 'medium', 'large'];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    const scale = scales[Math.floor(Math.random() * scales.length)];
    const name = `Stress-${industry}-${country}-R${round}`;

    try {
      const resp = await api.post('/api/create-company', { name, industry, country, strategy, scale });
      const token = resp.headers['x-session-token'];
      const company = resp.data;
      playerCompanies.push(company);
      if (token) sessionTokens[company.id] = token;
      log('StressTest', `Created ${name} (${industry}/${country}/${scale})`);

      // Init workforce
      try {
        await api.post('/api/workforce/init', {
          companyId: company.id, industry, country, scale,
        });
      } catch (e) {}
    } catch (e) {}
  }

  // Collect deep metrics for each company
  for (const company of playerCompanies) {
    const token = sessionTokens[company.id];

    // P&L calculation
    try {
      const { data: econ } = await api.post('/api/economy/calculate',
        { companyId: company.id }, { headers: token ? { 'x-session-token': token } : {} });
      D.econ_company_pnl.push({
        round, company: company.name, industry: company.industry, country: company.country,
        output_units: econ.economics?.output_units,
        raw_material_cost: econ.economics?.raw_material_cost,
        refining_cost: econ.economics?.refining_cost,
        manufacturing_cost: econ.economics?.manufacturing_cost,
        total_cost: econ.economics?.total_cost,
        revenue: econ.economics?.revenue,
        profit: econ.economics?.profit,
        profit_margin: econ.economics?.profit_margin,
        pipeline_health: econ.pipeline?.pipelineHealth,
        bottlenecks: (econ.pipeline?.bottlenecks || []).join(';'),
      });
    } catch (e) {}

    // Compliance stress
    try {
      const { data: comp } = await api.get(`/api/compliance/${company.id}`);
      D.strat_compliance_stress.push({
        round, company: company.name,
        compliance_score: comp.complianceScore,
        regulatory_burden: comp.regulatoryBurden,
        transparency: comp.transparency,
        audit_risk: comp.auditRisk,
        trust_score: comp.trustScore,
        status: comp.status,
        corp_tax: comp.taxProfile?.corporateTaxRate,
        import_tariff: comp.taxProfile?.importTariffRate,
        net_tax_burden: comp.taxProfile?.netTaxBurden,
      });
    } catch (e) {}

    // Workforce evolution
    try {
      const { data: wf } = await api.get(`/api/workforce/${company.id}`);
      D.social_workforce_evolution.push({
        round, company: company.name,
        size: wf.workforce?.size, skill_level: wf.workforce?.skill_level,
        productivity: wf.workforce?.productivity,
        cost_per_worker: wf.workforce?.cost_per_worker,
        morale: wf.workforce?.morale,
      });
    } catch (e) {}

    // SRES risk
    try {
      const { data: risk } = await api.get(`/api/risk/${company.id}`);
      const rd = risk.data || risk;
      D.risk_company_sres.push({
        round, company: company.name, sres_score: rd.company_sres,
        resource_count: rd.resource_breakdown?.length || 0,
        top_risk_resource: rd.resource_breakdown?.[0]?.resource_name || '',
        top_risk_sres: rd.resource_breakdown?.[0]?.sres || 0,
      });
    } catch (e) {}

    // Strategic action (vary by round)
    if (token) {
      const actions = ['rd', 'diversification', 'collaboration', 'diplomacy', 'vertical_integration'];
      const action = actions[round % actions.length];
      try {
        await api.post('/api/strategic', { companyId: company.id, actionType: action },
          { headers: { 'x-session-token': token } });
        D.strat_actions_outcomes.push({
          round, company: company.name, action, status: 'triggered',
        });
      } catch (e) {}

      // Submit contextual idea
      const RESOURCES = ['Lithium', 'Cobalt', 'Rare Earth Elements', 'Semiconductors', 'Copper', 'Nickel', 'Graphite'];
      const res = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
      const ideas = [
        `Build AI-powered ${res} demand forecasting system for real-time supply chain optimization`,
        `Create circular economy loop for ${res} with 95% recovery rate from end-of-life products`,
        `Establish ${res} futures hedging strategy to minimize price volatility exposure`,
        `Deploy satellite monitoring of ${res} mining operations for ESG compliance verification`,
        `Develop ${res}-free alternative material using computational chemistry and machine learning`,
        `Form strategic alliance with ${res} producing nations for long-term offtake agreements`,
        `Build underground ${res} storage facility for 12-month strategic buffer stock`,
        `Launch ${res} recycling program across all manufacturing facilities globally`,
        `Implement digital twin of entire ${res} supply chain for disruption simulation`,
        `Create joint venture for deep-sea ${res} extraction with reduced environmental footprint`,
      ];
      const ideaText = ideas[Math.floor(Math.random() * ideas.length)];

      try {
        const { data: idea } = await api.post('/api/ideas', { companyId: company.id, text: ideaText },
          { headers: { 'x-session-token': token } });
        D.strat_ideas_innovation.push({
          round, company: company.name, idea: ideaText,
          novelty: idea.novelty_score, impact: idea.impact_score,
          combined: idea.combined_score, category: idea.category,
          badges: (idea.badges || []).join(','), notable: idea.is_notable,
        });
      } catch (e) {}
    }
  }
}

// ─── Agent: Social (health, population, budget under stress) ─────────────────
async function socialAgent(round) {
  const countries = ['US', 'CN', 'IN', 'DE', 'JP', 'BR', 'RU', 'GB', 'ZA', 'NG', 'AU', 'IL'];

  for (const code of countries) {
    // Health
    try {
      const { data: h } = await api.get(`/api/health/${code}`);
      D.social_health_under_stress.push({
        round, country: code,
        health_index: h.health?.healthIndex,
        healthcare_capacity: h.health?.healthcareCapacity,
        disease_risk: h.health?.diseaseRisk,
        env_health: h.health?.environmentalHealth,
        literacy: h.literacy?.overallLiteracy,
        edu_quality: h.literacy?.educationQuality,
        innovation: h.literacy?.innovationIndex,
        social_index: h.socialIndex,
        workforce_quality: h.workforceQualityMultiplier,
      });
    } catch (e) {}

    // Population
    try {
      const { data: p } = await api.get(`/api/health/population/${code}`);
      D.social_population_shifts.push({
        round, country: code,
        total_pop_m: p.totalPopulationM,
        working_ratio: p.workingRatio,
        working_pop_m: p.workingPopulationM,
        unemployment_rate: p.unemploymentRate,
        private_share: p.employmentBreakdown?.privateShare,
        gov_share: p.employmentBreakdown?.govShare,
      });
    } catch (e) {}
  }
  log('Social', `Tracked ${countries.length} countries: health, population, literacy`);
}

// ─── Agent: DeepObserver ─────────────────────────────────────────────────────
async function deepObserver(round) {
  // 1. World state with delta tracking
  try {
    const { data: ws } = await api.get('/api/world-state');
    const prev = prevWorldState;
    const entry = {
      round, day: ws.day,
      active_scenarios: ws.activeScenarios?.length || 0,
      scenario_detail: ws.activeScenarios?.map(s =>
        `${s.type}[${s.stage}:${(s.intensity || 0).toFixed(2)}]`).join('; ') || 'none',
      sentiment: ws.marketState?.sentiment,
      confidence: ws.marketState?.confidence,
      volatility: ws.marketState?.volatility,
      demand_idx: ws.marketState?.demand_index,
      supply_idx: ws.marketState?.supply_index,
      price_pressure: ws.publicPressure?.price_pressure,
      env_pressure: ws.publicPressure?.environmental_pressure,
      shortage_pressure: ws.publicPressure?.shortage_pressure,
      total_pressure: ws.publicPressure?.total_pressure,
      env_debt: ws.environmentalDebt,
      // Deltas
      sentiment_delta: prev ? ws.marketState?.sentiment - prev.marketState?.sentiment : 0,
      confidence_delta: prev ? ws.marketState?.confidence - prev.marketState?.confidence : 0,
      pressure_delta: prev ? (ws.publicPressure?.total_pressure || 0) - (prev.publicPressure?.total_pressure || 0) : 0,
    };
    D.sim_world_timeline.push(entry);
    prevWorldState = ws;
  } catch (e) {}

  // 2. GDP delta tracking
  try {
    const { data: gdp } = await api.get('/api/gdp');
    const ranking = Array.isArray(gdp) ? gdp : gdp.ranking || gdp.data || [];
    for (const c of ranking.slice(0, 20)) {
      const prevGdp = prevGDPMap.get(c.country);
      D.econ_gdp_delta.push({
        round, country: c.country, gdp: c.gdp, rank: c.rank,
        growth: c.baseGrowth, adjusted_growth: c.adjustedGrowth,
        gdp_per_capita: c.gdpPerCapita, population: c.population,
        gdp_change: prevGdp ? c.gdp - prevGdp : 0,
        growth_change: prevGdp ? c.adjustedGrowth - (ranking.find(r => r.country === c.country)?.adjustedGrowth || c.adjustedGrowth) : 0,
      });
      prevGDPMap.set(c.country, c.gdp);
    }
  } catch (e) {}

  // 3. Global risk trend
  try {
    const { data: rg } = await api.get('/api/risk/global');
    const rd = rg.data || rg;
    D.risk_global_trend.push({
      round, global_sres: rd.global_sres, resource_count: rd.resource_count,
      critical_minerals_avg: rd.category_averages?.critical_minerals?.average_sres,
      industrial_metals_avg: rd.category_averages?.industrial_metals?.average_sres,
      energy_avg: rd.category_averages?.energy_resources?.average_sres,
      tech_avg: rd.category_averages?.technology_materials?.average_sres,
      high_risk_count: rd.high_risk_resources?.length || 0,
      top_risk_resource: rd.high_risk_resources?.[0]?.name || '',
      top_risk_sres: rd.high_risk_resources?.[0]?.sres || 0,
    });
  } catch (e) {}

  // 4. Nation risk evolution
  try {
    const { data: hm } = await api.get('/api/risk/heatmap');
    const nations = Array.isArray(hm) ? hm : hm.data || [];
    for (const n of nations) {
      D.risk_nation_evolution.push({
        round, nation: n.nation, code: n.code,
        risk_score: n.riskScore, base_score: n.baseScore,
        resource_criticality: n.factors?.resource_criticality,
        geopolitical_stability: n.factors?.geopolitical_stability,
        supply_concentration: n.factors?.supply_concentration,
        conflict_exposure: n.factors?.conflict_exposure,
        trade_dependency: n.factors?.trade_dependency,
      });
    }
  } catch (e) {}

  // 5. Trade route disruptions
  try {
    const { data: routes } = await api.get('/api/geo/trade-routes');
    const list = Array.isArray(routes) ? routes : routes.data || [];
    for (const r of list) {
      D.supply_route_disruption.push({
        round, route: r.name, status: r.status,
        resources: (r.resources || []).join(', '),
        is_disrupted: r.status !== 'stable' ? 1 : 0,
      });
    }
  } catch (e) {}

  // 6. Resource concentration (from strategic-resources)
  try {
    const { data: res } = await api.get('/api/strategic-resources');
    const list = Array.isArray(res) ? res : res.data || [];
    for (const r of list) {
      D.supply_concentration.push({
        round, resource: r.name, category: r.category,
        strategic_importance: r.strategic_importance,
        supply_risk: r.supply_risk,
        geopolitical_sensitivity: r.geopolitical_sensitivity,
      });
    }
  } catch (e) {}

  // 7. Geopolitical relation deltas
  try {
    const { data: geo } = await api.get('/api/geopolitical/snapshot');
    const pairs = geo.pairs || [];
    for (const p of pairs.slice(0, 30)) {
      const key = `${p.from}-${p.to}`;
      const prevScore = prevRelationMap.get(key);
      D.geo_relation_delta.push({
        round, from: p.from, to: p.to,
        score: p.score, status: p.status,
        trade_efficiency: p.tradeEfficiency,
        score_delta: prevScore != null ? p.score - prevScore : 0,
      });
      prevRelationMap.set(key, p.score);
    }
  } catch (e) {}

  // 8. Competition
  try {
    const { data: comp } = await api.get('/api/competition/overview/all');
    for (const s of (comp.sectors || [])) {
      D.comp_sector_dynamics.push({
        round, industry: s.industry, total_companies: s.totalCompanies,
        market_growth: s.marketGrowth, avg_budget_b: s.avgBudgetB,
        top_players: (s.topPlayers || []).join(', '),
      });
    }
  } catch (e) {}

  // 9. Leaderboard
  try {
    const { data: lb } = await api.get('/api/leaderboard');
    for (const c of (lb.leaderboard || [])) {
      D.comp_company_rankings.push({
        round, day: lb.day, name: c.name, industry: c.industry,
        country: c.country, score: c.score,
        growth: c.scores?.growth, sustainability: c.scores?.sustainability,
        stability: c.scores?.stability, supply_health: c.scores?.supplyHealth,
      });
    }
  } catch (e) {}
}

// ─── World Ticker ────────────────────────────────────────────────────────────
async function advanceWorld(ticks) {
  for (let i = 0; i < ticks; i++) {
    try { await api.post('/api/world-state/tick'); } catch (e) {}
  }
}

// ─── Import v1 data ──────────────────────────────────────────────────────────
function importV1Data() {
  const v1Files = fs.readdirSync(path.join(__dirname, '..'))
    .filter(f => f.startsWith('training_data_') && f.endsWith('.xlsx'))
    .sort().reverse();

  if (v1Files.length === 0) return null;

  const latest = path.join(__dirname, '..', v1Files[0]);
  console.log(`  Importing v1 data from: ${v1Files[0]}`);
  const wb = XLSX.readFile(latest);

  const v1Sheets = {};
  for (const name of wb.SheetNames) {
    v1Sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name]);
  }
  return v1Sheets;
}

// ─── Module-to-Sheet Mapping Index ───────────────────────────────────────────
const MODULE_MAP = [
  { sheet: 'INDEX', module: 'System', description: 'Module-to-sheet mapping for training pipeline', source: 'trainingSimV2.js' },
  // v1 sheets (imported)
  { sheet: 'v1_WorldState', module: 'v1:SimCore', description: 'v1 global world state per round', source: 'trainingSim.js round 1-20' },
  { sheet: 'v1_MarketState', module: 'v1:Economic', description: 'v1 market sentiment/confidence', source: 'trainingSim.js round 1-20' },
  { sheet: 'v1_RiskHeatmap', module: 'v1:Risk', description: 'v1 nation risk scores (5 factors)', source: 'trainingSim.js round 1-20' },
  { sheet: 'v1_GDPRanking', module: 'v1:Economic', description: 'v1 GDP rankings per round', source: 'trainingSim.js round 1-20' },
  { sheet: 'v1_Resources', module: 'v1:SupplyChain', description: 'v1 resource risk metrics', source: 'trainingSim.js round 1-20' },
  { sheet: 'v1_Companies', module: 'v1:Competition', description: 'v1 company leaderboard scores', source: 'trainingSim.js round 1-20' },
  { sheet: 'v1_TradeRoutes', module: 'v1:SupplyChain', description: 'v1 trade route status', source: 'trainingSim.js round 1-20' },
  { sheet: 'v1_Geopolitical', module: 'v1:Geopolitical', description: 'v1 country pair relations', source: 'trainingSim.js round 1-20' },
  { sheet: 'v1_ScenarioLog', module: 'v1:SimCore', description: 'v1 scenario trigger log', source: 'trainingSim.js round 1-20' },
  { sheet: 'v1_IdeasLog', module: 'v1:Strategic', description: 'v1 idea scoring log', source: 'trainingSim.js round 1-20' },
  // v2 sheets
  { sheet: 'WorldTimeline', module: 'SimCore', description: 'World state with delta tracking per round', source: 'DeepObserver' },
  { sheet: 'ScenarioCascade', module: 'SimCore', description: 'Multi-stage cascade scenario chains', source: 'CascadeAgent' },
  { sheet: 'CompanyPnL', module: 'Economic', description: 'Per-company P&L: cost, revenue, profit, margin', source: 'StressTestAgent' },
  { sheet: 'MarketCycles', module: 'Economic', description: 'Boom/bust cycle tracking with sentiment', source: 'BoomBustAgent' },
  { sheet: 'GDPDelta', module: 'Economic', description: 'GDP changes between rounds with growth delta', source: 'DeepObserver' },
  { sheet: 'ResourceStress', module: 'SupplyChain', description: 'Resource stress under active scenarios', source: 'DeepObserver' },
  { sheet: 'RouteDisruption', module: 'SupplyChain', description: 'Trade route disruption patterns', source: 'DeepObserver' },
  { sheet: 'Concentration', module: 'SupplyChain', description: 'Resource concentration / HHI risk', source: 'DeepObserver' },
  { sheet: 'RelationDelta', module: 'Geopolitical', description: 'Country relation CHANGES per round', source: 'DeepObserver' },
  { sheet: 'SanctionsImpact', module: 'Geopolitical', description: 'Supply risk modifier by country/region', source: 'RegionalAgent' },
  { sheet: 'NationRiskEvo', module: 'Risk', description: 'Nation risk score evolution over time', source: 'DeepObserver' },
  { sheet: 'CompanySRES', module: 'Risk', description: 'Company SRES risk evolution', source: 'StressTestAgent' },
  { sheet: 'GlobalRiskTrend', module: 'Risk', description: 'Global SRES trend line with category averages', source: 'DeepObserver' },
  { sheet: 'HealthStress', module: 'Social', description: 'Country health/literacy under crisis pressure', source: 'SocialAgent' },
  { sheet: 'WorkforceEvo', module: 'Social', description: 'Workforce size, skill, productivity, morale', source: 'StressTestAgent' },
  { sheet: 'PopulationShift', module: 'Social', description: 'Population/employment shifts under stress', source: 'SocialAgent' },
  { sheet: 'SectorDynamics', module: 'Competition', description: 'Sector competition evolution', source: 'DeepObserver' },
  { sheet: 'CompanyRankings', module: 'Competition', description: 'Leaderboard evolution across rounds', source: 'DeepObserver' },
  { sheet: 'ActionsOutcome', module: 'Strategic', description: 'Strategic actions and effects', source: 'StressTestAgent' },
  { sheet: 'Innovation', module: 'Strategic', description: 'Idea scoring: novelty, impact, badges', source: 'StressTestAgent' },
  { sheet: 'ComplianceStress', module: 'Strategic', description: 'Compliance/regulatory burden under stress', source: 'StressTestAgent' },
];

// ─── Excel Writer ────────────────────────────────────────────────────────────
function writeMasterWorkbook(v1Sheets) {
  const filePath = path.join(__dirname, '..', 'DIRE-X_Training_Master.xlsx');
  const wb = XLSX.utils.book_new();

  // INDEX sheet
  const indexWs = XLSX.utils.json_to_sheet(MODULE_MAP);
  XLSX.utils.book_append_sheet(wb, indexWs, 'INDEX');

  // v1 sheets
  if (v1Sheets) {
    const v1Map = {
      'WorldState': 'v1_WorldState', 'MarketState': 'v1_MarketState',
      'RiskHeatmap': 'v1_RiskHeatmap', 'GDPRanking': 'v1_GDPRanking',
      'Resources': 'v1_Resources', 'Companies': 'v1_Companies',
      'TradeRoutes': 'v1_TradeRoutes', 'Geopolitical': 'v1_Geopolitical',
      'ScenarioLog': 'v1_ScenarioLog', 'IdeasLog': 'v1_IdeasLog',
    };
    for (const [v1Name, newName] of Object.entries(v1Map)) {
      if (v1Sheets[v1Name] && v1Sheets[v1Name].length > 0) {
        const ws = XLSX.utils.json_to_sheet(v1Sheets[v1Name]);
        XLSX.utils.book_append_sheet(wb, ws, newName);
      }
    }
  }

  // v2 sheets
  const v2Map = {
    'WorldTimeline': D.sim_world_timeline,
    'ScenarioCascade': D.sim_scenario_cascade,
    'CompanyPnL': D.econ_company_pnl,
    'MarketCycles': D.econ_market_cycles,
    'GDPDelta': D.econ_gdp_delta,
    'RouteDisruption': D.supply_route_disruption,
    'Concentration': D.supply_concentration,
    'RelationDelta': D.geo_relation_delta,
    'SanctionsImpact': D.geo_sanctions_impact,
    'NationRiskEvo': D.risk_nation_evolution,
    'CompanySRES': D.risk_company_sres,
    'GlobalRiskTrend': D.risk_global_trend,
    'HealthStress': D.social_health_under_stress,
    'WorkforceEvo': D.social_workforce_evolution,
    'PopulationShift': D.social_population_shifts,
    'SectorDynamics': D.comp_sector_dynamics,
    'CompanyRankings': D.comp_company_rankings,
    'ActionsOutcome': D.strat_actions_outcomes,
    'Innovation': D.strat_ideas_innovation,
    'ComplianceStress': D.strat_compliance_stress,
  };

  for (const [name, rows] of Object.entries(v2Map)) {
    if (rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, name);
    } else {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No data yet']]), name);
    }
  }

  XLSX.writeFile(wb, filePath);
  return filePath;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  DIRE-X Multi-Agent Training v2 — Master Workbook     ║');
  console.log(`║  Rounds: ${ROUNDS} | Ticks/round: ${TICKS_PER_ROUND} | Total days: ${ROUNDS * TICKS_PER_ROUND}        ║`);
  console.log('║  New: Cascades, Boom/Bust, Social, Compliance, Deltas ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Verify server
  try {
    await api.get('/health');
    console.log('✓ Server connected');
  } catch {
    console.error('❌ Server not running'); process.exit(1);
  }

  // Import v1
  const v1Sheets = importV1Data();
  if (v1Sheets) {
    const v1Total = Object.values(v1Sheets).reduce((s, a) => s + a.length, 0);
    console.log(`✓ Imported ${v1Total} rows from v1 training data`);
  }

  // Reset world for clean v2 run
  try {
    await api.post('/api/world-state/reset', {}, { headers: adminH });
    console.log('✓ World state reset for v2\n');
  } catch {
    console.log('⚠ Could not reset, continuing\n');
  }

  const startTime = Date.now();

  for (let round = 1; round <= ROUNDS; round++) {
    const pct = Math.round((round / ROUNDS) * 100);
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ROUND ${round}/${ROUNDS} (${pct}%) — Day ${(round - 1) * TICKS_PER_ROUND + 1}-${round * TICKS_PER_ROUND}`);
    console.log('═'.repeat(60));

    // Phase 1: Agents act
    console.log('\n  Phase 1: Agent Actions');
    await cascadeAgent(round);
    await recoveryAgent(round);
    await boomBustAgent(round);
    await stressTestAgent(round);

    // Phase 2: Advance world
    console.log(`\n  Phase 2: Advancing ${TICKS_PER_ROUND} days...`);
    await advanceWorld(TICKS_PER_ROUND);

    // Phase 3: Deep observation
    console.log('  Phase 3: Deep metrics capture...');
    await regionalAgent(round);
    await socialAgent(round);
    await deepObserver(round);

    // Round stats
    const totalV2 = Object.values(D).reduce((s, a) => s + a.length, 0);
    console.log(`\n  Round ${round}: +${totalV2} total v2 rows`);

    // Save every 5 rounds
    if (round % 5 === 0 || round === ROUNDS) {
      const fp = writeMasterWorkbook(v1Sheets);
      console.log(`  📊 Master workbook saved: ${path.basename(fp)}`);
    }
  }

  // Final save
  const finalPath = writeMasterWorkbook(v1Sheets);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  MASTER TRAINING WORKBOOK COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Rounds: ${ROUNDS} | Days: ${ROUNDS * TICKS_PER_ROUND} | Elapsed: ${elapsed}s`);
  console.log(`  Output: ${finalPath}\n`);

  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │ MODULE-TO-SHEET SUMMARY                         │');
  console.log('  ├─────────────────────────────────────────────────┤');

  const modules = {};
  for (const m of MODULE_MAP) {
    if (!modules[m.module]) modules[m.module] = [];
    modules[m.module].push(m.sheet);
  }
  for (const [mod, sheets] of Object.entries(modules)) {
    console.log(`  │ ${mod.padEnd(15)} → ${sheets.join(', ').substring(0, 33)}│`);
  }
  console.log('  └─────────────────────────────────────────────────┘\n');

  console.log('  v2 Sheet Rows:');
  for (const [key, arr] of Object.entries(D)) {
    if (arr.length > 0) console.log(`    ${key.padEnd(30)} ${arr.length} rows`);
  }

  const v1Total = v1Sheets ? Object.values(v1Sheets).reduce((s, a) => s + a.length, 0) : 0;
  const v2Total = Object.values(D).reduce((s, a) => s + a.length, 0);
  console.log(`\n  TOTAL: ${v1Total} (v1) + ${v2Total} (v2) = ${v1Total + v2Total} rows`);
  console.log('═'.repeat(60));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
