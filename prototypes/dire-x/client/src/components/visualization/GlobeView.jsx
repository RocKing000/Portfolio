import { useEffect, useRef, useState, useMemo, lazy, Suspense, useCallback } from 'react';
import { motion } from 'framer-motion';
import useStore from '../../store/useStore';
import { GLOBE_MOUNT_DELAY_MS } from '../../config';

const Globe = lazy(() => import('react-globe.gl'));

// Module-level GeoJSON cache.
// main.jsx starts the network fetch at app boot (window.__geoJsonFetch).
// We DON'T parse at module load time — JSON.parse on 500KB blocks the main thread
// and can drop frames. Instead, parsing happens lazily when useEffect calls this.
const GEOJSON_URL = 'https://cdn.jsdelivr.net/gh/vasturiano/react-globe.gl@master/example/datasets/ne_110m_admin_0_countries.geojson';
let _geoJsonCache = null;
let _geoJsonPromise = null;
function fetchGeoJson() {
  if (_geoJsonCache) return Promise.resolve(_geoJsonCache);
  if (_geoJsonPromise) return _geoJsonPromise;
  // Reuse the response already in-flight from main.jsx, or start a new fetch
  const base = window.__geoJsonFetch || fetch(GEOJSON_URL).catch(() => null);
  _geoJsonPromise = Promise.resolve(base)
    .then((r) => r?.json())
    .then((d) => { _geoJsonCache = d?.features || []; return _geoJsonCache; })
    .catch(() => []);
  return _geoJsonPromise;
}

const STATUS_COLORS = { stable: '#22c55e', stressed: '#ff6b35', disrupted: '#ef4444' };

function riskToColor(risk) {
  if (risk >= 0.7) return '#ef4444';
  if (risk >= 0.5) return '#ff6b35';
  if (risk >= 0.3) return '#fbbf24';
  return '#22c55e';
}

function riskToCapColor(risk, isHovered, isSelected) {
  if (isSelected) {
    if (risk >= 0.7) return 'rgba(239, 68, 68, 0.75)';
    if (risk >= 0.5) return 'rgba(251, 146, 60, 0.70)';
    if (risk >= 0.3) return 'rgba(251, 191, 36, 0.65)';
    return 'rgba(34, 197, 94, 0.65)';
  }
  if (isHovered) return 'rgba(0, 212, 255, 0.45)';
  if (risk >= 0.7) return 'rgba(239, 68, 68, 0.20)';
  if (risk >= 0.5) return 'rgba(251, 146, 60, 0.15)';
  if (risk >= 0.3) return 'rgba(251, 191, 36, 0.12)';
  return 'rgba(30, 70, 120, 0.12)';
}

// Availability: share of global production (0–1)
function availabilityCapColor(share) {
  if (share >= 0.30) return 'rgba(34, 197, 94, 0.75)';   // dominant supplier → green
  if (share >= 0.15) return 'rgba(0, 212, 255, 0.70)';   // major → cyan
  if (share >= 0.05) return 'rgba(251, 191, 36, 0.65)';  // moderate → amber
  return 'rgba(249, 115, 22, 0.55)';                      // minor → orange
}

// Match a GeoJSON feature name to a producer entry (full-name fuzzy match)
function matchProducer(featureName, producers) {
  if (!featureName || !producers?.length) return null;
  const fn = featureName.toLowerCase();
  return producers.find((p) => {
    const pn = p.country.toLowerCase();
    return fn.includes(pn) || pn.includes(fn);
  }) || null;
}

