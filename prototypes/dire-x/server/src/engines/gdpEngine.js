// ============================================
// GDP ENGINE — Deterministic, snapshot-based
// ============================================

const BASE_GDP = {
  'United States':    { gdp: 26950, growth: 2.5,  population: 335, rank: 1 },
  'China':            { gdp: 17700, growth: 5.2,  population: 1412, rank: 2 },
  'Germany':          { gdp: 4430,  growth: 0.3,  population: 84,  rank: 3 },
  'Japan':            { gdp: 4210,  growth: 1.9,  population: 125, rank: 4 },
  'India':            { gdp: 3730,  growth: 6.8,  population: 1428, rank: 5 },
  'United Kingdom':   { gdp: 3080,  growth: 0.4,  population: 68,  rank: 6 },
  'France':           { gdp: 2920,  growth: 0.9,  population: 68,  rank: 7 },
  'Brazil':           { gdp: 2130,  growth: 2.9,  population: 215, rank: 8 },
  'Canada':           { gdp: 2090,  growth: 1.2,  population: 40,  rank: 9 },
  'Russia':           { gdp: 1860,  growth: -2.1, population: 144, rank: 10 },
  'South Korea':      { gdp: 1710,  growth: 1.4,  population: 52,  rank: 11 },
  'Australia':        { gdp: 1690,  growth: 1.9,  population: 26,  rank: 12 },
  'Mexico':           { gdp: 1320,  growth: 3.2,  population: 130, rank: 13 },
  'Saudi Arabia':     { gdp: 1060,  growth: 0.8,  population: 36,  rank: 14 },
  'Switzerland':      { gdp: 830,   growth: 0.9,  population: 9,   rank: 15 },
  'Taiwan':           { gdp: 760,   growth: 2.7,  population: 24,  rank: 16 },
  'Netherlands':      { gdp: 1010,  growth: 0.6,  population: 18,  rank: 17 },
  'Indonesia':        { gdp: 1320,  growth: 5.0,  population: 275, rank: 18 },
  'Turkey':           { gdp: 1110,  growth: 4.5,  population: 85,  rank: 19 },
  'Nigeria':          { gdp: 480,   growth: 2.8,  population: 220, rank: 20 },
  'South Africa':     { gdp: 380,   growth: 0.6,  population: 60,  rank: 21 },
  'Norway':           { gdp: 540,   growth: 2.1,  population: 5,   rank: 22 },
  'UAE':              { gdp: 500,   growth: 3.4,  population: 10,  rank: 23 },
  'Singapore':        { gdp: 420,   growth: 1.1,  population: 6,   rank: 24 },
};

const SECTOR_GROWTH_IMPACT = {
  ev:           { growth_boost: 0.8, trade_intensity: 0.7 },
  defense:      { growth_boost: 0.4, trade_intensity: 0.3 },
  agriculture:  { growth_boost: 0.5, trade_intensity: 0.8 },
  electronics:  { growth_boost: 0.7, trade_intensity: 0.9 },
  energy:       { growth_boost: 0.6, trade_intensity: 0.6 },
  pharma:       { growth_boost: 0.5, trade_intensity: 0.5 },
  mining:       { growth_boost: 0.4, trade_intensity: 0.7 },
  automotive:   { growth_boost: 0.6, trade_intensity: 0.8 },
  telecom:      { growth_boost: 0.5, trade_intensity: 0.4 },
  construction: { growth_boost: 0.4, trade_intensity: 0.3 },
};

const SCENARIO_GDP_IMPACT = {
  stable:        { growth_mult: 1.0,  volatility: 0.1 },
  supply_crisis: { growth_mult: 0.7,  volatility: 0.4 },
  war:           { growth_mult: 0.5,  volatility: 0.6 },
  drought:       { growth_mult: 0.75, volatility: 0.3 },
  pandemic:      { growth_mult: 0.55, volatility: 0.5 },
  trade_war:     { growth_mult: 0.65, volatility: 0.35 },
  cyber_attack:  { growth_mult: 0.8,  volatility: 0.25 },
  energy_crisis: { growth_mult: 0.6,  volatility: 0.45 },
};

/**
 * Compute GDP table for all tracked countries.
 * Applies scenario multipliers and simulation-day drift.
 * Returns array sorted by GDP descending (global ranking).
 */
