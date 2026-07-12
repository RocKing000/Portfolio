import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';

const BADGE_CONFIG = {
  innovator: { label: 'Innovator', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: '\uD83D\uDCA1' },
  systems_thinker: { label: 'Systems Thinker', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: '\uD83E\uDDE0' },
  strategist: { label: 'Strategist', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: '\u265F\uFE0F' },
  optimizer: { label: 'Optimizer', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: '\u2699\uFE0F' },
};

export default function IdeaJournal() {
  const ideas = useStore((s) => s.ideas);
  const ideaBadges = useStore((s) => s.ideaBadges);
  const showIdeaJournal = useStore((s) => s.showIdeaJournal);
  const setShowIdeaJournal = useStore((s) => s.setShowIdeaJournal);
  const submitIdeaAction = useStore((s) => s.submitIdea);
  const [newIdea, setNewIdea] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newIdea.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await submitIdeaAction(newIdea.trim());
    setNewIdea('');
    setIsSubmitting(false);
  };

  if (!showIdeaJournal) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed right-0 top-14 bottom-0 w-[360px] bg-dire-panel border-l border-white/10 z-40 flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-dire-accent uppercase tracking-wider">Idea Journal</h2>
        <button onClick={() => setShowIdeaJournal(false)} className="text-dire-muted hover:text-white text-lg">&times;</button>
      </div>

      {/* Badges */}
      <div className="px-4 py-3 border-b border-white/5 flex flex-wrap gap-2">
        {Object.entries(BADGE_CONFIG).map(([key, config]) => {
          const count = ideaBadges[key] || 0;
          return (
            <div
              key={key}
              className={`text-[10px] px-2 py-1 rounded-full border ${count > 0 ? config.color : 'bg-dire-dark/50 text-dire-muted/50 border-white/5'}`}
            >
              {config.icon} {config.label} {count > 0 && `x${count}`}
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-4 border-b border-white/5">
        <textarea
          value={newIdea}
          onChange={(e) => setNewIdea(e.target.value)}
          placeholder="Share a strategic idea or insight..."
          className="w-full bg-dire-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none h-20 focus:outline-none focus:border-dire-accent/50"
        />
        <button
          onClick={handleSubmit}
          disabled={!newIdea.trim() || isSubmitting}
          className="mt-2 w-full py-2 bg-dire-accent/20 text-dire-accent rounded-lg text-xs font-medium hover:bg-dire-accent/30 disabled:opacity-40 transition-colors"
        >
          {isSubmitting ? 'Evaluating...' : 'Submit Idea'}
        </button>
      </div>

      {/* Ideas List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence>
          {ideas.map((idea, i) => (
            <motion.div
              key={idea.id || i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-dire-card rounded-lg p-3 border ${idea.is_notable ? 'border-dire-accent/30' : 'border-white/5'}`}
            >
              <p className="text-xs text-white/90 mb-2">{idea.content}</p>

              <div className="flex items-center gap-2 flex-wrap">
                {idea.badges?.map(b => (
                  <span key={b} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${BADGE_CONFIG[b]?.color || 'bg-dire-dark text-dire-muted border-white/10'}`}>
                    {BADGE_CONFIG[b]?.icon} {BADGE_CONFIG[b]?.label || b}
                  </span>
                ))}
              </div>

              <div className="flex justify-between items-center mt-2 text-[10px] text-dire-muted">
                <span>Day {idea.simulation_day || 0}</span>
                <div className="flex gap-2">
                  <span>Novelty: <span className="text-white">{idea.novelty_score?.toFixed(1)}</span></span>
                  <span>Impact: <span className="text-white">{idea.impact_score?.toFixed(1)}</span></span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {ideas.length === 0 && (
          <div className="text-center text-dire-muted text-xs py-8">
            No ideas yet. Share your strategic insights above.
          </div>
        )}
      </div>
    </motion.div>
  );
}
