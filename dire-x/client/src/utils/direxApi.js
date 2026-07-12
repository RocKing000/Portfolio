/**
 * utils/direxApi.js
 *
 * Axios client for the DIRE-X FastAPI scoring backend.
 *
 * URL routing:
 *   Development  — Vite proxies /direx/* → http://localhost:8000/*
 *                  (VITE_DIREX_API_URL is empty, so baseURL = '/direx')
 *   Production   — VITE_DIREX_API_URL = 'https://dire-x-backend.onrender.com'
 *                  (calls go directly to Render; CORS is open)
 *
 * Endpoints covered:
 *   GET  /health
 *   POST /scenario/analyze
 *   GET  /scenario/list
 *   GET  /scenario/{id}
 *   POST /batch/analyze
 */

import axios from 'axios';
import { API_TIMEOUT_MS } from '../config';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const direxClient = axios.create({
  // Dev: '' → use /direx (Vite proxy strips prefix and forwards to localhost:8000)
  // Prod: 'https://dire-x-backend.onrender.com' → direct HTTPS call
  baseURL: import.meta.env.VITE_DIREX_API_URL || '/direx',
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// FastAPI error shape: { detail: string | { error, message, ... } }
direxClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const detail  = error.response?.data?.detail;
    const message =
      (detail && typeof detail === 'object' ? detail.message : detail) ||
      error.message ||
      'DIRE-X scoring engine error';
    console.error('[DIRE-X Scoring]', {
      url:    error.config?.url,
      status: error.response?.status,
      message,
    });
    return Promise.reject(new Error(message));
  }
);

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/**
 * Ping the scoring backend.
 * @returns {{ status, service, version, scoring_engine, redis }}
 */
export const checkDirexHealth = () =>
  direxClient.get('/health').then((r) => r.data);

// ---------------------------------------------------------------------------
// Single scenario
// ---------------------------------------------------------------------------

/**
 * Validate, score, and store one scenario.
 *
 * @param {{
 *   scenario_id:                  string,
 *   event_type:                   string,
 *   region:                       string,
 *   industry:                     string,
 *   direct_impact_score:          number,   // 0–100
 *   indirect_impact_score:        number,   // 0–100
 *   dependency_level:             'low'|'medium'|'high',
 *   hidden_dependency_percentage: number,   // 0–100
 *   time_to_impact:               number,   // days
 *   recovery_time:                number,   // days
 *   confidence_score:             number,   // 0–1
 *   manipulation_risk:            'low'|'medium'|'high',
 *   policy_impact:                'none'|'moderate'|'high',
 * }} payload
 *
 * @returns {{
 *   stored_id:   string,
 *   scenario_id: string,
 *   created_at:  string,
 *   validation:  { validation_score, validation_status, flags, passed },
 *   scores: {
 *     impact_score, exposure_score, temporal_factor,
 *     risk_score, fragility_score, final_score,
 *     final_tier, shocks_triggered, v2_flags
 *   },
 *   explanation: object,
 * }}
 *
 * Throws on validation failure (HTTP 422) or scoring error (HTTP 500).
 */
export const analyzeScenario = (payload) =>
  direxClient.post('/scenario/analyze', payload).then((r) => r.data);

// ---------------------------------------------------------------------------
// Fetch stored scenario
// ---------------------------------------------------------------------------

/**
 * Fetch a previously stored scenario by its scenario_id or UUID.
 * Result is served from Redis cache when available (TTL 1 h).
 *
 * @param {string} scenarioId
 * @returns {StoredScenario}
 */
export const fetchScenario = (scenarioId) =>
  direxClient
    .get(`/scenario/${encodeURIComponent(scenarioId)}`)
    .then((r) => r.data);

// ---------------------------------------------------------------------------
// List scenarios
// ---------------------------------------------------------------------------

/**
 * Return stored scenarios, newest first.
 *
 * @param {{ limit?: number, offset?: number, tier?: 'LOW'|'MODERATE'|'HIGH'|'CRITICAL' }} options
 * @returns {{ scenarios: StoredScenario[], count, limit, offset }}
 */
export const listScenarios = ({ limit = 50, offset = 0, tier } = {}) =>
  direxClient
    .get('/scenario/list', {
      params: { limit, offset, ...(tier ? { tier } : {}) },
    })
    .then((r) => r.data);

// ---------------------------------------------------------------------------
// Batch analysis
// ---------------------------------------------------------------------------

/**
 * Analyze up to 100 scenarios concurrently.
 * Items that fail validation are returned with status 'validation_failed'
 * rather than rejecting the entire batch.
 *
 * @param {Array<ScenarioInput>} scenarios  — same shape as analyzeScenario payload
 * @returns {{
 *   batch_id:    string,
 *   summary:     { total, succeeded, failed, cached },
 *   results:     Array<{ scenario_id, status, result?, error?, duration_ms }>,
 *   duration_ms: number,
 * }}
 */
export const analyzeBatch = (scenarios) =>
  direxClient
    .post('/batch/analyze', { scenarios })
    .then((r) => r.data);

export default direxClient;
