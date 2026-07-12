import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import RiskOverview from './RiskOverview';
import { getScoreColor, getScoreLabel } from '../../utils/format';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariant = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } },
};

function generateSparklineData(baseScore) {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    value: Math.max(0, Math.min(100, baseScore + (Math.random() - 0.5) * 25)),
  }));
}

function CompanyCard({ company, isSelected, onSelect }) {
  const sparkData = generateSparklineData(company.sresScore);
  const scoreColor = getScoreColor(company.sresScore);
  const scoreLabel = getScoreLabel(company.sresScore);

  return (
    <motion.div
      variants={cardVariant}
      className={`bg-dire-card rounded-xl p-4 border cursor-pointer transition-all ${
        isSelected
          ? 'border-dire-accent/50 glow-accent-sm'
          : 'border-white/5 hover:border-white/10'
      }`}
      onClick={() => onSelect(company)}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      layout
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{company.name}</h3>
          <p className="text-xs text-dire-muted mt-0.5">
            {company.sector} &middot; {company.country}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold font-mono ${scoreColor}`}>
            {company.sresScore}
          </div>
          <div className={`text-[10px] font-medium ${scoreColor}`}>
            {scoreLabel}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="h-10 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={
                company.sresScore >= 60
                  ? '#ef4444'
                  : company.sresScore >= 40
                    ? '#fbbf24'
                    : '#22c55e'
              }
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Key Resources */}
      <div className="space-y-1">
        {(company.resources || []).slice(0, 3).map((r) => (
          <div key={r.name} className="flex items-center justify-between">
            <span className="text-[10px] text-dire-muted truncate flex-1">
              {r.name}
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <div className="w-12 h-1 bg-dire-dark rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    r.risk >= 70
                      ? 'bg-dire-danger'
                      : r.risk >= 40
                        ? 'bg-dire-warning'
                        : 'bg-dire-success'
                  }`}
                  style={{ width: `${r.risk}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-dire-muted w-6 text-right">
                {r.risk}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function IntelligenceDashboard() {
  const companies = useStore((s) => s.companies);
  const selectedCompany = useStore((s) => s.selectedCompany);
  const selectCompany = useStore((s) => s.selectCompany);
  const fetchRisk = useStore((s) => s.fetchRisk);

  const handleSelect = (company) => {
    selectCompany(company);
    fetchRisk(company.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">
          Risk Intelligence Overview
        </h2>
        <p className="text-sm text-dire-muted mt-1">
          Monitor SRES scores and resource dependencies across companies
        </p>
      </div>

      {/* Selected Company Detail */}
      <AnimatePresence>
        {selectedCompany && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <RiskOverview company={selectedCompany} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Company Grid */}
      <motion.div
        className="grid grid-cols-2 gap-3"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {companies.map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            isSelected={selectedCompany?.id === company.id}
            onSelect={handleSelect}
          />
        ))}
      </motion.div>
    </div>
  );
}
