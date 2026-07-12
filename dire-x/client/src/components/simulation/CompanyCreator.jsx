import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';

const INDUSTRIES = [
  { id: 'ev', label: 'Electric Vehicles', icon: '\u26A1', color: 'text-cyan-400' },
  { id: 'agriculture', label: 'Agriculture', icon: '\uD83C\uDF3E', color: 'text-green-400' },
  { id: 'defense', label: 'Defense', icon: '\uD83D\uDEE1\uFE0F', color: 'text-red-400' },
  { id: 'electronics', label: 'Electronics', icon: '\uD83D\uDCF1', color: 'text-purple-400' },
  { id: 'energy', label: 'Energy', icon: '\uD83D\uDD0B', color: 'text-yellow-400' },
  { id: 'pharma', label: 'Pharma', icon: '\uD83D\uDC8A', color: 'text-pink-400' },
];

const COUNTRIES = [
  'United States', 'China', 'Germany', 'India', 'Taiwan', 'Japan',
  'South Korea', 'Brazil', 'UK', 'Australia', 'Russia', 'Nigeria',
  'Saudi Arabia', 'Mexico', 'Indonesia', 'Turkey', 'Vietnam', 'Thailand',
];

const STRATEGIES = [
  { id: 'cost', label: 'Cost-Optimized', desc: 'Higher dependency, lower costs', color: 'border-orange-500' },
  { id: 'balanced', label: 'Balanced', desc: 'Even trade-offs', color: 'border-blue-500' },
  { id: 'sustainable', label: 'Sustainable', desc: 'Lower risk, higher cost', color: 'border-green-500' },
];

const SCALES = [
  { id: 'small', label: 'Small', desc: 'Nimble, volatile' },
  { id: 'medium', label: 'Medium', desc: 'Balanced exposure' },
  { id: 'large', label: 'Large', desc: 'High dependency, stable' },
];

