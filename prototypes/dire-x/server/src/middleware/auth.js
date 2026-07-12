// ============================================
// Auth Middleware — Session management, ownership, admin access
// ============================================

const crypto = require('crypto');

// Session store (in production, use Redis or Supabase)
const sessions = new Map();

// Admin key from env or generated on startup
const ADMIN_KEY = process.env.ADMIN_API_KEY || crypto.randomBytes(32).toString('hex');

// Session cleanup interval (every 30 minutes, remove sessions older than 24h)
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_MAX_AGE) {
      sessions.delete(token);
    }
  }
}, 30 * 60 * 1000);

function generateSessionToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Player session middleware.
 * Auto-creates a session if none provided.
 * Attaches req.session with { id, companyIds, createdAt, requestCount }.
 */
function playerSession(req, res, next) {
  let token = req.headers['x-session-token'];

  if (!token || !sessions.has(token)) {
    token = generateSessionToken();
    sessions.set(token, {
      id: token,
      companyIds: [],
      createdAt: Date.now(),
      lastActive: Date.now(),
      requestCount: 0,
    });
    res.setHeader('X-Session-Token', token);
  }

  const session = sessions.get(token);
  session.requestCount++;
  session.lastActive = Date.now();
  req.session = session;
  next();
}

/**
 * Ownership check middleware factory.
 * Ensures the requesting session owns the target company.
 * @param {string} companyIdParam — where to find companyId (body, params, or query)
 */
function requireOwnership(companyIdParam = 'companyId') {
  return (req, res, next) => {
    const companyId =
      req.params[companyIdParam] ||
      req.body?.[companyIdParam] ||
      req.query?.[companyIdParam];

    // If no company context, skip ownership check
    if (!companyId) return next();

    // Admin bypasses ownership
    if (req.headers['x-admin-key'] === ADMIN_KEY) return next();

    if (!req.session || !req.session.companyIds.includes(companyId)) {
      return res.status(403).json({
        error: 'You do not own this company',
        code: 'OWNERSHIP_REQUIRED',
      });
    }

    next();
  };
}

/**
 * Register a company as owned by the current session.
 */
function registerOwnership(session, companyId) {
  if (session && companyId && !session.companyIds.includes(companyId)) {
    session.companyIds.push(companyId);
  }
}

/**
 * Admin-only endpoint protection.
 */
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({
      error: 'Admin API key required',
      code: 'ADMIN_REQUIRED',
    });
  }
  next();
}

module.exports = {
  playerSession,
  requireOwnership,
  registerOwnership,
  requireAdmin,
  sessions,
  ADMIN_KEY,
};
