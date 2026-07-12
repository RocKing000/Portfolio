import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import sounds from '../utils/soundSystem';
import { SIM_DAY_MS, MIN_TICK_INTERVAL_MS, EVENT_SEVERITY, SPEED_SOUND_THRESHOLD } from '../config';

/**
 * Custom hook that manages the simulation timer.
 * Calls store.tick() at intervals based on speed setting.
 * Base interval: 60000ms (60 seconds = 1 day).
 * Supports 0.5x speed (120000ms).
 * In open_world mode, worldTick is called via tick().
 * Auto-pauses if any event reaches severity >= 5.
 * Plays sound cues for events and ticks.
 */
export default function useSimulationTimer() {
  const isPlaying = useStore((s) => s.isPlaying);
  const speed = useStore((s) => s.speed);
  const tick = useStore((s) => s.tick);
  const mode = useStore((s) => s.mode);
  const events = useStore((s) => s.events);
  const pauseSimulation = useStore((s) => s.pauseSimulation);
  const soundEnabled = useStore((s) => s.soundEnabled);
  const intervalRef = useRef(null);
  const prevEventCountRef = useRef(0);
  const prevPlayingRef = useRef(false);

  // Play sound on simulation start/stop
  useEffect(() => {
    if (isPlaying && !prevPlayingRef.current) {
      sounds.simulationStart();
    }
    prevPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Play sound on new events
  useEffect(() => {
    if (!soundEnabled || events.length === 0) {
      prevEventCountRef.current = events.length;
      return;
    }
    if (events.length > prevEventCountRef.current) {
      const newEvents = events.slice(prevEventCountRef.current);
      const maxSeverity = Math.max(...newEvents.map(e => e.severity || 1));
      if (maxSeverity >= EVENT_SEVERITY.CRITICAL) {
        sounds.eventCritical();
        pauseSimulation();
      } else if (maxSeverity >= EVENT_SEVERITY.HIGH) {
        sounds.eventHigh();
        pauseSimulation();
      } else if (maxSeverity >= EVENT_SEVERITY.MEDIUM) {
        sounds.eventMedium();
      } else {
        sounds.eventLow();
      }
    }
    prevEventCountRef.current = events.length;
  }, [events, soundEnabled, pauseSimulation]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isPlaying) {
      const intervalMs = Math.max(MIN_TICK_INTERVAL_MS, SIM_DAY_MS / speed);
      intervalRef.current = setInterval(() => {
        tick();
        if (soundEnabled && speed <= SPEED_SOUND_THRESHOLD) sounds.tick();
      }, intervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, speed, tick, mode, soundEnabled]);
}