export default function CompanyCreator() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [strategy, setStrategy] = useState('');
  const [scale, setScale] = useState('');

  const { createCompany, isCreatingCompany, playerCompany } = useStore();

  // If company already created, show summary
  if (playerCompany) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 bg-dire-card rounded-lg border border-dire-accent/20"
      >
        <h3 className="text-dire-accent font-semibold mb-2">Your Company</h3>
        <div className="text-white font-bold text-lg">{playerCompany.name}</div>
        <div className="text-dire-muted text-sm mt-1">
          {playerCompany.industry} &bull; {playerCompany.country}
        </div>
        <div className="text-dire-muted text-sm">
          {playerCompany.strategy} &bull; {playerCompany.scale}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-dire-muted">SRES:</span>
          <span
            className={`font-mono font-bold ${
              playerCompany.sresScore > 60
                ? 'text-dire-danger'
                : playerCompany.sresScore > 40
                  ? 'text-dire-warning'
                  : 'text-dire-success'
            }`}
          >
            {playerCompany.sresScore}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
          {playerCompany.resources?.slice(0, 4).map((r) => (
            <div key={r.name} className="text-dire-muted truncate">
              {r.name}: {Math.round(r.dependency * 100)}%
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  const handleCreate = async () => {
    await createCompany({ name: name || undefined, industry, country, strategy, scale });
  };

  return (
    <div className="p-4">
      <h3 className="text-dire-accent font-semibold mb-3 text-sm uppercase tracking-wider">
        Create Company
      </h3>

      {/* Progress dots */}
      <div className="flex gap-1.5 mb-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-dire-accent' : 'bg-dire-panel'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="name"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
          >
            <label className="text-sm text-dire-muted mb-2 block">Company Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name (optional)"
              className="w-full bg-dire-dark border border-dire-muted/30 rounded px-3 py-2 text-white text-sm focus:border-dire-accent focus:outline-none"
            />
            <button
              onClick={() => setStep(1)}
              className="mt-3 w-full py-2 bg-dire-accent/20 text-dire-accent rounded text-sm hover:bg-dire-accent/30 transition-colors"
            >
              Next
            </button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="industry"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
          >
            <label className="text-sm text-dire-muted mb-2 block">Select Industry</label>
            <div className="grid grid-cols-2 gap-2">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind.id}
                  onClick={() => {
                    setIndustry(ind.id);
                    setStep(2);
                  }}
                  className={`p-2.5 rounded border text-left text-sm transition-all ${
                    industry === ind.id
                      ? 'border-dire-accent bg-dire-accent/10'
                      : 'border-dire-muted/20 bg-dire-dark hover:border-dire-muted/40'
                  }`}
                >
                  <span className="text-lg">{ind.icon}</span>
                  <div className={`mt-1 font-medium ${ind.color}`}>{ind.label}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(0)}
              className="mt-2 text-xs text-dire-muted hover:text-white"
            >
              &larr; Back
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="country"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
          >
            <label className="text-sm text-dire-muted mb-2 block">Select Country</label>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                if (e.target.value) setStep(3);
              }}
              className="w-full bg-dire-dark border border-dire-muted/30 rounded px-3 py-2 text-white text-sm focus:border-dire-accent focus:outline-none"
            >
              <option value="">Choose country...</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={() => setStep(1)}
              className="mt-2 text-xs text-dire-muted hover:text-white"
            >
              &larr; Back
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="strategy"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
          >
            <label className="text-sm text-dire-muted mb-2 block">Strategy</label>
            <div className="space-y-2">
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setStrategy(s.id);
                    setStep(4);
                  }}
                  className={`w-full p-2.5 rounded border text-left text-sm transition-all ${
                    strategy === s.id
                      ? 'border-dire-accent bg-dire-accent/10'
                      : `${s.color} border-opacity-30 bg-dire-dark hover:border-opacity-60`
                  }`}
                >
                  <div className="font-medium text-white">{s.label}</div>
                  <div className="text-dire-muted text-xs mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="mt-2 text-xs text-dire-muted hover:text-white"
            >
              &larr; Back
            </button>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="scale"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
          >
            <label className="text-sm text-dire-muted mb-2 block">Company Scale</label>
            <div className="space-y-2">
              {SCALES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setScale(s.id);
                    setStep(5);
                  }}
                  className={`w-full p-2.5 rounded border text-left text-sm transition-all ${
                    scale === s.id
                      ? 'border-dire-accent bg-dire-accent/10'
                      : 'border-dire-muted/20 bg-dire-dark hover:border-dire-muted/40'
                  }`}
                >
                  <div className="font-medium text-white">{s.label}</div>
                  <div className="text-dire-muted text-xs mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(3)}
              className="mt-2 text-xs text-dire-muted hover:text-white"
            >
              &larr; Back
            </button>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div
            key="review"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
          >
            <label className="text-sm text-dire-muted mb-2 block">Review</label>
            <div className="bg-dire-dark rounded p-3 space-y-1.5 text-sm">
              <div>
                <span className="text-dire-muted">Name:</span>{' '}
                <span className="text-white">{name || 'Auto-generated'}</span>
              </div>
              <div>
                <span className="text-dire-muted">Industry:</span>{' '}
                <span className="text-white">
                  {INDUSTRIES.find((i) => i.id === industry)?.label}
                </span>
              </div>
              <div>
                <span className="text-dire-muted">Country:</span>{' '}
                <span className="text-white">{country}</span>
              </div>
              <div>
                <span className="text-dire-muted">Strategy:</span>{' '}
                <span className="text-white">
                  {STRATEGIES.find((s) => s.id === strategy)?.label}
                </span>
              </div>
              <div>
                <span className="text-dire-muted">Scale:</span>{' '}
                <span className="text-white">
                  {SCALES.find((s) => s.id === scale)?.label}
                </span>
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={isCreatingCompany}
              className="mt-3 w-full py-2.5 bg-dire-accent text-dire-dark font-bold rounded text-sm hover:bg-dire-accent/90 transition-colors disabled:opacity-50"
            >
              {isCreatingCompany ? 'Creating...' : 'Launch Company'}
            </button>
            <button
              onClick={() => setStep(4)}
              className="mt-2 text-xs text-dire-muted hover:text-white"
            >
              &larr; Back
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
