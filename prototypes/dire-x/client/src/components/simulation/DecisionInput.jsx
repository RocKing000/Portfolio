import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import LoadingSpinner from '../shared/LoadingSpinner';

// Keyword-based local impact estimator — no API call needed
function estimateImpact(text) {
  if (!text || text.trim().length < 5) return null;
  const t = text.toLowerCase();
  const effects = [];
  let confidence = 28;
  const tradeoffs = [];

  if (/ban|block|restrict|embargo|sanction/.test(t)) {
    effects.push({ label: 'Supply', delta: -12, positive: false });
    effects.push({ label: 'Cost', delta: +18, positive: false });
    confidence += 22;
    tradeoffs.push('May trigger counter-measures');
  }
  if (/diversif|alternative|multi.sourc|backup|second.source/.test(t)) {
    effects.push({ label: 'Supply Risk', delta: -10, positive: true });
    effects.push({ label: 'Cost', delta: +8, positive: false });
    confidence += 16;
    tradeoffs.push('Increases supply chain resilience');
  }
  if (/invest|research|r&d|develop|innovat|technolog/.test(t)) {
    effects.push({ label: 'Stability', delta: +8, positive: true });
    effects.push({ label: 'Short-term Cost', delta: -5, positive: false });
    confidence += 14;
    tradeoffs.push('Benefits realised over 30–60 days');
  }
  if (/partner|alliance|deal|cooperat|agreement|bilateral/.test(t)) {
    effects.push({ label: 'Trade Efficiency', delta: +14, positive: true });
    effects.push({ label: 'Stability', delta: +6, positive: true });
    confidence += 20;
    tradeoffs.push('Long-term stability gain');
  }
  if (/cut cost|reduc cost|streamline|efficien|optim/.test(t)) {
    effects.push({ label: 'Operating Cost', delta: -12, positive: true });
    effects.push({ label: 'Quality Risk', delta: +5, positive: false });
    confidence += 12;
    tradeoffs.push('Quality monitoring recommended');
  }
  if (/stockpil|buffer|reserve|inventory/.test(t)) {
    effects.push({ label: 'Supply Security', delta: +10, positive: true });
    effects.push({ label: 'Capital', delta: -8, positive: false });
    confidence += 14;
    tradeoffs.push('Reduces short-term disruption risk');
  }

  // Generic fallback
  if (effects.length === 0) {
    effects.push({ label: 'Impact', delta: 0, positive: null });
    confidence = 18;
    tradeoffs.push('Insufficient context to estimate');
  }

  return {
    effects: effects.slice(0, 3),
    confidence: Math.min(82, confidence),
    tradeoffs: tradeoffs.slice(0, 2),
  };
}

export default function DecisionInput() {
  const [decision, setDecision] = useState('');
  const [recentDecisions, setRecentDecisions] = useState([]);
  const submitDecision = useStore((s) => s.submitDecision);
  const isSimulating   = useStore((s) => s.isSimulating);
  const createBranch   = useStore((s) => s.createBranch);

  const preview = useMemo(() => estimateImpact(decision), [decision]);

  const handleSubmit = async () => {
    if (!decision.trim() || isSimulating) return;
    const text = decision.trim();
    createBranch(`Decision: ${text.slice(0, 30)}…`);
    await submitDecision(text);
    setRecentDecisions((prev) => [{ text, timestamp: Date.now() }, ...prev.slice(0, 4)]);
    setDecision('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <label className="block text-xs font-medium text-dire-muted uppercase tracking-wider mb-2">
        Decision
      </label>

      <textarea
        value={decision}
        onChange={(e) => setDecision(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. 'Diversify lithium supply away from Chile'"
        className="w-full bg-dire-card border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-dire-muted/40 focus:outline-none focus:border-dire-accent/50 transition-colors resize-none leading-relaxed"
        rows={3}
        disabled={isSimulating}
      />

      {/* ── Impact Preview ── */}
      <AnimatePresence>
        {preview && decision.trim().length >= 5 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 bg-dire-dark rounded-lg border border-white/8 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-dire-muted uppercase tracking-wider">
                  Estimated Impact
                </span>
                <span className="text-[9px] text-dire-muted/60 font-mono">
                  local estimate
                </span>
              </div>

              {/* Effect badges */}
              <div className="flex flex-wrap gap-1">
                {preview.effects.map((ef, i) => (
                  <span
                    key={i}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${
                      ef.positive === true  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      ef.positive === false ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      'bg-white/5 text-dire-muted border-white/10'
                    }`}
                  >
                    {ef.label}{' '}
                    {ef.delta !== 0 ? (ef.delta > 0 ? `+${ef.delta}%` : `${ef.delta}%`) : '~'}
                  </span>
                ))}
              </div>

              {/* Trade-offs */}
              {preview.tradeoffs.length > 0 && (
                <div className="space-y-0.5">
                  {preview.tradeoffs.map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[9px] text-dire-muted/70">
                      <span className="text-dire-muted/40">·</span>
                      {t}
                    </div>
                  ))}
                </div>
              )}

              {/* Confidence bar */}
              <div>
                <div className="flex justify-between text-[8px] mb-1">
                  <span className="text-dire-muted/60">Confidence</span>
                  <span className="text-dire-muted font-mono">{preview.confidence}%</span>
                </div>
                <div className="h-1 bg-dire-card rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-dire-accent/60"
                    initial={{ width: 0 }}
                    animate={{ width: `${preview.confidence}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleSubmit}
        disabled={!decision.trim() || isSimulating}
        className="w-full mt-2 bg-dire-accent/20 hover:bg-dire-accent/30 border border-dire-accent/30 text-dire-accent text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isSimulating ? (
          <><LoadingSpinner size={14} /><span>Simulating…</span></>
        ) : (
          <><span>Submit Decision</span><span className="text-[10px] text-dire-muted">Ctrl+Enter</span></>
        )}
      </motion.button>

      {/* Recent decisions */}
      <AnimatePresence>
        {recentDecisions.length > 0 && (
          <motion.div
            className="mt-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <p className="text-[9px] text-dire-muted uppercase tracking-wider mb-1.5">Recent</p>
            <div className="space-y-1">
              {recentDecisions.map((d, i) => (
                <motion.div
                  key={d.timestamp}
                  className="text-[10px] text-dire-muted/65 bg-dire-dark rounded px-2 py-1.5 truncate cursor-pointer hover:text-white/80 transition-colors"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  title={d.text}
                  onClick={() => setDecision(d.text)}
                >
                  {d.text}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
