import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRiskHeatmap, getAIInsight, getTradeRoutes, getCompaniesByNation } from '../../utils/api';

const Globe = lazy(() => import('react-globe.gl'));

const RESOURCES = [
  'Semiconductors', 'Rare Earth Elements', 'Crude Oil', 'Lithium',
  'Cobalt', 'Copper', 'Natural Gas', 'Uranium', 'Titanium', 'Iron Ore',
];

const GEOJSON_URL =
  'https://cdn.jsdelivr.net/gh/vasturiano/react-globe.gl@master/example/datasets/ne_110m_admin_0_countries.geojson';

function riskColor(score, alpha) {
  if (score >= 70) return `rgba(239,68,68,${alpha})`;
  if (score >= 50) return `rgba(249,115,22,${alpha})`;
  if (score >= 30) return `rgba(251,191,36,${alpha})`;
  return `rgba(34,197,94,${alpha})`;
}

function riskLabel(score) {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MODERATE';
  return 'LOW';
}

function trendArrow(trend) {
  if (!trend) return '→';
  if (trend === 'up' || trend === 'rising' || trend === 'worsening') return '↑';
  if (trend === 'down' || trend === 'falling' || trend === 'improving') return '↓';
  return '→';
}

// ─── HoverTooltip ────────────────────────────────────────────────────────────

