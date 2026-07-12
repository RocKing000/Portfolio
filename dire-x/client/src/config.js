/**
 * client/src/config.js
 * All tunable client-side parameters in one place.
 */

// Must stay in sync with server SIM_DAY_MS (server/src/config/constants.js)
export const SIM_DAY_MS = 60_000;

// Minimum tick interval regardless of speed multiplier
export const MIN_TICK_INTERVAL_MS = 200;

// Axios timeout for all API requests
export const API_TIMEOUT_MS = 30_000;

// How often the risk heatmap auto-refreshes
export const RISK_HEATMAP_REFRESH_MS = 30_000;

// Delay before mounting the WebGL globe, giving the loader animation time
// to settle on its compositor layer before shader compilation begins
export const GLOBE_MOUNT_DELAY_MS = 900;

// Event severity thresholds that trigger auto-pause and sound cues
export const EVENT_SEVERITY = {
  CRITICAL: 5,
  HIGH:     4,
  MEDIUM:   3,
};

// Speed at or below which tick sounds play
export const SPEED_SOUND_THRESHOLD = 2;
