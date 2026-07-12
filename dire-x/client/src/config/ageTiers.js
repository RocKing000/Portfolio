// ============================================
// Age-Adaptive UI Tier Configuration
//
// Three tiers based on user age:
//   Explorer  (13-17)  — simplified, guided, game-like
//   Strategist (18-24) — full simulation, some complexity hidden
//   Analyst   (25+)    — everything visible, no guardrails
//
// Each tier defines:
//   - Which panels are visible
//   - Which tabs are available
//   - Label complexity (simple vs technical)
//   - Feature gates
// ============================================

export const TIERS = {
  explorer: {
    id: 'explorer',
    label: 'Explorer',
    ageRange: [13, 17],
    description: 'Learn how the world works through simulation',

    // Layout
    showLeftPanel: true,
    showRightPanel: true,
    leftPanelWidth: 'w-[260px] min-w-[260px]',
    rightPanelWidth: 'w-[280px] min-w-[280px]',

    // TopNav features
    showSpeedControls: true,
    showLanguageSelector: true,
    showResourceFilter: false,    // too complex
    showTradeRouteToggle: false,
    showIdeaJournal: true,
    showDataStatus: false,

    // Center panel views
    centerViews: ['globe', 'timeline'],  // no raw heatmap or intel globe
    defaultCenterView: 'globe',

    // Right panel tabs
    rightTabs: [
      { id: 'metrics',   label: 'My Scores',    short: 'S' },
      { id: 'economy',   label: 'Money',         short: '$' },
      { id: 'workforce', label: 'Workers',       short: 'W' },
      { id: 'gdp',       label: 'World Economy', short: 'G' },
    ],

    // Left panel sections
    showNationDrilldown: false,   // simplified company list
    showBranchTree: false,        // decision branching is advanced
    showScenarioCards: true,
    showStrategicActions: false,  // too complex for teens
    showResourceFilter: false,
    maxScenarios: 4,              // stable, supply_crisis, war, drought

    // Labels (simplified)
    labels: {
      supply: 'Supply Risk',
      economy: 'Market Health',
      environment: 'Planet Impact',
      stability: 'World Stability',
      sres: 'Risk Score',
      profit_margin: 'Profit %',
      pipeline_health: 'Factory Status',
      morale: 'Worker Happiness',
      compliance: 'Rule Following',
    },

    // Decision input
    decisionPlaceholder: 'What would you do? (e.g., "Find new lithium suppliers in Chile")',
    showDecisionConfidence: false,

    // Simulation
    defaultSpeed: 1,
    maxSpeed: 2,
  },

  strategist: {
    id: 'strategist',
    label: 'Strategist',
    ageRange: [18, 24],
    description: 'Navigate real-world supply chain strategy',

    showLeftPanel: true,
    showRightPanel: true,
    leftPanelWidth: 'w-[280px] min-w-[280px]',
    rightPanelWidth: 'w-[320px] min-w-[320px]',

    showSpeedControls: true,
    showLanguageSelector: true,
    showResourceFilter: true,
    showTradeRouteToggle: true,
    showIdeaJournal: true,
    showDataStatus: false,

    centerViews: ['globe', 'heatmap', 'timeline'],
    defaultCenterView: 'globe',

    rightTabs: [
      { id: 'metrics',     label: 'Metrics',    short: 'M' },
      { id: 'economy',     label: 'Economy',    short: 'E' },
      { id: 'workforce',   label: 'Workforce',  short: 'W' },
      { id: 'gdp',         label: 'GDP',        short: 'G' },
      { id: 'geo',         label: 'Geopolitics', short: '🌍' },
      { id: 'compliance',  label: 'Compliance', short: 'C' },
    ],

    showNationDrilldown: true,
    showBranchTree: true,
    showScenarioCards: true,
    showStrategicActions: true,
    showResourceFilter: true,
    maxScenarios: 7,

    labels: {
      supply: 'Supply Stress',
      economy: 'Economic Pressure',
      environment: 'Environmental Risk',
      stability: 'Geopolitical Stability',
      sres: 'SRES Score',
      profit_margin: 'Profit Margin',
      pipeline_health: 'Pipeline Health',
      morale: 'Workforce Morale',
      compliance: 'Compliance Score',
    },

    decisionPlaceholder: 'Enter strategic decision (e.g., "Diversify rare earth supply away from China")',
    showDecisionConfidence: true,

    defaultSpeed: 1,
    maxSpeed: 5,
  },

  analyst: {
    id: 'analyst',
    label: 'Analyst',
    ageRange: [25, 99],
    description: 'Full decision intelligence platform',

    showLeftPanel: true,
    showRightPanel: true,
    leftPanelWidth: 'w-[280px] min-w-[280px]',
    rightPanelWidth: 'w-[320px] min-w-[320px]',

    showSpeedControls: true,
    showLanguageSelector: true,
    showResourceFilter: true,
    showTradeRouteToggle: true,
    showIdeaJournal: true,
    showDataStatus: true,

    centerViews: ['globe', 'heatmap', 'timeline', 'intel'],
    defaultCenterView: 'globe',

    rightTabs: [
      { id: 'metrics',     label: 'Metrics',    short: 'M' },
      { id: 'economy',     label: 'Economy',    short: 'E' },
      { id: 'workforce',   label: 'Workforce',  short: 'W' },
      { id: 'gdp',         label: 'GDP',        short: 'G' },
      { id: 'geo',         label: 'Geo',        short: '🌍' },
      { id: 'health',      label: 'Health',     short: 'H' },
      { id: 'compliance',  label: 'Comply',     short: 'C' },
      { id: 'governance',  label: 'Gov',        short: '⚖' },
    ],

    showNationDrilldown: true,
    showBranchTree: true,
    showScenarioCards: true,
    showStrategicActions: true,
    showResourceFilter: true,
    maxScenarios: 7,

    labels: {
      supply: 'Supply Index',
      economy: 'Economic Index',
      environment: 'Environmental Index',
      stability: 'Stability Index',
      sres: 'SRES',
      profit_margin: 'Margin %',
      pipeline_health: 'Pipeline HP',
      morale: 'Morale',
      compliance: 'Compliance',
    },

    decisionPlaceholder: 'Strategic decision...',
    showDecisionConfidence: true,

    defaultSpeed: 1,
    maxSpeed: 5,
  },
};

/**
 * Resolve age to tier.
 */
export function getTierForAge(age) {
  const numAge = parseInt(age, 10);
  if (isNaN(numAge) || numAge < 13) return TIERS.explorer;
  if (numAge <= 17) return TIERS.explorer;
  if (numAge <= 24) return TIERS.strategist;
  return TIERS.analyst;
}

/**
 * Get tier by ID.
 */
export function getTierById(tierId) {
  return TIERS[tierId] || TIERS.strategist;
}
