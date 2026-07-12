import { useEffect, useRef, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRiskHeatmap } from '../../utils/api';
import { RISK_HEATMAP_REFRESH_MS } from '../../config';

const Globe = lazy(() => import('react-globe.gl'));

const REFRESH_INTERVAL_MS = RISK_HEATMAP_REFRESH_MS;

// ─── Color helpers ────────────────────────────────────────────────────────────

function scoreToHex(score) {
  if (score >= 75) return '#ef4444'; // red
  if (score >= 60) return '#f97316'; // orange
  if (score >= 45) return '#fbbf24'; // amber
  if (score >= 30) return '#84cc16'; // lime
  return '#22c55e';                  // green
}

function scoreToCapColor(score, isHovered) {
  if (isHovered) return 'rgba(0, 212, 255, 0.45)';
  if (score >= 75) return 'rgba(239, 68, 68, 0.30)';
  if (score >= 60) return 'rgba(249, 115, 22, 0.25)';
  if (score >= 45) return 'rgba(251, 191, 36, 0.20)';
  if (score >= 30) return 'rgba(132, 204, 22, 0.15)';
  return 'rgba(34, 197, 94, 0.12)';
}

function trendIcon(trend) {
  if (trend === 'increasing') return '↑';
  if (trend === 'decreasing') return '↓';
  return '→';
}

function trendColor(trend) {
  if (trend === 'increasing') return 'text-red-400';
  if (trend === 'decreasing') return 'text-green-400';
  return 'text-amber-400';
}

