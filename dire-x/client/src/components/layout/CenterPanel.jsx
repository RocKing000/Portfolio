import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import useStore from '../../store/useStore';
import SimulationTimeline from '../simulation/SimulationTimeline';
import ErrorBoundary from '../shared/ErrorBoundary';

const GlobeView    = lazy(() => import('../visualization/GlobeView'));
const RiskHeatmap  = lazy(() => import('../visualization/RiskHeatmap'));
const GeoIntelGlobe = lazy(() => import('../globe/GeoIntelGlobe'));

const SCENARIO_BADGE_COLORS = {
  supply_crisis: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  war: 'bg-red-500/20 text-red-400 border-red-500/30',
  drought: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  pandemic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  trade_war: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  cyber_attack: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  energy_crisis: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const SCENARIO_LABELS = {
  supply_crisis: 'Supply Crisis', war: 'War', drought: 'Drought',
  pandemic: 'Pandemic', trade_war: 'Trade War', cyber_attack: 'Cyber Attack', energy_crisis: 'Energy Crisis',
};

export default function CenterPanel({ tier }) {
  const mode       = useStore((s) => s.mode);
  const setMode    = useStore((s) => s.setMode);
  const centerMode = useStore((s) => s.centerMode);
  const activeScenarios = useStore((s) => s.activeScenarios);
  const scenario = useStore((s) => s.scenario);
  const [view, setView] = useState('globe'); // 'globe' | 'heatmap' | 'timeline' | 'intel'

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col">
      {/* Top bar — view toggle + scenario badges, in flow (no absolute overlap) */}
      <motion.div
        className="flex-shrink-0 flex items-center justify-between gap-3 px-5 h-10 border-b border-white/5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        {/* Scenario badges */}
        <div className="flex flex-wrap gap-1.5 min-w-0">
          {mode === 'open_world' &&
            activeScenarios.map((s) => {
              const colors = SCENARIO_BADGE_COLORS[s.type] || SCENARIO_BADGE_COLORS.supply_crisis;
              const label = SCENARIO_LABELS[s.type] || s.type;
              return (
                <motion.span
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${colors}`}
                >
                  {label} &bull; {Math.round(s.intensity * 100)}%
                </motion.span>
              );
            })}
          {mode === 'arcade' && scenario !== 'stable' && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                SCENARIO_BADGE_COLORS[scenario] || 'bg-dire-accent/20 text-dire-accent border-dire-accent/30'
              }`}
            >
              {SCENARIO_LABELS[scenario] || scenario}
            </motion.span>
          )}
        </div>

        {/* View toggle (dashboard only) + Mode toggle */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {centerMode === 'dashboard' && (
            <div className="flex bg-dire-dark/80 backdrop-blur-sm rounded-lg p-0.5 gap-0.5">
              {[
                { id: 'globe',    label: 'Globe'       },
                { id: 'heatmap',  label: 'Heatmap'     },
                { id: 'timeline', label: 'Timeline'    },
                { id: 'intel',    label: 'Intel Globe' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`px-3 py-1 text-[10px] rounded-md transition-colors ${
                    view === id ? 'bg-dire-accent/20 text-dire-accent' : 'text-dire-muted hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Mode toggle (Open World | Arcade) */}
          <div className="relative flex bg-dire-dark rounded-lg p-0.5">
            <span className="self-center px-2 text-[9px] text-dire-muted/60 font-medium uppercase tracking-wider">Mode</span>
            {['open_world', 'arcade'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={clsx(
                  'relative z-10 px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors',
                  mode === m ? 'text-white' : 'text-dire-muted hover:text-white/70'
                )}
              >
                {m === 'open_world' ? 'Open World' : 'Arcade'}
                {mode === m && (
                  <motion.div
                    className="absolute inset-0 bg-dire-accent/20 border border-dire-accent/30 rounded-md"
                    layoutId="mode-indicator"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* View content — both layers always mounted, crossfaded to avoid globe re-init */}
      <div className="flex-1 overflow-hidden relative">

        {/* ── Simulation layer ── */}
        <motion.div
          className="absolute inset-0 overflow-y-auto p-5"
          initial={{ opacity: 0 }}
          animate={{
            opacity: centerMode === 'simulation' ? 1 : 0,
            pointerEvents: centerMode === 'simulation' ? 'auto' : 'none',
          }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
        >
          <SimulationTimeline />
        </motion.div>

        {/* ── Dashboard layer ── */}
        <motion.div
          className="absolute inset-0 flex flex-col"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{
            opacity: centerMode === 'dashboard' ? 1 : 0,
            scale: centerMode === 'dashboard' ? 1 : 0.97,
            pointerEvents: centerMode === 'dashboard' ? 'auto' : 'none',
          }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
        >
          <AnimatePresence mode="wait">
            {view === 'globe' && (
              <motion.div
                key="globe"
                className="flex-1 min-h-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <ErrorBoundary>
                  <Suspense fallback={
                    <div className="w-full h-full flex items-center justify-center text-dire-muted text-sm">Loading globe...</div>
                  }>
                    <GlobeView />
                  </Suspense>
                </ErrorBoundary>
              </motion.div>
            )}
            {view === 'heatmap' && (
              <motion.div
                key="heatmap"
                className="flex-1 min-h-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <ErrorBoundary>
                  <Suspense fallback={
                    <div className="w-full h-full flex items-center justify-center text-dire-muted text-sm">Loading heatmap...</div>
                  }>
                    <RiskHeatmap />
                  </Suspense>
                </ErrorBoundary>
              </motion.div>
            )}
            {view === 'timeline' && (
              <motion.div
                key="timeline"
                className="flex-1 overflow-y-auto p-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <SimulationTimeline />
              </motion.div>
            )}
            {view === 'intel' && (
              <motion.div
                key="intel"
                className="flex-1 min-h-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <ErrorBoundary>
                  <Suspense fallback={
                    <div className="w-full h-full flex items-center justify-center text-dire-muted text-sm">Loading Intel Globe...</div>
                  }>
                    <GeoIntelGlobe />
                  </Suspense>
                </ErrorBoundary>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </div>
  );
}
