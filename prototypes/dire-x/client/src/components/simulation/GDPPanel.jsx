import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import useStore from '../../store/useStore';
import AnimatedNumber from '../shared/AnimatedNumber';

const TREND_COLOR = { up: '#4ade80', down: '#f87171', flat: '#94a3b8' };

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-dire-panel border border-white/10 rounded-lg p-2.5 text-[10px] shadow-xl">
      <div className="font-medium text-white">{d.country}</div>
      <div className="text-dire-muted">GDP: <span className="text-white">${d.gdp.toFixed(1)}T</span></div>
      <div className="text-dire-muted">Growth: <span className={d.adjustedGrowth >= 0 ? 'text-green-400' : 'text-red-400'}>{d.adjustedGrowth > 0 ? '+' : ''}{d.adjustedGrowth}%</span></div>
      <div className="text-dire-muted">Pop: <span className="text-white">{d.population}M</span></div>
    </div>
  );
};

export default function GDPPanel() {
  const gdpRanking = useStore(s => s.gdpRanking);
  const tradeVolume = useStore(s => s.tradeVolume);
  const playerCompany = useStore(s => s.playerCompany);
  const selectedCompany = useStore(s => s.selectedCompany);
  const [showAll, setShowAll] = useState(false);

  const company = playerCompany || selectedCompany;
  const ranking = gdpRanking || [];
  const displayedRanking = showAll ? ranking : ranking.slice(0, 12);

  // Highlight player's home country
  const homeCountry = company?.country;

  const getBarColor = (entry) => {
    if (entry.country === homeCountry) return '#00d4ff';
    return entry.adjustedGrowth >= 2 ? '#4ade80' : entry.adjustedGrowth >= 0 ? '#60a5fa' : '#f87171';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-dire-muted uppercase tracking-wider">GDP Intelligence</h3>

      {/* Global Trade Volume */}
      {tradeVolume && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'World GDP', value: tradeVolume.totalWorldGDP, suffix: 'T', color: 'text-blue-400' },
            { label: 'Trade Volume', value: tradeVolume.tradeVolume, suffix: 'T', color: 'text-green-400' },
            { label: 'Avg Growth', value: tradeVolume.avgGrowthRate, suffix: '%', color: tradeVolume.avgGrowthRate >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Trade Health', value: tradeVolume.tradeHealthIndex, suffix: '', color: 'text-amber-400' },
          ].map(m => (
            <motion.div
              key={m.label}
              className="bg-dire-card rounded-lg p-2.5 border border-white/5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="text-[10px] text-dire-muted uppercase">{m.label}</div>
              <div className={`text-sm font-bold font-mono ${m.color}`}>
                {m.label === 'World GDP' || m.label === 'Trade Volume' ? '$' : ''}
                <AnimatedNumber value={m.value} decimals={1} />
                {m.suffix}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Bar Chart Top 10 */}
      {ranking.length > 0 && (
        <div className="bg-dire-card rounded-lg p-3 border border-white/5">
          <div className="text-[10px] text-dire-muted uppercase mb-2">GDP by Country (USD Trillions)</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={ranking.slice(0, 10)} layout="vertical" margin={{ left: -10, right: 8, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="country" width={75} tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="gdp" radius={[0, 3, 3, 0]}>
                {ranking.slice(0, 10).map((entry, i) => (
                  <Cell key={i} fill={getBarColor(entry)} opacity={entry.country === homeCountry ? 1 : 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Rankings Table */}
      <div className="bg-dire-card rounded-lg border border-white/5 overflow-hidden">
        <div className="px-3 py-2 border-b border-white/5 flex justify-between items-center">
          <span className="text-[10px] text-dire-muted uppercase">Global Rankings</span>
          <span className="text-[9px] text-dire-muted">{ranking.length} countries</span>
        </div>
        <div className="divide-y divide-white/5">
          <AnimatePresence>
            {displayedRanking.map((c, i) => (
              <motion.div
                key={c.country}
                className={`flex items-center px-3 py-1.5 gap-2 ${c.country === homeCountry ? 'bg-dire-accent/5' : ''}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <span className="text-[10px] font-mono text-dire-muted w-5 text-right">{c.rank}</span>
                <span className={`flex-1 text-[10px] font-medium ${c.country === homeCountry ? 'text-dire-accent' : 'text-white'}`}>
                  {c.country}
                </span>
                <span className="text-[10px] font-mono text-white">${c.gdp.toFixed(1)}T</span>
                <span className={`text-[9px] font-mono w-10 text-right ${c.adjustedGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {c.adjustedGrowth > 0 ? '+' : ''}{c.adjustedGrowth}%
                </span>
                <span className="text-[8px]" style={{ color: TREND_COLOR[c.trend] }}>
                  {c.trend === 'up' ? '▲' : '▼'}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {ranking.length > 12 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full py-2 text-[10px] text-dire-muted hover:text-white transition-colors border-t border-white/5"
          >
            {showAll ? 'Show less' : `Show all ${ranking.length} countries`}
          </button>
        )}
      </div>
    </div>
  );
}
