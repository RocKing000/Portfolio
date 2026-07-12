/**
 * lib/openrouter.js
 * Reusable OpenRouter API client for DIRE-X
 */

const axios = require('axios');
const { OPENROUTER_URL, AI_DEFAULT_TIMEOUT, AI_DEFAULT_MAX_TOKENS, AI_DEFAULT_TEMPERATURE } = require('../config/server');

const DEFAULT_TIMEOUT = AI_DEFAULT_TIMEOUT;

/**
 * Send a chat completion request to OpenRouter.
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options
 * @param {string}  options.model     - OpenRouter model ID
 * @param {number}  options.maxTokens - Max tokens in response
 * @param {number}  options.temperature
 * @param {number}  options.timeout   - Request timeout in ms
 * @returns {Promise<{content: string, tokens_used: number|null}>}
 */
async function generateAIResponse(messages, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const {
    model = process.env.AI_MODEL || process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku',
    maxTokens = AI_DEFAULT_MAX_TOKENS,
    temperature = AI_DEFAULT_TEMPERATURE,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  const response = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://dire-x.app',
        'X-Title': 'DIRE-X Intelligence Platform',
      },
      timeout,
    }
  );

  const choice = response.data?.choices?.[0];
  const content = choice?.message?.content?.trim() || '';
  const tokens_used = response.data?.usage?.total_tokens ?? null;

  return { content, tokens_used };
}

module.exports = { generateAIResponse };
