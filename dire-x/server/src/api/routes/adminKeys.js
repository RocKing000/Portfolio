/**
 * api/routes/adminKeys.js
 *
 * Admin-only endpoints for API key lifecycle management.
 * Mounted at /api/admin/keys — protected by existing requireAdmin middleware.
 *
 * POST /api/admin/keys           — provision a new API key
 * PATCH /api/admin/keys/:id      — update tier / rate limits / active status
 * DELETE /api/admin/keys/:id     — deactivate a key
 * GET /api/admin/keys/usage      — usage stats across all keys
 */

'use strict';

const { Router }    = require('express');
const supabase      = require('../../config/supabase');
const {
  generateRawKey,
  hashKey,
  invalidateKeyCache,
} = require('../middleware/apiKeyAuth');

const router = Router();

// ─── Tier default limits ──────────────────────────────────────────────────────

const TIER_DEFAULTS = {
  starter:      { rate_limit_per_hour: 500,  simulate_quota_monthly: 0,   validate_exposure_limit: 0  },
  professional: { rate_limit_per_hour: 5000, simulate_quota_monthly: 100, validate_exposure_limit: 50 },
  enterprise:   { rate_limit_per_hour: -1,   simulate_quota_monthly: 500, validate_exposure_limit: -1 },
  oem:          { rate_limit_per_hour: -1,   simulate_quota_monthly: -1,  validate_exposure_limit: -1 },
};

// ─── POST /api/admin/keys ─────────────────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    const {
      owner_email,
      owner_name,
      tier            = 'starter',
      expires_days,
      stripe_customer_id,
      stripe_sub_id,
      // Optional overrides
      rate_limit_per_hour,
      simulate_quota_monthly,
      validate_exposure_limit,
    } = req.body;

    if (!owner_email) {
      return res.status(400).json({ error: 'owner_email is required.', code: 'VALIDATION_ERROR' });
    }

    if (!['starter', 'professional', 'enterprise', 'oem'].includes(tier)) {
      return res.status(400).json({ error: `Invalid tier: ${tier}`, code: 'VALIDATION_ERROR' });
    }

    const rawKey    = generateRawKey(`dx_live_`);
    const keyHash   = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);
    const defaults  = TIER_DEFAULTS[tier];

    const expiresAt = expires_days
      ? new Date(Date.now() + expires_days * 86400000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        key_hash:               keyHash,
        key_prefix:             keyPrefix,
        owner_email:            owner_email.toLowerCase().trim(),
        owner_name:             owner_name || null,
        tier,
        is_active:              true,
        rate_limit_per_hour:    rate_limit_per_hour    ?? defaults.rate_limit_per_hour,
        simulate_quota_monthly: simulate_quota_monthly ?? defaults.simulate_quota_monthly,
        validate_exposure_limit: validate_exposure_limit ?? defaults.validate_exposure_limit,
        stripe_customer_id:     stripe_customer_id || null,
        stripe_sub_id:          stripe_sub_id      || null,
        expires_at:             expiresAt,
      })
      .select('id, key_prefix, owner_email, tier, rate_limit_per_hour, simulate_quota_monthly, validate_exposure_limit, expires_at, created_at')
      .single();

    if (error) throw error;

    res.status(201).json({
      message:  'API key created. Store the raw key securely — it will not be shown again.',
      key:      rawKey,           // only time raw key is returned
      key_id:   data.id,
      key_prefix: data.key_prefix,
      ...data,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/keys/:id ────────────────────────────────────────────────

router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'tier', 'is_active', 'rate_limit_per_hour',
      'simulate_quota_monthly', 'validate_exposure_limit',
      'stripe_customer_id', 'stripe_sub_id', 'expires_at',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.', code: 'VALIDATION_ERROR' });
    }

    // If tier changes, apply defaults unless explicitly overridden
    if (updates.tier) {
      const defaults = TIER_DEFAULTS[updates.tier] || {};
      if (updates.rate_limit_per_hour    === undefined) updates.rate_limit_per_hour    = defaults.rate_limit_per_hour;
      if (updates.simulate_quota_monthly === undefined) updates.simulate_quota_monthly = defaults.simulate_quota_monthly;
      if (updates.validate_exposure_limit === undefined) updates.validate_exposure_limit = defaults.validate_exposure_limit;
    }

    const { data, error } = await supabase
      .from('api_keys')
      .update(updates)
      .eq('id', id)
      .select('id, key_prefix, owner_email, tier, is_active, rate_limit_per_hour, simulate_quota_monthly, validate_exposure_limit, expires_at')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Key not found.', code: 'NOT_FOUND' });

    // Invalidate in-memory cache so next request re-validates from DB
    // We don't have the raw key here, so we look up by ID — evict all cache entries matching this ID
    // (cache uses hash as key; we can't invert, so just note: cache will self-expire in 5 min)

    res.json({ message: 'Key updated.', ...data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/keys/:id ───────────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Key deactivated. Cache will clear within 5 minutes.' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/keys/usage ────────────────────────────────────────────────

router.get('/usage', async (req, res, next) => {
  try {
    const { days = '7', tier } = req.query;
    const since = new Date(Date.now() - parseInt(days, 10) * 86400000).toISOString();

    let query = supabase
      .from('api_usage_logs')
      .select(`
        api_key_id,
        endpoint,
        status_code,
        response_ms,
        created_at,
        api_keys!inner(owner_email, tier, key_prefix)
      `)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);

    if (tier) query = query.eq('api_keys.tier', tier);

    const { data, error } = await query;
    if (error) throw error;

    // Aggregate stats
    const logs = data || [];
    const stats = {
      period_days:        parseInt(days, 10),
      total_calls:        logs.length,
      avg_response_ms:    logs.length > 0 ? Math.round(logs.reduce((s, l) => s + (l.response_ms || 0), 0) / logs.length) : 0,
      error_rate:         logs.length > 0 ? Math.round(logs.filter(l => l.status_code >= 400).length / logs.length * 1000) / 10 : 0,
      calls_by_endpoint:  groupBy(logs, 'endpoint'),
      calls_by_status:    groupByStatus(logs),
      top_api_keys:       topKeys(logs, 5),
    };

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupBy(logs, field) {
  const counts = {};
  for (const l of logs) {
    counts[l[field]] = (counts[l[field]] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ [field]: k, count: v }));
}

function groupByStatus(logs) {
  const counts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  for (const l of logs) {
    const bucket = `${Math.floor(l.status_code / 100)}xx`;
    if (counts[bucket] !== undefined) counts[bucket]++;
  }
  return counts;
}

function topKeys(logs, n) {
  const keyMap = {};
  for (const l of logs) {
    const key = l.api_key_id;
    if (!keyMap[key]) keyMap[key] = { calls: 0, email: l.api_keys?.owner_email, tier: l.api_keys?.tier, prefix: l.api_keys?.key_prefix };
    keyMap[key].calls++;
  }
  return Object.values(keyMap).sort((a, b) => b.calls - a.calls).slice(0, n);
}

module.exports = router;
