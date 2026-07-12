// ============================================
// HEALTH & LITERACY ENGINE — Country-level social indicators
// ============================================

// Base values from real-world approximations (normalized 0-100)
const BASE_HEALTH = {
  'United States':  { index: 72, capacity: 85, diseaseRisk: 25, envHealth: 65 },
  'China':          { index: 75, capacity: 72, diseaseRisk: 32, envHealth: 50 },
  'Germany':        { index: 82, capacity: 90, diseaseRisk: 18, envHealth: 78 },
  'Japan':          { index: 85, capacity: 92, diseaseRisk: 15, envHealth: 80 },
  'India':          { index: 55, capacity: 48, diseaseRisk: 52, envHealth: 40 },
  'United Kingdom': { index: 78, capacity: 88, diseaseRisk: 20, envHealth: 72 },
  'France':         { index: 80, capacity: 88, diseaseRisk: 18, envHealth: 76 },
  'Brazil':         { index: 62, capacity: 65, diseaseRisk: 40, envHealth: 58 },
  'Canada':         { index: 80, capacity: 86, diseaseRisk: 18, envHealth: 78 },
  'Russia':         { index: 63, capacity: 70, diseaseRisk: 35, envHealth: 52 },
  'South Korea':    { index: 80, capacity: 88, diseaseRisk: 18, envHealth: 72 },
  'Australia':      { index: 82, capacity: 88, diseaseRisk: 16, envHealth: 80 },
  'Mexico':         { index: 60, capacity: 58, diseaseRisk: 42, envHealth: 52 },
  'Saudi Arabia':   { index: 70, capacity: 75, diseaseRisk: 28, envHealth: 58 },
  'Taiwan':         { index: 79, capacity: 85, diseaseRisk: 20, envHealth: 70 },
  'Indonesia':      { index: 58, capacity: 52, diseaseRisk: 45, envHealth: 50 },
  'Turkey':         { index: 68, capacity: 70, diseaseRisk: 30, envHealth: 60 },
  'Nigeria':        { index: 40, capacity: 30, diseaseRisk: 68, envHealth: 32 },
  'South Africa':   { index: 48, capacity: 45, diseaseRisk: 58, envHealth: 42 },
  'Norway':         { index: 88, capacity: 92, diseaseRisk: 12, envHealth: 88 },
  'Switzerland':    { index: 86, capacity: 94, diseaseRisk: 12, envHealth: 85 },
  'Netherlands':    { index: 82, capacity: 90, diseaseRisk: 16, envHealth: 80 },
  'UAE':            { index: 74, capacity: 80, diseaseRisk: 22, envHealth: 62 },
  'Singapore':      { index: 84, capacity: 92, diseaseRisk: 14, envHealth: 78 },
};

