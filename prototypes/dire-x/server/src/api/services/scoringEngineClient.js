/**
 * api/services/scoringEngineClient.js
 *
 * HTTP client for the DIRE-X Python Scoring Engine microservice.
 *
 * Replaces inline scoring logic in routes/simulateScenario.js with a call
 * to the Python engine running at SCORING_ENGINE_URL (default: http://localhost:8001).
 *
 * Falls back gracefully to null when the service is unavailable — callers
 * must decide whether to hard-fail or use local scoring fallback.
 */

'use strict';

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const BASE_URL   = process.env.SCORING_ENGINE_URL || 'http://localhost:8001';
const API_KEY    = process.env.SCORING_ENGINE_API_KEY || '';
const TIMEOUT_MS = parseInt(process.env.SCORING_ENGINE_TIMEOUT_MS || '8000', 10);

/**
 * POST a single scenario to the scoring engine.
 *
 * @param {object} scenarioPayload  Fields matching ScenarioInput (see Python models.py)
 * @returns {Promise<object|null>}  ScoringOutput JSON, or null on failure
 */
async function scoreScenario(scenarioPayload) {
  return _post('/score', scenarioPayload);
}

/**
 * POST a batch of scenarios (max 100).
 *
 * @param {object[]} scenarios
 * @returns {Promise<object|null>}  BatchScoringResponse JSON, or null on failure
 */
async function scoreScenarioBatch(scenarios) {
  return _post('/score/batch', { scenarios });
}

/**
 * Trigger weight calibration on the scoring engine.
 *
 * @param {object} params  CalibrateParams fields
 * @returns {Promise<object|null>}
 */
async function calibrate(params = {}) {
  return _post('/calibrate', {
    use_default_anchors: true,
    learning_rate: 0.01,
    max_iterations: 500,
    tolerance: 0.5,
    initial_profile: 'default',
    ...params,
  });
}

/**
 * Health check — returns true if the scoring engine is reachable.
 *
 * @returns {Promise<boolean>}
 */
async function isHealthy() {
  try {
    const result = await _get('/health');
    return result?.status === 'ok';
  } catch {
    return false;
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function _post(path, body) {
  const payload = JSON.stringify(body);
  return _request('POST', path, payload);
}

async function _get(path) {
  return _request('GET', path, null);
}

function _request(method, path, payload) {
  return new Promise((resolve, reject) => {
    const url     = new URL(BASE_URL + path);
    const isHttps = url.protocol === 'https:';
    const lib     = isHttps ? https : http;

    const headers = {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    };
    if (API_KEY) {
      headers['x-api-key'] = API_KEY;
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const options = {
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers,
      timeout:  TIMEOUT_MS,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(`Scoring engine returned ${res.statusCode}: ${parsed.detail || data}`);
            err.statusCode = res.statusCode;
            return reject(err);
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Scoring engine returned non-JSON response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Scoring engine request timed out after ${TIMEOUT_MS}ms`));
    });

    req.on('error', (err) => reject(err));

    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { scoreScenario, scoreScenarioBatch, calibrate, isHealthy };
