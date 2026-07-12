import { motion } from 'framer-motion';
import useStore from '../../store/useStore';
import AnimatedNumber from '../shared/AnimatedNumber';

const STATUS_CONFIG = {
  compliant: { label: 'Compliant', color: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/10' },
  watch:     { label: 'Under Watch', color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
  at_risk:   { label: 'At Risk', color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/10' },
};

function ScoreGauge({ value, label, color }) {
  const barColor = value >= 75 ? '#4ade80' : value >= 55 ? '#fbbf24' : '#f87171';
  return (
    <div>
      <div className="flex justify-between text-[9px] mb-1">
        <span className="text-dire-muted">{label}</span>
        <span className="font-mono text-white"><AnimatedNumber value={value} decimals={0} /></span>
      </div>
      <div className="h-1 bg-dire-dark rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color || barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7 }}
        />
      </div>
    </div>
  );
}

export default function CompliancePanel() {
  const complianceData = useStore(s => s.complianceData);
  const playerCompany = useStore(s => s.playerCompany);
  const selectedCompany = useStore(s => s.selectedCompany);
  const company = playerCompany || selectedCompany;

  const data = complianceData || {
    complianceScore: 65, regulatoryBurden: 70, transparency: 62,
    auditRisk: 38, trustScore: 64, status: 'watch', auditFrequency: 'medium',
    taxProfile: { corporateTaxRate: 25, importTariffRate: 12, exportDutyRate: 5, subsidyRate: 3, netTaxBurden: 31 },
  };

  const statusCfg = STATUS_CONFIG[data.status] || STATUS_CONFIG.watch;
  const auditFreqColor = { high: 'text-red-400', medium: 'text-yellow-400', low: 'text-green-400' };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-dire-muted uppercase tracking-wider">Compliance & Governance</h3>

      {/* Status badge */}
      <div className={`rounded-lg p-3 border ${statusCfg.border} ${statusCfg.bg} flex items-center justify-between`}>
        <div>
          <div className="text-[9px] text-dire-muted mb-0.5">Compliance Status</div>
          <div className={`text-sm font-bold ${statusCfg.color}`}>{statusCfg.label}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-dire-muted mb-0.5">Score</div>
          <div className={`text-xl font-bold font-mono ${statusCfg.color}`}>
            <AnimatedNumber value={data.complianceScore} decimals={0} />
          </div>
        </div>
      </div>

      {/* Compliance metrics */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5 space-y-2.5">
        <div className="text-[10px] text-dire-muted uppercase">Compliance Metrics</div>
        <ScoreGauge label="Compliance Score" value={data.complianceScore} />
        <ScoreGauge label="Transparency" value={data.transparency} color="#60a5fa" />
        <ScoreGauge label="Trust Score" value={data.trustScore} color="#4ade80" />
        <div className="h-px bg-white/5" />
        <ScoreGauge label="Regulatory Burden" value={data.regulatoryBurden} color="#fbbf24" />
        <div className="flex items-center justify-between text-[9px] pt-1">
          <span className="text-dire-muted">Audit Risk</span>
          <span className={`font-mono ${data.auditRisk > 50 ? 'text-red-400' : data.auditRisk > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
            {data.auditRisk}%
          </span>
        </div>
        <div className="flex items-center justify-between text-[9px]">
          <span className="text-dire-muted">Audit Frequency</span>
          <span className={`capitalize font-medium ${auditFreqColor[data.auditFrequency] || 'text-white'}`}>
            {data.auditFrequency}
          </span>
        </div>
      </div>

      {/* Tax & Tariff Profile */}
      {data.taxProfile && (
        <div className="bg-dire-card rounded-lg p-3 border border-white/5">
          <div className="text-[10px] text-dire-muted uppercase mb-2">Tax & Tariff Profile</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Corp Tax', value: data.taxProfile.corporateTaxRate, suffix: '%', color: 'text-amber-400' },
              { label: 'Import Tariff', value: data.taxProfile.importTariffRate, suffix: '%', color: 'text-orange-400' },
              { label: 'Export Duty', value: data.taxProfile.exportDutyRate, suffix: '%', color: 'text-pink-400' },
              { label: 'Subsidy', value: data.taxProfile.subsidyRate, suffix: '%', color: 'text-green-400' },
            ].map(m => (
              <div key={m.label} className="bg-dire-dark rounded-lg p-2">
                <div className="text-[9px] text-dire-muted">{m.label}</div>
                <div className={`text-sm font-bold font-mono ${m.color}`}>
                  <AnimatedNumber value={m.value} decimals={0} />{m.suffix}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-white/5 flex justify-between items-center">
            <span className="text-[10px] text-dire-muted">Net Tax Burden</span>
            <span className={`text-sm font-bold font-mono ${data.taxProfile.netTaxBurden > 40 ? 'text-red-400' : data.taxProfile.netTaxBurden > 25 ? 'text-yellow-400' : 'text-green-400'}`}>
              <AnimatedNumber value={data.taxProfile.netTaxBurden} decimals={0} />%
            </span>
          </div>
        </div>
      )}

      {/* Compliance tips */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5">
        <div className="text-[10px] text-dire-muted uppercase mb-2">Risk Signals</div>
        <div className="space-y-1.5">
          {data.auditRisk > 50 && (
            <motion.div
              className="flex items-start gap-2 text-[9px] text-red-300"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="mt-0.5 text-red-400">●</span>
              High audit risk — consider strengthening transparency measures
            </motion.div>
          )}
          {data.complianceScore < 55 && (
            <motion.div
              className="flex items-start gap-2 text-[9px] text-orange-300"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="mt-0.5 text-orange-400">●</span>
              Compliance exposure growing — regulatory action possible
            </motion.div>
          )}
          {data.taxProfile?.netTaxBurden > 35 && (
            <motion.div
              className="flex items-start gap-2 text-[9px] text-yellow-300"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="mt-0.5 text-yellow-400">●</span>
              Elevated tax burden compressing profit margins
            </motion.div>
          )}
          {data.complianceScore >= 75 && data.auditRisk <= 30 && (
            <motion.div
              className="flex items-start gap-2 text-[9px] text-green-300"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="mt-0.5 text-green-400">●</span>
              Strong compliance posture — low regulatory exposure
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
