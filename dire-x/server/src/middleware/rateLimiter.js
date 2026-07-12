// ============================================
// Rate Limiter — Per-session sliding window rate limiting
// ============================================

const WINDOW_MS = 60_000; // 1 minute

const LIMITS = {
  default: 60,
  simulate: 10,
  createCompany: 5,
  triggerScenario: 2,
  reset: 1,
  aiInsight: 15,
  audit: 5,
  strategicAction: 10,
  tick: 30,
  pipeline: 2,
};

// sessionKey → [timestamps]
const requestLog = new Map();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requestLog) {
    const fresh = timestamps.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, fresh);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter middleware factory.
 * @param {string} category — one of LIMITS keys
 */
function rateLimiter(category = 'default') {
  const limit = LIMITS[category] || LIMITS.default;

  return (req, res, next) => {
    const sessionId = req.session?.id || req.ip || 'anonymous';
    const key = `${sessionId}:${category}`;
    const now = Date.now();

    if (!requestLog.has(key)) requestLog.set(key, []);

    // Trim expired entries
    const log = requestLog.get(key).filter((t) => now - t < WINDOW_MS);
    requestLog.set(key, log);

    if (log.length >= limit) {
      const retryAfter = Math.ceil((log[0] + WINDOW_MS - now) / 1000);
      return res.status(429).json({
        error: `Rate limit exceeded: max ${limit} requests per minute for ${category}`,
        code: 'RATE_LIMITED',
        retryAfter,
      });
    }

    log.push(now);
    next();
  };
}

module.exports = { rateLimiter, LIMITS };
