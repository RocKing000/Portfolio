import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import useStore from '../../store/useStore';
import { setSoundEnabled, isSoundEnabled } from '../../utils/soundSystem';
import { TIERS } from '../../config/ageTiers';

const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hi', label: 'HI', name: 'Hindi' },
  { code: 'zh', label: 'ZH', name: '中文' },
  { code: 'ar', label: 'AR', name: 'العربية' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'pt', label: 'PT', name: 'Português' },
];

const QUICK_RESOURCES = ['Lithium', 'Semiconductors', 'Crude Oil', 'Rare Earth', 'Copper'];

export default function TopNav({ tier }) {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const centerMode = useStore((s) => s.centerMode);
  const setCenterMode = useStore((s) => s.setCenterMode);
  const currentDay = useStore((s) => s.currentDay);
  const worldDay = useStore((s) => s.worldDay);
  const isPlaying = useStore((s) => s.isPlaying);
  const speed = useStore((s) => s.speed);
  const startSimulation = useStore((s) => s.startSimulation);
  const pauseSimulation = useStore((s) => s.pauseSimulation);
  const setSpeed = useStore((s) => s.setSpeed);
  const reset = useStore((s) => s.reset);
  const selectedResource = useStore((s) => s.selectedResource);
  const setSelectedResource = useStore((s) => s.setSelectedResource);
  const showTradeRoutes = useStore((s) => s.showTradeRoutes);
  const setShowTradeRoutes = useStore((s) => s.setShowTradeRoutes);
  const showIdeaJournal = useStore((s) => s.showIdeaJournal);
  const setShowIdeaJournal = useStore((s) => s.setShowIdeaJournal);
  const ideas = useStore((s) => s.ideas);
  const language = useStore((s) => s.language);
  const setLanguage = useStore((s) => s.setLanguage);
  const soundEnabled = useStore((s) => s.soundEnabled);
  const setSoundEnabledStore = useStore((s) => s.setSoundEnabled);
  const dataLastUpdated = useStore((s) => s.dataLastUpdated);
  const fetchDataStatus = useStore((s) => s.fetchDataStatus);

  const globeReady = useStore((s) => s.globeReady);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const speeds = [0.5, 1, 2, 5];
  const displayDay = mode === 'open_world' ? worldDay : currentDay;

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    setSoundEnabledStore(next);
    setSoundEnabled(next);
  };

  const handleLangSelect = (code) => {
    setLanguage(code);
    setShowLangMenu(false);
  };

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  // Detect user language on mount and fetch data status
  useEffect(() => {
    const navLang = navigator.language?.slice(0, 2).toLowerCase();
    const match = LANGUAGES.find(l => l.code === navLang);
    if (match && language === 'en') {
      setLanguage(match.code);
    }
    fetchDataStatus();
  }, []);

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 h-14 bg-dire-panel/95 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: globeReady ? 1 : 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Left: Logo + Mode + Resource Filter */}
      <div className="flex items-center gap-3">
        <motion.div className="flex items-center gap-1.5" whileHover={{ scale: 1.02 }}>
          <div className="w-6 h-6 rounded bg-dire-accent/20 border border-dire-accent/30 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-dire-accent" />
          </div>
          <h1 className="text-base font-bold tracking-widest text-dire-accent select-none">DIRE-X</h1>
        </motion.div>

        {/* Dashboard / Simulation Toggle */}
        <div className="relative flex bg-dire-dark rounded-lg p-0.5">
          {['dashboard', 'simulation'].map((cm) => (
            <button
              key={cm}
              onClick={() => setCenterMode(cm)}
              className={clsx(
                'relative z-10 px-3 py-1.5 text-[10px] font-medium rounded-md transition-colors capitalize',
                centerMode === cm ? 'text-white' : 'text-dire-muted hover:text-white/70'
              )}
            >
              {cm}
              {centerMode === cm && (
                <motion.div
                  className="absolute inset-0 bg-dire-accent/20 border border-dire-accent/30 rounded-md"
                  layoutId="center-mode-indicator"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Resource Filter Quick Select — hidden for Explorer tier */}
        {tier?.showResourceFilter !== false && <div className="hidden xl:flex items-center gap-1">
          {QUICK_RESOURCES.map(r => (
            <button
              key={r}
              onClick={() => setSelectedResource(selectedResource === r ? null : r)}
              className={clsx(
                'px-2 py-1 text-[9px] rounded-md border transition-colors',
                selectedResource === r
                  ? 'bg-dire-accent/20 text-dire-accent border-dire-accent/30'
                  : 'text-dire-muted border-transparent hover:text-white/70 hover:border-white/10'
              )}
            >
              {r.split(' ')[0]}
            </button>
          ))}
        </div>}
      </div>

      {/* Center: Day Counter + Trade Routes */}
      <div className="flex items-center gap-3">
        {/* Trade Routes Toggle — hidden for Explorer tier */}
        {tier?.showTradeRouteToggle !== false && <motion.button
          onClick={() => setShowTradeRoutes(!showTradeRoutes)}
          className={clsx(
            'px-2.5 py-1 text-[10px] rounded-lg border transition-colors',
            showTradeRoutes
              ? 'bg-dire-accent/20 text-dire-accent border-dire-accent/30'
              : 'text-dire-muted border-white/5 hover:text-white hover:border-white/10'
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Routes
        </motion.button>}

        {tier?.showDataStatus && dataLastUpdated && (
          <div className="hidden lg:flex items-center gap-1 text-[9px] text-dire-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500/70 inline-block" />
            <span>DATA {new Date(dataLastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        )}

        {mode === 'open_world' && (
          <div className="text-[9px] text-dire-muted uppercase tracking-wider">World</div>
        )}

        <motion.div
          className="font-mono text-sm tracking-widest text-dire-accent/80"
          key={displayDay}
          initial={{ opacity: 0.5, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          DAY{' '}
          <span className="text-dire-accent font-bold text-base">
            {String(displayDay).padStart(3, '0')}
          </span>
        </motion.div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">

        {/* Language Selector */}
        <div className="relative">
          <motion.button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className={clsx(
              'px-2.5 py-1.5 text-[10px] font-medium rounded-lg border transition-colors',
              showLangMenu
                ? 'bg-dire-accent/20 text-dire-accent border-dire-accent/30'
                : 'text-dire-muted border-white/5 hover:text-white hover:border-white/10'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {currentLang.label}
          </motion.button>
          {showLangMenu && (
            <motion.div
              className="absolute right-0 top-9 w-36 bg-dire-panel border border-white/10 rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
            >
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => handleLangSelect(lang.code)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-[10px] transition-colors',
                    language === lang.code
                      ? 'text-dire-accent bg-dire-accent/10'
                      : 'text-dire-muted hover:text-white hover:bg-white/5'
                  )}
                >
                  <span className="font-mono font-bold w-5">{lang.label}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Sound Toggle */}
        <motion.button
          onClick={handleSoundToggle}
          className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors',
            soundEnabled
              ? 'bg-dire-accent/10 text-dire-accent border-dire-accent/20'
              : 'text-dire-muted border-white/5 hover:text-white hover:border-white/10'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </motion.button>

        {/* Idea Journal */}
        <motion.button
          onClick={() => setShowIdeaJournal(!showIdeaJournal)}
          className={clsx(
            'relative w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors border',
            showIdeaJournal
              ? 'bg-dire-accent/20 text-dire-accent border-dire-accent/30'
              : 'text-dire-muted border-white/5 hover:text-white hover:border-white/10'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Idea Journal"
        >
          📖
          {ideas.length > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-dire-accent rounded-full text-[8px] text-dire-dark font-bold flex items-center justify-center">
              {ideas.length}
            </span>
          )}
        </motion.button>

        {/* Play/Pause */}
        <motion.button
          onClick={isPlaying ? pauseSimulation : startSimulation}
          className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors',
            isPlaying
              ? 'bg-dire-warning/20 text-dire-warning border border-dire-warning/30'
              : 'bg-dire-accent/20 text-dire-accent border border-dire-accent/30'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </motion.button>

        {/* Speed — filtered by tier maxSpeed */}
        <div className="flex bg-dire-dark rounded-lg p-0.5 gap-0.5">
          {speeds.filter(s => s <= (tier?.maxSpeed || 5)).map((s) => (
            <motion.button
              key={s}
              onClick={() => setSpeed(s)}
              className={clsx(
                'px-2 py-1 text-[10px] font-mono rounded-md transition-colors',
                speed === s ? 'bg-dire-accent/20 text-dire-accent' : 'text-dire-muted hover:text-white/70'
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {s}x
            </motion.button>
          ))}
        </div>

        {/* Reset */}
        <motion.button
          onClick={reset}
          className="px-3 py-1.5 text-[10px] text-dire-muted hover:text-white rounded-lg bg-dire-dark border border-white/5 hover:border-white/10 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Reset
        </motion.button>

        {/* Exit — back to age selection */}
        <motion.button
          onClick={() => {
            const resetTier = useStore.getState().resetAgeTier;
            if (resetTier) resetTier();
          }}
          className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase rounded-lg bg-dire-accent/15 text-dire-accent border border-dire-accent/30 hover:bg-dire-accent/25 hover:border-dire-accent/50 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Return to age selection"
        >
          Exit
        </motion.button>
      </div>
    </motion.header>
  );
}
