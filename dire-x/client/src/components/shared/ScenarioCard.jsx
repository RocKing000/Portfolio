import { motion } from 'framer-motion';
import clsx from 'clsx';

const scenarioConfig = {
  stable: {
    label: 'Stable',
    icon: '\u2696\uFE0F',
    description: 'Normal operating conditions with baseline volatility',
    borderColor: 'border-dire-success',
    glowClass: 'shadow-green-500/20',
  },
  supply_crisis: {
    label: 'Supply Crisis',
    icon: '\u{1F4E6}',
    description: 'Major supply chain disruptions and shortages',
    borderColor: 'border-dire-warning',
    glowClass: 'shadow-orange-500/20',
  },
  war: {
    label: 'War',
    icon: '\u{1F4A5}',
    description: 'Armed conflict destabilizing trade and markets',
    borderColor: 'border-dire-danger',
    glowClass: 'shadow-red-500/20',
  },
  drought: {
    label: 'Drought',
    icon: '\u{1F3DC}\uFE0F',
    description: 'Severe water scarcity impacting agriculture and industry',
    borderColor: 'border-amber-400',
    glowClass: 'shadow-amber-500/20',
  },
};

/**
 * Scenario selection card component.
 * @param {{ scenario: string, selected: boolean, onClick: () => void }} props
 */
export default function ScenarioCard({ scenario, selected, onClick }) {
  const config = scenarioConfig[scenario] || scenarioConfig.stable;

  return (
    <motion.button
      onClick={onClick}
      className={clsx(
        'w-full text-left p-3 rounded-lg border-2 transition-colors',
        'bg-dire-card hover:bg-dire-card/80',
        selected
          ? `${config.borderColor} ${config.glowClass} shadow-lg`
          : 'border-white/5 hover:border-white/10'
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{config.icon}</span>
        <span
          className={clsx(
            'font-semibold text-sm',
            selected ? 'text-white' : 'text-dire-muted'
          )}
        >
          {config.label}
        </span>
      </div>
      <p className="text-xs text-dire-muted leading-relaxed">
        {config.description}
      </p>
    </motion.button>
  );
}
