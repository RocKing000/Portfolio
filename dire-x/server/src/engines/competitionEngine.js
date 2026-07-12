/**
 * Competition Engine
 * Deterministic competition analysis per sector.
 * Win probability = f(company score, competition intensity, scale, strategy)
 * No randomness — drift uses sin(day * seed) patterns.
 */

const SECTOR_COMPETITION = {
  ev:           { companiesGlobal: 18, avgBudgetB: 8.5,  marketGrowth: 0.18, topPlayers: ['Tesla', 'BYD', 'NIO', 'Rivian'] },
  agriculture:  { companiesGlobal: 32, avgBudgetB: 3.2,  marketGrowth: 0.04, topPlayers: ['Cargill', 'ADM', 'Bunge'] },
  defense:      { companiesGlobal: 12, avgBudgetB: 15.2, marketGrowth: 0.06, topPlayers: ['Lockheed', 'Raytheon', 'BAE Systems'] },
  electronics:  { companiesGlobal: 45, avgBudgetB: 6.8,  marketGrowth: 0.12, topPlayers: ['Samsung', 'Apple', 'LG', 'Foxconn'] },
  energy:       { companiesGlobal: 28, avgBudgetB: 12.1, marketGrowth: 0.08, topPlayers: ['ExxonMobil', 'Shell', 'BP'] },
  pharma:       { companiesGlobal: 22, avgBudgetB: 9.4,  marketGrowth: 0.10, topPlayers: ['Pfizer', 'J&J', 'Roche'] },
  automotive:   { companiesGlobal: 15, avgBudgetB: 11.0, marketGrowth: 0.07, topPlayers: ['Toyota', 'Volkswagen', 'GM'] },
  mining:       { companiesGlobal: 20, avgBudgetB: 4.5,  marketGrowth: 0.05, topPlayers: ['Rio Tinto', 'BHP', 'Vale'] },
  telecom:      { companiesGlobal: 25, avgBudgetB: 7.2,  marketGrowth: 0.09, topPlayers: ['AT&T', 'Verizon', 'Huawei'] },
  construction: { companiesGlobal: 38, avgBudgetB: 2.8,  marketGrowth: 0.06, topPlayers: ['CSCEC', 'Vinci', 'ACS Group'] },
};

// Country competitive advantage modifiers (0.8 = disadvantage, 1.2 = advantage)
const COUNTRY_ADVANTAGE = {
  'United States': 1.15, 'China': 1.10, 'Germany': 1.12, 'Japan': 1.10,
  'South Korea': 1.08, 'Taiwan': 1.05, 'UK': 1.05, 'India': 0.95,
  'Brazil': 0.90, 'Russia': 0.88, 'Nigeria': 0.82, 'Saudi Arabia': 0.92,
  'Australia': 1.00, 'Mexico': 0.88, 'Indonesia': 0.85, 'Turkey': 0.87,
  'Vietnam': 0.85, 'Thailand': 0.87,
};

/**
 * Compute deterministic competition profile for a company.
 * @param {object} company - { id, industry, country, scale, strategy, sresScore }
 * @param {number} day - simulation day (used for deterministic drift)
 * @returns {object} competition analysis
 */
function computeCompetition(company, day) {
  const sector = SECTOR_COMPETITION[company.industry] || SECTOR_COMPETITION.electronics;
  const seed = (company.country || 'us').length + (company.industry || 'x').length;

  // Deterministic drift using sin pattern (no Math.random)
  const drift = Math.sin(day * 0.07 + seed * 0.3) * 0.04;
  const marketDrift = Math.sin(day * 0.05 + seed * 0.2) * 0.015;

  // Competition intensity: more companies = higher intensity (0-1 scale)
  const baseIntensity = Math.min(0.95, sector.companiesGlobal / 50);
  const competitionIntensity = Math.min(0.98, Math.max(0.1, baseIntensity + drift));

  // Company effectiveness score (lower SRES = healthier = higher score)
  const sresScore = company.sresScore || 50;
  const healthScore = (100 - sresScore) / 100;

  // Scale modifier
  const scaleMod = { small: 0.70, medium: 1.00, large: 1.40 }[company.scale] || 1.0;

  // Strategy modifier
  const stratMod = { cost: 1.12, balanced: 1.00, sustainable: 0.97 }[company.strategy] || 1.0;

  // Country advantage
  const countryAdv = COUNTRY_ADVANTAGE[company.country] || 0.95;

  // Win probability: company effectiveness vs competition
  const rawWin = (healthScore * scaleMod * stratMod * countryAdv) / (competitionIntensity + 0.5);
  const winProbability = Math.min(0.92, Math.max(0.05, rawWin));

  // Estimated market share (%)
  const totalPlayers = sector.companiesGlobal + Math.round(drift * 3);
  const marketShare = Math.min(40, Math.max(0.5, (winProbability / totalPlayers) * 100 * scaleMod));

  // Contract win rate (probability of winning a new contract)
  const contractWinRate = Math.min(0.90, winProbability * 1.1);

  // Budget competitiveness
  const avgBudget = sector.avgBudgetB * (1 + marketDrift);
  const companyBudgetScore = scaleMod * stratMod;
  const budgetGap = Math.round((companyBudgetScore - 1.0) * avgBudget * 10) / 10;

  return {
    sector: company.industry,
    companiesInSector: totalPlayers,
    competitionIntensity: Math.round(competitionIntensity * 100),   // 0-100
    winProbability: Math.round(winProbability * 100),               // 0-100
    contractWinRate: Math.round(contractWinRate * 100),             // 0-100
    marketShare: Math.round(marketShare * 10) / 10,                 // %
    marketGrowthRate: Math.round((sector.marketGrowth + marketDrift) * 1000) / 10, // %
    avgIndustrBudgetB: Math.round(avgBudget * 10) / 10,            // $B
    budgetPositionB: Math.round(budgetGap * 10) / 10,               // vs avg
    topCompetitors: sector.topPlayers,
    countryAdvantage: Math.round(countryAdv * 100),                 // 0-100
  };
}

/**
 * Sector-level competition snapshot (all companies in a sector).
 */
function getSectorSnapshot(industry, day) {
  const sector = SECTOR_COMPETITION[industry] || SECTOR_COMPETITION.electronics;
  const drift = Math.sin(day * 0.06 + industry.length * 0.4) * 0.03;
  return {
    industry,
    totalCompanies: sector.companiesGlobal + Math.round(drift * 3),
    marketGrowth: Math.round((sector.marketGrowth + drift * 0.5) * 1000) / 10,
    avgBudgetB: Math.round(sector.avgBudgetB * (1 + drift) * 10) / 10,
    topPlayers: sector.topPlayers,
  };
}

module.exports = { computeCompetition, getSectorSnapshot, SECTOR_COMPETITION };
