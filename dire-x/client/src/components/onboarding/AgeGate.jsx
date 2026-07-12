import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTierForAge, TIERS } from '../../config/ageTiers';

const AGE_GROUPS = [
  { label: '13 – 17', value: 15, emoji: '🎮', tier: 'explorer', tagline: 'Learn by playing' },
  { label: '18 – 24', value: 21, emoji: '📊', tier: 'strategist', tagline: 'Think strategically' },
  { label: '25+',     value: 30, emoji: '🔬', tier: 'analyst', tagline: 'Full intelligence suite' },
];

export default function AgeGate({ onComplete }) {
  const [selected, setSelected] = useState(null);
  const [hoveredTier, setHoveredTier] = useState(null);

  const handleSelect = (group) => {
    setSelected(group);
    // Brief pause for animation, then proceed
    setTimeout(() => {
      const tier = getTierForAge(group.value);
      onComplete(group.value, tier);
    }, 600);
  };

  return (
    <div className="h-screen w-screen bg-dire-dark flex items-center justify-center overflow-hidden">
      {/* Background subtle grid */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,212,255,0.3) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-8 max-w-2xl px-6"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Logo / Title */}
        <div className="text-center">
          <motion.h1
            className="text-5xl font-bold tracking-tight"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="text-white">DIRE</span>
            <span className="text-dire-accent">-X</span>
          </motion.h1>
          <motion.p
            className="text-dire-muted text-lg mt-2 font-light"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Decision Intelligence & Risk Engine
          </motion.p>
        </div>

        {/* Age selection prompt */}
        <motion.p
          className="text-white/80 text-center text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Select your age group to personalize your experience
        </motion.p>

        {/* Age group cards */}
        <motion.div
          className="flex gap-4 overflow-visible"
          style={{ overflow: 'visible' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {AGE_GROUPS.map((group, i) => {
            const isSelected = selected?.tier === group.tier;
            const tierConfig = TIERS[group.tier];
            const isHovered = hoveredTier === group.tier;

            return (
              <motion.button
                key={group.tier}
                onClick={() => handleSelect(group)}
                onMouseEnter={() => setHoveredTier(group.tier)}
                onMouseLeave={() => setHoveredTier(null)}
                className={`
                  relative flex flex-col items-center gap-3 p-6 rounded-xl border
                  transition-all duration-300 cursor-pointer min-w-[180px]
                  ${isSelected
                    ? 'bg-dire-accent/20 border-dire-accent shadow-lg shadow-dire-accent/20'
                    : 'bg-dire-card border-white/10 hover:border-dire-accent/50 hover:bg-dire-card/80'
                  }
                `}
                style={{ zIndex: isHovered ? 30 : 1, overflow: 'visible' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: isSelected ? 1.05 : 1,
                }}
                transition={{ delay: 0.8 + i * 0.15 }}
                whileHover={{ scale: isSelected ? 1.05 : 1.03 }}
                whileTap={{ scale: 0.97 }}
                disabled={!!selected}
              >
                <span className="text-3xl">{group.emoji}</span>
                <span className="text-white font-semibold text-lg">{group.label}</span>
                <span className="text-dire-muted text-xs">{group.tagline}</span>

                {/* Tier preview on hover */}
                <AnimatePresence>
                  {isHovered && !selected && (
                    <motion.div
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full
                        bg-dire-panel border border-white/10 rounded-lg p-3 w-56 z-20 shadow-xl"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                    >
                      <p className="text-white text-xs font-medium mb-1.5">{tierConfig.label} Mode</p>
                      <p className="text-dire-muted text-[10px] leading-relaxed">
                        {tierConfig.rightTabs.length} analytics panels
                        {tierConfig.showStrategicActions ? ' + strategic actions' : ''}
                        {tierConfig.showBranchTree ? ' + decision branching' : ''}
                      </p>
                      <p className="text-dire-accent text-[10px] mt-1">
                        {tierConfig.centerViews.length} visualization modes
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selection checkmark */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      className="absolute top-2 right-2 w-6 h-6 bg-dire-accent rounded-full
                        flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    >
                      <svg className="w-3.5 h-3.5 text-dire-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Loading state after selection */}
        <AnimatePresence>
          {selected && (
            <motion.div
              className="flex flex-col items-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="w-6 h-6 border-2 border-dire-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-dire-accent text-sm">Loading {TIERS[selected.tier].label} dashboard...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.p
          className="text-dire-muted/50 text-xs text-center mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          You can change this anytime from settings
        </motion.p>
      </motion.div>
    </div>
  );
}
