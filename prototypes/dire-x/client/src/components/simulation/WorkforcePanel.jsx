import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import useStore from '../../store/useStore';
import AnimatedNumber from '../shared/AnimatedNumber';

// Deterministic workforce distribution based on industry
const INDUSTRY_DISTRIBUTION = {
  ev:           { manufacturing: 38, refining: 12, rd: 15, supplyChain: 14, operations: 10, management: 6, support: 5 },
  agriculture:  { manufacturing: 20, refining: 18, rd: 8,  supplyChain: 22, operations: 18, management: 7, support: 7 },
  defense:      { manufacturing: 32, refining: 8,  rd: 22, supplyChain: 12, operations: 12, management: 8, support: 6 },
  electronics:  { manufacturing: 40, refining: 10, rd: 18, supplyChain: 12, operations: 8,  management: 6, support: 6 },
  energy:       { manufacturing: 22, refining: 25, rd: 10, supplyChain: 16, operations: 14, management: 8, support: 5 },
  pharma:       { manufacturing: 28, refining: 14, rd: 24, supplyChain: 10, operations: 10, management: 7, support: 7 },
  automotive:   { manufacturing: 42, refining: 6,  rd: 14, supplyChain: 14, operations: 10, management: 7, support: 7 },
  mining:       { manufacturing: 18, refining: 30, rd: 8,  supplyChain: 18, operations: 16, management: 5, support: 5 },
  telecom:      { manufacturing: 15, refining: 5,  rd: 28, supplyChain: 12, operations: 20, management: 10, support: 10 },
  construction: { manufacturing: 44, refining: 12, rd: 6,  supplyChain: 16, operations: 12, management: 5, support: 5 },
};

const DIST_COLORS = {
  manufacturing: '#60a5fa',
  refining:      '#fbbf24',
  rd:            '#a78bfa',
  supplyChain:   '#4ade80',
  operations:    '#f97316',
  management:    '#f472b6',
  support:       '#64748b',
};

const DIST_LABELS = {
  manufacturing: 'Manufacturing',
  refining:      'Refining',
  rd:            'R&D',
  supplyChain:   'Supply Chain',
  operations:    'Operations',
  management:    'Management',
  support:       'Support',
};

function StatBar({ label, value, max, color }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-dire-muted">{label}</span>
        <span className="text-white font-mono">{typeof value === 'number' && value < 10 ? (value * 100).toFixed(0) + '%' : value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-dire-dark rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

export default function WorkforcePanel() {
  const workforce = useStore((s) => s.workforce);
  const playerCompany = useStore((s) => s.playerCompany);
  const selectedCompany = useStore((s) => s.selectedCompany);

  const company = playerCompany || selectedCompany;
  const wf = workforce || company?.workforce || {
    size: 2000, skill_level: 0.6, productivity: 0.7, cost_per_worker: 50, morale: 0.7,
  };

  const totalCost = wf.size * wf.cost_per_worker;
  const effectiveOutput = wf.productivity * wf.morale * 100;

  // Build distribution based on industry
  const industry = company?.industry || 'electronics';
  const dist = INDUSTRY_DISTRIBUTION[industry] || INDUSTRY_DISTRIBUTION.electronics;
  const pieData = Object.entries(dist).map(([key, pct]) => ({
    name: DIST_LABELS[key],
    value: pct,
    headcount: Math.round(wf.size * pct / 100),
    color: DIST_COLORS[key],
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-dire-muted uppercase tracking-wider">Workforce</h3>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <motion.div className="bg-dire-card rounded-lg p-2.5 border border-white/5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="text-[10px] text-dire-muted uppercase">Headcount</div>
          <div className="text-sm font-bold font-mono text-white">{wf.size.toLocaleString()}</div>
        </motion.div>
        <motion.div className="bg-dire-card rounded-lg p-2.5 border border-white/5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="text-[10px] text-dire-muted uppercase">Total Cost</div>
          <div className="text-sm font-bold font-mono text-amber-400">${(totalCost / 1000).toFixed(0)}K</div>
        </motion.div>
      </div>

      {/* Stat Bars */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5 space-y-3">
        <StatBar label="Skill Level"   value={wf.skill_level}  max={1} color="bg-blue-400" />
        <StatBar label="Productivity"  value={wf.productivity} max={1} color="bg-green-400" />
        <StatBar label="Morale"        value={wf.morale}       max={1} color={wf.morale > 0.5 ? 'bg-emerald-400' : 'bg-red-400'} />
      </div>

      {/* Effective Output */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5 flex justify-between items-center">
        <div>
          <span className="text-[10px] text-dire-muted uppercase block">Effective Output</span>
          <span className="text-[9px] text-dire-muted">productivity × morale</span>
        </div>
        <span className={`text-sm font-bold font-mono ${effectiveOutput > 60 ? 'text-green-400' : effectiveOutput > 40 ? 'text-amber-400' : 'text-red-400'}`}>
          <AnimatedNumber value={effectiveOutput} decimals={1} />%
        </span>
      </div>

      {/* ── WORKFORCE DISTRIBUTION ── */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5">
        <div className="text-[10px] text-dire-muted uppercase mb-2">Distribution by Function</div>

        {/* Mini pie chart */}
        <ResponsiveContainer width="100%" height={110}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" strokeWidth={0}>
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10 }}
              formatter={(v, name) => [`${v}%`, name]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Distribution list */}
        <div className="space-y-1.5 mt-1">
          {pieData.map(({ name, value, headcount, color }) => (
            <div key={name} className="flex items-center justify-between text-[9px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm inline-block flex-shrink-0" style={{ background: color }} />
                <span className="text-dire-muted">{name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-dire-muted">{headcount.toLocaleString()}</span>
                <span className="text-white font-mono w-7 text-right">{value}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost per Worker */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5 flex justify-between items-center">
        <span className="text-[10px] text-dire-muted uppercase">Cost per Worker</span>
        <span className="text-sm font-bold font-mono text-white">${wf.cost_per_worker.toFixed(0)}</span>
      </div>
    </div>
  );
}
