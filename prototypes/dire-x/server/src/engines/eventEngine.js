const { v4: uuidv4 } = require('uuid');
const { EVENT_TEMPLATES, MAX_EVENTS_PER_DAY } = require('../config/constants');

const FILL_VALUES = {
  region: ['East Asia', 'Middle East', 'Sub-Saharan Africa', 'South America', 'Eastern Europe', 'Central Asia'],
  country: ['China', 'Russia', 'India', 'Brazil', 'Iran', 'Turkey', 'Indonesia', 'Saudi Arabia'],
  countryA: ['United States', 'European Union', 'China', 'India'],
  countryB: ['China', 'Russia', 'Iran', 'North Korea'],
  percentage: ['15', '22', '30', '40', '12', '18', '25', '35'],
  port: ['Shanghai', 'Singapore', 'Rotterdam', 'Busan', 'Jebel Ali'],
  cause: ['labor strikes', 'extreme weather', 'security threats', 'infrastructure failure'],
  sector: ['energy', 'technology', 'agriculture', 'mining', 'defense'],
  resource: ['lithium', 'cobalt', 'rare earth elements', 'copper', 'semiconductors', 'wheat'],
  duration: ['3-6 weeks', '2-4 months', '6-8 weeks', '1-3 months'],
  border: ['India-Pakistan', 'Russia-Ukraine', 'China-Taiwan Strait', 'North-South Korea'],
  target: ['energy grid', 'financial network', 'port logistics', 'telecommunications'],
  pipeline: ['Nord Stream', 'Keystone XL', 'Trans-Arabian', 'Druzhba', 'TAPI'],
  factory: ['TSMC Fab 18', 'Samsung Pyeongtaek', 'Intel Chandler', 'GlobalFoundries Malta'],
  currency: ['Turkish Lira', 'Argentine Peso', 'Egyptian Pound', 'Nigerian Naira', 'Pakistani Rupee'],
  location: ['Atacama Desert', 'Congo Basin', 'Western Australia', 'Norilsk', 'Inner Mongolia'],
};

/**
 * Pick a random element from an array.
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Fill template placeholders like {region}, {country}, etc.
 */
function fillTemplate(template) {
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    const candidates = FILL_VALUES[key];
    return candidates ? pick(candidates) : key;
  });
}

/**
 * Compute severity from stress on a 1-5 scale.
 */
function computeSeverity(stress) {
  if (stress >= 90) return 5;
  if (stress >= 75) return 4;
  if (stress >= 55) return 3;
  if (stress >= 35) return 2;
  return 1;
}

/**
 * Generate events based on stress level, scenario, current day, and event history.
 *
 * stress = impact * sres * scenarioMultiplier (passed in by caller, typically 0-100+)
 * Selects templates where stress exceeds their minStress threshold.
 * Cascade effect: prior events increase selection probability.
 * Limited to MAX_EVENTS_PER_DAY.
 */
function generateEvents(stress, scenario, currentDay, history) {
  const safeStress = Math.max(0, stress || 0);
  const safeHistory = history || [];

  // Find templates whose minStress threshold is met
  const eligible = EVENT_TEMPLATES.filter((t) => safeStress >= t.minStress);

  if (eligible.length === 0) {
    return [];
  }

  // Cascade effect: more past events increases probability of new events
  const cascadeFactor = 1 + safeHistory.length * 0.15;

  // Base probability scales with how far stress exceeds minimum thresholds
  const events = [];
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);

  for (const template of shuffled) {
    if (events.length >= MAX_EVENTS_PER_DAY) break;

    const excessStress = safeStress - template.minStress;
    const baseProbability = Math.min(0.85, (excessStress / 100) * cascadeFactor);

    // Scenario affinity: boost probability if event type matches scenario theme
    let scenarioBoost = 0;
    if (scenario === 'supply_crisis' && template.type === 'supply') scenarioBoost = 0.2;
    if (scenario === 'war' && template.type === 'stability') scenarioBoost = 0.25;
    if (scenario === 'drought' && template.type === 'environment') scenarioBoost = 0.2;

    // Check for cascade from same-type previous events
    const sameTypePrevious = safeHistory.filter((e) => e.type === template.type).length;
    const cascadeBoost = sameTypePrevious * 0.1;

    const finalProbability = Math.min(0.95, baseProbability + scenarioBoost + cascadeBoost);

    if (Math.random() < finalProbability) {
      const severity = computeSeverity(safeStress);

      events.push({
        id: uuidv4(),
        template_id: template.id,
        day: currentDay,
        type: template.type,
        title: fillTemplate(template.titleTemplate),
        description: fillTemplate(template.descriptionTemplate),
        severity,
        impact: {
          supply: Math.round(template.impact.supply * (severity / 3) * 1000) / 1000,
          economy: Math.round(template.impact.economy * (severity / 3) * 1000) / 1000,
          environment: Math.round(template.impact.environment * (severity / 3) * 1000) / 1000,
          stability: Math.round(template.impact.stability * (severity / 3) * 1000) / 1000,
        },
      });
    }
  }

  // If stress is very high but no events generated due to randomness, guarantee at least one
  if (events.length === 0 && safeStress >= 50 && eligible.length > 0) {
    const forced = pick(eligible);
    const severity = computeSeverity(safeStress);
    events.push({
      id: uuidv4(),
      template_id: forced.id,
      day: currentDay,
      type: forced.type,
      title: fillTemplate(forced.titleTemplate),
      description: fillTemplate(forced.descriptionTemplate),
      severity,
      impact: {
        supply: Math.round(forced.impact.supply * (severity / 3) * 1000) / 1000,
        economy: Math.round(forced.impact.economy * (severity / 3) * 1000) / 1000,
        environment: Math.round(forced.impact.environment * (severity / 3) * 1000) / 1000,
        stability: Math.round(forced.impact.stability * (severity / 3) * 1000) / 1000,
      },
    });
  }

  return events;
}

module.exports = { generateEvents };
