import { motion } from 'framer-motion';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { getScoreColor, getScoreLabel, getTypeColor } from '../../utils/format';
import useStore from '../../store/useStore';

const dimensions = [
  { key: 'spiScore', label: 'Supply', type: 'supply' },
  { key: 'ecoScore', label: 'Economy', type: 'economy' },
  { key: 'envScore', label: 'Environment', type: 'environment' },
  { key: 'stabScore', label: 'Stability', type: 'stability' },
];

export default function RiskOverview({ company }) {
  const riskData = useStore((s) => s.riskData);

  const sresScore = company.sresScore || 0;
  const scoreColor = getScoreColor(sresScore);
  const scoreLabel = getScoreLabel(sresScore);

  const gaugeData = [
    {
      name: 'SRES',
      value: sresScore,
      fill:
        sresScore >= 75
          ? '#ef4444'
          : sresScore >= 50
            ? '#fbbf24'
            : sresScore >= 25
              ? '#fb923c'
              : '#22c55e',
    },
  ];

  const dimensionData = dimensions.map((d) => ({
    name: d.label,
    value: company[d.key] || 0,
    type: d.type,
  }));

  return (
    <motion.div
      className="bg-dire-card rounded-xl border border-dire-accent/20 p-5 mb-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            {company.name}
          </h3>
          <p className="text-xs text-dire-muted">
            {company.sector} &middot; {company.country}
          </p>
        </div>
        <button
          className="text-xs text-dire-muted hover:text-white transition-colors"
          onClick={() => useStore.getState().selectCompany(null)}
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* SRES Gauge */}
        <div className="flex flex-col items-center">
          <div className="relative w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="70%"
                outerRadius="100%"
                startAngle={180}
                endAngle={0}
                data={gaugeData}
                barSize={12}
              >
                <RadialBar
                  background={{ fill: '#1a2332' }}
                  dataKey="value"
                  cornerRadius={6}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold font-mono ${scoreColor}`}>
                {sresScore}
              </span>
              <span className={`text-xs font-medium ${scoreColor}`}>
                {scoreLabel}
              </span>
            </div>
          </div>
          <p className="text-xs text-dire-muted mt-1">SRES Composite Score</p>
        </div>

        {/* Dimension Breakdown */}
        <div>
          <h4 className="text-xs font-medium text-dire-muted uppercase tracking-wider mb-3">
            Risk Dimensions
          </h4>
          <div className="space-y-3">
            {dimensionData.map((d, i) => {
              const color = getTypeColor(d.type);
              return (
                <motion.div
                  key={d.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${color.text}`}>
                      {d.name}
                    </span>
                    <span className="text-xs font-mono text-dire-muted">
                      {d.value}
                    </span>
                  </div>
                  <div className="h-2 bg-dire-dark rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${color.bg}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${d.value}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                      style={{ opacity: 0.8 }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resource Dependency Table */}
      {company.resources && company.resources.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs font-medium text-dire-muted uppercase tracking-wider mb-2">
            Resource Dependencies
          </h4>
          <div className="bg-dire-dark rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-3 py-2 text-dire-muted font-medium">
                    Resource
                  </th>
                  <th className="text-left px-3 py-2 text-dire-muted font-medium">
                    Origin
                  </th>
                  <th className="text-right px-3 py-2 text-dire-muted font-medium">
                    Dependency
                  </th>
                  <th className="text-right px-3 py-2 text-dire-muted font-medium">
                    Risk
                  </th>
                </tr>
              </thead>
              <tbody>
                {company.resources.map((r, i) => (
                  <motion.tr
                    key={r.name}
                    className="border-b border-white/5 last:border-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                  >
                    <td className="px-3 py-2 text-white">{r.name}</td>
                    <td className="px-3 py-2 text-dire-muted">{r.origin}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.dependency}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`font-mono ${
                          r.risk >= 70
                            ? 'text-dire-danger'
                            : r.risk >= 40
                              ? 'text-dire-warning'
                              : 'text-dire-success'
                        }`}
                      >
                        {r.risk}%
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
