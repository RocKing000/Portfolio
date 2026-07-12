import React, { Suspense, useRef, useEffect, useMemo, useCallback } from 'react';
import LoadingSpinner from '../shared/LoadingSpinner';
import useStore from '../../store/useStore';

const Globe = React.lazy(() => import('react-globe.gl'));

const defaultPoints = [
  { lat: 25.0, lng: 121.5, size: 0.8, color: '#ef4444', label: 'Taiwan - Semiconductors' },
  { lat: 35.6, lng: 139.7, size: 0.6, color: '#fbbf24', label: 'Japan - Electronics' },
  { lat: 39.9, lng: 116.4, size: 0.9, color: '#ef4444', label: 'China - Rare Earths' },
  { lat: 37.5, lng: 127.0, size: 0.7, color: '#fb923c', label: 'South Korea - Chips' },
  { lat: -4.3, lng: 29.0, size: 0.5, color: '#ef4444', label: 'DRC - Cobalt' },
  { lat: -33.4, lng: -70.6, size: 0.4, color: '#fbbf24', label: 'Chile - Lithium' },
  { lat: 50.1, lng: 8.7, size: 0.5, color: '#4ade80', label: 'Germany - Manufacturing' },
  { lat: 37.4, lng: -122.1, size: 0.6, color: '#4ade80', label: 'USA - Tech' },
  { lat: 25.2, lng: 55.3, size: 0.4, color: '#fbbf24', label: 'UAE - Energy' },
  { lat: -25.7, lng: 28.2, size: 0.3, color: '#fb923c', label: 'South Africa - Minerals' },
];

const defaultArcs = [
  { startLat: 39.9, startLng: 116.4, endLat: 25.0, endLng: 121.5, color: ['#ef4444', '#fbbf24'] },
  { startLat: 25.0, startLng: 121.5, endLat: 37.4, endLng: -122.1, color: ['#fbbf24', '#4ade80'] },
  { startLat: -4.3, startLng: 29.0, endLat: 37.5, endLng: 127.0, color: ['#ef4444', '#fb923c'] },
  { startLat: -33.4, startLng: -70.6, endLat: 50.1, endLng: 8.7, color: ['#fbbf24', '#4ade80'] },
  { startLat: 35.6, startLng: 139.7, endLat: 25.0, endLng: 121.5, color: ['#fbbf24', '#fb923c'] },
  { startLat: 25.2, startLng: 55.3, endLat: 50.1, endLng: 8.7, color: ['#fbbf24', '#4ade80'] },
];

// --- Scenario overlay data ---
const SCENARIO_POINTS = {
  drought: [
    { lat: 9.0, lng: 38.7, size: 1.0, color: '#fbbf24', label: 'East Africa - Drought' },
    { lat: 20.5, lng: 78.9, size: 0.9, color: '#fbbf24', label: 'South Asia - Drought' },
    { lat: 24.0, lng: 45.0, size: 0.8, color: '#fbbf24', label: 'Middle East - Drought' },
    { lat: 12.0, lng: -1.5, size: 0.7, color: '#fbbf24', label: 'West Africa - Drought' },
  ],
  war: [
    { lat: 48.3, lng: 37.8, size: 1.2, color: '#ef4444', label: 'Eastern Europe - Conflict' },
    { lat: 33.3, lng: 44.4, size: 1.0, color: '#ef4444', label: 'Middle East - Conflict' },
    { lat: 31.5, lng: 34.5, size: 0.9, color: '#ef4444', label: 'Eastern Mediterranean - Conflict' },
  ],
  supply_crisis: [],
  pandemic: [
    { lat: 30.6, lng: 114.3, size: 1.1, color: '#a855f7', label: 'Origin - Pandemic' },
    { lat: 28.6, lng: 77.2, size: 0.9, color: '#a855f7', label: 'South Asia - Pandemic Spread' },
    { lat: 51.5, lng: -0.1, size: 0.8, color: '#a855f7', label: 'Europe - Pandemic Spread' },
    { lat: 40.7, lng: -74.0, size: 0.8, color: '#a855f7', label: 'North America - Pandemic Spread' },
  ],
  trade_war: [],
};

