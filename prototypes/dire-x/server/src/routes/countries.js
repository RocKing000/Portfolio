'use strict';

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { getLastUpdateTimestamp } = require('../services/dataIngestion');

// GET /api/countries/status — lightweight ping for last-updated timestamp
router.get('/status', async (_req, res) => {
  try {
    const lastUpdated = await getLastUpdateTimestamp();
    res.json({ lastUpdated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/countries/ranking/gdp — top countries ranked by GDP from DB
router.get('/ranking/gdp', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 250);

    const { data, error } = await supabase
      .from('countries_master')
      .select('code, code2, name, gdp, gdp_norm, growth_rate, population, eco_score, region, last_updated')
      .not('gdp', 'is', null)
      .order('gdp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const lastUpdated = await getLastUpdateTimestamp();
    const ranked = (data || []).map((c, i) => ({ ...c, rank: i + 1 }));

    res.json({ ranking: ranked, count: ranked.length, lastUpdated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/countries — all countries (simulation reads from here, not live APIs)
router.get('/', async (req, res) => {
  try {
    const { region, limit = 250 } = req.query;

    let query = supabase
      .from('countries_master')
      .select('*')
      .order('gdp', { ascending: false, nullsFirst: false })
      .limit(parseInt(limit, 10));

    if (region) {
      query = query.eq('region', region);
    }

    const { data, error } = await query;
    if (error) throw error;

    const lastUpdated = await getLastUpdateTimestamp();
    res.json({ countries: data || [], count: (data || []).length, lastUpdated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/countries/:code — single country by ISO3 code
router.get('/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { data, error } = await supabase
      .from('countries_master')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: `Country "${code}" not found` });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
