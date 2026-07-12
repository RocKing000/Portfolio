#!/usr/bin/env node
// ============================================
// DIRE-X Multi-Agent Training Data Generator
//
// Runs N rounds of simulation with multiple specialized agents.
// Each round: triggers scenarios, advances the world, captures
// all metrics across every dimension, and appends to an Excel file.
//
// Agents:
//   1. GeopoliticalAgent  — triggers conflicts, trade wars, sanctions
//   2. ResourceAgent      — triggers supply crises, energy shocks
//   3. EnvironmentAgent   — triggers droughts, pandemics
//   4. CyberAgent         — triggers cyber attacks
//   5. EconomicAgent      — creates companies, executes strategies
//   6. ObserverAgent      — captures all metrics after each round
//
// Output: training_data_YYYYMMDD_HHmmss.xlsx
//         One sheet per data type, rows accumulate across rounds
// ============================================

require('dotenv').config();
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4000';
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'direx-admin-2026-secure-key';
const ROUNDS = parseInt(process.argv[2] || '20', 10);
const TICKS_PER_ROUND = 5; // 5 simulation days per round

const api = axios.create({ baseURL: BASE, timeout: 30000 });
const adminHeaders = { 'x-admin-key': ADMIN_KEY };

// ─── Collected data across all rounds ────────────────────────────────────────
const data = {
  world_state: [],       // global metrics per round
  country_metrics: [],   // per-country data per round
  resource_metrics: [],  // per-resource risk per round
  company_metrics: [],   // per-company performance per round
  scenario_log: [],      // scenarios triggered each round
  trade_routes: [],      // trade route status per round
  risk_heatmap: [],      // nation risk scores per round
  gdp_ranking: [],       // GDP rankings per round
  market_state: [],      // market sentiment/confidence per round
  geopolitical: [],      // country relations per round
  events_log: [],        // events generated each round
  competition: [],       // sector competition per round
  ideas_log: [],         // ideas generated per round
};

const log = (agent, msg) => console.log(`  [${agent}] ${msg}`);

// ─── Agent: Geopolitical ─────────────────────────────────────────────────────
const GEOPOLITICAL_SCENARIOS = [
  { type: 'war', weight: 0.15 },
  { type: 'trade_war', weight: 0.25 },
  { type: 'cyber_attack', weight: 0.20 },
];

async function geopoliticalAgent(round) {
  // Probability-based scenario triggering
  for (const s of GEOPOLITICAL_SCENARIOS) {
    const roll = Math.random();
    // Increase probability as rounds progress (escalation)
    const threshold = 1 - s.weight * (1 + round * 0.03);
    if (roll > threshold) {
      try {
        const { data: result } = await api.post('/api/world-state/trigger-scenario',
          { type: s.type }, { headers: adminHeaders });
        const sid = result.scenarioId || 'unknown';
        log('Geopolitical', `Triggered ${s.type} → ${sid}`);
        data.scenario_log.push({
          round, agent: 'geopolitical', type: s.type,
          scenario_id: sid, trigger_reason: `roll=${roll.toFixed(3)}, thresh=${threshold.toFixed(3)}`,
        });
      } catch (e) {
        // May fail if too many active scenarios
      }
    }
  }
}

// ─── Agent: Resource ─────────────────────────────────────────────────────────
const RESOURCE_SCENARIOS = [
  { type: 'supply_crisis', weight: 0.30 },
  { type: 'energy_crisis', weight: 0.20 },
];

async function resourceAgent(round) {
  for (const s of RESOURCE_SCENARIOS) {
    const roll = Math.random();
    const threshold = 1 - s.weight * (1 + round * 0.02);
    if (roll > threshold) {
      try {
        const { data: result } = await api.post('/api/world-state/trigger-scenario',
          { type: s.type }, { headers: adminHeaders });
        log('Resource', `Triggered ${s.type}`);
        data.scenario_log.push({
          round, agent: 'resource', type: s.type,
          scenario_id: result.scenarioId || 'unknown',
          trigger_reason: `roll=${roll.toFixed(3)}`,
        });
      } catch (e) {}
    }
  }
}

