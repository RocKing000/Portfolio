'use strict';

/**
 * GET /api/strategic-resources
 * GET /api/strategic-resources?companyId=<uuid>
 *
 * Returns strategic resources, optionally filtered by company dependency.
 * Falls back to mock data if Supabase is unavailable.
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

const MOCK_RESOURCES = [
  { id: 'mock-1', name: 'Lithium',             category: 'critical_minerals',    unit: 'tonne',  strategic_importance: 0.95, supply_risk: 0.80 },
  { id: 'mock-2', name: 'Cobalt',              category: 'critical_minerals',    unit: 'tonne',  strategic_importance: 0.90, supply_risk: 0.88 },
  { id: 'mock-3', name: 'Rare Earth Elements', category: 'critical_minerals',    unit: 'tonne',  strategic_importance: 0.95, supply_risk: 0.90 },
  { id: 'mock-4', name: 'Semiconductors',      category: 'technology_materials', unit: 'wafer',  strategic_importance: 0.98, supply_risk: 0.87 },
  { id: 'mock-5', name: 'Crude Oil',           category: 'energy_resources',     unit: 'barrel', strategic_importance: 0.90, supply_risk: 0.70 },
  { id: 'mock-6', name: 'Natural Gas',         category: 'energy_resources',     unit: 'MMBtu',  strategic_importance: 0.85, supply_risk: 0.65 },
  { id: 'mock-7', name: 'Copper',              category: 'industrial_metals',    unit: 'tonne',  strategic_importance: 0.88, supply_risk: 0.62 },
  { id: 'mock-8', name: 'Nickel',              category: 'critical_minerals',    unit: 'tonne',  strategic_importance: 0.80, supply_risk: 0.65 },
];

// GET /api/strategic-resources[?companyId=uuid]
router.get('/', async (req, res) => {
  const { companyId } = req.query;

  try {
    if (companyId) {
      // Resources for a specific company via company_resources join
      console.log(`[GET /api/strategic-resources] Fetching resources for company: ${companyId}`);

      const { data, error } = await supabase
        .from('company_resources')
        .select(`
          dependency_score,
          resources (
            id,
            name,
            category,
            unit,
            strategic_importance,
            supply_risk,
            geopolitical_sensitivity,
            refining_dependency,
            description
          )
        `)
        .eq('company_id', companyId)
        .order('dependency_score', { ascending: false });

      if (error) throw error;

      const resources = (data || []).map((row) => ({
        ...row.resources,
        dependency_score: row.dependency_score,
      }));

      console.log(`[GET /api/strategic-resources] Returning ${resources.length} resources for company ${companyId}`);
      return res.json({ data: resources, count: resources.length });
    }

    // All resources
    console.log('[GET /api/strategic-resources] Fetching all strategic resources');

    const { data, error } = await supabase
      .from('resources')
      .select('id, name, category, unit, strategic_importance, supply_risk, geopolitical_sensitivity, description')
      .order('strategic_importance', { ascending: false });

    if (error) throw error;

    console.log(`[GET /api/strategic-resources] Returning ${(data || []).length} resources`);
    res.json({ data: data || [], count: (data || []).length });
  } catch (err) {
    console.warn('[GET /api/strategic-resources] DB unavailable, using mock data:', err.message);
    res.json({ data: MOCK_RESOURCES, count: MOCK_RESOURCES.length, mock: true });
  }
});

module.exports = router;
