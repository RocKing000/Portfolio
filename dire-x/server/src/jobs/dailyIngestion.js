const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const { computeSRES } = require('../engines/sresEngine');
const { SRES_WEIGHTS } = require('../config/constants');
const { runDataPipeline } = require('../services/dataIngestion');

const WORLD_BANK_BASE = process.env.WORLD_BANK_BASE_URL || 'https://api.worldbank.org/v2';
const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY;

const WORLD_BANK_INDICATORS = ['NY.GDP.MKTP.CD', 'SP.POP.TOTL'];
const WEATHER_CITIES = [
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
  { name: 'Washington', lat: 38.9072, lon: -77.0369 },
  { name: 'Moscow', lat: 55.7558, lon: 37.6173 },
  { name: 'Delhi', lat: 28.6139, lon: 77.209 },
];

// Seed/fallback data if APIs are unreachable
const FALLBACK_ECONOMIC = {
  gdp_growth_index: 52,
  trade_volume_index: 55,
  inflation_pressure: 48,
  currency_stability: 60,
};

const FALLBACK_WEATHER = {
  London: { temp: 12, humidity: 75, condition: 'cloudy', severity: 1 },
  Beijing: { temp: 18, humidity: 45, condition: 'clear', severity: 0 },
  Washington: { temp: 20, humidity: 60, condition: 'partly_cloudy', severity: 0 },
  Moscow: { temp: 5, humidity: 70, condition: 'overcast', severity: 1 },
  Delhi: { temp: 35, humidity: 40, condition: 'haze', severity: 2 },
};

/**
 * Fetch World Bank indicator data for major economies.
 */
async function fetchWorldBankData() {
  const results = {};

  for (const indicator of WORLD_BANK_INDICATORS) {
    try {
      const url = `${WORLD_BANK_BASE}/country/USA;CHN;DEU;JPN;IND/indicator/${indicator}?format=json&date=2022:2024&per_page=50`;
      const response = await axios.get(url, { timeout: 10000 });

      if (response.data && Array.isArray(response.data) && response.data.length > 1) {
        const records = response.data[1] || [];
        results[indicator] = records
          .filter((r) => r.value !== null)
          .map((r) => ({
            country: r.country?.id || 'UNK',
            country_name: r.country?.value || 'Unknown',
            year: r.date,
            value: r.value,
          }));
      }
    } catch (err) {
      console.warn(`[Ingestion] World Bank fetch failed for ${indicator}:`, err.message);
      results[indicator] = [];
    }
  }

  return results;
}

/**
 * Fetch current weather data from OpenWeather API.
 */
