/**
 * dataIngestion.js
 * Real-world data ingestion, normalization, derived metrics, and DB storage.
 *
 * Pipeline:
 *   fetchCountries + fetchGDP + fetchPopulation + fetchGrowthRate + fetchLiteracy + fetchHealth
 *   → normalizeCountries → computeDerivedMetrics → upsertCountriesMaster
 *
 * All API calls are wrapped in try/catch. Missing values fall back to existing DB data.
 * No external APIs are called during simulation — simulation reads only from DB.
 */

'use strict';

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const WB_BASE = process.env.WORLD_BANK_BASE_URL || 'https://api.worldbank.org/v2';
const REST_COUNTRIES_URL =
  'https://restcountries.com/v3.1/all?fields=name,cca2,cca3,region,subregion,population';
const FETCH_TIMEOUT_MS = 15000;
const CACHE_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours
const WORKING_AGE_RATIO = 0.60;
const BATCH_SIZE = 50;

// World Bank API params: most-recent value, up to 300 countries, last 5 years
const WB_PARAMS = 'format=json&mrv=1&per_page=300&date=2019:2024';

const WB_INDICATORS = {
  gdp:        'NY.GDP.MKTP.CD',     // GDP current USD
  growth:     'NY.GDP.MKTP.KD.ZG',  // GDP growth % annual
  population: 'SP.POP.TOTL',        // Population total
  literacy:   'SE.ADT.LITR.ZS',     // Adult literacy rate %
  health:     'SP.DYN.LE00.IN',     // Life expectancy at birth (years)
};

// ─── IN-MEMORY RESPONSE CACHE ─────────────────────────────────────────────────

let _pipelineCache = null;
let _pipelineCacheTs = 0;

// ─── FETCH LAYER ─────────────────────────────────────────────────────────────

/**
 * Fetch a World Bank indicator for all countries.
 * Returns Map<iso3, latestNonNullValue>.
 */
async function fetchWorldBankIndicator(indicatorCode) {
  const url = `${WB_BASE}/country/all/indicator/${indicatorCode}?${WB_PARAMS}`;
  try {
    const { data } = await axios.get(url, { timeout: FETCH_TIMEOUT_MS });
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) {
      console.warn(`[Ingestion] WB ${indicatorCode}: unexpected shape`);
      return new Map();
    }
    const map = new Map();
    for (const rec of data[1]) {
      const code = rec.countryiso3code;
      const val  = rec.value;
      if (code && val != null && !map.has(code)) {
        map.set(code, val); // mrv=1 ensures first hit is most recent
      }
    }
    console.log(`[Ingestion] WB ${indicatorCode}: ${map.size} countries`);
    return map;
  } catch (err) {
    console.warn(`[Ingestion] WB ${indicatorCode} failed: ${err.message}`);
    return new Map();
  }
}

async function fetchGDP()        { return fetchWorldBankIndicator(WB_INDICATORS.gdp); }
async function fetchPopulation() { return fetchWorldBankIndicator(WB_INDICATORS.population); }
async function fetchGrowthRate() { return fetchWorldBankIndicator(WB_INDICATORS.growth); }
async function fetchLiteracy()   { return fetchWorldBankIndicator(WB_INDICATORS.literacy); }
async function fetchHealth()     { return fetchWorldBankIndicator(WB_INDICATORS.health); }

/**
 * Fetch country metadata from REST Countries API.
 * Returns Map<iso3, { name, code2, region, subregion, population }>.
 */
async function fetchCountries() {
  try {
    const { data } = await axios.get(REST_COUNTRIES_URL, { timeout: FETCH_TIMEOUT_MS });
    const map = new Map();
    for (const c of data) {
      const iso3 = c.cca3;
      if (!iso3) continue;
      map.set(iso3, {
        name:       c.name?.common || 'Unknown',
        code2:      c.cca2 || '',
        region:     c.region || 'Unknown',
        subregion:  c.subregion || '',
        population: typeof c.population === 'number' ? c.population : 0,
      });
    }
    console.log(`[Ingestion] REST Countries: ${map.size} countries`);
    return map;
  } catch (err) {
    console.warn(`[Ingestion] REST Countries failed: ${err.message}`);
    return new Map();
  }
}

// ─── NORMALIZATION ────────────────────────────────────────────────────────────

/**
 * Merge all data sources into unified records keyed by ISO3 code.
 * Missing fields are left null — fallback to DB happens in upsert step.
 */
