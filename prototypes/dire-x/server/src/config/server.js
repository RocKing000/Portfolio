/**
 * config/server.js
 * All tunable server-side operational parameters.
 * Every value can be overridden via environment variables.
 */

module.exports = {
  // ── Cache TTLs ─────────────────────────────────────────────────────────────
  CACHE_TTL_COMPANIES:    Number(process.env.CACHE_TTL_COMPANIES)    || 30_000,        // 30 s
  CACHE_TTL_GDP:          Number(process.env.CACHE_TTL_GDP)          || 10_000,        // 10 s
  CACHE_TTL_HEATMAP:      Number(process.env.CACHE_TTL_HEATMAP)      || 5 * 60_000,   // 5 min
  CACHE_TTL_AI_INSIGHTS:  Number(process.env.CACHE_TTL_AI_INSIGHTS)  || 5 * 60_000,   // 5 min

  // ── AI / OpenRouter ────────────────────────────────────────────────────────
  OPENROUTER_URL:              process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions',

  // openrouter lib defaults (used by generateAIResponse when callers don't override)
  AI_DEFAULT_TIMEOUT:          Number(process.env.AI_DEFAULT_TIMEOUT)          || 10_000,
  AI_DEFAULT_MAX_TOKENS:       Number(process.env.AI_DEFAULT_MAX_TOKENS)       || 500,
  AI_DEFAULT_TEMPERATURE:      Number(process.env.AI_DEFAULT_TEMPERATURE)      || 0.7,

  // per-service overrides
  AI_INSIGHTS_MAX_TOKENS:      Number(process.env.AI_INSIGHTS_MAX_TOKENS)      || 500,
  AI_INSIGHTS_TEMPERATURE:     Number(process.env.AI_INSIGHTS_TEMPERATURE)     || 0.6,

  AI_NARRATION_MAX_TOKENS:     Number(process.env.AI_NARRATION_MAX_TOKENS)     || 400,
  AI_NARRATION_TEMPERATURE:    Number(process.env.AI_NARRATION_TEMPERATURE)    || 0.7,
  AI_NARRATION_TIMEOUT:        Number(process.env.AI_NARRATION_TIMEOUT)        || 15_000,
};