async function fetchWeatherData() {
  if (!OPENWEATHER_KEY) {
    console.warn('[Ingestion] No OPENWEATHER_API_KEY set, using fallback weather data');
    return FALLBACK_WEATHER;
  }

  const results = {};

  for (const city of WEATHER_CITIES) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lon}&appid=${OPENWEATHER_KEY}&units=metric`;
      const response = await axios.get(url, { timeout: 8000 });
      const data = response.data;

      const temp = data.main?.temp || 20;
      const humidity = data.main?.humidity || 50;
      const weatherMain = (data.weather?.[0]?.main || 'Clear').toLowerCase();

      // Derive environmental severity from extreme conditions
      let severity = 0;
      if (temp > 40 || temp < -20) severity = 3;
      else if (temp > 35 || temp < -10) severity = 2;
      else if (temp > 30 || temp < 0) severity = 1;
      if (humidity > 90 || humidity < 15) severity = Math.max(severity, 2);

      results[city.name] = {
        temp: Math.round(temp * 10) / 10,
        humidity,
        condition: weatherMain,
        severity,
      };
    } catch (err) {
      console.warn(`[Ingestion] Weather fetch failed for ${city.name}:`, err.message);
      results[city.name] = FALLBACK_WEATHER[city.name] || { temp: 20, humidity: 50, condition: 'unknown', severity: 0 };
    }
  }

  return results;
}

/**
 * Normalize raw API data into internal risk metric adjustments.
 */
function normalizeData(economicData, weatherData) {
  // Derive demand index from GDP trends
  const gdpRecords = economicData['NY.GDP.MKTP.CD'] || [];
  let demandAdjustment = 0;
  if (gdpRecords.length > 0) {
    // Higher GDP values in recent years suggest growing demand
    const avgGdp = gdpRecords.reduce((s, r) => s + (r.value || 0), 0) / gdpRecords.length;
    demandAdjustment = avgGdp > 5e12 ? 5 : avgGdp > 1e12 ? 3 : 1;
  }

  // Derive environmental index from weather severity
  const weatherEntries = Object.values(weatherData);
  const avgSeverity = weatherEntries.reduce((s, w) => s + (w.severity || 0), 0) / Math.max(1, weatherEntries.length);
  const envAdjustment = Math.round(avgSeverity * 8);

  return {
    demand_adjustment: demandAdjustment,
    supply_adjustment: 0, // Supply data would come from commodity APIs
    geopolitical_adjustment: 0, // Would come from event/news APIs
    environmental_adjustment: envAdjustment,
    raw_economic: FALLBACK_ECONOMIC,
    raw_weather: weatherData,
  };
}

/**
 * Upsert normalized data into Supabase risk_metrics table.
 */
async function upsertRiskMetrics(normalized) {
  try {
    // Fetch all resources
    const { data: resources, error: resError } = await supabase
      .from('resources')
      .select('id, name, category');

    if (resError) throw resError;
    if (!resources || resources.length === 0) {
      console.warn('[Ingestion] No resources found in DB, skipping metric upsert');
      return [];
    }

    const updates = [];
    for (const resource of resources) {
      // Fetch existing metrics
      const { data: existing } = await supabase
        .from('risk_metrics')
        .select('*')
        .eq('resource_id', resource.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const base = existing || {
        demand_index: 50,
        supply_index: 50,
        geopolitical_index: 50,
        environmental_index: 50,
      };

      // Apply adjustments with small random variance for realism
      const variance = () => (Math.random() - 0.5) * 4;
      const clamp = (v) => Math.min(100, Math.max(0, Math.round(v * 100) / 100));

      const updated = {
        resource_id: resource.id,
        demand_index: clamp(base.demand_index + normalized.demand_adjustment + variance()),
        supply_index: clamp(base.supply_index + normalized.supply_adjustment + variance()),
        geopolitical_index: clamp(base.geopolitical_index + normalized.geopolitical_adjustment + variance()),
        environmental_index: clamp(base.environmental_index + normalized.environmental_adjustment + variance()),
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('risk_metrics')
        .upsert(updated, { onConflict: 'resource_id' });

      if (upsertError) {
        console.warn(`[Ingestion] Upsert failed for resource ${resource.name}:`, upsertError.message);
      } else {
        updates.push(updated);
      }
    }

    return updates;
  } catch (err) {
    console.error('[Ingestion] upsertRiskMetrics error:', err.message);
    return [];
  }
}

/**
 * Create a new data_snapshots entry recording the ingestion.
 */
async function createSnapshot(normalized, metricUpdates) {
  try {
    const snapshot = {
      id: uuidv4(),
      source: 'daily_ingestion',
      data: {
        economic: normalized.raw_economic,
        weather: normalized.raw_weather,
        adjustments: {
          demand: normalized.demand_adjustment,
          supply: normalized.supply_adjustment,
          geopolitical: normalized.geopolitical_adjustment,
          environmental: normalized.environmental_adjustment,
        },
        metrics_updated: metricUpdates.length,
      },
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('data_snapshots').insert(snapshot);
    if (error) {
      console.warn('[Ingestion] Snapshot insert failed:', error.message);
      return null;
    }

    return snapshot;
  } catch (err) {
    console.error('[Ingestion] createSnapshot error:', err.message);
    return null;
  }
}

/**
 * Precompute SRES for all companies using latest metrics.
 */
async function precomputeCompanySRES() {
  try {
    const { data: companies } = await supabase.from('companies').select('id, name');
    if (!companies || companies.length === 0) return [];

    const results = [];

    for (const company of companies) {
      const { data: compResources } = await supabase
        .from('company_resources')
        .select('resource_id, dependency_score')
        .eq('company_id', company.id);

      if (!compResources || compResources.length === 0) continue;

      const resourceIds = compResources.map((cr) => cr.resource_id);
      const { data: metrics } = await supabase
        .from('risk_metrics')
        .select('*')
        .in('resource_id', resourceIds);

      if (!metrics) continue;

      let weightedSum = 0;
      let totalWeight = 0;

      for (const cr of compResources) {
        const metric = metrics.find((m) => m.resource_id === cr.resource_id);
        if (!metric) continue;

        const sres = computeSRES(null, {
          demand: metric.demand_index,
          supply: metric.supply_index,
          geopolitical: metric.geopolitical_index,
          environmental: metric.environmental_index,
        }, SRES_WEIGHTS);

        weightedSum += cr.dependency_score * sres;
        totalWeight += cr.dependency_score;
      }

      const companySres = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;

      results.push({
        company_id: company.id,
        company_name: company.name,
        sres: companySres,
      });
    }

    console.log(`[Ingestion] Precomputed SRES for ${results.length} companies`);
    return results;
  } catch (err) {
    console.error('[Ingestion] precomputeCompanySRES error:', err.message);
    return [];
  }
}

/**
 * Main daily ingestion function. Fetches external data, normalizes, stores, and precomputes.
 */
async function runDailyIngestion() {
  const startTime = Date.now();
  console.log('[Ingestion] Starting daily ingestion...');

  // 1. Fetch external data
  const [economicData, weatherData] = await Promise.all([
    fetchWorldBankData(),
    fetchWeatherData(),
  ]);

  console.log(`[Ingestion] Fetched economic indicators: ${Object.keys(economicData).length}`);
  console.log(`[Ingestion] Fetched weather for ${Object.keys(weatherData).length} cities`);

  // 2. Normalize
  const normalized = normalizeData(economicData, weatherData);
  console.log('[Ingestion] Data normalized');

  // 3. Upsert risk metrics
  const metricUpdates = await upsertRiskMetrics(normalized);
  console.log(`[Ingestion] Updated ${metricUpdates.length} risk metrics`);

  // 4. Create snapshot
  const snapshot = await createSnapshot(normalized, metricUpdates);
  console.log(`[Ingestion] Snapshot created: ${snapshot?.id || 'failed'}`);

  // 5. Precompute SRES
  const sresResults = await precomputeCompanySRES();

  // 6. Run countries data pipeline
  console.log('[Ingestion] Running countries data pipeline...');
  let countriesSummary = null;
  try {
    countriesSummary = await runDataPipeline();
    console.log(`[Ingestion] Countries pipeline: ${countriesSummary.countries_upserted} upserted`);
  } catch (err) {
    console.warn('[Ingestion] Countries pipeline failed (non-fatal):', err.message);
  }

  const elapsed = Date.now() - startTime;
  const summary = {
    success: true,
    elapsed_ms: elapsed,
    metrics_updated: metricUpdates.length,
    snapshot_id: snapshot?.id || null,
    company_sres: sresResults,
    countries_pipeline: countriesSummary,
    timestamp: new Date().toISOString(),
  };

  console.log(`[Ingestion] Completed in ${elapsed}ms`);
  return summary;
}

module.exports = { runDailyIngestion };