const BASE_LITERACY = {
  'United States':  { overall: 99, male: 99, female: 99, balance: 98, eduQuality: 82, innovationIndex: 85 },
  'China':          { overall: 97, male: 98, female: 96, balance: 94, eduQuality: 72, innovationIndex: 70 },
  'Germany':        { overall: 99, male: 99, female: 99, balance: 99, eduQuality: 88, innovationIndex: 88 },
  'Japan':          { overall: 99, male: 99, female: 99, balance: 98, eduQuality: 90, innovationIndex: 86 },
  'India':          { overall: 77, male: 84, female: 70, balance: 72, eduQuality: 52, innovationIndex: 62 },
  'United Kingdom': { overall: 99, male: 99, female: 99, balance: 99, eduQuality: 88, innovationIndex: 86 },
  'France':         { overall: 99, male: 99, female: 99, balance: 98, eduQuality: 86, innovationIndex: 84 },
  'Brazil':         { overall: 93, male: 93, female: 94, balance: 97, eduQuality: 58, innovationIndex: 58 },
  'Canada':         { overall: 99, male: 99, female: 99, balance: 99, eduQuality: 88, innovationIndex: 86 },
  'Russia':         { overall: 99, male: 99, female: 99, balance: 98, eduQuality: 70, innovationIndex: 72 },
  'South Korea':    { overall: 99, male: 99, female: 99, balance: 99, eduQuality: 92, innovationIndex: 88 },
  'Australia':      { overall: 99, male: 99, female: 99, balance: 99, eduQuality: 88, innovationIndex: 85 },
  'Mexico':         { overall: 95, male: 96, female: 95, balance: 96, eduQuality: 60, innovationIndex: 55 },
  'Saudi Arabia':   { overall: 97, male: 98, female: 96, balance: 93, eduQuality: 68, innovationIndex: 62 },
  'Taiwan':         { overall: 98, male: 98, female: 98, balance: 99, eduQuality: 88, innovationIndex: 85 },
  'Indonesia':      { overall: 96, male: 97, female: 95, balance: 95, eduQuality: 58, innovationIndex: 55 },
  'Turkey':         { overall: 96, male: 98, female: 95, balance: 92, eduQuality: 62, innovationIndex: 60 },
  'Nigeria':        { overall: 62, male: 71, female: 53, balance: 65, eduQuality: 38, innovationIndex: 35 },
  'South Africa':   { overall: 87, male: 88, female: 87, balance: 96, eduQuality: 50, innovationIndex: 50 },
  'Norway':         { overall: 99, male: 99, female: 99, balance: 99, eduQuality: 92, innovationIndex: 90 },
  'Switzerland':    { overall: 99, male: 99, female: 99, balance: 99, eduQuality: 94, innovationIndex: 92 },
  'Netherlands':    { overall: 99, male: 99, female: 99, balance: 99, eduQuality: 90, innovationIndex: 88 },
  'UAE':            { overall: 97, male: 98, female: 97, balance: 96, eduQuality: 75, innovationIndex: 70 },
  'Singapore':      { overall: 97, male: 97, female: 97, balance: 99, eduQuality: 92, innovationIndex: 90 },
};

const SCENARIO_HEALTH_IMPACT = {
  stable:        { health_drift: 0,   disease_add: 0,  capacity_drift: 0 },
  supply_crisis: { health_drift: -2,  disease_add: 4,  capacity_drift: -3 },
  war:           { health_drift: -8,  disease_add: 12, capacity_drift: -10 },
  drought:       { health_drift: -5,  disease_add: 8,  capacity_drift: -4 },
  pandemic:      { health_drift: -12, disease_add: 25, capacity_drift: -15 },
  trade_war:     { health_drift: -2,  disease_add: 2,  capacity_drift: -1 },
  cyber_attack:  { health_drift: -1,  disease_add: 1,  capacity_drift: -5 },
  energy_crisis: { health_drift: -3,  disease_add: 5,  capacity_drift: -6 },
};

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

/**
 * Get health indicators for a country with scenario adjustments.
 */
function getCountryHealth(country, activeScenarios, simulationDay) {
  const base = BASE_HEALTH[country] || { index: 60, capacity: 60, diseaseRisk: 40, envHealth: 55 };
  const dominantScenario = activeScenarios.length > 0
    ? activeScenarios.reduce((p, c) => c.intensity > p.intensity ? c : p, activeScenarios[0])?.type
    : 'stable';

  const impact = SCENARIO_HEALTH_IMPACT[dominantScenario] || SCENARIO_HEALTH_IMPACT.stable;
  const scenarioSeverity = activeScenarios.length > 0
    ? activeScenarios[0]?.intensity || 0
    : 0;

  // Deterministic drift
  const drift = Math.sin(country.length * simulationDay * 0.03) * 2;

  return {
    country,
    healthIndex: clamp(base.index + impact.health_drift * scenarioSeverity + drift, 0, 100),
    healthcareCapacity: clamp(base.capacity + impact.capacity_drift * scenarioSeverity, 0, 100),
    diseaseRisk: clamp(base.diseaseRisk + impact.disease_add * scenarioSeverity, 0, 100),
    environmentalHealth: clamp(base.envHealth + drift * 0.5, 0, 100),
  };
}