// ─── Agent: Environment ──────────────────────────────────────────────────────
async function environmentAgent(round) {
  const scenarios = [
    { type: 'drought', weight: 0.20 },
    { type: 'pandemic', weight: 0.10 },
  ];
  for (const s of scenarios) {
    if (Math.random() > (1 - s.weight * (1 + round * 0.02))) {
      try {
        const { data: result } = await api.post('/api/world-state/trigger-scenario',
          { type: s.type }, { headers: adminHeaders });
        log('Environment', `Triggered ${s.type}`);
        data.scenario_log.push({
          round, agent: 'environment', type: s.type,
          scenario_id: result.scenarioId || 'unknown',
        });
      } catch (e) {}
    }
  }
}

// ─── Agent: Cyber ────────────────────────────────────────────────────────────
async function cyberAgent(round) {
  // Cyber attacks become more likely in later rounds
  if (Math.random() > (0.85 - round * 0.02)) {
    try {
      const { data: result } = await api.post('/api/world-state/trigger-scenario',
        { type: 'cyber_attack' }, { headers: adminHeaders });
      log('Cyber', `Triggered cyber_attack`);
      data.scenario_log.push({
        round, agent: 'cyber', type: 'cyber_attack',
        scenario_id: result.scenarioId || 'unknown',
      });
    } catch (e) {}
  }
}

// ─── Agent: Economic (creates companies, strategies) ─────────────────────────
const INDUSTRIES = ['ev', 'defense', 'semiconductors', 'energy', 'mining', 'pharma'];
const STRATEGIES = ['cost', 'balanced', 'sustainable'];
const SCALES = ['small', 'medium', 'large'];
const COUNTRIES = ['US', 'CN', 'DE', 'JP', 'IN', 'KR', 'BR', 'AU', 'GB', 'FR'];
const IDEA_TEMPLATES = [
  'Develop alternative supply chain for {resource} to reduce dependency on {country}',
  'Invest in recycling technology for {resource} recovery from e-waste',
  'Establish strategic reserve of {resource} for 6-month buffer',
  'Partner with {country} for joint {resource} processing facility',
  'Develop synthetic substitute for {resource} using AI-driven material science',
  'Implement blockchain-based {resource} supply chain tracking',
  'Build vertical integration for {resource} from mining to manufacturing',
  'Launch trade agreement with {country} for preferential {resource} access',
  'Diversify {resource} suppliers across 3+ continents',
  'Invest in deep-sea mining technology for {resource} extraction',
];
const RESOURCES = ['Lithium', 'Cobalt', 'Nickel', 'Copper', 'Rare Earth Elements', 'Semiconductors', 'Graphite'];

let createdCompanies = [];
let sessionTokens = {};

