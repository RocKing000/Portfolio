const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { CACHE_TTL_COMPANIES } = require('../config/server');

// Simple in-memory cache
const cache = {};
const CACHE_TTL = CACHE_TTL_COMPANIES;

function getCached(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCached(key, data) {
  cache[key] = { data, ts: Date.now() };
}

// GET /companies[?nationId=ISO2] — fetch companies, optionally filtered by nation (ISO2 code)
router.get('/', async (req, res, next) => {
  const { nationId } = req.query;
  const cacheKey = `companies:${nationId || 'all'}`;

  const cached = getCached(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'private, max-age=30');
    return res.json(cached);
  }

  try {
    let companyQuery = supabase
      .from('companies')
      .select('*')
      .order('name', { ascending: true });

    if (nationId) companyQuery = companyQuery.eq('country', nationId);

    // Fetch companies and resources in parallel
    const [compResult, crResult] = await Promise.all([
      companyQuery,
      supabase.from('company_resources').select(`
        id,
        company_id,
        resource_id,
        dependency_score,
        resources (
          id,
          name,
          category,
          unit
        )
      `),
    ]);

    if (compResult.error) throw compResult.error;
    if (crResult.error) throw crResult.error;

    const resourcesByCompany = {};
    for (const cr of crResult.data || []) {
      if (!resourcesByCompany[cr.company_id]) resourcesByCompany[cr.company_id] = [];
      resourcesByCompany[cr.company_id].push({
        id: cr.resource_id,
        name: cr.resources?.name || 'Unknown',
        category: cr.resources?.category || 'unknown',
        unit: cr.resources?.unit || 'unit',
        dependency_score: cr.dependency_score,
      });
    }

    const result = (compResult.data || []).map((c) => ({
      ...c,
      resources: resourcesByCompany[c.id] || [],
    }));

    const payload = { data: result, count: result.length };
    setCached(cacheKey, payload);
    res.set('Cache-Control', 'private, max-age=30');
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// GET /companies/:id — fetch single company with full detail
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  const cacheKey = `company:${id}`;

  const cached = getCached(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'private, max-age=30');
    return res.json(cached);
  }

  try {
    // Fetch company + resources in parallel
    const [compResult, crResult, snapResult] = await Promise.all([
      supabase.from('companies').select('*').eq('id', id).single(),
      supabase.from('company_resources').select(`
        id,
        resource_id,
        dependency_score,
        resources (
          id,
          name,
          category,
          unit
        )
      `).eq('company_id', id),
      supabase.from('data_snapshots').select('*').order('created_at', { ascending: false }).limit(1).single(),
    ]);

    if (compResult.error) {
      if (compResult.error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Company not found', code: 'NOT_FOUND' });
      }
      throw compResult.error;
    }
    if (crResult.error) throw crResult.error;

    const resourceIds = (crResult.data || []).map((cr) => cr.resource_id);

    let riskMetrics = [];
    if (resourceIds.length > 0) {
      const { data: metrics, error: metError } = await supabase
        .from('risk_metrics')
        .select('*')
        .in('resource_id', resourceIds)
        .order('updated_at', { ascending: false });
      if (metError) throw metError;
      riskMetrics = metrics || [];
    }

    const resources = (crResult.data || []).map((cr) => {
      const metric = riskMetrics.find((m) => m.resource_id === cr.resource_id);
      return {
        id: cr.resource_id,
        name: cr.resources?.name || 'Unknown',
        category: cr.resources?.category || 'unknown',
        unit: cr.resources?.unit || 'unit',
        dependency_score: cr.dependency_score,
        risk_metrics: metric || null,
      };
    });

    const payload = {
      data: {
        ...compResult.data,
        resources,
        latest_snapshot: (snapResult.error?.code === 'PGRST116' ? null : snapResult.data) || null,
      },
    };

    setCached(cacheKey, payload);
    res.set('Cache-Control', 'private, max-age=30');
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
