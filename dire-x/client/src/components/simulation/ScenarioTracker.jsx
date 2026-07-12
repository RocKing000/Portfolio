import { motion } from 'framer-motion';
import useStore from '../../store/useStore';

const SCENARIO_CONFIG = {
  supply_crisis: {
    label: 'Supply Crisis',
    color: 'text-orange-400',
    bg: 'bg-orange-400',
    border: 'border-orange-500/30',
  },
  war: {
    label: 'War',
    color: 'text-red-400',
    bg: 'bg-red-400',
    border: 'border-red-500/30',
  },
  drought: {
    label: 'Drought',
    color: 'text-amber-400',
    bg: 'bg-amber-400',
    border: 'border-amber-500/30',
  },
  pandemic: {
    label: 'Pandemic',
    color: 'text-purple-400',
    bg: 'bg-purple-400',
    border: 'border-purple-500/30',
  },
  trade_war: {
    label: 'Trade War',
    color: 'text-pink-400',
    bg: 'bg-pink-400',
    border: 'border-pink-500/30',
  },
};

const STAGE_LABELS = {
  emerging: { label: 'Emerging', color: 'text-yellow-300' },
  growth: { label: 'Growing', color: 'text-orange-300' },
  peak: { label: 'Peak', color: 'text-red-300' },
  decline: { label: 'Declining', color: 'text-blue-300' },
};

export default function ScenarioTracker() {
  const { activeScenarios, mode } = useStore();

  if (mode !== 'open_world') return null;

  return (
    <div className="p-3">
      <h4 className="text-xs uppercase tracking-wider text-dire-muted mb-2">
        Active Conditions
      </h4>
      {activeScenarios.length === 0 ? (
        <div className="text-dire-muted text-xs py-2">
          World is stable. Conditions may emerge based on stress levels.
        </div>
      ) : (
        <div className="space-y-2">
          {activeScenarios.map((scenario) => {
            const config = SCENARIO_CONFIG[scenario.type] || SCENARIO_CONFIG.supply_crisis;
            const stageInfo = STAGE_LABELS[scenario.stage] || STAGE_LABELS.emerging;
            return (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-2.5 rounded-lg border ${config.border} bg-dire-card`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium text-sm ${config.color}`}>
                    {config.label}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${stageInfo.color} bg-white/5`}
                  >
                    {stageInfo.label}
                  </span>
                </div>
                {/* Intensity bar */}
                <div className="mt-2 h-1.5 bg-dire-dark rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${config.bg} rounded-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${scenario.intensity * 100}%` }}
                    transition={{ type: 'spring', stiffness: 100 }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-dire-muted">
                  <span>Intensity: {Math.round(scenario.intensity * 100)}%</span>
                  <span>
                    Day {scenario.day}/{scenario.maxDuration}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
