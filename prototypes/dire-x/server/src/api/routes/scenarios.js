/**
 * api/routes/scenarios.js
 *
 * GET  /api/v1/scenarios            — paginated scenario catalog
 * GET  /api/v1/scenarios/:id        — single scenario with cascade phases
 * GET  /api/v1/scenarios/search     — full-text + filter search
 */

'use strict';

const { Router } = require('express');
const supabase   = require('../../config/supabase');
const { applyTimeDecay } = require('../services/scoringService');

const router = Router();

// ─── Simple in-memory cache (TTL 5 min) ──────────────────────────────────────
const cache    = new Map();
const CACHE_MS = 5 * 60 * 1000;

function cacheGet(key)       { const e = cache.get(key); return e && (Date.now() - e.t) < CACHE_MS ? e.v : null; }
function cacheSet(key, val)  { cache.set(key, { v: val, t: Date.now() }); }

// ─── GET /scenarios ───────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const {
      page     = '1',
      limit    = '20',
      event_type,
      region,
      industry,
      min_risk,
      max_risk,
      trust_tier,
      is_live,
      sort     = 'risk_score',
      order    = 'desc',
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page,  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const from     = (pageNum - 1) * limitNum;
    const to       = from + limitNum - 1;

    // Validate sort column whitelist
    const ALLOWED_SORT = ['risk_score', 'direct_impact_score', 'confidence_score', 'created_at', 'time_to_impact_days', 'recovery_time_days'];
    const sortCol  = ALLOWED_SORT.includes(sort) ? sort : 'risk_score';
    const sortAsc  = order === 'asc';

    // Build cache key
    const cacheKey = `scenarios_list:${JSON.stringify(req.query)}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let query = supabase
      .from('dp_scenarios')
      .select(
        'scenario_id, event_type, event_subtype, region, country_codes, industry, ' +
        'company_exposure_level, direct_impact_score, indirect_impact_score, risk_score, ' +
        'confidence_score, time_to_impact_days, recovery_time_days, hidden_dependency_pct, ' +
        'policy_impact, manipulation_risk, trust_tier, is_live, created_at, affected_resources',
        { count: 'exact' }
      )
      .order(sortCol, { ascending: sortAsc })
      .range(from, to);

    if (event_type)  query = query.ilike('event_type', `%${event_type}%`);
    if (region)      query = query.ilike('region', `%${region}%`);
    if (industry)    query = query.ilike('industry', `%${industry}%`);
    if (min_risk)    query = query.gte('risk_score', parseInt(min_risk, 10));
    if (max_risk)    query = query.lte('risk_score', parseInt(max_risk, 10));
    if (trust_tier)  query = query.eq('trust_tier', trust_tier);
    if (is_live !== undefined) query = query.eq('is_live', is_live === 'true');

    const { data, error, count } = await query;
    if (error) throw error;

    // Apply time-decay to returned scores
    const enriched = (data || []).map(row => {
      const decay = applyTimeDecay(row.risk_score, row.created_at);
      return {
        ...row,
        risk_score_live:         decay.adjustedScore,
        days_since_generation:   decay.daysSinceGeneration,
        stale_flag:              decay.staleFlag,
      };
    });

    const response = {
      data:       enriched,
      pagination: {
        page:       pageNum,
        limit:      limitNum,
        total:      count ?? 0,
        pages:      Math.ceil((count ?? 0) / limitNum),
        from:       from + 1,
        to:         Math.min(to + 1, count ?? 0),
      },
      meta: {
        sort:   sortCol,
        order:  sortAsc ? 'asc' : 'desc',
        filters_applied: Object.fromEntries(
          Object.entries({ event_type, region, industry, min_risk, max_risk, trust_tier, is_live })
            .filter(([, v]) => v !== undefined)
        ),
      },
    };

    cacheSet(cacheKey, response);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ─── GET /scenarios/search ────────────────────────────────────────────────────

router.get('/search', async (req, res, next) => {
  try {
    const { q, limit = '10' } = req.query;
    if (!q || q.trim().length < 3) {
      return res.status(400).json({
        error: 'Query parameter `q` must be at least 3 characters.',
        code:  'SEARCH_QUERY_TOO_SHORT',
      });
    }

    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    // Supabase full-text search
    const { data, error } = await supabase
      .from('dp_scenarios')
      .select('scenario_id, event_type, region, industry, risk_score, confidence_score, scenario_notes')
      .textSearch('scenario_notes', q, { type: 'websearch', config: 'english' })
      .order('risk_score', { ascending: false })
      .limit(limitNum);

    if (error) throw error;

    res.json({ query: q, results: data || [], count: (data || []).length });
  } catch (err) {
    next(err);
  }
});

// ─── GET /scenarios/:id ───────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { include_cascades = 'true', vertical } = req.query;

    // Validate ID format
    if (!/^[A-Z0-9\-]{4,20}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid scenario_id format.', code: 'INVALID_ID' });
    }

    const cacheKey = `scenario:${id}:${include_cascades}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    // Fetch scenario
    const { data: scenario, error: scError } = await supabase
      .from('dp_scenarios')
      .select('*')
      .eq('scenario_id', id)
      .single();

    if (scError || !scenario) {
      return res.status(404).json({
        error: `Scenario ${id} not found.`,
        code:  'SCENARIO_NOT_FOUND',
      });
    }

    // Optionally fetch cascade phases
    let cascadePhases = [];
    if (include_cascades === 'true') {
      const { data: phases } = await supabase
        .from('dp_cascade_phases')
        .select('*')
        .eq('scenario_id', id)
        .order('phase_days', { ascending: true });
      cascadePhases = phases || [];
    }

    // Apply time-decay
    const decay = applyTimeDecay(scenario.risk_score, scenario.created_at);

    const response = {
      ...scenario,
      risk_score_live:       decay.adjustedScore,
      days_since_generation: decay.daysSinceGeneration,
      stale_flag:            decay.staleFlag,
      cascade_phases:        cascadePhases,
      _links: {
        self:           `/api/v1/scenarios/${id}`,
        dependency_map: `/api/v1/dependency-map?scenario_id=${id}`,
      },
    };

    cacheSet(cacheKey, response);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
