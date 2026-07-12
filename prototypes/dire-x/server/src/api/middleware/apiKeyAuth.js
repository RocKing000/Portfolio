/**
 * api/middleware/apiKeyAuth.js
 *
 * Validates API keys for the /api/v1/ data product layer.
 * Keys are stored as SHA-256 hashes in Supabase; raw keys never persist.
 *
 * Flow:
 *   1. Extract key from Authorization header: "Bearer dx_live_xxxxx"
 *   2. Hash the key → look up in api_keys table
 *   3. Check active, not expired, tier resolved
 *   4. Attach { apiKey } to req for downstream use
 *
 * Tier feature gates are enforced here (not in routes).
 */

'use strict';

const crypto  = require('crypto');
const supabase = require('../../config/supabase');

// ─── In-memory key cache ──────────────────────────────────────────────────────
// Avoids a DB round-trip on every request. TTL = 5 minutes.
// Map<keyHash, { record, cachedAt }>

const KEY_CACHE_TTL_MS = 5 * 60 * 1000;
const keyCache = new Map();

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

async function resolveKey(rawKey) {
  const hash = hashKey(rawKey);

  // Cache hit
  const cached = keyCache.get(hash);
  if (cached && (Date.now() - cached.cachedAt) < KEY_CACHE_TTL_MS) {
    return cached.record;
  }

  // DB lookup
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, key_hash, key_prefix, owner_email, owner_name, tier, is_active, rate_limit_per_hour, simulate_quota_monthly, validate_exposure_limit, expires_at')
    .eq('key_hash', hash)
    .single();

  if (error || !data) return null;

  keyCache.set(hash, { record: data, cachedAt: Date.now() });
  return data;
}

// ─── Main middleware ──────────────────────────────────────────────────────────

async function apiKeyAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing API key. Include: Authorization: Bearer <your_key>',
      code: 'AUTH_MISSING',
    });
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith('dx_')) {
    return res.status(401).json({
      error: 'Invalid API key format. Keys begin with dx_',
      code: 'AUTH_FORMAT',
    });
  }

  const keyRecord = await resolveKey(rawKey).catch(() => null);

  if (!keyRecord) {
    return res.status(401).json({
      error: 'API key not found or invalid.',
      code: 'AUTH_INVALID',
    });
  }

  if (!keyRecord.is_active) {
    return res.status(403).json({
      error: 'This API key has been deactivated.',
      code: 'AUTH_INACTIVE',
    });
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return res.status(403).json({
      error: 'This API key has expired. Please renew your subscription.',
      code: 'AUTH_EXPIRED',
    });
  }

  // Attach to request for downstream middleware and routes
  req.apiKey = keyRecord;

  // Fire-and-forget: update last_used_at (non-blocking, best-effort)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)
    .then(() => {})
    .catch(() => {});

  next();
}

// ─── Feature gate helpers (used in routes) ────────────────────────────────────

const TIER_RANK = { starter: 0, professional: 1, enterprise: 2, oem: 3 };

function requireTier(minTier) {
  return (req, res, next) => {
    const keyTier = req.apiKey?.tier;
    if (!keyTier || TIER_RANK[keyTier] === undefined) {
      return res.status(403).json({ error: 'Cannot resolve API key tier.', code: 'TIER_UNKNOWN' });
    }
    if (TIER_RANK[keyTier] < TIER_RANK[minTier]) {
      return res.status(403).json({
        error: `This endpoint requires a ${minTier} tier key or above. Your tier: ${keyTier}.`,
        code: 'TIER_INSUFFICIENT',
        upgrade_url: 'https://direx.io/pricing',
      });
    }
    next();
  };
}

// Invalidate cached entry (call after key update/deactivation)
function invalidateKeyCache(rawKey) {
  keyCache.delete(hashKey(rawKey));
}

// For tests / admin: generate a new raw key
function generateRawKey(prefix = 'dx_live_') {
  return prefix + crypto.randomBytes(24).toString('hex');
}

module.exports = { apiKeyAuth, requireTier, invalidateKeyCache, generateRawKey, hashKey };
