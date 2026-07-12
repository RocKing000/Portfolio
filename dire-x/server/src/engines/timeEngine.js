const { SIM_DAY_MS } = require('../config/constants');

/**
 * TimeEngine manages simulation time progression.
 * Each tick represents one simulation day.
 */
class TimeEngine {
  /**
   * @param {Function} onTick - callback invoked each tick with (currentDay)
   */
  constructor(onTick) {
    this._onTick = onTick || (() => {});
    this._currentDay = 0;
    this._intervalId = null;
    this._running = false;
    this._paused = false;
    this._speedMultiplier = 1.0;
    this._baseInterval = SIM_DAY_MS;
  }

  /**
   * Start the time engine from day 0 (or current day if resumed).
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._paused = false;
    this._scheduleNext();
    console.log(`[TimeEngine] Started — interval: ${this._effectiveInterval()}ms`);
  }

  /**
   * Pause the time engine, preserving current day.
   */
  pause() {
    if (!this._running || this._paused) return;
    this._paused = true;
    this._clearInterval();
    console.log(`[TimeEngine] Paused at day ${this._currentDay}`);
  }

  /**
   * Resume the time engine after a pause.
   */
  resume() {
    if (!this._running || !this._paused) return;
    this._paused = false;
    this._scheduleNext();
    console.log(`[TimeEngine] Resumed at day ${this._currentDay}`);
  }

  /**
   * Change the speed multiplier. Higher = faster ticks.
   * @param {number} multiplier - speed factor (e.g., 2 = 2x faster)
   */
  setSpeed(multiplier) {
    const prev = this._speedMultiplier;
    this._speedMultiplier = Math.max(0.1, Math.min(10, multiplier));

    // Restart the interval with new timing if running
    if (this._running && !this._paused) {
      this._clearInterval();
      this._scheduleNext();
    }

    console.log(`[TimeEngine] Speed changed: ${prev}x -> ${this._speedMultiplier}x (${this._effectiveInterval()}ms per day)`);
  }

  /**
   * Get the current simulation day.
   * @returns {number}
   */
  getCurrentDay() {
    return this._currentDay;
  }

  /**
   * Reset the engine back to day 0 and stop.
   */
  reset() {
    this._clearInterval();
    this._currentDay = 0;
    this._running = false;
    this._paused = false;
    this._speedMultiplier = 1.0;
    console.log('[TimeEngine] Reset');
  }

  /**
   * Manually advance one day without waiting for the interval.
   * Useful for step-by-step simulation.
   */
  tick() {
    this._currentDay += 1;
    this._onTick(this._currentDay);
  }

  // --- Private helpers ---

  _effectiveInterval() {
    return Math.max(100, Math.round(this._baseInterval / this._speedMultiplier));
  }

  _scheduleNext() {
    this._clearInterval();
    this._intervalId = setInterval(() => {
      if (this._paused) return;
      this._currentDay += 1;
      try {
        this._onTick(this._currentDay);
      } catch (err) {
        console.error(`[TimeEngine] Tick error on day ${this._currentDay}:`, err.message);
      }
    }, this._effectiveInterval());
  }

  _clearInterval() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}

module.exports = { TimeEngine };
