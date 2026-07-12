import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';

const ACTION_ICONS = {
  diplomacy: '\uD83E\uDD1D',
  collaboration: '\uD83D\uDD17',
  rd: '\uD83D\uDD2C',
  diversification: '\uD83C\uDF10',
  vertical_integration: '\u2B06\uFE0F',
};

const ACTION_COLORS = {
  diplomacy: 'border-blue-500/30 bg-blue-500/10',
  collaboration: 'border-purple-500/30 bg-purple-500/10',
  rd: 'border-cyan-500/30 bg-cyan-500/10',
  diversification: 'border-green-500/30 bg-green-500/10',
  vertical_integration: 'border-amber-500/30 bg-amber-500/10',
};

const STATUS_LABELS = {
  pending: { label: 'Pending', color: 'text-dire-muted' },
  in_progress: { label: 'Active', color: 'text-dire-accent' },
  completed: { label: 'Done', color: 'text-green-400' },
};

export default function StrategicActionsPanel() {
  const strategicActions = useStore((s) => s.strategicActions);
  const availableStrategicActions = useStore((s) => s.availableStrategicActions);
  const launchStrategicAction = useStore((s) => s.launchStrategicAction);
  const fetchStrategicActions = useStore((s) => s.fetchStrategicActions);
  const playerCompany = useStore((s) => s.playerCompany);
  const currentDay = useStore((s) => s.currentDay);

  useEffect(() => {
    if (playerCompany) fetchStrategicActions();
  }, [playerCompany, currentDay, fetchStrategicActions]);

  const available = availableStrategicActions.length > 0
    ? availableStrategicActions
    : [
      { type: 'diplomacy', label: 'Diplomacy & Trade Agreements', delay: 10, duration: 60, cost: 500, relevance: 70 },
      { type: 'collaboration', label: 'Industry Collaboration', delay: 7, duration: 45, cost: 800, relevance: 65 },
      { type: 'rd', label: 'Research & Development', delay: 15, duration: 90, cost: 1500, relevance: 80 },
      { type: 'diversification', label: 'Supply Diversification', delay: 8, duration: 30, cost: 1000, relevance: 75 },
      { type: 'vertical_integration', label: 'Vertical Integration', delay: 20, duration: 120, cost: 2000, relevance: 60 },
    ];

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-dire-muted uppercase tracking-wider">Strategic Actions</h3>

      {/* Active Actions */}
      {strategicActions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-dire-muted uppercase">Active</div>
          <AnimatePresence>
            {strategicActions.filter(a => a.status !== 'completed').map((action, i) => {
              const st = STATUS_LABELS[action.status] || STATUS_LABELS.pending;
              return (
                <motion.div
                  key={action.action_type + i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={`rounded-lg p-2.5 border ${ACTION_COLORS[action.action_type] || 'border-white/10 bg-dire-card'}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{ACTION_ICONS[action.action_type] || '\u2699\uFE0F'}</span>
                    <span className="text-xs text-white font-medium flex-1 truncate">{action.title || action.action_type}</span>
                    <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
                  </div>
                  {action.status === 'in_progress' && (
                    <div className="mt-2 h-1 bg-dire-dark rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-dire-accent rounded-full"
                        animate={{ width: `${Math.min(100, ((currentDay - action.started_day) / (action.completion_day - action.started_day)) * 100)}%` }}
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Available Actions */}
      <div className="space-y-2">
        <div className="text-[10px] text-dire-muted uppercase">Available</div>
        {available.map((action) => {
          const isActive = strategicActions.some(a => a.action_type === action.type && a.status !== 'completed');
          return (
            <motion.button
              key={action.type}
              disabled={isActive}
              onClick={() => launchStrategicAction(action.type, action.label)}
              className={`w-full text-left rounded-lg p-3 border transition-all ${
                isActive
                  ? 'border-white/5 bg-dire-dark opacity-40 cursor-not-allowed'
                  : 'border-white/10 bg-dire-card hover:border-dire-accent/30 hover:bg-dire-accent/5 cursor-pointer'
              }`}
              whileHover={isActive ? {} : { scale: 1.01 }}
              whileTap={isActive ? {} : { scale: 0.99 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{ACTION_ICONS[action.type] || '\u2699\uFE0F'}</span>
                <span className="text-xs text-white font-medium">{action.label}</span>
              </div>
              <div className="flex gap-3 text-[10px] text-dire-muted">
                <span>Delay: {action.delay}d</span>
                <span>Duration: {action.duration}d</span>
                <span>Cost: ${action.cost}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
