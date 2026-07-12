import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';

const STATUS_CONFIG = {
  Allied:   { bg: 'bg-green-500/15',  border: 'border-green-500/30',  text: 'text-green-400',  dot: 'bg-green-400' },
  Friendly: { bg: 'bg-teal-500/15',   border: 'border-teal-500/30',   text: 'text-teal-400',   dot: 'bg-teal-400' },
  Neutral:  { bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  Tense:    { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400' },
  Hostile:  { bg: 'bg-red-500/15',    border: 'border-red-500/30',    text: 'text-red-400',    dot: 'bg-red-400' },
};

function RelationBar({ score }) {
  const color = score >= 80 ? '#4ade80' : score >= 60 ? '#2dd4bf' : score >= 40 ? '#fbbf24' : score >= 20 ? '#f97316' : '#f87171';
  return (
    <div className="flex-1 h-1 bg-dire-dark rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.6 }}
      />
    </div>
  );
}

export default function GeopoliticalPanel() {
  const geopoliticalRelations = useStore(s => s.geopoliticalRelations);
  const playerCompany = useStore(s => s.playerCompany);
  const selectedCompany = useStore(s => s.selectedCompany);
  const [filter, setFilter] = useState('all');

  const company = playerCompany || selectedCompany;
  const homeCountry = company?.country || 'United States';
  const relations = geopoliticalRelations || [];

  const statusCounts = relations.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const filtered = filter === 'all' ? relations : relations.filter(r => r.status === filter);

  const avgScore = relations.length > 0
    ? Math.round(relations.reduce((s, r) => s + r.score, 0) / relations.length)
    : 50;

  const avgTradeEfficiency = relations.length > 0
    ? Math.round(relations.reduce((s, r) => s + r.tradeEfficiency, 0) / relations.length * 100)
    : 65;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-dire-muted uppercase tracking-wider">Geopolitical Intelligence</h3>

      {/* Home country indicator */}
      <div className="bg-dire-card rounded-lg p-3 border border-dire-accent/20 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-dire-accent animate-pulse" />
        <div>
          <div className="text-[10px] text-dire-muted">Analyzing from</div>
          <div className="text-sm font-medium text-white">{homeCountry}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] text-dire-muted">Avg Relation</div>
          <div className={`text-sm font-bold font-mono ${avgScore >= 60 ? 'text-green-400' : avgScore >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
            {avgScore}
          </div>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Allied', count: statusCounts['Allied'] || 0, color: 'text-green-400' },
          { label: 'Neutral', count: (statusCounts['Friendly'] || 0) + (statusCounts['Neutral'] || 0), color: 'text-yellow-400' },
          { label: 'Hostile', count: (statusCounts['Tense'] || 0) + (statusCounts['Hostile'] || 0), color: 'text-red-400' },
        ].map(m => (
          <motion.div key={m.label} className="bg-dire-card rounded-lg p-2 border border-white/5 text-center"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className={`text-lg font-bold font-mono ${m.color}`}>{m.count}</div>
            <div className="text-[9px] text-dire-muted">{m.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Trade efficiency gauge */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] text-dire-muted uppercase">Avg Trade Efficiency</span>
          <span className={`text-sm font-bold font-mono ${avgTradeEfficiency >= 70 ? 'text-green-400' : avgTradeEfficiency >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {avgTradeEfficiency}%
          </span>
        </div>
        <div className="h-1.5 bg-dire-dark rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400"
            style={{ transformOrigin: 'left' }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: avgTradeEfficiency / 100 }}
            transition={{ duration: 0.8 }}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex bg-dire-dark rounded-lg p-0.5 gap-0.5 text-[9px]">
        {['all', 'Allied', 'Friendly', 'Neutral', 'Tense', 'Hostile'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1 rounded-md transition-colors capitalize ${
              filter === f ? 'bg-dire-accent/20 text-dire-accent' : 'text-dire-muted hover:text-white/70'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Relations list */}
      <div className="space-y-1 max-h-[280px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {filtered.slice(0, 20).map((rel, i) => {
            const cfg = STATUS_CONFIG[rel.status] || STATUS_CONFIG.Neutral;
            return (
              <motion.div
                key={rel.partner}
                layout
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${cfg.bg} ${cfg.border}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.02 }}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
                <span className="text-[10px] font-medium text-white flex-1 truncate">{rel.partner}</span>
                <RelationBar score={rel.score} />
                <span className={`text-[9px] font-mono w-6 text-right ${cfg.text}`}>{rel.score}</span>
                <span className="text-[9px] text-dire-muted w-8 text-right">{Math.round(rel.tradeEfficiency * 100)}%</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="text-[10px] text-dire-muted text-center py-4">
            No {filter} relations
          </div>
        )}
      </div>
    </div>
  );
}
