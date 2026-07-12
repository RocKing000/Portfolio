import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import useStore from '../../store/useStore';

const POLICY_ICONS = {
  export_ban: '🚫',
  regulation: '📜',
  subsidy: '💰',
  tariff: '🚧',
  import_quota: '📦',
};

const STYLE_LABELS = {
  responsive:     { label: 'Responsive',     color: 'text-blue-400' },
  centralized:    { label: 'Centralized',    color: 'text-red-400' },
  interventionist:{ label: 'Interventionist',color: 'text-amber-400' },
  market_driven:  { label: 'Market-Driven',  color: 'text-green-400' },
};

const BUDGET_COLORS = {
  health:         '#4ade80',
  education:      '#60a5fa',
  infrastructure: '#fbbf24',
  defense:        '#f87171',
  industry:       '#a78bfa',
  other:          '#64748b',
};

const IMPACT_COLOR = {
  '+workforce quality':  'text-green-400',
  '+supply efficiency':  'text-green-400',
  '+innovation index':   'text-green-400',
  '+stability':          'text-green-400',
  '+GDP growth':         'text-green-400',
  '-health index':       'text-red-400',
  '-pipeline speed':     'text-red-400',
  '-skill level':        'text-red-400',
  '-stability risk':     'text-red-400',
  '-economic output':    'text-red-400',
  neutral:               'text-dire-muted',
};

export default function GovernancePanel() {
  const governancePolicies = useStore((s) => s.governancePolicies);
  const publicPressure     = useStore((s) => s.publicPressure);
  const playerCompany      = useStore((s) => s.playerCompany);
  const selectedCompany    = useStore((s) => s.selectedCompany);
  const marketState        = useStore((s) => s.marketState);
  const governmentBudget   = useStore((s) => s.governmentBudget);

  const company = playerCompany || selectedCompany;
  const country = company?.country || 'United States';

  const STYLES = {
    'United States': 'market_driven', 'China': 'centralized', 'Germany': 'responsive',
    'India': 'responsive', 'Japan': 'responsive', 'Taiwan': 'responsive',
    'Saudi Arabia': 'interventionist', 'Russia': 'centralized',
  };
  const style = STYLES[country] || 'responsive';
  const styleInfo = STYLE_LABELS[style] || STYLE_LABELS.responsive;

  // Build budget chart data
  const budget = governmentBudget?.allocations || {
    health: 28, education: 16, infrastructure: 12, defense: 20, industry: 8, other: 16,
  };
  const impacts = governmentBudget?.impacts || {};

  const budgetChartData = [
    { name: 'Health', value: budget.health, key: 'health' },
    { name: 'Education', value: budget.education, key: 'education' },
    { name: 'Infra', value: budget.infrastructure, key: 'infrastructure' },
    { name: 'Defense', value: budget.defense, key: 'defense' },
    { name: 'Industry', value: budget.industry, key: 'industry' },
    { name: 'Other', value: budget.other, key: 'other' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-dire-muted uppercase tracking-wider">Governance</h3>

      {/* Country + Response Style */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-dire-muted uppercase">Response Style</span>
          <span className={`text-xs font-medium ${styleInfo.color}`}>{styleInfo.label}</span>
        </div>
        <div className="text-[10px] text-dire-muted mt-1">{country}</div>
      </div>

      {/* ── GOVERNMENT BUDGET ── */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5">
        <div className="text-[10px] text-dire-muted uppercase mb-2">Government Budget Allocation</div>

        {/* Bar chart */}
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={budgetChartData} barSize={14} margin={{ top: 4, bottom: 0, left: -20, right: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 40]} />
            <Tooltip
              contentStyle={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10 }}
              formatter={(v) => [`${v}%`, '']}
            />
            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
              {budgetChartData.map((entry) => (
                <Cell key={entry.key} fill={BUDGET_COLORS[entry.key] || '#64748b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Allocation detail + performance impacts */}
        <div className="mt-2 space-y-1">
          {budgetChartData.slice(0, 5).map(({ name, value, key }) => {
            const impact = impacts[key] || 'neutral';
            return (
              <div key={key} className="flex justify-between items-center text-[9px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: BUDGET_COLORS[key] }} />
                  <span className="text-dire-muted">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={IMPACT_COLOR[impact] || 'text-dire-muted'}>{impact}</span>
                  <span className="text-white font-mono w-6 text-right">{value}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Market State */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5 space-y-2">
        <div className="text-[10px] text-dire-muted uppercase mb-1">Market State</div>
        {[
          { label: 'Sentiment', value: marketState.sentiment, color: marketState.sentiment > 50 ? 'bg-green-400' : 'bg-red-400' },
          { label: 'Confidence', value: marketState.confidence, color: marketState.confidence > 50 ? 'bg-green-400' : 'bg-red-400' },
          { label: 'Volatility', value: marketState.volatility, color: marketState.volatility > 40 ? 'bg-red-400' : 'bg-amber-400' },
        ].map(m => (
          <div key={m.label}>
            <div className="flex justify-between text-[10px]">
              <span className="text-dire-muted">{m.label}</span>
              <span className="text-white font-mono">{Math.round(m.value)}</span>
            </div>
            <div className="h-1 bg-dire-dark rounded-full overflow-hidden">
              <motion.div className={`h-full rounded-full ${m.color}`} animate={{ width: `${m.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Active Policies */}
      <div className="space-y-2">
        <div className="text-[10px] text-dire-muted uppercase">Active Policies</div>
        {governancePolicies.length > 0 ? (
          governancePolicies.slice(-4).map((policy, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-dire-card rounded-lg p-2.5 border border-white/5"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{POLICY_ICONS[policy.type] || '📋'}</span>
                <span className="text-xs text-white flex-1">{policy.label}</span>
              </div>
              <div className="text-[10px] text-dire-muted mt-1">
                Trigger: {policy.trigger} · Strength: {Math.round((policy.strength || 1) * 100)}%
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-[10px] text-dire-muted text-center py-3">
            No active policies. Governance reacts to stress levels.
          </div>
        )}
      </div>

      {/* Public Pressure */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5">
        <div className="text-[10px] text-dire-muted uppercase mb-2">Pressure Breakdown</div>
        {[
          { label: 'Price Pressure',   value: publicPressure?.price_pressure        || 25 },
          { label: 'Environmental',    value: publicPressure?.environmental_pressure || 25 },
          { label: 'Shortage',         value: publicPressure?.shortage_pressure      || 20 },
        ].map(p => (
          <div key={p.label} className="flex justify-between items-center text-[10px] py-1">
            <span className="text-dire-muted">{p.label}</span>
            <span className={`font-mono ${p.value > 50 ? 'text-red-400' : p.value > 30 ? 'text-amber-400' : 'text-green-400'}`}>
              {Math.round(p.value)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