/**
 * Get literacy indicators for a country with simulation adjustments.
 */
function getCountryLiteracy(country, simulationDay) {
  const base = BASE_LITERACY[country] || { overall: 75, male: 78, female: 72, balance: 88, eduQuality: 55, innovationIndex: 50 };

  // Literacy changes very slowly — small positive drift over time
  const improvementRate = 0.001; // 0.1% per 100 days
  const improvement = Math.round(simulationDay * improvementRate * 10) / 10;

  return {
    country,
    overallLiteracy: clamp(base.overall + improvement, 0, 100),
    maleLiteracy: clamp(base.male + improvement, 0, 100),
    femaleLiteracy: clamp(base.female + improvement, 0, 100),
    genderBalance: Math.round(clamp(base.balance + improvement * 0.5, 0, 100)),
    educationQuality: clamp(base.eduQuality, 0, 100),
    innovationIndex: clamp(base.innovationIndex + improvement * 0.5, 0, 100),
  };
}

/**
 * Get combined social index (health + literacy composite).
 * Used for workforce quality and governance effectiveness.
 */
function getSocialIndex(country, activeScenarios, simulationDay) {
  const health = getCountryHealth(country, activeScenarios, simulationDay);
  const literacy = getCountryLiteracy(country, simulationDay);

  const socialIndex = Math.round(
    (health.healthIndex * 0.4 +
     health.healthcareCapacity * 0.15 +
     literacy.overallLiteracy * 0.25 +
     literacy.educationQuality * 0.2) * 10
  ) / 10;

  return {
    country,
    health,
    literacy,
    socialIndex,
    workforceQualityMultiplier: Math.round((0.5 + socialIndex / 200) * 100) / 100,
  };
}

/**
 * Get health/literacy data for all tracked countries.
 */
function getAllSocialIndicators(activeScenarios, simulationDay) {
  const countries = Object.keys(BASE_HEALTH);
  return countries.map(country => getSocialIndex(country, activeScenarios, simulationDay))
    .sort((a, b) => b.socialIndex - a.socialIndex);
}

// ============================================
// POPULATION SYSTEM — per country demographics
// ============================================

// totalM = population in millions, workRatio = working-age share
// govShare = govt employed share, selfShare = self-employed share
const COUNTRY_POPULATION = {
  'United States':  { totalM: 334.9, workRatio: 0.63, empRate: 0.964, govShare: 0.150, selfShare: 0.080 },
  'China':          { totalM: 1412,  workRatio: 0.71, empRate: 0.950, govShare: 0.180, selfShare: 0.220 },
  'Germany':        { totalM: 84.4,  workRatio: 0.61, empRate: 0.970, govShare: 0.110, selfShare: 0.100 },
  'Japan':          { totalM: 124.5, workRatio: 0.60, empRate: 0.975, govShare: 0.090, selfShare: 0.120 },
  'India':          { totalM: 1428,  workRatio: 0.56, empRate: 0.930, govShare: 0.070, selfShare: 0.450 },
  'United Kingdom': { totalM: 67.9,  workRatio: 0.63, empRate: 0.965, govShare: 0.170, selfShare: 0.130 },
  'France':         { totalM: 68.0,  workRatio: 0.60, empRate: 0.932, govShare: 0.200, selfShare: 0.090 },
  'Brazil':         { totalM: 215.3, workRatio: 0.62, empRate: 0.888, govShare: 0.120, selfShare: 0.280 },
  'Canada':         { totalM: 38.2,  workRatio: 0.62, empRate: 0.958, govShare: 0.190, selfShare: 0.080 },
  'Russia':         { totalM: 144.1, workRatio: 0.60, empRate: 0.963, govShare: 0.280, selfShare: 0.070 },
  'South Korea':    { totalM: 51.7,  workRatio: 0.63, empRate: 0.972, govShare: 0.090, selfShare: 0.250 },
  'Australia':      { totalM: 26.5,  workRatio: 0.64, empRate: 0.968, govShare: 0.155, selfShare: 0.095 },
  'Mexico':         { totalM: 128.5, workRatio: 0.62, empRate: 0.961, govShare: 0.110, selfShare: 0.310 },
  'Saudi Arabia':   { totalM: 36.4,  workRatio: 0.58, empRate: 0.948, govShare: 0.380, selfShare: 0.050 },
  'Taiwan':         { totalM: 23.6,  workRatio: 0.60, empRate: 0.978, govShare: 0.095, selfShare: 0.190 },
  'Indonesia':      { totalM: 277.5, workRatio: 0.58, empRate: 0.940, govShare: 0.080, selfShare: 0.420 },
  'Turkey':         { totalM: 85.3,  workRatio: 0.58, empRate: 0.942, govShare: 0.130, selfShare: 0.220 },
  'Nigeria':        { totalM: 223.8, workRatio: 0.52, empRate: 0.855, govShare: 0.075, selfShare: 0.510 },
  'Vietnam':        { totalM: 97.3,  workRatio: 0.60, empRate: 0.948, govShare: 0.100, selfShare: 0.360 },
  'Thailand':       { totalM: 71.7,  workRatio: 0.60, empRate: 0.956, govShare: 0.090, selfShare: 0.340 },
};

