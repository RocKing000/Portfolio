// ============================================
// GEOPOLITICAL ENGINE — Nation relations, trade efficiency
// ============================================

// Relation matrix: score 0-100 (0=hostile, 50=neutral, 100=allied)
const BASE_RELATIONS = {
  'United States': {
    'United Kingdom': 92, 'Germany': 85, 'France': 82, 'Canada': 95, 'Australia': 90,
    'Japan': 88, 'South Korea': 85, 'Taiwan': 78, 'India': 65, 'Brazil': 60,
    'Mexico': 70, 'Saudi Arabia': 65, 'UAE': 70, 'Israel': 88,
    'China': 38, 'Russia': 15, 'Iran': 5, 'North Korea': 2,
    'Nigeria': 55, 'South Africa': 60, 'Turkey': 52,
    'Norway': 88, 'Netherlands': 85, 'Switzerland': 80, 'Singapore': 78,
    'Indonesia': 62,
  },
  'China': {
    'Russia': 75, 'Pakistan': 82, 'North Korea': 70, 'Iran': 68, 'Saudi Arabia': 72,
    'UAE': 70, 'Indonesia': 60, 'Nigeria': 62, 'South Africa': 65, 'Brazil': 62,
    'India': 35, 'Australia': 30, 'Japan': 38, 'South Korea': 50, 'Taiwan': 5,
    'United States': 38, 'United Kingdom': 42, 'Germany': 55, 'France': 52,
    'Vietnam': 25, 'Philippines': 28,
    'Norway': 48, 'Switzerland': 58, 'Singapore': 65, 'Mexico': 58,
  },
  'Russia': {
    'China': 75, 'Belarus': 85, 'Kazakhstan': 78, 'Armenia': 70, 'Serbia': 68,
    'India': 60, 'Iran': 65, 'Turkey': 55,
    'United States': 15, 'United Kingdom': 12, 'Germany': 14, 'France': 16,
    'Ukraine': 2, 'Poland': 8, 'Estonia': 6, 'Latvia': 6, 'Lithuania': 6,
    'Japan': 22, 'South Korea': 28, 'Norway': 30, 'Sweden': 32,
    'Saudi Arabia': 52, 'UAE': 55, 'Nigeria': 50, 'South Africa': 55,
  },
  'India': {
    'United States': 65, 'Japan': 72, 'Australia': 70, 'France': 68, 'Germany': 65,
    'Russia': 60, 'Iran': 55, 'UAE': 72, 'Saudi Arabia': 65, 'Bangladesh': 48,
    'Israel': 65, 'South Africa': 65, 'Brazil': 62, 'Nigeria': 60,
    'China': 35, 'Pakistan': 8, 'Nepal': 55, 'Sri Lanka': 58,
    'United Kingdom': 72, 'Canada': 68, 'Singapore': 75,
  },
  'Germany': {
    'France': 90, 'Netherlands': 88, 'Poland': 72, 'Italy': 80, 'Spain': 78,
    'United Kingdom': 82, 'United States': 85, 'Canada': 80, 'Australia': 75,
    'Japan': 78, 'South Korea': 72, 'India': 65, 'Brazil': 62,
    'China': 55, 'Russia': 14, 'Turkey': 52, 'Saudi Arabia': 58,
    'Ukraine': 72, 'Norway': 82, 'Switzerland': 85, 'Singapore': 70,
  },
};

const SCENARIO_RELATION_IMPACT = {
  stable:        { hostility_add: 0,   friendly_decay: 0 },
  supply_crisis: { hostility_add: 5,   friendly_decay: 2 },
  war:           { hostility_add: 20,  friendly_decay: 10 },
  drought:       { hostility_add: 3,   friendly_decay: 1 },
  pandemic:      { hostility_add: 2,   friendly_decay: 3 },
  trade_war:     { hostility_add: 15,  friendly_decay: 8 },
  cyber_attack:  { hostility_add: 8,   friendly_decay: 4 },
  energy_crisis: { hostility_add: 6,   friendly_decay: 2 },
};