function normalizeCountries({ countries, gdp, population, growth, literacy, health }) {
  // Union all ISO3 codes across all sources
  const allCodes = new Set([
    ...countries.keys(),
    ...gdp.keys(),
    ...population.keys(),
  ]);

  const records = [];
  for (const code of allCodes) {
    // Skip World Bank regional/aggregate entries (non-3-char codes)
    if (code.length !== 3) continue;

    const meta = countries.get(code);

    // Raw values
    const rawGDP        = gdp.get(code)        ?? null;
    const rawPop        = population.get(code) ?? (meta?.population ?? null);
    const rawGrowth     = growth.get(code)     ?? null;
    const rawLiteracy   = literacy.get(code)   ?? null;
    const rawHealth     = health.get(code)     ?? null; // life expectancy years

    // Converted values
    const gdpBillions         = rawGDP  != null ? Math.round(rawGDP  / 1e9  * 10)  / 10  : null;
    const populationMillions  = rawPop  != null ? Math.round(rawPop  / 1e6  * 100) / 100 : null;
    const growthRate          = rawGrowth != null
      ? Math.round(Math.min(50, Math.max(-50, rawGrowth)) * 100) / 100
      : null;
    const literacyPct         = rawLiteracy != null
      ? Math.round(Math.min(100, Math.max(0, rawLiteracy)) * 10) / 10
      : null;

    // Normalize life expectancy [30, 90] → [0, 100]
    const healthIndex = rawHealth != null
      ? Math.round(Math.min(100, Math.max(0, ((rawHealth - 30) / 60) * 100)) * 10) / 10
      : null;

    records.push({
      code,
      code2:      meta?.code2     || '',
      name:       meta?.name      || code,
      region:     meta?.region    || 'Unknown',
      gdp:        gdpBillions,
      population: populationMillions,
      growth_rate: growthRate,
      literacy:   literacyPct,
      health_index: healthIndex,
    });
  }

  return records;
}

// ─── DERIVED METRICS ──────────────────────────────────────────────────────────

/**
 * Compute GDP_norm, eco_score, demand, and workforce from normalized records.
 * All formulas are deterministic and documented.
 */
function computeDerivedMetrics(records) {
  // Step 1: find maxGDP for normalization
  const maxGDP = records.reduce((m, r) => (r.gdp != null && r.gdp > m ? r.gdp : m), 1);

  return records.map((r) => {
    // 1. GDP normalized to [0, 1]
    const gdp_norm = r.gdp != null
      ? Math.round((r.gdp / maxGDP) * 10000) / 10000
      : 0;

    // 2. Growth normalized: [-20, +20] → [0, 1], center = 0.5
    const growthVal  = r.growth_rate ?? 0;
    const growth_norm = Math.round(
      Math.min(1, Math.max(0, (growthVal + 20) / 40)) * 10000
    ) / 10000;

    // 3. Social stability proxy (average of health + literacy, both 0-100 → 0-1)
    const stabilityProxy =
      ((r.health_index ?? 50) + (r.literacy ?? 50)) / 200;

    // 4. Eco score: weighted composite [0-100]
    //    EcoScore = 50*GDP_norm + 30*growth_norm*100 + 20*stability*100  (rescaled)
    //    Simplified: (0.5*gdp_norm + 0.3*growth_norm + 0.2*stabilityProxy) * 100
    const eco_score = Math.round(
      (0.5 * gdp_norm + 0.3 * growth_norm + 0.2 * stabilityProxy) * 100 * 10
    ) / 10;

    // 5. Demand proxy: population * consumption_rate (derived from GDP per capita quartile)
    const popM = r.population ?? 0;
    const gdpPerCapUSD = (popM > 0 && r.gdp != null)
      ? (r.gdp * 1e9) / (popM * 1e6)
      : 0;
    const consumptionRate =
      gdpPerCapUSD > 20000 ? 0.70
      : gdpPerCapUSD > 5000  ? 0.55
      : gdpPerCapUSD > 1000  ? 0.40
      : 0.25;
    const demand = Math.round(popM * consumptionRate * 100) / 100;

    // 6. Workforce proxy: population * working-age ratio
    const workforce = Math.round(popM * WORKING_AGE_RATIO * 100) / 100;

    return { ...r, gdp_norm, eco_score, demand, workforce };
  });
}

// ─── DB STORAGE ───────────────────────────────────────────────────────────────

/**
 * Load existing DB records as a fallback map for missing API values.
 */
async function loadExistingRecords() {
  try {
    const { data } = await supabase
      .from('countries_master')
      .select('code, gdp, population, literacy, health_index, growth_rate');
    if (!data) return new Map();
    return new Map(data.map((r) => [r.code, r]));
  } catch {
    return new Map();
  }
}

/**
 * Upsert all enriched records into countries_master in batches.
 * Null fields fall back to existing DB values to prevent data degradation.
 */
