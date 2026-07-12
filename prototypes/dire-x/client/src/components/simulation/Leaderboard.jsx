import { motion } from 'framer-motion';
import useStore from '../../store/useStore';

// Derive up to 2 readable rank-driver phrases from score breakdown
function getRankDrivers(entry) {
  const s = entry.scores || {};
  const drivers = [];

  if ((s.growth         || 0) > 65) drivers.push({ text: 'Growth momentum',    positive: true });
  if ((s.sustainability || 0) > 65) drivers.push({ text: 'Sustainability edge', positive: true });
  if ((s.stability      || 0) > 65) drivers.push({ text: 'High stability',      positive: true });
  if ((s.supplyHealth   || 0) > 65) drivers.push({ text: 'Resilient supply',    positive: true });

  if ((s.growth         || 0) < 35) drivers.push({ text: 'Growth lag',          positive: false });
  if ((s.stability      || 0) < 35) drivers.push({ text: 'Stability risk',      positive: false });
  if ((s.supplyHealth   || 0) < 35) drivers.push({ text: 'Supply fragile',      positive: false });
  if ((entry.sresScore  || 0) > 70) drivers.push({ text: 'Elevated SRES',       positive: false });

  // If nothing notable, fall back to dominant score
  if (drivers.length === 0) {
    const topScore = Object.entries(s).sort((a, b) => b[1] - a[1])[0];
    if (topScore) {
      const label = { growth: 'Growth', sustainability: 'Sustainability', stability: 'Stability', supplyHealth: 'Supply Health' }[topScore[0]] || topScore[0];
      drivers.push({ text: `${label} driven`, positive: topScore[1] >= 50 });
    }
  }

  return drivers.slice(0, 2);
}

export default function Leaderboard() {
  const { leaderboard, playerCompany, worldDay } = useStore();

  const displayBoard =
    leaderboard.length > 0
      ? leaderboard
      : playerCompany
        ? [{
            id:       playerCompany.id,
            name:     playerCompany.name,
            industry: playerCompany.industry,
            score:
              Math.round(
                ((playerCompany.scores?.growth        || 0) * 0.30 +
                 (playerCompany.scores?.sustainability || 0) * 0.25 +
                 (playerCompany.scores?.stability      || 0) * 0.25 +
                 (playerCompany.scores?.supplyHealth   || 0) * 0.20) * 10
              ) / 10,
            scores:    playerCompany.scores,
            sresScore: playerCompany.sresScore,
          }]
        : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-dire-accent font-semibold text-sm uppercase tracking-wider">
          Leaderboard
        </h3>
        <span className="text-dire-muted text-xs">Day {worldDay}</span>
      </div>

      {displayBoard.length === 0 ? (
        <div className="text-dire-muted text-sm text-center py-8">
          No companies yet. Create one to start competing.
        </div>
      ) : (
        <div className="space-y-2">
          {displayBoard.map((entry, i) => {
            const isPlayer   = entry.id === playerCompany?.id;
            const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
            const drivers    = getRankDrivers(entry);

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`p-3 rounded-lg border ${
                  isPlayer
                    ? 'border-dire-accent/40 bg-dire-accent/5'
                    : 'border-dire-muted/10 bg-dire-card'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-bold text-lg w-6 ${rankColors[i] || 'text-dire-muted'}`}>
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm truncate">
                        {entry.name}
                      </span>
                      {isPlayer && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-dire-accent/20 text-dire-accent rounded flex-shrink-0">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-dire-muted text-xs">{entry.industry}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-mono font-bold">{entry.score}</div>
                    <div className="text-dire-muted text-[10px]">SCORE</div>
                  </div>
                </div>

                {/* Score breakdown mini bars */}
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {[
                    { label: 'GRW', value: entry.scores?.growth,        color: 'bg-cyan-400' },
                    { label: 'SUS', value: entry.scores?.sustainability, color: 'bg-green-400' },
                    { label: 'STB', value: entry.scores?.stability,      color: 'bg-amber-400' },
                    { label: 'SPH', value: entry.scores?.supplyHealth,   color: 'bg-blue-400' },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className="h-1 bg-dire-dark rounded-full overflow-hidden">
                        <div
                          className={`h-full ${s.color} rounded-full`}
                          style={{ width: `${s.value || 0}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-dire-muted mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Rank drivers */}
                {drivers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {drivers.map((d, di) => (
                      <span
                        key={di}
                        className={`text-[9px] px-1.5 py-0.5 rounded border ${
                          d.positive
                            ? 'bg-green-500/8 text-green-400/80 border-green-500/15'
                            : 'bg-red-500/8 text-red-400/80 border-red-500/15'
                        }`}
                      >
                        {d.positive ? '↑' : '↓'} {d.text}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