/**
 * Get full population breakdown for a country.
 * All drift is deterministic (no Math.random).
 */
function getCountryPopulation(country, metrics, simulationDay) {
  const base = COUNTRY_POPULATION[country] || COUNTRY_POPULATION['United States'];

  // Deterministic drift from sin pattern
  const drift = Math.sin(simulationDay * 0.04 + country.length * 0.12) * 0.008;
  const econEffect = ((metrics?.economy || 50) - 50) / 10000;

  const empRate = Math.min(0.995, Math.max(0.75, base.empRate + drift + econEffect));
  const workingM = base.totalM * base.workRatio;
  const employedM = workingM * empRate;
  const unemployedM = workingM - employedM;

  const privateShare = 1 - base.govShare - base.selfShare;
  const privateM = employedM * privateShare;
  const govM = employedM * base.govShare;
  const selfM = employedM * base.selfShare;

  const round1 = (v) => Math.round(v * 10) / 10;

  return {
    country,
    totalPopulationM: round1(base.totalM),
    workingRatio: Math.round(base.workRatio * 100),
    workingPopulationM: round1(workingM),
    employedM: round1(employedM),
    unemployedM: round1(unemployedM),
    unemploymentRate: Math.round((1 - empRate) * 1000) / 10,
    employmentBreakdown: {
      privateM: round1(privateM),
      governmentM: round1(govM),
      selfEmployedM: round1(selfM),
      privateShare: Math.round(privateShare * 100),
      govShare: Math.round(base.govShare * 100),
      selfShare: Math.round(base.selfShare * 100),
    },
  };
}

// ============================================
// GOVERNMENT BUDGET SYSTEM — sector allocations
// ============================================

