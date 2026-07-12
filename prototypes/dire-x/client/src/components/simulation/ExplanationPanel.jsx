import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';

const METRIC_LABELS = {
  supply: 'Supply', economy: 'Economy',
  environment: 'Environment', stability: 'Stability',
};

const REASON_TYPE_STYLES = {
  event:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  scenario: 'bg-red-500/10 text-red-400 border-red-500/20',
  decision: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  market:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

function MetricDeltaBadge({ metric, delta }) {
  if (Math.abs(delta) < 0.2) return null;
  const isPos = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-mono border ${
      isPos
        ? 'bg-green-500/10 text-green-400 border-green-500/20'
        : 'bg-red-500/10 text-red-400 border-red-500/20'
    }`}>
      {METRIC_LABELS[metric] || metric}
      {' '}{isPos ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}
    </span>
  );
}

export default function ExplanationPanel() {
  const narration   = useStore((s) => s.narration);
  const isSimulating = useStore((s) => s.isSimulating);
  const causalLog   = useStore((s) => s.causalLog);

  const [displayText, setDisplayText] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);

  // Character-reveal animation
  useEffect(() => {
    if (!narration) { setDisplayText(''); return; }
    setIsRevealing(true);
    setDisplayText('');
    let idx = 0;
    const iv = setInterval(() => {
      if (idx < narration.length) {
        setDisplayText(narration.slice(0, idx + 1));
        idx++;
      } else {
        clearInterval(iv);
        setIsRevealing(false);
      }
    }, 12);
    return () => clearInterval(iv);
  }, [narration]);

  const latest = causalLog[causalLog.length - 1];
  const hasMeaningfulDeltas = latest &&
    Object.values(latest.allDeltas || {}).some((d) => Math.abs(d) >= 0.2);

  return (
    <div className="space-y-3">
      {/* ── Narration ── */}
      <div>
        <h3 className="text-[10px] font-medium text-dire-muted uppercase tracking-wider mb-2">
          Situation Report
        </h3>

        <div className="bg-dire-card rounded-lg border border-white/5 p-3 min-h-[72px]">
          <AnimatePresence mode="wait">
            {isSimulating && !narration ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-2 pt-1"
              >
                <div className="h-2 bg-dire-dark rounded animate-pulse w-full" />
                <div className="h-2 bg-dire-dark rounded animate-pulse w-4/5" />
                <div className="h-2 bg-dire-dark rounded animate-pulse w-3/5" />
              </motion.div>
            ) : displayText ? (
              <motion.p
                key="content"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-[11px] text-white/80 leading-relaxed font-light"
              >
                {displayText}
                {isRevealing && (
                  <motion.span
                    className="inline-block w-0.5 h-3 bg-dire-accent ml-0.5 align-middle"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )}
              </motion.p>
            ) : (
              <motion.p
                key="empty"
                className="text-[11px] text-dire-muted/50 italic"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              >
                Press play to begin the simulation.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Why This Happened ── */}
      <AnimatePresence>
        {latest && (
          <motion.div
            key={latest.day}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="bg-dire-card rounded-lg border border-white/5 p-3 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-dire-muted uppercase tracking-wider">
                Why this happened
              </span>
              <span className="text-[9px] font-mono text-dire-muted/50">
                Day {latest.day}
              </span>
            </div>

            {/* Metric deltas */}
            {hasMeaningfulDeltas && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(latest.allDeltas || {}).map(([m, d]) => (
                  <MetricDeltaBadge key={m} metric={m} delta={d} />
                ))}
              </div>
            )}

            {/* Contributing factors */}
            {latest.reasons?.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[9px] text-dire-muted/70 uppercase tracking-wide">
                  Contributing factors
                </div>
                {latest.reasons.map((reason, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-[8px] px-1 py-0.5 rounded border capitalize flex-shrink-0 mt-0.5 ${
                      REASON_TYPE_STYLES[reason.type] || 'bg-white/5 text-dire-muted border-white/10'
                    }`}>
                      {reason.type}
                    </span>
                    <span className="text-[10px] text-white/65 leading-snug">
                      {reason.factor}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!latest.reasons?.length && (
              <p className="text-[10px] text-dire-muted/50 italic">
                No significant causal factors identified this period.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