export default function GlobeView() {
  const globeRef = useRef();
  const containerRef = useRef();

  const countries      = useStore((s) => s.countries);
  const tradeRoutes    = useStore((s) => s.tradeRoutes);
  const showTradeRoutes  = useStore((s) => s.showTradeRoutes);
  const selectedNation   = useStore((s) => s.selectedNation);
  const resourceHeatmap  = useStore((s) => s.resourceHeatmap);
  const selectedResource = useStore((s) => s.selectedResource);
  const globeViewMode    = useStore((s) => s.globeViewMode);
  const activeScenarios  = useStore((s) => s.activeScenarios);
  const fetchGeoData     = useStore((s) => s.fetchGeoData);
  const fetchTradeRoutes = useStore((s) => s.fetchTradeRoutes);
  const globeReady       = useStore((s) => s.globeReady);
  const setGlobeReady    = useStore((s) => s.setGlobeReady);

  const [hoveredPoint,   setHoveredPoint]   = useState(null);
  const [hoveredPolygon, setHoveredPolygon] = useState(null);
  const [geoFeatures,    setGeoFeatures]    = useState([]);
  const [dims,           setDims]           = useState({ width: 700, height: 500 });
  const [webglReady,     setWebglReady]     = useState(false);
  // Delay Globe mount so the spinner renders + gets promoted to its own
  // GPU composite layer before WebGL initialization contends for the GPU
  const [mountGlobe,     setMountGlobe]     = useState(false);

  // Initial data
  useEffect(() => {
    fetchGeoData();
    fetchTradeRoutes();
  }, [fetchGeoData, fetchTradeRoutes]);

  // Delay Globe mount: 900ms lets the spinner fully settle on its GPU layer
  // before WebGL shader compilation begins competing for the GPU
  useEffect(() => {
    const t = setTimeout(() => setMountGlobe(true), GLOBE_MOUNT_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Countries GeoJSON — network fetch started in main.jsx, parsed here after mount
  useEffect(() => {
    fetchGeoJson().then((features) => setGeoFeatures(features));
  }, []);

  // Responsive container sizing
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

  // Globe initialization — runs in onGlobeReady so globeRef is guaranteed to be set
  const handleGlobeReady = useCallback(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 20, lng: 30, altitude: 2.0 }, 0);
      globeRef.current.controls().autoRotate      = true;
      globeRef.current.controls().autoRotateSpeed = 0.3;
      globeRef.current.controls().enableZoom      = true;
      globeRef.current.controls().minDistance     = 150;
      globeRef.current.controls().maxDistance     = 900;
    }
    setWebglReady(true);
  }, []);

  // Signal global readiness only when WebGL + both data sets are loaded.
  // The extra 600ms lets the globe's WebGL pipeline actually render the data
  // before the spinner lifts — eliminates the "data arrives late" visual gap.
  useEffect(() => {
    if (!webglReady || countries.length === 0 || geoFeatures.length === 0) return;
    const t = setTimeout(() => {
      setGlobeReady();
      // Fade out and remove the static HTML loader from index.html.
      // It lives outside React so it's unaffected by JS work — the smoothest possible spinner.
      const loader = document.getElementById('app-loader');
      if (loader) {
        loader.classList.add('hide');
        setTimeout(() => loader.remove(), 750);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [webglReady, countries, geoFeatures, setGlobeReady]);

  // Fly to selected nation when it changes
  useEffect(() => {
    if (!globeRef.current || !selectedNation || geoFeatures.length === 0) return;
    const feat = geoFeatures.find(
      (f) => (f.properties?.ISO_A2 || '').toUpperCase() === selectedNation.toUpperCase()
    );
    if (!feat) return;
    // Use centroid from bounding box as fallback
    const coords = feat.properties?.LABEL_X != null
      ? { lat: feat.properties.LABEL_Y, lng: feat.properties.LABEL_X }
      : (() => {
          const bounds = feat.bbox;
          if (bounds) return { lat: (bounds[1] + bounds[3]) / 2, lng: (bounds[0] + bounds[2]) / 2 };
          return null;
        })();
    if (!coords) return;
    globeRef.current.controls().autoRotate = false;
    globeRef.current.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 1.8 }, 1200);
  }, [selectedNation, geoFeatures]);

  // Points — hidden when a resource is selected (polygons handle it)
  const pointsData = useMemo(() => {
    if (selectedResource) return [];
    return countries.map((c) => ({
      lat: c.lat, lng: c.lng,
      size: 0.12 + c.risk * 0.30,
      color: riskToColor(c.risk),
      label: `${c.name}: Risk ${Math.round(c.risk * 100)}%`,
      altitude: 0.01, risk: c.risk, country: c.name,
    }));
  }, [countries, selectedResource]);

  // Arcs — capped at 20 for performance
  const arcsData = useMemo(() => {
    if (!showTradeRoutes) return [];
    return tradeRoutes.slice(0, 20).map((r) => ({
      startLat: r.from.lat, startLng: r.from.lng,
      endLat:   r.to.lat,   endLng:   r.to.lng,
      color:      STATUS_COLORS[r.status] || STATUS_COLORS.stable,
      label:      `${r.name} (${r.status})`,
      stroke:     r.status === 'disrupted' ? 1.5 : 0.8,
      dashLength: r.status === 'disrupted' ? 0.3 : r.status === 'stressed' ? 0.5 : 1,
      dashGap:    r.status === 'disrupted' ? 0.2 : 0,
    }));
  }, [tradeRoutes, showTradeRoutes]);

  // Scenario rings
  const ringsData = useMemo(() => {
    const rings = [];
    const LOCS = {
      drought:      [{ lat: 20, lng: 30 }, { lat: 10, lng: 78 }],
      war:          [{ lat: 35, lng: 45 }, { lat: 50, lng: 36 }],
      supply_crisis:[{ lat: 1.4, lng: 103.8 }, { lat: 30, lng: 32 }],
      pandemic:     [{ lat: 35, lng: 104 }],
      trade_war:    [{ lat: 39, lng: -98 }, { lat: 35, lng: 104 }],
    };
    for (const s of activeScenarios) {
      for (const loc of (LOCS[s.type] || [])) {
        rings.push({
          lat: loc.lat, lng: loc.lng,
          maxR:             5 + s.intensity * 12,
          propagationSpeed: 1 + s.intensity * 2,
          repeatPeriod:     1500 - s.intensity * 400,
          color: s.type === 'war' ? '#ef4444' : s.type === 'drought' ? '#fbbf24' : '#ff6b35',
        });
      }
    }
    return rings;
  }, [activeScenarios]);

  // Polygon hover handler — also pauses auto-rotate while hovering
  const handlePolygonHover = useCallback((polygon) => {
    setHoveredPolygon(polygon || null);
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = !polygon;
    }
  }, []);

  // Derive hovered country name for color callbacks
  const hoveredName = hoveredPolygon
    ? (hoveredPolygon.properties?.ADMIN || hoveredPolygon.properties?.NAME)
    : null;

  // Memoised polygon colour functions
  const polygonCapColor = useCallback((feature) => {
    const name = feature.properties?.ADMIN || feature.properties?.NAME;
    const iso2 = feature.properties?.ISO_A2 || '';
    const isHovered = name === hoveredName;

    // ── Resource filter active: highlight producer landmasses by view mode ──
    if (selectedResource && resourceHeatmap?.producers?.length > 0) {
      if (isHovered) return 'rgba(0, 212, 255, 0.45)';
      const producer = matchProducer(name, resourceHeatmap.producers);
      if (!producer) return 'rgba(20, 40, 80, 0.07)'; // dim non-producers
      if (globeViewMode === 'availability') return availabilityCapColor(producer.share);
      if (globeViewMode === 'combined') {
        // combined score: higher = riskier AND scarcer
        const score = producer.risk * 0.5 + (1 - producer.share) * 0.5;
        return riskToCapColor(score, false, true);
      }
      // risk (default)
      return riskToCapColor(producer.risk, false, true);
    }

    // ── Nation filter: highlight selected nation ──
    const isSelectedNation = selectedNation
      ? iso2.toUpperCase() === selectedNation.toUpperCase()
      : false;
    const countryMatch = countries.find((c) =>
      name?.toLowerCase().includes(c.name.toLowerCase()) ||
      c.name.toLowerCase().includes((name || '').toLowerCase())
    );
    return riskToCapColor(countryMatch?.risk || 0, isHovered, isSelectedNation);
  }, [hoveredName, countries, selectedNation, selectedResource, resourceHeatmap, globeViewMode]);

  const polygonSideColor  = useCallback(() => 'rgba(0,0,0,0)', []);

  const polygonStrokeColor = useCallback((feature) => {
    const name = feature.properties?.ADMIN || feature.properties?.NAME;
    const iso2 = feature.properties?.ISO_A2 || '';
    if (name === hoveredName) return 'rgba(0, 212, 255, 0.9)';
    if (selectedResource && resourceHeatmap?.producers?.length > 0) {
      const producer = matchProducer(name, resourceHeatmap.producers);
      if (producer) return 'rgba(255, 255, 255, 0.7)';
    }
    const isSelectedNation = selectedNation
      ? iso2.toUpperCase() === selectedNation.toUpperCase()
      : false;
    if (isSelectedNation) return 'rgba(255, 255, 255, 0.9)';
    return 'rgba(100, 130, 160, 0.22)';
  }, [hoveredName, selectedNation, selectedResource, resourceHeatmap]);

  // Tooltip: polygon hover takes priority over point hover
  const tooltipData = hoveredPolygon
    ? (() => {
        const name = hoveredPolygon.properties?.ADMIN || hoveredPolygon.properties?.NAME || 'Unknown';
        // If resource is active, show producer data for this country
        if (selectedResource && resourceHeatmap?.producers?.length > 0) {
          const producer = matchProducer(name, resourceHeatmap.producers);
          if (producer) return { name, risk: producer.risk, share: producer.share, hasRisk: true, isProducer: true };
          return { name, risk: null, hasRisk: false };
        }
        const match = countries.find((c) =>
          name.toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(name.toLowerCase())
        );
        return { name, risk: match?.risk, hasRisk: !!match };
      })()
    : hoveredPoint
      ? { name: hoveredPoint.country, risk: hoveredPoint.risk, hasRisk: true }
      : null;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#060d18] rounded-lg overflow-hidden">

      {/* Country / point tooltip */}
      {tooltipData && (
        <motion.div
          key={tooltipData.name}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute top-4 left-4 z-20 bg-dire-panel/95 backdrop-blur-sm border border-white/15 rounded-lg px-3 py-2 text-xs pointer-events-none shadow-xl"
        >
          <div className="text-white font-semibold text-sm">{tooltipData.name}</div>
          {tooltipData.hasRisk && tooltipData.isProducer && (
            <div className="space-y-0.5 mt-0.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-dire-accent" />
                <span className="text-dire-muted">
                  Share:{' '}
                  <span className="text-dire-accent font-semibold">
                    {Math.round(tooltipData.share * 100)}%
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: riskToColor(tooltipData.risk) }}
                />
                <span className="text-dire-muted">
                  Risk:{' '}
                  <span className={
                    tooltipData.risk >= 0.6 ? 'text-red-400 font-semibold' :
                    tooltipData.risk >= 0.3 ? 'text-amber-400' : 'text-green-400'
                  }>
                    {Math.round(tooltipData.risk * 100)}%
                  </span>
                </span>
              </div>
            </div>
          )}
          {tooltipData.hasRisk && !tooltipData.isProducer && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: riskToColor(tooltipData.risk) }}
              />
              <span className="text-dire-muted">
                Supply Risk:{' '}
                <span className={
                  tooltipData.risk >= 0.6 ? 'text-red-400 font-semibold' :
                  tooltipData.risk >= 0.3 ? 'text-amber-400' : 'text-green-400'
                }>
                  {Math.round(tooltipData.risk * 100)}%
                </span>
              </span>
            </div>
          )}
          {!tooltipData.hasRisk && (
            <div className="text-dire-muted text-[10px] mt-0.5">No risk data</div>
          )}
        </motion.div>
      )}

      {/* Active resource indicator */}
      {selectedResource && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-12 right-4 z-20 bg-dire-accent/15 border border-dire-accent/30 rounded-lg px-3 py-1.5 text-xs text-dire-accent font-medium flex flex-col gap-0.5"
        >
          <span>{selectedResource}</span>
          <span className="text-[9px] text-dire-muted capitalize">{globeViewMode} view</span>
        </motion.div>
      )}

      {/* Hover hint */}
      {!tooltipData && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[10px] text-white/25 pointer-events-none">
          Hover a country to inspect · Click to select
        </div>
      )}


      {/* Globe — mounts after 250ms delay, fades in only after data+WebGL ready */}
      <motion.div
        className="w-full h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: globeReady ? 1 : 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        {mountGlobe && <Suspense fallback={null}>
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
            onPolygonHover={handlePolygonHover}
            polygonLabel={(f) => f.properties?.ADMIN || f.properties?.NAME || ''}

            pointsData={pointsData}
            pointLat="lat"
            pointLng="lng"
            pointAltitude="altitude"
            pointRadius="size"
            pointColor="color"
            pointLabel="label"
            onPointHover={setHoveredPoint}

            arcsData={arcsData}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor="color"
            arcStroke="stroke"
            arcDashLength="dashLength"
            arcDashGap="dashGap"
            arcDashAnimateTime={2000}

            ringsData={ringsData}
            ringLat="lat"
            ringLng="lng"
            ringMaxRadius="maxR"
            ringPropagationSpeed="propagationSpeed"
            ringRepeatPeriod="repeatPeriod"
            ringColor="color"

            atmosphereColor="rgba(50, 120, 200, 0.7)"
            atmosphereAltitude={0.18}
            animateIn={false}
            onGlobeReady={handleGlobeReady}
            width={dims.width}
            height={dims.height}
          />
        </Suspense>}
      </motion.div>
    </div>
  );
}
