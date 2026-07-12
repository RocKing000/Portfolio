// ============================================
// Seeded PRNG — Deterministic randomness for reproducible simulations
// Replaces Math.random() in all engines
// ============================================

/**
 * Mulberry32 — Fast, high-quality 32-bit PRNG.
 * Same seed always produces the same sequence.
 */
class SeededRandom {
  constructor(seed = 42) {
    this.seed = seed | 0;
  }

  /** Returns a float in [0, 1) */
  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [-0.5, 0.5) — replacement for (Math.random() - 0.5) */
  drift() {
    return this.next() - 0.5;
  }

  /** Returns a float in [min, max) */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Returns true with the given probability (0–1) */
  chance(probability) {
    return this.next() < probability;
  }

  /** Pick a random element from an array */
  pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Shuffle array in place (Fisher-Yates) */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/**
 * Create a PRNG seeded by company ID + simulation day.
 * Ensures deterministic per-company per-day results.
 */
function createCompanyPRNG(companyId, day) {
  let hash = 0;
  const str = `${companyId}-${day}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return new SeededRandom(Math.abs(hash) || 1);
}

/**
 * Create a PRNG seeded by day only (for world-level operations).
 */
function createDayPRNG(day) {
  return new SeededRandom((day * 2654435761) | 0 || 1);
}

module.exports = { SeededRandom, createCompanyPRNG, createDayPRNG };