async function economicAgent(round) {
  // Round 1-3: Create companies
  if (round <= 3) {
    const industry = INDUSTRIES[round % INDUSTRIES.length];
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const strategy = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
    const scale = SCALES[Math.floor(Math.random() * SCALES.length)];
    const name = `Agent-${industry.toUpperCase()}-${country}-R${round}`;

    try {
      const resp = await api.post('/api/create-company', {
        name, industry, country, strategy, scale,
      });
      const sessionToken = resp.headers['x-session-token'];
      const company = resp.data;
      createdCompanies.push(company);
      if (sessionToken) sessionTokens[company.id] = sessionToken;
      log('Economic', `Created ${name} (${company.id})`);
    } catch (e) {
      log('Economic', `Failed to create company: ${e.message?.substring(0, 80)}`);
    }
  }

  // Execute strategic actions for existing companies
  if (createdCompanies.length > 0) {
    const company = createdCompanies[round % createdCompanies.length];
    const actions = ['rd', 'diversification', 'collaboration', 'diplomacy', 'vertical_integration'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const token = sessionTokens[company.id];

    if (token) {
      try {
        await api.post('/api/strategic', {
          companyId: company.id, actionType: action,
        }, { headers: { 'x-session-token': token } });
        log('Economic', `${company.name} → ${action}`);
      } catch (e) {}
    }

    // Submit an idea
    const resource = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const template = IDEA_TEMPLATES[Math.floor(Math.random() * IDEA_TEMPLATES.length)];
    const ideaText = template.replace('{resource}', resource).replace('{country}', country);

    try {
      const { data: idea } = await api.post('/api/ideas', {
        companyId: company.id, text: ideaText,
      }, { headers: { 'x-session-token': token } });
      log('Economic', `Idea: "${ideaText.substring(0, 50)}..." → score ${idea.combined_score}`);
      data.ideas_log.push({
        round, company: company.name, idea: ideaText,
        novelty: idea.novelty_score, impact: idea.impact_score,
        combined: idea.combined_score, category: idea.category,
        badges: (idea.badges || []).join(','),
      });
    } catch (e) {}
  }
}

// ─── Agent: Observer (captures all metrics) ──────────────────────────────────
async function observerAgent(round) {
  // 1. World state
  try {
    const { data: ws } = await api.get('/api/world-state');
    data.world_state.push({
      round, day: ws.day,
      active_scenarios: ws.activeScenarios?.length || 0,
      scenario_types: ws.activeScenarios?.map(s => `${s.type}(${s.stage}:${s.intensity?.toFixed(2)})`).join('; ') || '',
      sentiment: ws.marketState?.sentiment,
      confidence: ws.marketState?.confidence,
      volatility: ws.marketState?.volatility,
      demand_index: ws.marketState?.demand_index,
      supply_index: ws.marketState?.supply_index,
      base_rate: ws.marketState?.baseRate,
      price_pressure: ws.publicPressure?.price_pressure,
      env_pressure: ws.publicPressure?.environmental_pressure,
      shortage_pressure: ws.publicPressure?.shortage_pressure,
      total_pressure: ws.publicPressure?.total_pressure,
      env_debt: ws.environmentalDebt,
      companies_count: ws.companies?.length || 0,
      event_count: ws.eventCount,
    });

    data.market_state.push({
      round, day: ws.day, ...ws.marketState, ...ws.publicPressure,
    });
  } catch (e) {}

  // 2. Risk heatmap
  try {
    const { data: heatmap } = await api.get('/api/risk/heatmap');
    const nations = Array.isArray(heatmap) ? heatmap : heatmap.data || [];
    for (const n of nations) {
      data.risk_heatmap.push({
        round, nation: n.nation, code: n.code,
        risk_score: n.riskScore, base_score: n.baseScore,
        ai_adjustment: n.aiAdjustment,
        resource_criticality: n.factors?.resource_criticality,
        geopolitical_stability: n.factors?.geopolitical_stability,
        supply_concentration: n.factors?.supply_concentration,
        conflict_exposure: n.factors?.conflict_exposure,
        trade_dependency: n.factors?.trade_dependency,
      });
    }
  } catch (e) {}

  // 3. GDP rankings
  try {
    const { data: gdp } = await api.get('/api/gdp');
    const ranking = Array.isArray(gdp) ? gdp : gdp.ranking || gdp.data || [];
    for (const c of ranking) {
      data.gdp_ranking.push({
        round, country: c.country, gdp: c.gdp,
        gdp_per_capita: c.gdpPerCapita, growth: c.baseGrowth,
        adjusted_growth: c.adjustedGrowth, population: c.population,
        rank: c.rank, trend: c.trend,
      });
    }
  } catch (e) {}

  // 4. Trade routes
  try {
    const { data: routes } = await api.get('/api/geo/trade-routes');
    const routeList = Array.isArray(routes) ? routes : routes.data || [];
    for (const r of routeList) {
      data.trade_routes.push({
        round, route: r.name, status: r.status,
        resources: (r.resources || []).join(', '),
        from_lat: r.from?.lat, from_lng: r.from?.lng,
        to_lat: r.to?.lat, to_lng: r.to?.lng,
      });
    }
  } catch (e) {}

  // 5. Strategic resources
  try {
    const { data: resources } = await api.get('/api/strategic-resources');
    const resList = Array.isArray(resources) ? resources : resources.data || [];
    for (const r of resList) {
      data.resource_metrics.push({
        round, name: r.name, category: r.category,
        strategic_importance: r.strategic_importance,
        supply_risk: r.supply_risk,
        geopolitical_sensitivity: r.geopolitical_sensitivity,
      });
    }
  } catch (e) {}

  // 6. Risk global
  try {
    const { data: riskGlobal } = await api.get('/api/risk/global');
    const rd = riskGlobal.data || riskGlobal;
    if (rd.high_risk_resources) {
      for (const r of rd.high_risk_resources) {
        data.resource_metrics.push({
          round, name: r.name, category: r.category || 'global_risk',
          sres: r.sres, supply_index: r.supply, demand_index: r.demand,
          geopolitical_index: r.geopolitical, environmental_index: r.environmental,
        });
      }
    }
  } catch (e) {}

  // 7. Company metrics (DB companies + player companies)
  try {
    const { data: leaderboard } = await api.get('/api/leaderboard');
    const lb = leaderboard.leaderboard || [];
    for (const c of lb) {
      data.company_metrics.push({
        round, day: leaderboard.day, name: c.name,
        industry: c.industry, country: c.country,
        score: c.score,
        growth: c.scores?.growth, sustainability: c.scores?.sustainability,
        stability: c.scores?.stability, supply_health: c.scores?.supplyHealth,
        base_score: c.breakdown?.base,
        engagement_bonus: c.breakdown?.engagement,
        crisis_bonus: c.breakdown?.crisisNavigation,
        passivity_penalty: c.breakdown?.passivityPenalty,
      });
    }
  } catch (e) {}

  // 8. Competition overview
  try {
    const { data: comp } = await api.get('/api/competition/overview/all');
    const sectors = comp.sectors || [];
    for (const s of sectors) {
      data.competition.push({
        round, industry: s.industry, total_companies: s.totalCompanies,
        market_growth: s.marketGrowth, avg_budget_b: s.avgBudgetB,
        top_players: (s.topPlayers || []).join(', '),
      });
    }
  } catch (e) {}

  // 9. Geopolitical snapshot
  try {
    const { data: geo } = await api.get('/api/geopolitical/snapshot');
    const pairs = geo.pairs || [];
    // Only capture top 20 most important pairs per round
    const top = pairs.slice(0, 20);
    for (const p of top) {
      data.geopolitical.push({
        round, from: p.from, to: p.to,
        score: p.score, status: p.status,
        trade_efficiency: p.tradeEfficiency,
      });
    }
  } catch (e) {}

  // 10. Country metrics from DB
  try {
    const { data: countries } = await api.get('/api/countries/ranking/gdp');
    const list = countries.ranking || countries.data || countries;
    if (Array.isArray(list)) {
      for (const c of list.slice(0, 30)) {
        data.country_metrics.push({
          round, code: c.code, name: c.name,
          gdp: c.gdp, population: c.population,
          growth_rate: c.growth_rate, gdp_norm: c.gdp_norm,
          eco_score: c.eco_score, region: c.region,
        });
      }
    }
  } catch (e) {}
}

// ─── World Ticker ────────────────────────────────────────────────────────────
async function advanceWorld(ticks) {
  for (let i = 0; i < ticks; i++) {
    try {
      const { data: result } = await api.post('/api/world-state/tick');
      // Capture events if any
      if (result.events && result.events.length > 0) {
        for (const e of result.events) {
          data.events_log.push({
            day: result.day, type: e.type, severity: e.severity,
            headline: e.headline,
            resources: (e.affected_resources || []).join(', '),
          });
        }
      }
    } catch (e) {}
  }
}

// ─── Excel Writer ────────────────────────────────────────────────────────────
function writeExcel(round) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filePath = path.join(__dirname, '..', `training_data_${timestamp}.xlsx`);

  const wb = XLSX.utils.book_new();

  const sheets = [
    { name: 'WorldState', data: data.world_state },
    { name: 'MarketState', data: data.market_state },
    { name: 'RiskHeatmap', data: data.risk_heatmap },
    { name: 'GDPRanking', data: data.gdp_ranking },
    { name: 'Resources', data: data.resource_metrics },
    { name: 'Companies', data: data.company_metrics },
    { name: 'TradeRoutes', data: data.trade_routes },
    { name: 'Geopolitical', data: data.geopolitical },
    { name: 'Competition', data: data.competition },
    { name: 'CountryMetrics', data: data.country_metrics },
    { name: 'ScenarioLog', data: data.scenario_log },
    { name: 'EventsLog', data: data.events_log },
    { name: 'IdeasLog', data: data.ideas_log },
  ];

  for (const { name, data: sheetData } of sheets) {
    if (sheetData.length === 0) {
      // Add empty sheet with headers
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No data']], {}), name);
    } else {
      const ws = XLSX.utils.json_to_sheet(sheetData);
      // Auto-width columns
      const colWidths = Object.keys(sheetData[0]).map(key => ({
        wch: Math.max(key.length, ...sheetData.slice(0, 50).map(r => String(r[key] || '').length))
      }));
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, name);
    }
  }

  XLSX.writeFile(wb, filePath);
  return filePath;
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  DIRE-X Multi-Agent Training Data Generator      ║');
  console.log(`║  Rounds: ${ROUNDS} | Ticks/round: ${TICKS_PER_ROUND} | Total days: ${ROUNDS * TICKS_PER_ROUND}     ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log();

  // Verify server
  try {
    await api.get('/health');
    console.log('✓ Server connected\n');
  } catch {
    console.error('❌ Server not reachable at ' + BASE);
    process.exit(1);
  }

  // Reset world state for clean training run
  try {
    await api.post('/api/world-state/reset', {}, { headers: adminHeaders });
    console.log('✓ World state reset\n');
  } catch (e) {
    console.log('⚠ Could not reset world state, continuing with current state\n');
  }

  const startTime = Date.now();

  for (let round = 1; round <= ROUNDS; round++) {
    const pct = Math.round((round / ROUNDS) * 100);
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ROUND ${round}/${ROUNDS} (${pct}%)`);
    console.log('═'.repeat(60));

    // Phase 1: Agents trigger scenarios & take actions
    console.log('\n  Phase 1: Agent Actions');
    await geopoliticalAgent(round);
    await resourceAgent(round);
    await environmentAgent(round);
    await cyberAgent(round);
    await economicAgent(round);

    // Phase 2: Advance world
    console.log(`\n  Phase 2: Advancing ${TICKS_PER_ROUND} days...`);
    await advanceWorld(TICKS_PER_ROUND);

    // Phase 3: Observe & collect
    console.log('  Phase 3: Capturing metrics...');
    await observerAgent(round);

    // Stats
    console.log(`\n  Round ${round} stats:`);
    console.log(`    Scenarios triggered: ${data.scenario_log.filter(s => s.round === round).length}`);
    console.log(`    World state rows: ${data.world_state.length}`);
    console.log(`    Risk heatmap rows: ${data.risk_heatmap.length}`);
    console.log(`    GDP rows: ${data.gdp_ranking.length}`);
    console.log(`    Company rows: ${data.company_metrics.length}`);
    console.log(`    Ideas: ${data.ideas_log.filter(i => i.round === round).length}`);

    // Write intermediate Excel every 5 rounds
    if (round % 5 === 0 || round === ROUNDS) {
      const filePath = writeExcel(round);
      console.log(`\n  📊 Excel saved: ${path.basename(filePath)}`);
    }
  }

  // Final write
  const finalPath = writeExcel(ROUNDS);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  TRAINING DATA GENERATION COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Rounds:          ${ROUNDS}`);
  console.log(`  Total sim days:  ${ROUNDS * TICKS_PER_ROUND}`);
  console.log(`  Elapsed:         ${elapsed}s`);
  console.log(`  Output:          ${finalPath}`);
  console.log();
  console.log('  Sheet summary:');
  console.log(`    WorldState:     ${data.world_state.length} rows`);
  console.log(`    MarketState:    ${data.market_state.length} rows`);
  console.log(`    RiskHeatmap:    ${data.risk_heatmap.length} rows`);
  console.log(`    GDPRanking:     ${data.gdp_ranking.length} rows`);
  console.log(`    Resources:      ${data.resource_metrics.length} rows`);
  console.log(`    Companies:      ${data.company_metrics.length} rows`);
  console.log(`    TradeRoutes:    ${data.trade_routes.length} rows`);
  console.log(`    Geopolitical:   ${data.geopolitical.length} rows`);
  console.log(`    Competition:    ${data.competition.length} rows`);
  console.log(`    CountryMetrics: ${data.country_metrics.length} rows`);
  console.log(`    ScenarioLog:    ${data.scenario_log.length} rows`);
  console.log(`    EventsLog:      ${data.events_log.length} rows`);
  console.log(`    IdeasLog:       ${data.ideas_log.length} rows`);
  console.log(`\n  TOTAL ROWS: ${Object.values(data).reduce((s, a) => s + a.length, 0)}`);
  console.log('═'.repeat(60));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