const RELATION_STATUS = {
  allied:   { min: 80, color: 'green',  label: 'Allied' },
  friendly: { min: 60, color: 'teal',   label: 'Friendly' },
  neutral:  { min: 40, color: 'yellow', label: 'Neutral' },
  tense:    { min: 20, color: 'orange', label: 'Tense' },
  hostile:  { min: 0,  color: 'red',    label: 'Hostile' },
};

function getRelationStatus(score) {
  if (score >= 80) return RELATION_STATUS.allied;
  if (score >= 60) return RELATION_STATUS.friendly;
  if (score >= 40) return RELATION_STATUS.neutral;
  if (score >= 20) return RELATION_STATUS.tense;
  return RELATION_STATUS.hostile;
}

/**
 * Compute trade efficiency between two countries based on relation score.
 * Returns 0.3 (hostile) to 1.0 (allied).
 */
function computeTradeEfficiency(score) {
  return Math.round((0.3 + (score / 100) * 0.7) * 100) / 100;
}

/**
 * Compute tariff multiplier: lower relations → higher tariffs
 */
function computeTariffMultiplier(score) {
  // score 100 → 1.0x (no tariff), score 0 → 2.5x (max tariff)
  return Math.round((1.0 + ((100 - score) / 100) * 1.5) * 100) / 100;
}

/**
 * Get relations for a specific country with scenario adjustments.
 */
function getCountryRelations(country, activeScenarios, simulationDay) {
  const baseRelations = BASE_RELATIONS[country] || {};
  const dominantScenario = activeScenarios.length > 0
    ? activeScenarios.reduce((p, c) => c.intensity > p.intensity ? c : p, activeScenarios[0])?.type
    : 'stable';
  const impact = SCENARIO_RELATION_IMPACT[dominantScenario] || SCENARIO_RELATION_IMPACT.stable;

  return Object.entries(baseRelations).map(([partner, baseScore]) => {
    // Deterministic drift based on day and country pair
    const seed = (country.length + partner.length) * simulationDay;
    const drift = Math.sin(seed * 0.05) * 4;

    const adjustedScore = Math.min(100, Math.max(0,
      baseScore + drift - impact.hostility_add * (1 - baseScore / 100)
    ));

    const status = getRelationStatus(adjustedScore);
    return {
      partner,
      score: Math.round(adjustedScore),
      status: status.label,
      color: status.color,
      tradeEfficiency: computeTradeEfficiency(adjustedScore),
      tariffMultiplier: computeTariffMultiplier(adjustedScore),
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Compute supply risk modifier for a company based on its country relations.
 * Higher average hostility with key resource producers → higher supply risk.
 */
function computeSupplyRiskModifier(companyCountry, resourceProducers, activeScenarios, simulationDay) {
  const relations = getCountryRelations(companyCountry, activeScenarios, simulationDay);
  const relationsMap = Object.fromEntries(relations.map(r => [r.partner, r]));

  let totalRisk = 0;
  let count = 0;

  for (const producer of resourceProducers) {
    const rel = relationsMap[producer];
    if (rel) {
      // Invert: hostile = high risk
      totalRisk += (100 - rel.score) / 100;
      count++;
    }
  }

  const avgRisk = count > 0 ? totalRisk / count : 0.5;
  return Math.round(avgRisk * 100) / 100;
}

/**
 * Generate a simplified global relations heatmap for the globe.
 * Returns array of country pairs with relation scores.
 */
function getGlobalRelationsSnapshot(activeScenarios, simulationDay) {
  const pairs = [];
  const countries = Object.keys(BASE_RELATIONS);

  for (const country of countries) {
    const relations = getCountryRelations(country, activeScenarios, simulationDay);
    for (const rel of relations.slice(0, 5)) { // Top 5 partners per country
      pairs.push({
        from: country,
        to: rel.partner,
        score: rel.score,
        status: rel.status,
        tradeEfficiency: rel.tradeEfficiency,
      });
    }
  }

  return pairs;
}

module.exports = {
  getCountryRelations,
  computeSupplyRiskModifier,
  computeTradeEfficiency,
  computeTariffMultiplier,
  getGlobalRelationsSnapshot,
  BASE_RELATIONS,
  RELATION_STATUS,
};
