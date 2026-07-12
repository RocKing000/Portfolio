import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import useAutoScroll from '../../hooks/useAutoScroll';
import EventCard from './EventCard';
import { formatDay } from '../../utils/format';

export default function SimulationTimeline({ compact = false }) {
  const timeline = useStore((s) => s.timeline);
  const currentDay = useStore((s) => s.currentDay);
  const scenario = useStore((s) => s.scenario);
  const scrollRef = useRef(null);

  useAutoScroll(scrollRef, [timeline.length]);

  const scenarioLabels = {
    stable: 'Stable Baseline', supply_crisis: 'Supply Crisis',
    war: 'War Scenario', drought: 'Drought Scenario',
  };

  const displayEntries = compact ? timeline.slice(-10) : timeline;

  return (
    <div className={`${compact ? 'h-full' : 'h-full flex flex-col'}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Simulation Timeline</h2>
            <p className="text-xs text-dire-muted mt-0.5">
              {scenarioLabels[scenario] || scenario} &middot; Day {currentDay}
            </p>
          </div>
          <div className="text-xs text-dire-muted font-mono">{timeline.length} entries</div>
        </div>
      )}

      {compact && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-dire-muted uppercase tracking-wider">Timeline</span>
          <span className="text-[10px] text-dire-muted font-mono">Day {currentDay}</span>
        </div>
      )}

      <div ref={scrollRef} className={`${compact ? 'h-full overflow-y-auto' : 'flex-1 overflow-y-auto'} space-y-${compact ? '2' : '4'} pr-1`}>
        {displayEntries.length === 0 && (
          <motion.div
            className={`flex flex-col items-center justify-center ${compact ? 'h-24' : 'h-64'} text-center`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-xs text-dire-muted">
              {compact ? 'Press play to begin' : 'No simulation data yet. Press play or submit a decision to begin.'}
            </p>
          </motion.div>
        )}

        <AnimatePresence>
          {displayEntries.map((entry, i) => (
            <motion.div
              key={`day-${entry.day}-${i}`}
              className="relative"
              initial={{ opacity: 0, y: compact ? 10 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.05 }}
            >
              {/* Day marker */}
              <div className="flex items-center gap-3 mb-1">
                <div className={`${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-dire-accent flex-shrink-0`} />
                <div className="h-px flex-1 bg-white/5" />
                <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-mono text-dire-accent/70`}>
                  {formatDay(entry.day)}
                </span>
              </div>

              {/* Decision (hidden in compact) */}
              {!compact && entry.decision && (
                <motion.div
                  className="ml-5 mb-2 bg-dire-accent/10 border border-dire-accent/20 rounded-lg p-3"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="text-[10px] text-dire-accent font-medium uppercase tracking-wider mb-1">Decision</div>
                  <p className="text-xs text-white/90">{entry.decision}</p>
                </motion.div>
              )}

              {/* Events */}
              {entry.events && entry.events.length > 0 && (
                <div className={`${compact ? 'ml-3' : 'ml-5'} space-y-1`}>
                  {entry.events.map((event, j) => (
                    compact ? (
                      <div key={event.id} className="text-[10px] text-dire-muted flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          event.severity >= 4 ? 'bg-red-400' : event.severity >= 2 ? 'bg-amber-400' : 'bg-green-400'
                        }`} />
                        <span className="truncate">{event.title}</span>
                      </div>
                    ) : (
                      <EventCard key={event.id} event={event} index={j} />
                    )
                  ))}
                </div>
              )}

              {/* Narration (hidden in compact) */}
              {!compact && entry.narration && (
                <motion.blockquote
                  className="ml-5 mt-2 pl-3 border-l-2 border-dire-accent/30 text-xs text-dire-muted/80 italic leading-relaxed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {entry.narration}
                </motion.blockquote>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
