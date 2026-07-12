import { motion } from 'framer-motion';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import useStore from '../../store/useStore';
import AnimatedNumber from '../shared/AnimatedNumber';

function GaugeBar({ label, value, color = '#00d4ff', max = 100, suffix = '' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px]">
        <span className="text-dire-muted">{label}</span>
        <span className="text-white font-mono"><AnimatedNumber value={value} decimals={0} />{suffix}</span>
      </div>
      <div className="h-1 bg-dire-dark rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7 }}
        />
      </div>
    </div>
  );
}

function PopBar({ label, valueM, total, color }) {
  const pct = total > 0 ? Math.min(100, (valueM / total) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[9px]">
        <span className="text-dire-muted">{label}</span>
        <span className="text-white font-mono">{valueM.toFixed(1)}M</span>
      </div>
      <div className="h-1.5 bg-dire-dark rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}

export default function HealthLiteracyPanel() {
  const healthData = useStore(s => s.healthData);
  const literacyData = useStore(s => s.literacyData);
  const populationData = useStore(s => s.populationData);
  const playerCompany = useStore(s => s.playerCompany);
  const selectedCompany = useStore(s => s.selectedCompany);

  const company = playerCompany || selectedCompany;
  const country = company?.country || 'United States';

  const health = healthData || {
    healthIndex: 72, healthcareCapacity: 80, diseaseRisk: 28, environmentalHealth: 65,
  };
  const literacy = literacyData || {
    overallLiteracy: 95, maleLiteracy: 96, femaleLiteracy: 94, genderBalance: 96,
    educationQuality: 78, innovationIndex: 80,
  };
  const pop = populationData || {
    totalPopulationM: 334.9, workingRatio: 63, workingPopulationM: 211,
    employedM: 203.5, unemployedM: 7.5, unemploymentRate: 3.6,
    employmentBreakdown: { privateM: 146.5, governmentM: 30.5, selfEmployedM: 26.5, privateShare: 72, govShare: 15, selfShare: 13 },
  };

  const radarData = [
    { subject: 'Health', value: health.healthIndex },
    { subject: 'Capacity', value: health.healthcareCapacity },
    { subject: 'Env Health', value: health.environmentalHealth },
    { subject: 'Education', value: literacy.educationQuality },
    { subject: 'Innovation', value: literacy.innovationIndex },
    { subject: 'Literacy', value: literacy.overallLiteracy },
  ];

  const bd = pop.employmentBreakdown || {};

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-dire-muted uppercase tracking-wider">Social Indicators</h3>

      {/* Country indicator */}
      <div className="bg-dire-card rounded-lg px-3 py-2 border border-white/5 flex items-center justify-between">
        <div>
          <div className="text-[9px] text-dire-muted">Country</div>
          <div className="text-xs font-medium text-white">{country}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-dire-muted">Social Index</div>
          <div className="text-base font-bold font-mono text-dire-accent">
            <AnimatedNumber value={Math.round((health.healthIndex + literacy.overallLiteracy + literacy.educationQuality) / 3)} decimals={0} />
          </div>
        </div>
      </div>

      {/* Radar chart */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5">
        <div className="text-[10px] text-dire-muted uppercase mb-1">Social Performance Radar</div>
        <ResponsiveContainer width="100%" height={150}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.05)" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#64748b' }} />
            <Radar dataKey="value" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.12} strokeWidth={1.5} />
            <Tooltip contentStyle={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* ── POPULATION SYSTEM ── */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5 space-y-2.5">
        <div className="text-[10px] text-dire-muted uppercase mb-1">Population System</div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Total', value: `${pop.totalPopulationM.toFixed(0)}M`, color: 'text-white' },
            { label: 'Working', value: `${pop.workingRatio}%`, color: 'text-blue-400' },
            { label: 'Unemp.', value: `${pop.unemploymentRate}%`, color: pop.unemploymentRate > 8 ? 'text-red-400' : pop.unemploymentRate > 5 ? 'text-amber-400' : 'text-green-400' },
          ].map(k => (
            <div key={k.label} className="bg-dire-dark rounded p-1.5 text-center">
              <div className={`text-sm font-bold font-mono ${k.color}`}>{k.value}</div>
              <div className="text-[9px] text-dire-muted">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Employed vs unemployed */}
        <div className="space-y-1.5">
          <PopBar label="Employed" valueM={pop.employedM} total={pop.workingPopulationM} color="#4ade80" />
          <PopBar label="Unemployed" valueM={pop.unemployedM} total={pop.workingPopulationM} color="#f87171" />
        </div>

        {/* Employment breakdown */}
        <div className="text-[9px] text-dire-muted uppercase pt-1">Employment Breakdown</div>
        <div className="space-y-1.5">
          <PopBar label={`Private Sector (${bd.privateShare || 72}%)`} valueM={bd.privateM || 0} total={pop.employedM} color="#60a5fa" />
          <PopBar label={`Government (${bd.govShare || 15}%)`}         valueM={bd.governmentM || 0} total={pop.employedM} color="#a78bfa" />
          <PopBar label={`Self-Employed (${bd.selfShare || 13}%)`}      valueM={bd.selfEmployedM || 0} total={pop.employedM} color="#fbbf24" />
        </div>
      </div>

      {/* Health Indicators */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5 space-y-2.5">
        <div className="text-[10px] text-dire-muted uppercase mb-1">Health System</div>
        <GaugeBar label="Health Index" value={health.healthIndex} color="#4ade80" />
        <GaugeBar label="Healthcare Capacity" value={health.healthcareCapacity} color="#60a5fa" />
        <GaugeBar label="Disease Risk" value={health.diseaseRisk} color="#f87171" />
        <GaugeBar label="Environmental Health" value={health.environmentalHealth} color="#a78bfa" />
      </div>

      {/* Literacy Indicators */}
      <div className="bg-dire-card rounded-lg p-3 border border-white/5 space-y-2.5">
        <div className="text-[10px] text-dire-muted uppercase mb-1">Education & Literacy</div>
        <GaugeBar label="Overall Literacy" value={literacy.overallLiteracy} color="#4ade80" suffix="%" />
        <GaugeBar label="Male Literacy" value={literacy.maleLiteracy} color="#60a5fa" suffix="%" />
        <GaugeBar label="Female Literacy" value={literacy.femaleLiteracy} color="#f472b6" suffix="%" />
        <GaugeBar label="Gender Balance" value={literacy.genderBalance} color="#a78bfa" />
        <GaugeBar label="Education Quality" value={literacy.educationQuality} color="#fbbf24" />
        <GaugeBar label="Innovation Index" value={literacy.innovationIndex} color="#00d4ff" />
      </div>
    </div>
  );
}