function HoverTooltip({ nation }) {
  const resources = useMemo(() => {
    if (!nation) return [];
    const src = nation.factors || nation.risks || [];
    return Array.isArray(src) ? src.slice(0, 2) : [];
  }, [nation]);

  return (
    <AnimatePresence>
      {nation && (
        <motion.div
          key={nation.code || nation.nation}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="absolute top-4 left-4 z-20 pointer-events-none"
        >
          <div className="bg-[#0a1628]/95 backdrop-blur-sm border border-white/15 rounded-xl px-4 py-3 min-w-[200px]">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-white text-sm font-semibold">{nation.nation}</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: riskColor(nation.riskScore, 0.25), color: riskColor(nation.riskScore, 1) }}
              >
                {nation.riskScore}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#8a9bb8]">
              <span style={{ color: riskColor(nation.riskScore, 0.9) }}>{riskLabel(nation.riskScore)}</span>
              <span className="text-white/40">·</span>
              <span>{trendArrow(nation.trend)}</span>
            </div>
            {resources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {resources.map((r, i) => (
                  <span key={i} className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[#8a9bb8]">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── InsightPanel ─────────────────────────────────────────────────────────────

function InsightPanel({ nation, insightData, insightLoading, companies, onClose }) {
  const displaySummary = insightData?.summary || insightData?.analysis || nation?.aiSummary || null;
  const riskList = insightData?.risks || insightData?.key_risks || [];
  const opportunities = insightData?.opportunities || [];
  const outlook = insightData?.outlook || null;

  return (
    <AnimatePresence>
      {nation && (
        <motion.div
          key="insight-panel"
          initial={{ x: 380 }}
          animate={{ x: 0 }}
          exit={{ x: 380 }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          className="absolute right-0 top-0 h-full z-30 flex flex-col"
          style={{ width: 380 }}
        >
          <div className="h-full bg-[#080f1e] border-l border-white/10 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-white/8 shrink-0">
              <div>
                <div className="text-white font-semibold text-base leading-tight">{nation.nation}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: riskColor(nation.riskScore, 0.2), color: riskColor(nation.riskScore, 1) }}
                  >
                    Risk {nation.riskScore}
                  </span>
                  <span className="text-[11px] text-[#8a9bb8]">{riskLabel(nation.riskScore)}</span>
                  <span className="text-[#8a9bb8] text-xs">{trendArrow(nation.trend)}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-[#8a9bb8] hover:text-white transition-colors p-1 rounded-md hover:bg-white/8 mt-0.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {insightLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
                  <span className="text-[#8a9bb8] text-sm">Analysing intelligence...</span>
                </div>
              ) : (
                <>
                  {/* Nation Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Risk Score', value: nation.riskScore },
                      { label: 'Confidence', value: nation.confidence ? `${nation.confidence}%` : '—' },
                      { label: 'Companies', value: nation.companyCount ?? companies.length },
                      { label: 'Resources', value: nation.resourceCount ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white/4 border border-white/8 rounded-lg px-3 py-2">
                        <div className="text-[10px] text-[#8a9bb8] uppercase tracking-wider mb-0.5">{label}</div>
                        <div className="text-white text-sm font-semibold">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* AI Summary */}
                  {displaySummary && (
                    <div>
                      <SectionTitle>AI Summary</SectionTitle>
                      <p className="text-[#8a9bb8] text-xs leading-relaxed">{displaySummary}</p>
                    </div>
                  )}

                  {/* Risk Factors */}
                  {riskList.length > 0 && (
                    <div>
                      <SectionTitle>Risk Factors</SectionTitle>
                      <ul className="space-y-1.5">
                        {riskList.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-[#8a9bb8]">
                            <span className="mt-0.5 text-red-400 shrink-0">▪</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Opportunities */}
                  {opportunities.length > 0 && (
                    <div>
                      <SectionTitle>Opportunities</SectionTitle>
                      <ul className="space-y-1.5">
                        {opportunities.map((o, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-[#8a9bb8]">
                            <span className="mt-0.5 text-emerald-400 shrink-0">▪</span>
                            <span>{o}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Outlook */}
                  {outlook && (
                    <div>
                      <SectionTitle>Outlook</SectionTitle>
                      <p className="text-[#8a9bb8] text-xs leading-relaxed">{outlook}</p>
                    </div>
                  )}

                  {/* Companies */}
                  {companies.length > 0 && (
                    <div>
                      <SectionTitle>Active Companies</SectionTitle>
                      <div className="space-y-1.5">
                        {companies.map((c) => (
                          <div key={c.id} className="flex items-center justify-between bg-white/4 border border-white/8 rounded-lg px-3 py-2">
                            <span className="text-white text-xs font-medium">{c.name}</span>
                            {c.industry && (
                              <span className="text-[10px] bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20 rounded px-1.5 py-0.5">
                                {c.industry}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resource Breakdown */}
                  {Array.isArray(nation.factors) && nation.factors.length > 0 && (
                    <div>
                      <SectionTitle>Resource Breakdown</SectionTitle>
                      <div className="flex flex-wrap gap-1.5">
                        {nation.factors.map((f, i) => (
                          <span key={i} className="text-[11px] bg-white/5 border border-white/10 rounded px-2 py-1 text-[#8a9bb8]">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-[#00d4ff]/70 font-semibold mb-2 border-b border-white/6 pb-1">
      {children}
    </div>
  );
}

// ─── ControlsPanel ───────────────────────────────────────────────────────────

function ControlsPanel({ showHeatmap, setShowHeatmap, showRoutes, setShowRoutes, selectedNation, onOpenAI, selectedResource, setSelectedResource }) {
  return (
    <div className="absolute bottom-4 right-4 z-20">
      <div className="bg-[#0a1628]/90 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex flex-col gap-2 min-w-[170px]">
        <TogglePill active={showHeatmap} onClick={() => setShowHeatmap((v) => !v)} label="Risk Heatmap" icon="🔥" />
        <TogglePill active={showRoutes} onClick={() => setShowRoutes((v) => !v)} label="Trade Routes" icon="↗" />
        <TogglePill
          active={!!selectedNation}
          onClick={() => { if (selectedNation) onOpenAI(); }}
          label="AI Panel"
          icon="🧠"
          disabled={!selectedNation}
        />
        <div className="mt-1 border-t border-white/8 pt-2">
          <label className="text-[9px] uppercase tracking-widest text-[#8a9bb8] block mb-1">Resource Filter</label>
          <select
            value={selectedResource || ''}
            onChange={(e) => setSelectedResource(e.target.value || null)}
            className="w-full bg-[#0d1b2e] border border-white/10 rounded-lg text-[11px] text-white px-2 py-1.5 outline-none focus:border-[#00d4ff]/40"
          >
            <option value="">All Resources</option>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function TogglePill({ active, onClick, label, icon, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-colors w-full text-left ${
        active
          ? 'bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/30'
          : 'bg-white/4 text-[#8a9bb8] border-white/10 hover:text-white hover:bg-white/8'
      } ${disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Top5Panel ────────────────────────────────────────────────────────────────

function Top5Panel({ hotspots, onSelect }) {
  const top5 = useMemo(
    () => [...hotspots].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
    [hotspots],
  );

  if (!top5.length) return null;

  return (
    <div className="absolute top-14 left-4 z-20">
      <div className="bg-[#0a1628]/85 backdrop-blur-sm border border-white/10 rounded-xl p-3 min-w-[200px]">
        <div className="text-[9px] uppercase tracking-widest text-[#8a9bb8] font-semibold mb-2.5">
          Top Risk Nations
        </div>
        <div className="space-y-1.5">
          {top5.map((n, idx) => (
            <button
              key={n.code || n.nation}
              onClick={() => onSelect(n)}
              className="w-full flex items-center gap-2 group"
            >
              <span className="text-[10px] text-[#8a9bb8] w-4 shrink-0">{idx + 1}</span>
              <span className="text-[10px] text-[#8a9bb8] w-5 shrink-0">{n.code?.slice(0, 2) || '??'}</span>
              <span className="text-[11px] text-white group-hover:text-[#00d4ff] transition-colors flex-1 text-left truncate">
                {n.nation}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-14 h-1 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${n.riskScore}%`, backgroundColor: riskColor(n.riskScore, 0.9) }}
                  />
                </div>
                <span
                  className="text-[10px] font-bold w-7 text-right"
                  style={{ color: riskColor(n.riskScore, 1) }}
                >
                  {n.riskScore}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GlobeInner ───────────────────────────────────────────────────────────────

function GlobeInner({
  dims, hotspots, routes, showHeatmap, showRoutes,
  hoveredNation, setHoveredNation, onNationClick, geoFeatures,
}) {
  const globeRef = useRef(null);
  const isHovering = useRef(false);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView({ lat: 20, lng: 30, altitude: 2.2 }, 0);
    const controls = g.controls?.();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.25;
    }
  }, []);

  // ── Points ──
  const pointsData = useMemo(() => (showHeatmap ? hotspots : []), [showHeatmap, hotspots]);

  const getPointSize = useCallback((d) => 0.08 + (d.riskScore / 100) * 0.45, []);
  const getPointColor = useCallback((d) => riskColor(d.riskScore, 0.9), []);
  const getPointAltitude = useCallback(() => 0.015, []);

  // ── Rings ──
  const ringsData = useMemo(
    () => hotspots.filter((h) => h.riskScore >= 55),
    [hotspots],
  );

  const getRingMaxR = useCallback((d) => 4 + (d.riskScore / 100) * 10, []);
  const getRingPropSpeed = useCallback((d) => 1.5 + (d.riskScore / 100) * 2, []);
  const getRingRepeatPeriod = useCallback((d) => 1800 - (d.riskScore / 100) * 600, []);
  const getRingColor = useCallback((d) => riskColor(d.riskScore, 0.7), []);

  // ── Arcs ──
  const arcsData = useMemo(() => {
    if (!showRoutes) return [];
    return routes.slice(0, 25).map((r) => ({
      startLat: r.from.lat, startLng: r.from.lng,
      endLat: r.to.lat, endLng: r.to.lng,
      status: r.status, name: r.name,
    }));
  }, [showRoutes, routes]);

  const getArcColor = useCallback((d) => {
    if (d.status === 'disrupted') return '#ef4444';
    if (d.status === 'stressed') return '#f97316';
    return '#22d3ee';
  }, []);

  // ── Polygons ──
  const hotspotMap = useMemo(() => {
    const m = {};
    hotspots.forEach((h) => { m[h.nation?.toLowerCase()] = h; });
    return m;
  }, [hotspots]);

  const getCapColor = useCallback(
    (feat) => {
      const name = feat.properties?.ADMIN?.toLowerCase() || feat.properties?.NAME?.toLowerCase() || '';
      const h = hotspotMap[name];
      const hovered =
        hoveredNation &&
        (feat.properties?.ADMIN?.toLowerCase() === hoveredNation.nation?.toLowerCase() ||
          feat.properties?.NAME?.toLowerCase() === hoveredNation.nation?.toLowerCase());
      if (hovered) return 'rgba(0,212,255,0.35)';
      if (!h) return 'rgba(30,70,120,0.10)';
      return riskColor(h.riskScore, h.riskScore >= 70 ? 0.25 : h.riskScore >= 50 ? 0.20 : h.riskScore >= 30 ? 0.15 : 0.10);
    },
    [hotspotMap, hoveredNation],
  );

  const getStrokeColor = useCallback(
    (feat) => {
      const hovered =
        hoveredNation &&
        (feat.properties?.ADMIN?.toLowerCase() === hoveredNation.nation?.toLowerCase() ||
          feat.properties?.NAME?.toLowerCase() === hoveredNation.nation?.toLowerCase());
      return hovered ? 'rgba(0,212,255,0.9)' : 'rgba(100,130,160,0.20)';
    },
    [hoveredNation],
  );

  const handlePolyHover = useCallback(
    (feat) => {
      if (!feat) { if (!isHovering.current) setHoveredNation(null); return; }
      const name = feat.properties?.ADMIN?.toLowerCase() || feat.properties?.NAME?.toLowerCase() || '';
      const h = hotspotMap[name];
      setHoveredNation(h || null);
      const controls = globeRef.current?.controls?.();
      if (controls) controls.autoRotate = !feat;
    },
    [hotspotMap, setHoveredNation],
  );

  const handlePolyClick = useCallback(
    (feat) => {
      if (!feat) return;
      const name = feat.properties?.ADMIN?.toLowerCase() || feat.properties?.NAME?.toLowerCase() || '';
      const h = hotspotMap[name];
      if (h) onNationClick(h);
    },
    [hotspotMap, onNationClick],
  );

  const handlePointHover = useCallback(
    (point) => {
      setHoveredNation(point || null);
      const controls = globeRef.current?.controls?.();
      if (controls) controls.autoRotate = !point;
    },
    [setHoveredNation],
  );

  const handlePointClick = useCallback(
    (point) => { if (point) onNationClick(point); },
    [onNationClick],
  );

  return (
    <Suspense fallback={
      <div className="w-full h-full flex items-center justify-center text-[#8a9bb8] text-sm">
        Loading globe...
      </div>
    }>
      <Globe
        ref={globeRef}
        width={dims.width}
        height={dims.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#1e64c8"
        atmosphereAltitude={0.18}
        // Polygons
        polygonsData={geoFeatures}
        polygonAltitude={0.008}
        polygonCapColor={getCapColor}
        polygonSideColor={() => 'transparent'}
        polygonStrokeColor={getStrokeColor}
        onPolygonHover={handlePolyHover}
        onPolygonClick={handlePolyClick}
        // Points
        pointsData={pointsData}
        pointAltitude={getPointAltitude}
        pointRadius={getPointSize}
        pointColor={getPointColor}
        onPointHover={handlePointHover}
        onPointClick={handlePointClick}
        // Rings
        ringsData={ringsData}
        ringMaxRadius={getRingMaxR}
        ringPropagationSpeed={getRingPropSpeed}
        ringRepeatPeriod={getRingRepeatPeriod}
        ringColor={getRingColor}
        // Arcs
        arcsData={arcsData}
        arcColor={getArcColor}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={2500}
        arcStroke={0.6}
      />
    </Suspense>
  );
}

// ─── GeoIntelGlobe (main) ─────────────────────────────────────────────────────

export default function GeoIntelGlobe() {
  const containerRef = useRef(null);

  const [hotspots, setHotspots] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNation, setSelectedNation] = useState(null);
  const [hoveredNation, setHoveredNation] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [selectedResource, setSelectedResource] = useState(null);
  const [insightData, setInsightData] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [nationCompanies, setNationCompanies] = useState([]);
  const [dims, setDims] = useState({ width: 800, height: 600 });
  const [geoFeatures, setGeoFeatures] = useState([]);

  // ── Responsive dims ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDims({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setDims({ width: Math.floor(r.width), height: Math.floor(r.height) });
    return () => ro.disconnect();
  }, []);

  // ── GeoJSON ──
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then((d) => setGeoFeatures(d.features || []))
      .catch(() => setGeoFeatures([]));
  }, []);

  // ── Initial data load ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = selectedResource ? { resource: selectedResource } : {};
        const [heatRes, routeRes] = await Promise.all([
          getRiskHeatmap(params),
          getTradeRoutes(),
        ]);
        setHotspots(heatRes?.data || []);
        setRoutes(routeRes?.data || []);
      } catch {
        setHotspots([]);
        setRoutes([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedResource]);

  // ── Nation click handler ──
  const handleNationClick = useCallback(async (hotspot) => {
    setSelectedNation(hotspot);
    setInsightData(null);
    setInsightLoading(true);
    setNationCompanies([]);

    try {
      const [companiesRes] = await Promise.all([
        getCompaniesByNation(hotspot.code),
      ]);
      const companies = companiesRes?.data || [];
      setNationCompanies(companies);

      const top3Resources = Array.isArray(hotspot.factors)
        ? hotspot.factors.slice(0, 3)
        : Array.isArray(hotspot.risks)
        ? hotspot.risks.slice(0, 3)
        : [];

      const insight = await getAIInsight({
        nation: hotspot.nation,
        company: companies[0]?.name || hotspot.nation,
        resources: top3Resources.join(','),
      });
      setInsightData(insight);
    } catch {
      setInsightData(null);
    } finally {
      setInsightLoading(false);
    }
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedNation(null);
    setInsightData(null);
    setNationCompanies([]);
  }, []);

  const handleOpenAI = useCallback(() => {
    if (selectedNation && !insightData && !insightLoading) {
      handleNationClick(selectedNation);
    }
  }, [selectedNation, insightData, insightLoading, handleNationClick]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#060d18] overflow-hidden">
      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[#060d18]"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
              <span className="text-[#8a9bb8] text-sm">Loading geopolitical intelligence...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Globe */}
      {dims.width > 0 && dims.height > 0 && (
        <GlobeInner
          dims={dims}
          hotspots={hotspots}
          routes={routes}
          showHeatmap={showHeatmap}
          showRoutes={showRoutes}
          hoveredNation={hoveredNation}
          setHoveredNation={setHoveredNation}
          onNationClick={handleNationClick}
          geoFeatures={geoFeatures}
        />
      )}

      {/* Overlay panels */}
      <HoverTooltip nation={hoveredNation && !selectedNation ? hoveredNation : null} />

      <Top5Panel hotspots={hotspots} onSelect={handleNationClick} />

      <ControlsPanel
        showHeatmap={showHeatmap}
        setShowHeatmap={setShowHeatmap}
        showRoutes={showRoutes}
        setShowRoutes={setShowRoutes}
        selectedNation={selectedNation}
        onOpenAI={handleOpenAI}
        selectedResource={selectedResource}
        setSelectedResource={setSelectedResource}
      />

      <InsightPanel
        nation={selectedNation}
        insightData={insightData}
        insightLoading={insightLoading}
        companies={nationCompanies}
        onClose={handleClosePanel}
      />
    </div>
  );
}