const SCENARIO_ARCS = {
  supply_crisis: [
    { startLat: 25.0, startLng: 121.5, endLat: 37.4, endLng: -122.1, color: ['#fb923c', '#fb923c'], label: 'Disrupted: Taiwan-US' },
    { startLat: 39.9, startLng: 116.4, endLat: 50.1, endLng: 8.7, color: ['#fb923c', '#fb923c'], label: 'Disrupted: China-EU' },
    { startLat: -4.3, startLng: 29.0, endLat: 39.9, endLng: 116.4, color: ['#fb923c', '#fb923c'], label: 'Disrupted: DRC-China' },
  ],
  trade_war: [
    { startLat: 39.9, startLng: 116.4, endLat: 37.4, endLng: -122.1, color: ['#ec4899', '#ec4899'], label: 'Trade War: US-China' },
    { startLat: 39.9, startLng: 116.4, endLat: 50.1, endLng: 8.7, color: ['#ec4899', '#ec4899'], label: 'Trade War: China-EU' },
    { startLat: 37.4, startLng: -122.1, endLat: 50.1, endLng: 8.7, color: ['#ec4899', '#ec4899'], label: 'Trade Tension: US-EU' },
  ],
  war: [],
  drought: [],
  pandemic: [],
};

const SCENARIO_LEGEND = {
  drought: { color: '#fbbf24', label: 'Drought' },
  war: { color: '#ef4444', label: 'War' },
  supply_crisis: { color: '#fb923c', label: 'Supply Crisis' },
  pandemic: { color: '#a855f7', label: 'Pandemic' },
  trade_war: { color: '#ec4899', label: 'Trade War' },
};

function GlobeInner() {
  const globeRef = useRef();
  const globeData = useStore((s) => s.globeData);
  const events = useStore((s) => s.events);
  const activeScenarios = useStore((s) => s.activeScenarios);

  // Merge default + scenario-driven points
  const points = useMemo(() => {
    const base = globeData.points.length > 0 ? globeData.points : defaultPoints;
    const scenarioPoints = activeScenarios.flatMap((s) => {
      const pts = SCENARIO_POINTS[s.type] || [];
      return pts.map((p) => ({
        ...p,
        size: p.size * s.intensity,
      }));
    });
    return [...base, ...scenarioPoints];
  }, [globeData.points, activeScenarios]);

  // Merge default + scenario-driven arcs
  const arcs = useMemo(() => {
    const base = globeData.arcs.length > 0 ? globeData.arcs : defaultArcs;
    const scenarioArcs = activeScenarios.flatMap((s) => {
      return SCENARIO_ARCS[s.type] || [];
    });
    return [...base, ...scenarioArcs];
  }, [globeData.arcs, activeScenarios]);

  // Active scenario types for legend
  const activeTypes = useMemo(
    () => [...new Set(activeScenarios.map((s) => s.type))],
    [activeScenarios]
  );

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.4;
      globeRef.current.controls().enableZoom = true;
      globeRef.current.pointOfView({ lat: 20, lng: 100, altitude: 2.5 }, 1000);
    }
  }, []);

  // Pulse effect on new events
  useEffect(() => {
    if (globeRef.current && events.length > 0) {
      globeRef.current.controls().autoRotateSpeed = 0.8;
      const timer = setTimeout(() => {
        if (globeRef.current) {
          globeRef.current.controls().autoRotateSpeed = 0.4;
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [events.length]);

  const pointAltitude = useCallback(() => 0.01, []);
  const pointRadius = useCallback((d) => d.size || 0.5, []);
  const pointColor = useCallback((d) => d.color || '#00d4ff', []);
  const pointLabel = useCallback((d) => d.label || '', []);
  const arcColor = useCallback((d) => d.color || ['#00d4ff', '#00d4ff'], []);
  const arcDashLength = useCallback(() => 0.4, []);
  const arcDashGap = useCallback(() => 0.2, []);
  const arcDashAnimateTime = useCallback(() => 2000, []);

  return (
    <div className="relative w-full h-full">
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        pointsData={points}
        pointAltitude={pointAltitude}
        pointRadius={pointRadius}
        pointColor={pointColor}
        pointLabel={pointLabel}
        arcsData={arcs}
        arcColor={arcColor}
        arcDashLength={arcDashLength}
        arcDashGap={arcDashGap}
        arcDashAnimateTime={arcDashAnimateTime}
        arcStroke={0.5}
        atmosphereColor="#00d4ff"
        atmosphereAltitude={0.15}
        width={600}
        height={400}
      />

      {/* Scenario legend */}
      {activeTypes.length > 0 && (
        <div className="absolute bottom-3 left-3 bg-dire-dark/80 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <div className="text-[9px] text-dire-muted uppercase tracking-wider mb-1">Active</div>
          <div className="space-y-1">
            {activeTypes.map((type) => {
              const legend = SCENARIO_LEGEND[type];
              if (!legend) return null;
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: legend.color }}
                  />
                  <span className="text-[10px] text-white/80">{legend.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GlobeView() {
  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden bg-dire-dark border border-white/5">
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <LoadingSpinner size={40} />
          </div>
        }
      >
        <GlobeInner />
      </Suspense>
    </div>
  );
}
