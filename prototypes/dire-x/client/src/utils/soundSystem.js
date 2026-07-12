// ============================================
// DIRE-X Sound System — Web Audio API, no dependencies
// Deterministic, lightweight, non-blocking
// ============================================

let audioCtx = null;
let masterGain = null;
let enabled = true;

function getCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.25;
      masterGain.connect(audioCtx.destination);
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone({ frequency, type = 'sine', duration = 0.3, volume = 0.3, attack = 0.01, decay = 0.1, delay = 0 }) {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  const startTime = ctx.currentTime + delay;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + attack + decay + (duration - attack - decay));

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playNoise({ duration = 0.15, volume = 0.1, frequency = 200, type = 'bandpass' }) {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(ctx.currentTime);
  source.stop(ctx.currentTime + duration);
}

// ---- Named Sound Cues ----

export const sounds = {
  /** Simulation starts — positive rising chord */
  simulationStart() {
    [261.6, 329.6, 392.0].forEach((freq, i) => {
      playTone({ frequency: freq, type: 'triangle', duration: 0.5, volume: 0.15, attack: 0.01, decay: 0.4, delay: i * 0.06 });
    });
  },

  /** Day tick — very subtle click */
  tick() {
    playTone({ frequency: 880, type: 'square', duration: 0.04, volume: 0.04, attack: 0.001, decay: 0.03 });
  },

  /** Decision submitted — confirmation chime */
  decisionSubmit() {
    [523.2, 659.3].forEach((freq, i) => {
      playTone({ frequency: freq, type: 'sine', duration: 0.25, volume: 0.12, attack: 0.01, decay: 0.2, delay: i * 0.08 });
    });
  },

  /** Low severity event (1-2) — soft notification */
  eventLow() {
    playTone({ frequency: 440, type: 'sine', duration: 0.2, volume: 0.1, attack: 0.01, decay: 0.15 });
  },

  /** Medium severity event (3) — alert tone */
  eventMedium() {
    [440, 494].forEach((freq, i) => {
      playTone({ frequency: freq, type: 'sawtooth', duration: 0.3, volume: 0.1, attack: 0.01, decay: 0.25, delay: i * 0.12 });
    });
  },

  /** High severity event (4-5) — crisis rumble + alert */
  eventHigh() {
    playNoise({ duration: 0.6, volume: 0.08, frequency: 80, type: 'lowpass' });
    [220, 277].forEach((freq, i) => {
      playTone({ frequency: freq, type: 'sawtooth', duration: 0.5, volume: 0.12, attack: 0.02, decay: 0.45, delay: i * 0.1 });
    });
  },

  /** Critical event (severity 5) — deep crisis alarm */
  eventCritical() {
    playNoise({ duration: 1.2, volume: 0.15, frequency: 60, type: 'lowpass' });
    [110, 138.6, 110].forEach((freq, i) => {
      playTone({ frequency: freq, type: 'sawtooth', duration: 0.4, volume: 0.15, attack: 0.05, decay: 0.35, delay: i * 0.2 });
    });
  },

  /** Positive outcome — success chime */
  success() {
    [523.2, 659.3, 783.9].forEach((freq, i) => {
      playTone({ frequency: freq, type: 'triangle', duration: 0.4, volume: 0.1, attack: 0.01, decay: 0.35, delay: i * 0.1 });
    });
  },

  /** Scenario triggered — tension swell */
  scenarioStart() {
    playNoise({ duration: 0.8, volume: 0.07, frequency: 120, type: 'lowpass' });
    playTone({ frequency: 196, type: 'sawtooth', duration: 0.8, volume: 0.1, attack: 0.1, decay: 0.6 });
  },

  /** Idea submitted — soft positive */
  ideaSubmit() {
    [523.2, 622.3].forEach((freq, i) => {
      playTone({ frequency: freq, type: 'sine', duration: 0.3, volume: 0.08, attack: 0.01, decay: 0.25, delay: i * 0.1 });
    });
  },

  /** Strategic action launched — determined pulse */
  strategicAction() {
    playTone({ frequency: 392, type: 'triangle', duration: 0.35, volume: 0.12, attack: 0.02, decay: 0.3 });
    playTone({ frequency: 523.2, type: 'triangle', duration: 0.25, volume: 0.08, attack: 0.01, decay: 0.2, delay: 0.15 });
  },
};

export function setSoundEnabled(value) {
  enabled = value;
  if (masterGain) masterGain.gain.value = value ? 0.25 : 0;
}

export function isSoundEnabled() { return enabled; }

export function setSoundVolume(vol) {
  if (masterGain) masterGain.gain.value = vol;
}

export default sounds;
