/**
 * Creative Intelligence Engine
 * Detects creative user inputs, scores based on novelty + impact.
 * Stores high-quality ideas and assigns badges.
 */

const { IDEA_BADGES } = require('../config/constants');

// Keywords that indicate creative/novel decisions
const CREATIVITY_MARKERS = {
  high: [
    'innovate', 'pivot', 'disrupt', 'transform', 'revolutionize', 'redesign',
    'alternative', 'unconventional', 'novel', 'creative', 'pioneer',
    'synthesize', 'hybrid', 'circular', 'regenerative', 'blockchain',
    'decentralize', 'vertical farm', 'urban mine', 'closed loop',
  ],
  medium: [
    'optimize', 'improve', 'enhance', 'adapt', 'combine', 'integrate',
    'restructure', 'streamline', 'automate', 'reconfigure', 'diversify',
    'partner', 'collaborate', 'alliance', 'consortium',
  ],
  low: [
    'reduce', 'increase', 'maintain', 'continue', 'standard', 'traditional',
    'conventional', 'follow', 'copy', 'replicate',
  ],
};

// System-level impact indicators
const IMPACT_MARKERS = {
  high: [
    'global', 'systemic', 'industry-wide', 'revolutionary', 'paradigm',
    'entire', 'fundamental', 'structural', 'market-changing', 'breakthrough',
  ],
  medium: [
    'regional', 'significant', 'substantial', 'notable', 'meaningful',
    'multiple', 'cross-sector', 'supply chain', 'ecosystem',
  ],
  low: [
    'local', 'minor', 'small', 'incremental', 'marginal', 'temporary',
  ],
};

/**
 * Score the novelty of an idea (0-10).
 */
function scoreNovelty(text) {
  const lower = text.toLowerCase();
  let score = 3; // base

  for (const word of CREATIVITY_MARKERS.high) {
    if (lower.includes(word)) score += 2;
  }
  for (const word of CREATIVITY_MARKERS.medium) {
    if (lower.includes(word)) score += 1;
  }
  for (const word of CREATIVITY_MARKERS.low) {
    if (lower.includes(word)) score -= 0.5;
  }

  // Bonus for length (more detail = more thought)
  if (text.length > 100) score += 1;
  if (text.length > 200) score += 1;

  // Bonus for combining multiple concepts
  const conceptCount = [...CREATIVITY_MARKERS.high, ...CREATIVITY_MARKERS.medium]
    .filter(w => lower.includes(w)).length;
  if (conceptCount >= 3) score += 2;

  return Math.min(10, Math.max(0, Math.round(score * 10) / 10));
}

/**
 * Score the potential impact of an idea (0-10).
 */
function scoreImpact(text) {
  const lower = text.toLowerCase();
  let score = 3;

  for (const word of IMPACT_MARKERS.high) {
    if (lower.includes(word)) score += 2;
  }
  for (const word of IMPACT_MARKERS.medium) {
    if (lower.includes(word)) score += 1;
  }
  for (const word of IMPACT_MARKERS.low) {
    if (lower.includes(word)) score -= 0.5;
  }

  return Math.min(10, Math.max(0, Math.round(score * 10) / 10));
}

/**
 * Determine badges based on scores and content.
 */
function determineBadges(text, noveltyScore, impactScore) {
  const badges = [];
  const lower = text.toLowerCase();

  if (noveltyScore >= IDEA_BADGES.innovator.minNovelty) {
    badges.push('innovator');
  }

  // Systems thinker: mentions interconnections, cascading effects, feedback loops
  const systemsWords = ['cascade', 'feedback', 'interconnect', 'system', 'ripple', 'chain', 'dependency', 'network'];
  if (systemsWords.some(w => lower.includes(w)) && (noveltyScore + impactScore) / 2 >= IDEA_BADGES.systems_thinker.minNovelty) {
    badges.push('systems_thinker');
  }

  // Strategist: mentions long-term, strategic, future, years
  const strategyWords = ['long-term', 'strategic', 'future', 'years', 'decade', 'roadmap', 'vision', 'plan'];
  if (strategyWords.some(w => lower.includes(w)) && noveltyScore >= IDEA_BADGES.strategist.minNovelty) {
    badges.push('strategist');
  }

  // Optimizer: mentions efficiency, cost, reduce, optimize
  const optimizerWords = ['efficien', 'cost', 'optimi', 'reduc', 'lean', 'waste', 'streamline'];
  if (optimizerWords.some(w => lower.includes(w)) && noveltyScore >= IDEA_BADGES.optimizer.minNovelty) {
    badges.push('optimizer');
  }

  return badges;
}

/**
 * Categorize the idea.
 */
function categorizeIdea(text) {
  const lower = text.toLowerCase();
  const categories = {
    supply_chain: ['supply', 'logistics', 'transport', 'shipping', 'inventory', 'warehouse'],
    technology: ['technology', 'ai', 'automation', 'digital', 'software', 'data', 'algorithm'],
    sustainability: ['sustainab', 'green', 'carbon', 'renewable', 'circular', 'recycle', 'emission'],
    finance: ['invest', 'fund', 'capital', 'cost', 'revenue', 'profit', 'hedge'],
    diplomacy: ['trade', 'agreement', 'treaty', 'alliance', 'partner', 'bilateral', 'diplomatic'],
    innovation: ['innovat', 'research', 'develop', 'patent', 'breakthrough', 'pioneer'],
  };

  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'general';
}

/**
 * Evaluate a user decision for creative intelligence.
 */
function evaluateIdea(text, simulationDay) {
  const noveltyScore = scoreNovelty(text);
  const impactScore = scoreImpact(text);
  const combinedScore = Math.round((noveltyScore * 0.6 + impactScore * 0.4) * 10) / 10;
  const badges = determineBadges(text, noveltyScore, impactScore);
  const category = categorizeIdea(text);

  return {
    content: text,
    novelty_score: noveltyScore,
    impact_score: impactScore,
    combined_score: combinedScore,
    category,
    badges,
    simulation_day: simulationDay,
    is_notable: combinedScore >= 5,
  };
}

module.exports = {
  evaluateIdea,
  scoreNovelty,
  scoreImpact,
  determineBadges,
  categorizeIdea,
};