function computeGDPRanking(scenarioMultipliers, simulationDay, activeScenarios = []) {
  const dominantScenario = activeScenarios.length > 0
    ? activeScenarios.reduce((prev, curr) => (curr.intensity > prev.intensity ? curr : prev), activeScenarios[0])?.type
    : 'stable';

  const scenarioImpact = SCENARIO_GDP_IMPACT[dominantScenario] || SCENARIO_GDP_IMPACT.stable;

  const countries = Object.entries(BASE_GDP).map(([country, base]) => {
    // Deterministic drift: sin wave seeded by country name length + day
    const seed = country.length + simulationDay;
    const drift = Math.sin(seed * 0.07) * 0.8;
    const scenarioAdj = (base.growth * scenarioImpact.growth_mult) + drift;

    // Cumulative growth over simulation days (each day = 1/365 of annual growth)
    const dayGrowthFactor = 1 + (scenarioAdj / 100) * (simulationDay / 365);
    const currentGDP = Math.round(base.gdp * dayGrowthFactor * 10) / 10;

    // GDP per capita (billions → USD)
    const gdpPerCapita = base.population > 0
      ? Math.round((currentGDP * 1e9) / (base.population * 1e6))
      : 0;

    return {
      country,
      gdp: currentGDP,           // USD trillions
      gdpPerCapita,               // USD
      baseGrowth: base.growth,   // % annual
      adjustedGrowth: Math.round(scenarioAdj * 10) / 10,
      population: base.population, // millions
      baseRank: base.rank,
      trend: scenarioAdj >= base.growth ? 'up' : 'down',
    };
  });

  // Sort by current GDP descending and assign live ranks
  countries.sort((a, b) => b.gdp - a.gdp);
  countries.forEach((c, i) => { c.rank = i + 1; });

  return countries;
}

/**
 * Compute a simplified GDP impact from a company's operations.
 * Used to show how the player company affects their home country's GDP.
 */
function computeCompanyGDPContribution(company) {
  const base = BASE_GDP[company.country];
  if (!base) return { contribution: 0, multiplier: 1 };

  const sector = SECTOR_GROWTH_IMPACT[company.industry] || { growth_boost: 0.5, trade_intensity: 0.5 };
  const scaleMap = { small: 0.001, medium: 0.003, large: 0.008 };
  const scaleFactor = scaleMap[company.scale] || 0.003;

  const contribution = Math.round(base.gdp * scaleFactor * sector.growth_boost * 100) / 100;
  const tradeMultiplier = 1 + sector.trade_intensity * 0.1;

  return {
    country: company.country,
    contribution,   // USD trillions
    tradeMultiplier,
    sector: company.industry,
  };
}

/**
 * Compute global trade volume as a derived metric.
 */
function computeGlobalTradeVolume(gdpRanking, scenarioImpact) {
  const totalGDP = gdpRanking.reduce((sum, c) => sum + c.gdp, 0);
  const avgGrowth = gdpRanking.reduce((sum, c) => sum + c.adjustedGrowth, 0) / gdpRanking.length;
  const tradeRatio = 0.55; // Global trade ~55% of world GDP

  return {
    totalWorldGDP: Math.round(totalGDP * 10) / 10,
    tradeVolume: Math.round(totalGDP * tradeRatio * 10) / 10,
    avgGrowthRate: Math.round(avgGrowth * 10) / 10,
    tradeHealthIndex: Math.min(100, Math.max(0, 50 + avgGrowth * 5)),
  };
}

/**
 * Load GDP data from countries_master DB and merge with BASE_GDP.
 * DB values take precedence; BASE_GDP entries missing from DB are kept as-is.
 * Call this once at server startup after the first pipeline run.
 */
async function syncGDPFromDB() {
  const { supabase } = require('../config/supabase');
  try {
    const { data, error } = await supabase
      .from('countries_master')
      .select('name, gdp, growth_rate, population')
      .not('gdp', 'is', null)
      .order('gdp', { ascending: false })
      .limit(200);

    if (error || !data || data.length === 0) {
      console.warn('[GDPEngine] DB sync skipped — no data available');
      return false;
    }

    let merged = 0;
    for (const row of data) {
      if (!row.name || !row.gdp) continue;
      // GDP from DB is in billions; BASE_GDP is also in billions
      BASE_GDP[row.name] = {
        gdp:        Math.round(row.gdp * 10) / 10,
        growth:     Math.round((row.growth_rate ?? 2.0) * 100) / 100,
        population: BASE_GDP[row.name]?.population ?? Math.round((row.population ?? 10)),
        rank:       BASE_GDP[row.name]?.rank ?? 99,
      };
      merged++;
    }
    console.log(`[GDPEngine] Synced ${merged} countries from DB`);
    return true;
  } catch (err) {
    console.warn('[GDPEngine] DB sync error:', err.message);
    return false;
  }
}

module.exports = { computeGDPRanking, computeCompanyGDPContribution, computeGlobalTradeVolume, BASE_GDP, syncGDPFromDB };
