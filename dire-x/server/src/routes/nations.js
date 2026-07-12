'use strict';

/**
 * GET /api/nations
 * Returns distinct nations derived from the companies table,
 * with display names resolved from countries_master.
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// GET /api/nations — all distinct nations from companies
router.get('/', async (_req, res) => {
  try {
    // 1. Get distinct country codes from companies
    const { data: companyRows, error: compErr } = await supabase
      .from('companies')
      .select('country');

    if (compErr) throw compErr;

    const codes = [...new Set((companyRows || []).map(r => r.country).filter(Boolean))];

    if (codes.length === 0) {
      return res.json({ data: [], count: 0 });
    }

    // 2. Resolve display names from countries_master
    const { data: masterRows, error: masterErr } = await supabase
      .from('countries_master')
      .select('code2, name')
      .in('code2', codes);

    if (masterErr) {
      console.warn('[GET /api/nations] countries_master lookup failed:', masterErr.message);
    }

    const nameMap = {};
    for (const row of masterRows || []) {
      nameMap[row.code2] = row.name;
    }

    const nations = codes
      .map(code => ({ code, name: nameMap[code] || code }))
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[GET /api/nations] Returning ${nations.length} nations`);
    res.json({ data: nations, count: nations.length });
  } catch (err) {
    console.error('[GET /api/nations] Failed:', err.message);
    res.status(500).json({ error: 'Failed to load nations' });
  }
});

module.exports = router;
