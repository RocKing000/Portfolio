/**
 * services/aiInsights.service.js
 * Generates structured geopolitical intelligence insights via OpenRouter.
 */

const { generateAIResponse } = require('../lib/openrouter');
const { CACHE_TTL_AI_INSIGHTS, AI_INSIGHTS_MAX_TOKENS, AI_INSIGHTS_TEMPERATURE } = require('../config/server');

const SYSTEM_PROMPT = `You are a senior geopolitical intelligence analyst specializing in strategic resource risk and supply chain security.
Your job is to deliver concise, high-signal intelligence briefings.
Always respond with ONLY a valid JSON object — no markdown, no code fences, no extra text.
Keep the total response under 300 words.`;

// Simple in-memory cache: key → { result, expiresAt }
const cache = new Map();
const CACHE_TTL_MS = CACHE_TTL_AI_INSIGHTS;

/**
 * Build a deterministic cache key from insight params.
 */
function cacheKey({ nation, company, resources }) {
  return `${nation}|${company}|${(resources || []).sort().join(',')}`;
}

/**
 * Generate a structured strategic insight.
 *
 * @param {object} params
 * @param {string}   params.nation    - Nation name or ISO2 code
 * @param {string}   params.company   - Company name
 * @param {string[]} params.resources - Array of resource names
 * @returns {Promise<{summary: string, risks: string[], opportunities: string[], outlook: string, tokens_used: number|null}>}
 */
async function getStrategicInsight({ nation, company, resources = [] }) {
  const key = cacheKey({ nation, company, resources });

  // Return cached result if still valid
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[AIInsights] Cache hit for ${key}`);
    return cached.result;
  }

  const resourceList = resources.length > 0 ? resources.join(', ') : 'unspecified resources';

  const userPrompt = `Analyze the following geopolitical intelligence scenario:

Nation: ${nation}
Company: ${company}
Strategic Resources: ${resourceList}

Respond with a JSON object with exactly these four fields:
{
  "summary": "2-3 sentence overview of strategic importance and current risk posture",
  "risks": ["risk 1", "risk 2", "risk 3"],
  "opportunities": ["opportunity 1", "opportunity 2"],
  "outlook": "1-2 sentence forward-looking assessment"
}

Focus on: supply chain vulnerabilities, geopolitical dependencies, concentration risk, and strategic leverage.`;

  let tokens_used = null;

  try {
    const { content, tokens_used: tu } = await generateAIResponse(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: AI_INSIGHTS_MAX_TOKENS, temperature: AI_INSIGHTS_TEMPERATURE }
    );

    tokens_used = tu;

    // Parse JSON from response
    const parsed = JSON.parse(content);

    const result = {
      summary: parsed.summary || '',
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      outlook: parsed.outlook || '',
      tokens_used,
    };

    // Store in cache
    cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });

    console.log(`[AIInsights] Generated insight for ${company} / ${nation} (${tokens_used ?? 'unknown'} tokens)`);
    return result;
  } catch (err) {
    console.warn('[AIInsights] Failed to generate insight:', err.message);
    return buildFallback({ nation, company, resources });
  }
}

/**
 * Fallback insight when AI is unavailable.
 */
function buildFallback({ nation, company, resources }) {
  return {
    summary: `Baseline analysis for ${company} operating in ${nation}. AI insight unavailable — using static assessment. Strategic resource dependencies across ${resources.join(', ') || 'key materials'} present standard concentration risk.`,
    risks: [
      'Supply chain concentration in single-source regions',
      'Geopolitical instability may disrupt procurement',
      'Regulatory and export control exposure',
    ],
    opportunities: [
      'Diversification into alternative supplier networks',
      'Strategic stockpiling during low-price windows',
    ],
    outlook: 'AI insight unavailable. Monitor geopolitical developments and maintain contingency supply arrangements.',
    tokens_used: null,
  };
}

// ─── Risk Adjustment ─────────────────────────────────────────────────────────

const ADJUSTMENT_SYSTEM_PROMPT = `You are a geopolitical risk quantification engine.
Always respond with ONLY a valid JSON object — no markdown, no code fences, no extra text.`;

const adjustmentCache = new Map();

/**
 * Get AI-based risk score adjustment for a nation.
 * Returns a delta (-10 to +10) and 2–3 key risks.
 *
 * @param {object} params
 * @param {string}   params.nationCode  - ISO-2 code
 * @param {string}   params.nationName
 * @param {number}   params.baseScore   - computed base score
 * @param {string[]} params.resources   - resource names
 * @returns {Promise<{adjustment: number, key_risks: string[], confidence: string}>}
 */
async function getRiskAdjustment({ nationCode, nationName, baseScore, resources = [] }) {
  const key = `adj:${nationCode}:${resources.sort().join(',')}`;

  const cached = adjustmentCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  const resourceList = resources.length > 0 ? resources.join(', ') : 'general strategic resources';

  const userPrompt = `Nation: ${nationName} (${nationCode})
Strategic resources in focus: ${resourceList}
Current computed base risk score: ${baseScore}/100

Evaluate current geopolitical conditions, supply chain vulnerabilities, and strategic risks for this nation.
Respond with a JSON object:
{
  "adjustment": <integer from -10 to +10, positive means higher risk than model baseline>,
  "key_risks": ["<risk 1>", "<risk 2>"],
  "confidence": "high" | "medium" | "low",
  "summary": "<one sentence current-conditions summary>"
}`;

  try {
    const { content, tokens_used } = await generateAIResponse(
      [
        { role: 'system', content: ADJUSTMENT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 200, temperature: 0.4 }
    );

    const parsed = JSON.parse(content);
    const result = {
      adjustment: Math.max(-10, Math.min(10, parseInt(parsed.adjustment) || 0)),
      key_risks: Array.isArray(parsed.key_risks) ? parsed.key_risks.slice(0, 3) : [],
      confidence: parsed.confidence || 'medium',
      summary: parsed.summary || '',
      tokens_used,
    };

    adjustmentCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    console.log(`[AIInsights] Risk adjustment for ${nationName}: ${result.adjustment > 0 ? '+' : ''}${result.adjustment} (${result.confidence})`);
    return result;
  } catch (err) {
    console.warn(`[AIInsights] Risk adjustment failed for ${nationName}:`, err.message);
    return { adjustment: 0, key_risks: [], confidence: 'low', summary: '', tokens_used: null };
  }
}

module.exports = { getStrategicInsight, getRiskAdjustment };
