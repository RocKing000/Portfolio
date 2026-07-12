/**
 * api/middleware/usageTracker.js
 *
 * Two responsibilities:
 *   1. RATE LIMITING  — sliding 1-hour window, in-memory with Supabase sync
 *   2. USAGE LOGGING  — async, fire-and-forget, never blocks the request
 *
 * Rate limit state: Map<apiKeyId, { count, windowStart }> (reset hourly)
 * On server restart the window resets; durable fallback in api_rate_limit_counters.
 */

'use strict';

const crypto  = require('crypto');
const supabase = require('../../config/supabase');

// ─── In-memory rate limit store ───────────────────────────────────────────────

const WINDOW_MS = 60 * 60 * 1000;  // 1 hour

/** @type {Map<string, { count: number, windowStart: number }>} */
const rateLimitStore = new Map();

function getRateLimitState(apiKeyId) {
  const now    = Date.now();
  const state  = rateLimitStore.get(apiKeyId);

  // New or expired window
  if (!state || (now - state.windowStart) >= WINDOW_MS) {
    const fresh = { count: 0, windowStart: now };
    rateLimitStore.set(apiKeyId, fresh);
    return fresh;
  }
  return state;
}

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * Usage tracker middleware.
 * Must run AFTER apiKeyAuth (req.apiKey must be populated).
 */
function usageTracker(req, res, next) {
  const apiKey = req.apiKey;
  if (!apiKey) return next();  // shouldn't happen, but guard

  const limit = apiKey.rate_limit_per_hour;
  const state = getRateLimitState(apiKey.id);

  // -1 = unlimited
  if (limit !== -1 && state.count >= limit) {
    const resetAt = new Date(state.windowStart + WINDOW_MS).toISOString();
    return res.status(429).json({
      error: `Rate limit exceeded. ${limit} requests/hour on ${apiKey.tier} tier.`,
      code: 'RATE_LIMIT_EXCEEDED',
      limit,
      used: state.count,
      reset_at: resetAt,
      upgrade_url: 'https://direx.io/pricing',
    });
  }

  // Increment counter
  state.count += 1;

  // Attach usage headers to response
  res.setHeader('X-RateLimit-Limit',     limit === -1 ? 'unlimited' : limit);
  res.setHeader('X-RateLimit-Remaining', limit === -1 ? 'unlimited' : Math.max(0, limit - state.count));
  res.setHeader('X-RateLimit-Reset',     new Date(state.windowStart + WINDOW_MS).toISOString());

  // Intercept response to log status + timing
  const startMs = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    const responseMs = Date.now() - startMs;

    // Fire-and-forget usage log
    logUsage({
      apiKeyId:    apiKey.id,
      endpoint:    req.route?.path || req.path,
      method:      req.method,
      statusCode:  res.statusCode,
      responseMs,
      requestBody: sanitizeBody(req.body),
      ipHash:      hashIp(req.ip || req.socket?.remoteAddress),
    }).catch(() => {});

    return originalJson(body);
  };

  next();
}

// ─── Async log writer ─────────────────────────────────────────────────────────

async function logUsage({ apiKeyId, endpoint, method, statusCode, responseMs, requestBody, ipHash }) {
  await supabase.from('api_usage_logs').insert({
    api_key_id:   apiKeyId,
    endpoint,
    method,
    status_code:  statusCode,
    response_ms:  responseMs,
    request_body: requestBody,
    ip_hash:      ipHash,
    created_at:   new Date().toISOString(),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return null;
  // Remove potentially sensitive fields before logging
  const STRIP_FIELDS = ['password', 'token', 'secret', 'key', 'card', 'ssn'];
  const cleaned = { ...body };
  for (const field of STRIP_FIELDS) {
    if (cleaned[field]) cleaned[field] = '[REDACTED]';
  }
  return cleaned;
}

// ─── Quota checkers (used in specific routes) ─────────────────────────────────

/**
 * Check remaining simulate-scenario calls for the current calendar month.
 * Returns { allowed: boolean, used: number, quota: number }
 */
async function checkSimulateQuota(apiKey) {
  if (apiKey.simulate_quota_monthly === -1) return { allowed: true, used: 0, quota: -1 };
  if (apiKey.simulate_quota_monthly === 0)  return { allowed: false, used: 0, quota: 0 };

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('api_usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('api_key_id', apiKey.id)
    .eq('endpoint', '/simulate-scenario')
    .gte('created_at', monthStart.toISOString());

  if (error) return { allowed: true, used: 0, quota: apiKey.simulate_quota_monthly }; // fail open

  return {
    allowed: count < apiKey.simulate_quota_monthly,
    used:    count,
    quota:   apiKey.simulate_quota_monthly,
  };
}

module.exports = { usageTracker, checkSimulateQuota };