async function upsertCountriesMaster(records, existingMap) {
  const rows = records.map((r) => {
    const ex = existingMap.get(r.code) || {};
    return {
      name:         r.name,
      code:         r.code,
      code2:        r.code2 || '',
      gdp:          r.gdp          ?? ex.gdp          ?? null,
      population:   r.population   ?? ex.population   ?? null,
      literacy:     r.literacy     ?? ex.literacy     ?? null,
      health_index: r.health_index ?? ex.health_index ?? null,
      growth_rate:  r.growth_rate  ?? ex.growth_rate  ?? null,
      gdp_norm:     r.gdp_norm     ?? 0,
      eco_score:    r.eco_score    ?? 0,
      demand:       r.demand       ?? 0,
      workforce:    r.workforce    ?? 0,
      region:       r.region       || 'Unknown',
      last_updated: new Date().toISOString(),
    };
  });

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('countries_master')
      .upsert(batch, { onConflict: 'code' });
    if (error) {
      console.warn(`[Ingestion] Batch upsert failed at offset ${i}: ${error.message}`);
    } else {
      upserted += batch.length;
    }
  }

  return upserted;
}

/**
 * Record this pipeline run in data_snapshots for auditing.
 */
async function recordPipelineSnapshot(summary) {
  try {
    await supabase.from('data_snapshots').insert({
      id:         uuidv4(),
      source:     'countries_pipeline',
      data:       summary,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Ingestion] Snapshot record failed:', err.message);
  }
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────────────────

/**
 * Run the full data pipeline. Cached for CACHE_TTL_MS to avoid redundant runs.
 *
 * Steps:
 *  1. Fetch all sources in parallel
 *  2. Normalize to unified schema (ISO3-keyed)
 *  3. Compute derived metrics (GDP_norm, eco_score, demand, workforce)
 *  4. Load existing DB records for fallback
 *  5. Upsert into countries_master (batch of 50)
 *  6. Record pipeline snapshot
 */
async function runDataPipeline() {
  if (_pipelineCache && Date.now() - _pipelineCacheTs < CACHE_TTL_MS) {
    console.log('[Ingestion] Pipeline cache hit — skipping refetch');
    return _pipelineCache;
  }

  const start = Date.now();
  console.log('[Ingestion] Starting data pipeline...');

  // Step 1: Parallel fetch
  const [countries, gdp, population, growth, literacy, health] = await Promise.all([
    fetchCountries(),
    fetchGDP(),
    fetchPopulation(),
    fetchGrowthRate(),
    fetchLiteracy(),
    fetchHealth(),
  ]);

  console.log(
    `[Ingestion] Fetch complete — countries:${countries.size} ` +
    `gdp:${gdp.size} pop:${population.size} growth:${growth.size} ` +
    `literacy:${literacy.size} health:${health.size}`
  );

  // Step 2: Normalize
  const normalized = normalizeCountries({ countries, gdp, population, growth, literacy, health });
  console.log(`[Ingestion] Normalized ${normalized.length} records`);

  // Step 3: Derived metrics
  const enriched = computeDerivedMetrics(normalized);

  // Step 4: Existing DB fallback values
  const existingMap = await loadExistingRecords();

  // Step 5: Upsert
  const upserted = await upsertCountriesMaster(enriched, existingMap);
  console.log(`[Ingestion] Upserted ${upserted} countries`);

  const summary = {
    countries_processed: enriched.length,
    countries_upserted:  upserted,
    sources: {
      rest_countries: countries.size,
      gdp:            gdp.size,
      population:     population.size,
      growth:         growth.size,
      literacy:       literacy.size,
      health:         health.size,
    },
    elapsed_ms: Date.now() - start,
    timestamp:  new Date().toISOString(),
  };

  // Step 6: Snapshot
  await recordPipelineSnapshot(summary);

  _pipelineCache   = summary;
  _pipelineCacheTs = Date.now();

  console.log(`[Ingestion] Pipeline complete in ${summary.elapsed_ms}ms`);
  return summary;
}

/**
 * Get the timestamp of the most recently updated country record.
 * Used by the UI to display "Data last updated: {timestamp}".
 */
async function getLastUpdateTimestamp() {
  try {
    const { data } = await supabase
      .from('countries_master')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();
    return data?.last_updated || null;
  } catch {
    return null;
  }
}

module.exports = {
  runDataPipeline,
  getLastUpdateTimestamp,
  // Individual fetchers (exported for testing / manual use)
  fetchGDP,
  fetchPopulation,
  fetchGrowthRate,
  fetchLiteracy,
  fetchHealth,
  fetchCountries,
  // Processing functions (exported for testing)
  normalizeCountries,
  computeDerivedMetrics,
};
