import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import AnimatedNumber from '../shared/AnimatedNumber';

const metricConfigs = [
  { key: 'supply',      label: 'Supply',      color: 'bg-blue-400',    textColor: 'text-blue-400',    hex: '#60a5fa' },
  { key: 'economy',     label: 'Economy',     color: 'bg-green-400',   textColor: 'text-green-400',   hex: '#4ade80' },
  { key: 'environment', label: 'Environment', color: 'bg-emerald-400', textColor: 'text-emerald-400', hex: '#34d399' },
  { key: 'stability',   label: 'Stability',   color: 'bg-amber-400',   textColor: 'text-amber-400',   hex: '#fbbf24' },
];

function MetricGauge({ config, value, prevValue }) {
  const diff = value - prevValue;
  const isSignificantChange = Math.abs(diff) > 10;
  const trendUp = diff > 0;
  const trendDown = diff < 0;

  return (
    <motion.div
      className="bg-dire-card rounded-lg p-3 border border-white/5"
      animate={isSignificantChange ? { borderColor: ['rgba(255,255,255,0.05)', config.hex + '60', 'rgba(255,255,255,0.05)'] } : {}}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
        <div className="flex items-center gap-1">
          <AnimatePresence mode="wait">
            {trendUp && (
              <motion.span key="up" className="text-dire-success text-[10px]" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>▲</motion.span>
            )}
            {trendDown && (
              <motion.span key="down" className="text-dire-danger text-[10px]" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>▼</motion.span>
            )}
          </AnimatePresence>
          <AnimatedNumber value={value} decimals={1} className="text-sm font-bold font-mono" colorize />
        </div>
      </div>

      <div className="h-2 bg-dire-dark rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${config.color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          style={{ opacity: 0.8 }}
        />
      </div>

      {diff !== 0 && (
        <motion.div className="mt-1 text-right" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <span className={`text-[10px] font-mono ${trendUp ? 'text-dire-success' : 'text-dire-danger'}`}>
            {trendUp ? '+' : ''}{diff.toFixed(1)}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Competition Intelligence sub-panel ──
function CompetitionIntel() {
  const competitionData = useStore(s => s.competitionData);
  if (!competitionData) return null;

  const c = competitionData;
  const winColor = c.winProbability >= 60 ? 'text-green-400' : c.winProbability >= 40 ? 'text-amber-400' : 'text-red-400';
  const intensityColor = c.competitionIntensity >= 70 ? 'text-red-400' : c.competitionIntensity >= 50 ? 'text-amber-400' : 'text-green-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 space-y-2"
    >
      <h3 className="text-xs font-medium text-dire-muted uppercase tracking-wider">Competition Intelligence</h3>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-dire-card rounded-lg p-2.5 border border-white/5">
          <div className="text-[9px] text-dire-muted uppercase">Companies</div>
          <div className="text-sm font-bold font-mono text-white">{c.companiesInSector}</div>
          <div className="text-[9px] text-dire-muted">{c.sector} sector</div>
        </div>
        <div className="bg-dire-card rounded-lg p-2.5 border border-white/5">
          <div className="text-[9px] text-dire-muted uppercase">Intensity</div>
          <div className={`text-sm font-bold font-mono ${intensityColor}`}>{c.competitionIntensity}</div>
          <div className="text-[9px] text-dire-muted">/ 100</div>
        </div>
        <div className="bg-dire-card rounded-lg p-2.5 border border-white/5">
          <div className="text-[9px] text-dire-muted uppercase">Win Prob.</div>
          <div className={`text-sm font-bold font-mono ${winColor}`}>{c.winProbability}%</div>
          <div className="text-[9px] text-dire-muted">contract wins</div>
        </div>
        <div className="bg-dire-card rounded-lg p-2.5 border border-white/5">
          <div className="text-[9px] text-dire-muted uppercase">Mkt Share</div>
          <div className="text-sm font-bold font-mono text-dire-accent">{c.marketShare}%</div>
          <div className="text-[9px] text-dire-muted">est. current</div>
        </div>
      </div>

      {/* Win probability bar */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5">
        <div className="flex justify-between text-[9px] mb-1">
          <span className="text-dire-muted">Contract Win Rate</span>
          <span className={winColor}>{c.contractWinRate}%</span>
        </div>
        <div className="h-2 bg-dire-dark rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
            animate={{ width: `${c.contractWinRate}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <div className="flex justify-between text-[9px] mt-2">
          <span className="text-dire-muted">Market Growth</span>
          <span className="text-green-400">+{c.marketGrowthRate}%/yr</span>
        </div>
      </div>

      {/* Top competitors */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5">
        <div className="text-[9px] text-dire-muted uppercase mb-1.5">Top Competitors</div>
        {(c.topCompetitors || []).map((name, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <span className="text-[9px] text-dire-muted w-3">{i + 1}.</span>
            <span className="text-[10px] text-white">{name}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function MetricsPanel() {
  const metrics = useStore((s) => s.metrics);
  const [prevMetrics, setPrevMetrics] = useState(metrics);

  const prevRef = useRef(metrics);
  useEffect(() => {
    setPrevMetrics(prevRef.current);
    prevRef.current = metrics;
  }, [metrics]);

  return (
    <div>
      <h3 className="text-xs font-medium text-dire-muted uppercase tracking-wider mb-3">
        Risk Metrics
      </h3>
      <div className="space-y-2">
        {metricConfigs.map((config) => (
          <MetricGauge
            key={config.key}
            config={config}
            value={metrics[config.key]}
            prevValue={prevMetrics[config.key]}
          />
        ))}
      </div>

      <CompetitionIntel />
    </div>
  );
}