// Allocations in % of total government budget
const COUNTRY_BUDGET = {
  'United States':  { infrastructure: 12, health: 28, education: 16, defense: 20, industry: 8,  other: 16 },
  'China':          { infrastructure: 22, health: 18, education: 15, defense: 18, industry: 20, other: 7  },
  'Germany':        { infrastructure: 14, health: 30, education: 18, defense: 8,  industry: 12, other: 18 },
  'Japan':          { infrastructure: 16, health: 30, education: 15, defense: 5,  industry: 14, other: 20 },
  'India':          { infrastructure: 20, health: 15, education: 18, defense: 15, industry: 18, other: 14 },
  'United Kingdom': { infrastructure: 12, health: 32, education: 18, defense: 10, industry: 8,  other: 20 },
  'France':         { infrastructure: 13, health: 34, education: 18, defense: 9,  industry: 10, other: 16 },
  'Brazil':         { infrastructure: 14, health: 24, education: 18, defense: 6,  industry: 14, other: 24 },
  'Canada':         { infrastructure: 12, health: 30, education: 20, defense: 6,  industry: 10, other: 22 },
  'Russia':         { infrastructure: 16, health: 20, education: 14, defense: 28, industry: 14, other: 8  },
  'South Korea':    { infrastructure: 18, health: 22, education: 18, defense: 12, industry: 18, other: 12 },
  'Australia':      { infrastructure: 14, health: 28, education: 18, defense: 8,  industry: 10, other: 22 },
  'Mexico':         { infrastructure: 16, health: 20, education: 20, defense: 5,  industry: 16, other: 23 },
  'Saudi Arabia':   { infrastructure: 24, health: 18, education: 14, defense: 26, industry: 12, other: 6  },
  'Taiwan':         { infrastructure: 16, health: 22, education: 18, defense: 16, industry: 20, other: 8  },
  'Indonesia':      { infrastructure: 20, health: 18, education: 20, defense: 8,  industry: 16, other: 18 },
  'Turkey':         { infrastructure: 18, health: 18, education: 16, defense: 12, industry: 18, other: 18 },
  'Nigeria':        { infrastructure: 20, health: 12, education: 16, defense: 10, industry: 20, other: 22 },
  'Vietnam':        { infrastructure: 22, health: 16, education: 20, defense: 10, industry: 22, other: 10 },
  'Thailand':       { infrastructure: 18, health: 20, education: 18, defense: 8,  industry: 18, other: 18 },
};

/**
 * Get government budget allocation for a country.
 * Returns allocations as percentages + performance impact scores.
 */
function getGovernmentBudget(country, metrics, simulationDay) {
  const base = COUNTRY_BUDGET[country] || COUNTRY_BUDGET['United States'];

  // Deterministic drift (budgets shift slowly)
  const drift = Math.sin(simulationDay * 0.02 + country.length * 0.08) * 1.5;
  const stressShift = ((metrics?.stability || 50) < 40) ? 2 : 0; // stress → defense up

  const alloc = {
    infrastructure: Math.round(Math.max(5, base.infrastructure + drift * 0.3)),
    health:         Math.round(Math.max(8, base.health + drift * 0.2 - stressShift * 0.5)),
    education:      Math.round(Math.max(8, base.education + drift * 0.1)),
    defense:        Math.round(Math.max(3, base.defense + stressShift)),
    industry:       Math.round(Math.max(5, base.industry + drift * 0.2)),
    other:          0,
  };
  // Normalize so sum = 100
  const sum = alloc.infrastructure + alloc.health + alloc.education + alloc.defense + alloc.industry;
  alloc.other = Math.max(0, 100 - sum);

  // Performance impacts (how budget allocation affects system KPIs)
  const healthImpact   = alloc.health > 25   ? '+workforce quality' : alloc.health < 15   ? '-health index' : 'neutral';
  const infraImpact    = alloc.infrastructure > 18 ? '+supply efficiency' : alloc.infrastructure < 10 ? '-pipeline speed' : 'neutral';
  const eduImpact      = alloc.education > 17 ? '+innovation index'  : alloc.education < 12  ? '-skill level' : 'neutral';
  const defenseImpact  = alloc.defense > 20  ? '+stability'         : alloc.defense < 5    ? '-stability risk' : 'neutral';
  const industryImpact = alloc.industry > 16 ? '+GDP growth'        : alloc.industry < 8   ? '-economic output' : 'neutral';

  return {
    country,
    allocations: alloc,
    impacts: { health: healthImpact, infrastructure: infraImpact, education: eduImpact, defense: defenseImpact, industry: industryImpact },
    totalBudgetIndexed: Math.round(sum),
  };
}

module.exports = {
  getCountryHealth,
  getCountryLiteracy,
  getSocialIndex,
  getAllSocialIndicators,
  getCountryPopulation,
  getGovernmentBudget,
  BASE_HEALTH,
  BASE_LITERACY,
  COUNTRY_POPULATION,
  COUNTRY_BUDGET,
};
