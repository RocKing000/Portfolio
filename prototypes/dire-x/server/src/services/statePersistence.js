// ============================================
// State Persistence — Snapshot/restore world state to Supabase
// Prevents data loss on server restart/crash
// ============================================

const { supabaseAdmin } = require('../config/supabase');

/**
 * Save current world state to Supabase.
 * Called periodically (every N ticks) and before destructive operations.
 */
async function snapshotState(worldState) {
  if (!supabaseAdmin) {
    console.warn('[Persistence] Supabase admin not configured, skipping snapshot');
    return null;
  }

  try {
    const companies = {};
    for (const [id, c] of worldState.companies) {
      companies[id] = {
        id: c.id,
        name: c.name,
        industry: c.industry,
        country: c.country,
        strategy: c.strategy,
        scale: c.scale,
        resources: c.resources,
        metrics: c.metrics,
        sresScore: c.sresScore,
        scores: c.scores,
        economics: c.economics,
        workforce: c.workforce,
        pipeline: c.pipeline,
        strategicActions: c.strategicActions || [],
        decisionHistory: (c.decisionHistory || []).slice(-50), // keep last 50
        crisesSurvived: c.crisesSurvived || 0,
        createdAt: c.createdAt,
      };
    }

    const snapshot = {
      id: 'singleton',
      current_day: worldState.currentDay,
      market_state: worldState.marketState,
      public_pressure: worldState.publicPressure,
      governance_policies: worldState.governancePolicies || [],
      environmental_debt: worldState.environmentalDebt || 0,
      companies: JSON.stringify(companies),
      scenario_state: JSON.stringify(worldState.scenarioEngine.getState()),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from('simulation_state')
      .upsert(snapshot, { onConflict: 'id' });

    if (error) {
      console.warn('[Persistence] Snapshot upsert failed:', error.message);
      return null;
    }

    console.log(`[Persistence] Snapshot saved at day ${worldState.currentDay} (${worldState.companies.size} companies)`);
    return snapshot.updated_at;
  } catch (err) {
    console.warn('[Persistence] Snapshot error:', err.message);
    return null;
  }
}

/**
 * Restore world state from Supabase on startup.
 * Returns true if state was restored, false if starting fresh.
 */
async function hydrateState(worldState) {
  if (!supabaseAdmin) {
    console.log('[Persistence] Supabase admin not configured, starting fresh');
    return false;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('simulation_state')
      .select('*')
      .eq('id', 'singleton')
      .single();

    if (error || !data) {
      console.log('[Persistence] No saved state found, starting fresh');
      return false;
    }

    // Restore scalar state
    worldState.currentDay = data.current_day || 0;
    worldState.marketState = data.market_state || worldState.marketState;
    worldState.publicPressure = data.public_pressure || worldState.publicPressure;
    worldState.governancePolicies = data.governance_policies || [];
    worldState.environmentalDebt = data.environmental_debt || 0;

    // Restore companies (safe parse)
    let companies = {};
    try {
      companies = typeof data.companies === 'string'
        ? JSON.parse(data.companies)
        : data.companies || {};
    } catch (parseErr) {
      console.warn('[Persistence] Failed to parse companies, starting with empty:', parseErr.message);
    }

    for (const [id, companyData] of Object.entries(companies)) {
      worldState.companies.set(id, companyData);
    }

    // Restore scenario state (if scenarios support rehydration)
    // Scenarios are harder to rehydrate — start fresh but keep day counter
    // Future: serialize/deserialize active scenarios

    console.log(
      `[Persistence] Restored state: day ${data.current_day}, ` +
      `${worldState.companies.size} companies, ` +
      `last saved ${data.updated_at}`
    );
    return true;
  } catch (err) {
    console.warn('[Persistence] Hydration failed:', err.message);
    return false;
  }
}

/**
 * Auto-snapshot helper — call inside worldState.tick().
 * Snapshots every N ticks.
 */
function maybeSnapshot(worldState, intervalTicks = 5) {
  if (worldState.currentDay > 0 && worldState.currentDay % intervalTicks === 0) {
    // Fire-and-forget
    snapshotState(worldState).catch(() => {});
  }
}

module.exports = { snapshotState, hydrateState, maybeSnapshot };
