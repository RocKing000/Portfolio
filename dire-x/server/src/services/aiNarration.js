const axios = require('axios');
const { OPENROUTER_URL, AI_NARRATION_MAX_TOKENS, AI_NARRATION_TEMPERATURE, AI_NARRATION_TIMEOUT } = require('../config/server');

const MODEL = 'mistralai/mistral-7b-instruct:free';

const SYSTEM_PROMPT = `You are a Bloomberg-style geopolitical and economic analyst. Provide realistic, data-driven narration. Never generate numbers - only explain trends and causation. Be concise but authoritative.`;

/**
 * Generate AI-powered narration for simulation results.
 * Falls back to template-based narration if the API call fails.
 */
async function generateNarration({ events, metrics, scenario, decision }) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  // Build context for the prompt
  const eventDescriptions = (events || [])
    .map((e) => `- [${e.type.toUpperCase()}] ${e.title} (severity ${e.severity}/5): ${e.description}`)
    .join('\n');

  const userPrompt = buildUserPrompt({ events, eventDescriptions, metrics, scenario, decision });

  // Attempt API call if key is available
  if (apiKey) {
    try {
      const response = await axios.post(
        OPENROUTER_URL,
        {
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: AI_NARRATION_MAX_TOKENS,
          temperature: AI_NARRATION_TEMPERATURE,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://dire-x.app',
            'X-Title': 'DIRE-X Simulation Engine',
          },
          timeout: AI_NARRATION_TIMEOUT,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (content && content.trim().length > 0) {
        return content.trim();
      }
    } catch (apiErr) {
      console.warn('[AINarration] OpenRouter API call failed:', apiErr.message);
    }
  }

  // Fallback: template-based narration
  return buildFallbackNarration({ events, metrics, scenario, decision });
}

function buildUserPrompt({ events, eventDescriptions, metrics, scenario, decision }) {
  const scenarioLabels = {
    stable: 'Baseline/Stable',
    supply_crisis: 'Supply Chain Crisis',
    war: 'Armed Conflict / Geopolitical Escalation',
    drought: 'Severe Drought / Environmental Crisis',
  };

  let prompt = `Scenario: ${scenarioLabels[scenario] || scenario}\n`;
  prompt += `Decision taken: "${decision}"\n`;
  prompt += `Company SRES (risk score): ${metrics.companySRES || 'N/A'}\n\n`;

  if (events && events.length > 0) {
    prompt += `Events triggered this cycle:\n${eventDescriptions}\n\n`;
  } else {
    prompt += `No significant events triggered this cycle.\n\n`;
  }

  if (metrics.aggregatedImpact) {
    const imp = metrics.aggregatedImpact;
    prompt += `Impact assessment — Supply: ${imp.supply}, Economy: ${imp.economy}, Environment: ${imp.environment}, Stability: ${imp.stability}\n\n`;
  }

  if (metrics.resourceSRES && metrics.resourceSRES.length > 0) {
    prompt += `Top at-risk resources:\n`;
    for (const r of metrics.resourceSRES) {
      prompt += `- ${r.resource_name}: SRES ${r.sres} (dependency: ${Math.round((r.dependency || 0) * 100)}%)\n`;
    }
    prompt += '\n';
  }

  prompt += `Write a 2-3 paragraph analyst briefing on the implications of this decision under the given scenario. Focus on causation, cascading effects, and strategic outlook. Do not invent specific numbers.`;

  return prompt;
}

function buildFallbackNarration({ events, metrics, scenario, decision }) {
  const scenarioContext = {
    stable: 'Under baseline conditions',
    supply_crisis: 'Amid an intensifying supply chain crisis',
    war: 'Against the backdrop of escalating geopolitical conflict',
    drought: 'As severe drought conditions persist across key agricultural regions',
  };

  const opening = scenarioContext[scenario] || 'Under current conditions';
  const sresLevel = metrics.companySRES || 50;
  const riskLabel = sresLevel >= 70 ? 'critically elevated' : sresLevel >= 50 ? 'notably heightened' : 'moderately elevated';

  let narration = `${opening}, the decision to ${decision.toLowerCase()} has pushed the company's composite risk profile to ${riskLabel} levels. `;

  if (events && events.length > 0) {
    const highSeverity = events.filter((e) => e.severity >= 4);
    if (highSeverity.length > 0) {
      narration += `The simulation has triggered ${events.length} significant event${events.length > 1 ? 's' : ''}, `;
      narration += `including ${highSeverity.length} high-severity development${highSeverity.length > 1 ? 's' : ''} `;
      narration += `that could fundamentally reshape supply chain dynamics in the near term. `;
    } else {
      narration += `${events.length} event${events.length > 1 ? 's have' : ' has'} been triggered, `;
      narration += `signaling growing pressure across affected resource chains. `;
    }

    const supplyEvents = events.filter((e) => e.type === 'supply');
    const stabilityEvents = events.filter((e) => e.type === 'stability');

    if (supplyEvents.length > 0) {
      narration += `Supply-side disruptions dominate the event landscape, suggesting that procurement teams should accelerate contingency planning. `;
    }
    if (stabilityEvents.length > 0) {
      narration += `Political instability factors introduce additional uncertainty that may compound existing vulnerabilities. `;
    }
  } else {
    narration += `Current stress levels remain below critical event thresholds, though the trajectory warrants close monitoring. `;
  }

  if (metrics.aggregatedImpact) {
    const imp = metrics.aggregatedImpact;
    const maxDim = Object.entries(imp)
      .filter(([k]) => k !== 'total')
      .sort(([, a], [, b]) => b - a)[0];

    if (maxDim) {
      narration += `The most pronounced impact is concentrated in the ${maxDim[0]} dimension, `;
      narration += `indicating that strategic responses should prioritize ${maxDim[0]}-related resilience measures. `;
    }
  }

  narration += `Forward-looking indicators suggest that sustained attention to diversification and contingency reserves will be essential to navigating the evolving risk landscape.`;

  return narration;
}

module.exports = { generateNarration };
