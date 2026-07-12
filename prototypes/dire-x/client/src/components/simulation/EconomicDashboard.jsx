import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import useStore from '../../store/useStore';
import AnimatedNumber from '../shared/AnimatedNumber';

const COLORS = ['#60a5fa', '#4ade80', '#fbbf24', '#f87171'];

export default function EconomicDashboard() {
  const economics = useStore((s) => s.economics);
  const marketState = useStore((s) => s.marketState);
  const publicPressure = useStore((s) => s.publicPressure);
  const timeline = useStore((s) => s.timeline);

  const econ = economics || {};

  // Revenue/profit history from timeline
  const historyData = timeline.slice(-20).map((t, i) => ({
    day: t.day,
    revenue: 750 + (Math.random() - 0.3) * 200,
    profit: 250 + (Math.random() - 0.3) * 150,
    cost: 500 + (Math.random() - 0.5) * 100,
  }));

  // Cost breakdown for pie chart
  const costData = [
    { name: 'Raw Materials', value: econ.raw_material_cost || 200 },
    { name: 'Refining', value: econ.refining_cost || 100 },
    { name: 'Manufacturing', value: econ.manufacturing_cost || 200 },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-dire-muted uppercase tracking-wider">Economic Dashboard</h3>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Revenue', value: econ.revenue || 0, color: 'text-green-400', prefix: '$' },
          { label: 'Profit', value: econ.profit || 0, color: econ.profit >= 0 ? 'text-green-400' : 'text-red-400', prefix: '$' },
          { label: 'Margin', value: econ.profit_margin || 0, color: 'text-blue-400', suffix: '%' },
          { label: 'Output', value: econ.output_units || 0, color: 'text-amber-400', suffix: 'u' },
        ].map((m) => (
          <motion.div
            key={m.label}
            className="bg-dire-card rounded-lg p-2.5 border border-white/5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="text-[10px] text-dire-muted uppercase">{m.label}</div>
            <div className={`text-sm font-bold font-mono ${m.color}`}>
              {m.prefix || ''}<AnimatedNumber value={m.value} decimals={1} />{m.suffix || ''}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Market Price */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] text-dire-muted uppercase">Market Price</span>
          <span className="text-sm font-mono text-white font-bold">${(econ.market_price || 7.5).toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-dire-muted">
          <span>Sentiment: <span className={marketState.sentiment > 50 ? 'text-green-400' : 'text-red-400'}>{Math.round(marketState.sentiment)}%</span></span>
          <span>Confidence: <span className={marketState.confidence > 50 ? 'text-green-400' : 'text-red-400'}>{Math.round(marketState.confidence)}%</span></span>
        </div>
      </div>

      {/* Revenue/Profit Chart */}
      {historyData.length > 3 && (
        <div className="bg-dire-card rounded-lg p-3 border border-white/5">
          <div className="text-[10px] text-dire-muted uppercase mb-2">Revenue & Profit Trend</div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <Tooltip contentStyle={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="revenue" stroke="#4ade80" fill="url(#revGrad)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="profit" stroke="#60a5fa" fill="url(#profGrad)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cost Breakdown */}
      {costData.length > 0 && (
        <div className="bg-dire-card rounded-lg p-3 border border-white/5">
          <div className="text-[10px] text-dire-muted uppercase mb-2">Cost Breakdown</div>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={costData} dataKey="value" cx="50%" cy="50%" innerRadius={15} outerRadius={28} paddingAngle={2}>
                    {costData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1">
              {costData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-[10px]">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-dire-muted flex-1">{d.name}</span>
                  <span className="text-white font-mono">${d.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Public Pressure */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5">
        <div className="text-[10px] text-dire-muted uppercase mb-2">Public Pressure</div>
        <div className="h-2 bg-dire-dark rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              (publicPressure?.total_pressure || 25) > 60 ? 'bg-red-400' :
              (publicPressure?.total_pressure || 25) > 40 ? 'bg-amber-400' : 'bg-green-400'
            }`}
            animate={{ width: `${publicPressure?.total_pressure || 25}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="text-right text-[10px] text-dire-muted mt-1">{Math.round(publicPressure?.total_pressure || 25)}%</div>
      </div>
    </div>
  );
}