function riskLabel(score) {
  if (score >= 75) return { text: 'CRITICAL', cls: 'text-red-400' };
  if (score >= 60) return { text: 'HIGH',     cls: 'text-orange-400' };
  if (score >= 45) return { text: 'ELEVATED', cls: 'text-amber-400' };
  if (score >= 30) return { text: 'MODERATE', cls: 'text-lime-400' };
  return              { text: 'LOW',      cls: 'text-green-400' };
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function HeatmapLegend() {
  const bands = [
    { label: 'Critical  75+', color: '#ef4444' },
    { label: 'High      60–74', color: '#f97316' },
    { label: 'Elevated  45–59', color: '#fbbf24' },
    { label: 'Moderate  30–44', color: '#84cc16' },
    { label: 'Low       0–29',  color: '#22c55e' },
  ];
  return (
    <div className="absolute bottom-5 left-4 z-20 bg-dire-panel/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 space-y-1">
      <div className="text-[9px] text-dire-muted uppercase tracking-widest mb-1.5">Risk Scale</div>
      {bands.map((b) => (
        <div key={b.label} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.color }} />
          <span className="text-[9px] text-white/60 font-mono">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function HeatmapTooltip({ entry }) {
  if (!entry) return null;
  const label = riskLabel(entry.riskScore);
  return (
    <motion.div
      key={entry.code}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="absolute top-4 left-4 z-20 w-72 bg-dire-panel/97 backdrop-blur-sm border border-white/15 rounded-xl p-3 shadow-2xl pointer-events-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-white font-semibold text-sm">{entry.nation}</div>
          <div className="text-dire-muted text-[10px]">
            {entry.companyCount} compan{entry.companyCount === 1 ? 'y' : 'ies'} · {entry.resourceCount} resources
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold ${label.cls}`}>{entry.riskScore}</div>
          <div className={`text-[9px] font-semibold ${label.cls}`}>{label.text}</div>
        </div>
      </div>

      {/* Trend + AI confidence */}
      <div className="flex items-center gap-3 mb-2 text-[10px]">
        <span className={`font-medium ${trendColor(entry.trend)}`}>
          {trendIcon(entry.trend)} {entry.trend}
        </span>
        {entry.confidence && (
          <span className="text-dire-muted">
            AI confidence: <span className="text-white/60">{entry.confidence}</span>
          </span>
        )}
        {entry.aiAdjustment !== 0 && (
          <span className={entry.aiAdjustment > 0 ? 'text-red-400' : 'text-green-400'}>
            AI {entry.aiAdjustment > 0 ? '+' : ''}{entry.aiAdjustment}
          </span>
        )}
      </div>

      {/* AI Summary */}
      {entry.aiSummary && (
        <p className="text-[10px] text-white/70 leading-relaxed mb-2 border-l-2 border-dire-accent/40 pl-2">
          {entry.aiSummary}
        </p>
      )}

      {/* Key risks */}
      {entry.risks && entry.risks.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[9px] text-dire-muted uppercase tracking-widest mb-1">Key Risks</div>
          {entry.risks.slice(0, 2).map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-white/70">
              <span className="text-red-400 flex-shrink-0 mt-px">▸</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Score breakdown */}
      <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-2 gap-x-3 gap-y-0.5">
        {entry.factors && Object.entries(entry.factors).map(([k, v]) => (
          <div key={k} className="flex justify-between text-[9px]">
            <span className="text-dire-muted capitalize">{k.replace(/_/g, ' ')}</span>
            <span className="text-white/50 font-mono">{v}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RiskHeatmap() {
  const globeRef    = useRef();
  const containerRef = useRef();

  const [heatmapData,   setHeatmapData]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [lastUpdated,   setLastUpdated]   = useState(null);
  const [hoveredEntry,  setHoveredEntry]  = useState(null);
  const [hoveredPoly,   setHoveredPoly]   = useState(null);
  const [geoFeatures,   setGeoFeatures]   = useState([]);
  const [dims,          setDims]          = useState({ width: 700, height: 500 });
  const [selectedResource, setSelectedResource] = useState('');
  const [allResources,  setAllResources]  = useState([]);

  // Fetch heatmap data
  const fetchData = useCallback(async (resourceFilter) => {
    try {
      const params = resourceFilter ? { resource: resourceFilter } : {};
      const result = await getRiskHeatmap(params);
      const entries = result.data || [];
      setHeatmapData(entries);
      setLastUpdated(new Date());
      setError(null);

      // Collect unique resource names for filter chips
      if (!resourceFilter) {
        const names = new Set();
        entries.forEach(e => {/* resources come from factors — collect from API if needed */});
        // Resource names will come from separate getAllResources call
      }
    } catch (err) {
      console.error('[RiskHeatmap] Fetch failed:', err.message);
      setError('Failed to load heatmap data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh
  useEffect(() => {
    fetchData(selectedResource);
    const interval = setInterval(() => fetchData(selectedResource), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData, selectedResource]);

  // GeoJSON polygons
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/gh/vasturiano/react-globe.gl@master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(r => r.json())
      .then(d => setGeoFeatures(d.features || []))
      .catch(() => {});
  }, []);

  // Globe init
  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.pointOfView({ lat: 20, lng: 15, altitude: 2.2 }, 1200);
    globeRef.current.controls().autoRotate      = true;
    globeRef.current.controls().autoRotateSpeed = 0.25;
    globeRef.current.controls().enableZoom      = true;
  }, []);

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (containerRef.current) {
        setDims({
          width:  containerRef.current.clientWidth  || 700,
          height: containerRef.current.clientHeight || 500,
        });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Build a map of country name → heatmap entry for polygon coloring
  const entryByName = useMemo(() => {
    const map = {};
    for (const e of heatmapData) {
      map[e.nation.toLowerCase()] = e;
      // Also index by code for fallback matching
      map[e.code.toLowerCase()] = e;
    }
    return map;
  }, [heatmapData]);

  function resolveEntry(feature) {
    const name = (feature.properties?.ADMIN || feature.properties?.NAME || '').toLowerCase();
    return entryByName[name] ||
      Object.values(entryByName).find(e =>
        name.includes(e.nation.toLowerCase()) ||
        e.nation.toLowerCase().includes(name)
      ) || null;
  }

  const hoveredName = hoveredPoly
    ? (hoveredPoly.properties?.ADMIN || hoveredPoly.properties?.NAME || '')
    : null;

  const polygonCapColor = useCallback((feature) => {
    const entry = resolveEntry(feature);
    const name  = feature.properties?.ADMIN || feature.properties?.NAME || '';
    const isHov = name === hoveredName;
    return scoreToCapColor(entry?.riskScore ?? -1, isHov);
  }, [entryByName, hoveredName]);

  const polygonStrokeColor = useCallback((feature) => {
    const name = feature.properties?.ADMIN || feature.properties?.NAME || '';
    return name === hoveredName ? 'rgba(0,212,255,0.9)' : 'rgba(80,110,140,0.2)';
  }, [hoveredName]);

  const polygonSideColor = useCallback(() => 'rgba(0,0,0,0)', []);

  // Glow points for nations with data
  const pointsData = useMemo(() =>
    heatmapData.map(e => ({
      lat:   e.lat,
      lng:   e.lng,
      size:  0.18 + (e.riskScore / 100) * 0.45,
      color: scoreToHex(e.riskScore),
      label: `${e.nation}: ${e.riskScore}/100`,
      entry: e,
    })),
  [heatmapData]);

  // Rings on high-risk nations (score ≥ 65)
  const ringsData = useMemo(() =>
    heatmapData
      .filter(e => e.riskScore >= 65)
      .map(e => ({
        lat:              e.lat,
        lng:              e.lng,
        maxR:             4 + (e.riskScore / 100) * 10,
        propagationSpeed: 1.5,
        repeatPeriod:     1800,
        color:            scoreToHex(e.riskScore),
      })),
  [heatmapData]);

  // Resolve tooltip: prefer polygon hover
  const tooltipEntry = useMemo(() => {
    if (hoveredPoly) return resolveEntry(hoveredPoly);
    return hoveredEntry;
  }, [hoveredPoly, hoveredEntry, entryByName]);

  const handlePolyHover = useCallback((poly) => {
    setHoveredPoly(poly || null);
    if (globeRef.current) globeRef.current.controls().autoRotate = !poly;
  }, []);

  // Resource quick-filter chips
  const RESOURCE_CHIPS = [
    'Semiconductors', 'Rare Earth Elements', 'Lithium',
    'Cobalt', 'Crude Oil', 'Uranium',
  ];

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#060d18] rounded-lg overflow-hidden">

      {/* Header bar */}
      <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-dire-muted uppercase tracking-widest">Strategic Risk Heatmap</div>
          {loading && (
            <div className="w-3 h-3 rounded-full border border-dire-accent border-t-transparent animate-spin" />
          )}
          {error && (
            <div className="text-[10px] text-red-400">{error}</div>
          )}
        </div>
        {lastUpdated && (
          <div className="text-[9px] text-white/25">
            Updated {lastUpdated.toLocaleTimeString()} · auto-refresh 30s
          </div>
        )}
      </div>

      {/* Resource filter chips */}
      <div className="absolute top-9 left-4 z-20 flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedResource('')}
          className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
            !selectedResource
              ? 'bg-dire-accent/20 text-dire-accent border-dire-accent/40'
              : 'text-white/40 border-white/10 hover:text-white/60'
          }`}
        >
          All
        </button>
        {RESOURCE_CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => setSelectedResource(selectedResource === chip ? '' : chip)}
            className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
              selectedResource === chip
                ? 'bg-dire-accent/20 text-dire-accent border-dire-accent/40'
                : 'text-white/40 border-white/10 hover:text-white/60'
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipEntry && <HeatmapTooltip entry={tooltipEntry} />}
      </AnimatePresence>

      {/* Legend */}
      <HeatmapLegend />

      {/* Nation count */}
      {!loading && heatmapData.length > 0 && (
        <div className="absolute bottom-5 right-4 z-20 text-[9px] text-white/25">
          {heatmapData.length} nations scored
        </div>
      )}

      {/* Globe */}
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center text-dire-muted text-sm">
          Loading heatmap…
        </div>
      }>
        <Globe
          ref={globeRef}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

          polygonsData={geoFeatures}
          polygonAltitude={0.007}
          polygonCapColor={polygonCapColor}
          polygonSideColor={polygonSideColor}
          polygonStrokeColor={polygonStrokeColor}
          onPolygonHover={handlePolyHover}

          pointsData={pointsData}
          pointLat="lat"
          pointLng="lng"
          pointRadius="size"
          pointColor="color"
          pointAltitude={0.01}
          pointLabel="label"
          onPointHover={(pt) => setHoveredEntry(pt?.entry || null)}

          ringsData={ringsData}
          ringLat="lat"
          ringLng="lng"
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
          ringColor="color"

          atmosphereColor="rgba(50,120,200,0.6)"
          atmosphereAltitude={0.18}
          animateIn={true}
          width={dims.width}
          height={dims.height}
        />
      </Suspense>
    </div>
  );
}
