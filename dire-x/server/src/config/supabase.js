'use strict';

const { createClient } = require('@supabase/supabase-js');

// ── Required env vars ─────────────────────────────────────────────────────────
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[DIRE-X] Missing required env vars: ${missing.join(', ')}`);
  console.error('[DIRE-X] Copy dire-x/server/.env.example → .env and fill in values.');
  // Don't crash — allow server to start in degraded mode (mock fallback handles UI)
}

const url = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;

/**
 * Anon client — safe for public queries (respects RLS policies).
 */
const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

/**
 * Admin client — uses SERVICE_ROLE key, bypasses RLS.
 * Use ONLY for seed scripts and admin operations — never expose to client.
 */
const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

module.exports = { supabase, supabaseAdmin };
