import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import ScenarioCard from '../shared/ScenarioCard';
import DecisionInput from '../simulation/DecisionInput';
import BranchTree from '../simulation/BranchTree';
import CompanyCreator from '../simulation/CompanyCreator';
import ScenarioTracker from '../simulation/ScenarioTracker';
import StrategicActionsPanel from '../simulation/StrategicActionsPanel';
import ResourceFilter from '../visualization/ResourceFilter';
import { getNations, getCompaniesByNation } from '../../utils/api';

const scenarios = ['stable', 'supply_crisis', 'war', 'drought'];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } },
};

export default function LeftPanel({ tier }) {
  const companies       = useStore((s) => s.companies);
  const selectedCompany = useStore((s) => s.selectedCompany);
  const selectCompany   = useStore((s) => s.selectCompany);
  const fetchCompanies  = useStore((s) => s.fetchCompanies);
  const scenario        = useStore((s) => s.scenario);
  const setScenario     = useStore((s) => s.setScenario);
  const mode            = useStore((s) => s.mode);
  const branches          = useStore((s) => s.branches);
  const playerCompany     = useStore((s) => s.playerCompany);
  const selectedNation    = useStore((s) => s.selectedNation);
  const setSelectedNation = useStore((s) => s.setSelectedNation);

  // Nation → Company → Resource drill-down state
  const [nations, setNations]                   = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [nationsLoading, setNationsLoading]     = useState(false);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  // Initial load: fetch all companies + nations
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Load nations from API on mount
  useEffect(() => {
    let cancelled = false;
    async function loadNations() {
      setNationsLoading(true);
      try {
        console.log('[LeftPanel] Fetching nations...');
        const result = await getNations();
        if (!cancelled) {
          const list = result?.data || result || [];
          console.log(`[LeftPanel] Loaded ${list.length} nations`);
          setNations(list);
        }
      } catch (err) {
        console.error('[LeftPanel] Failed to load nations:', err.message);
      } finally {
        if (!cancelled) setNationsLoading(false);
      }
    }
    loadNations();
    return () => { cancelled = true; };
  }, []);

  // When nation changes: fetch companies for that nation
  useEffect(() => {
    let cancelled = false;

    if (!selectedNation) {
      // No nation selected — show all companies from store
      setFilteredCompanies(Array.isArray(companies) ? companies : []);
      return;
    }

    async function loadCompaniesByNation() {
      setCompaniesLoading(true);
      // Clear company selection when nation changes
      selectCompany(null);
      try {
        console.log(`[LeftPanel] Fetching companies for nation: ${selectedNation}`);
        const result = await getCompaniesByNation(selectedNation);
        if (!cancelled) {
          const list = result?.data || result || [];
          console.log(`[LeftPanel] Loaded ${list.length} companies for nation ${selectedNation}`);
          if (list.length === 0) {
            console.warn('[LeftPanel] No companies found for this nation');
          }
          setFilteredCompanies(list);
        }
      } catch (err) {
        console.error('[LeftPanel] Failed to load companies by nation:', err.message);
        // Fallback: filter the store's companies client-side
        if (!cancelled) {
          const fallback = companies.filter((c) => c.country === selectedNation);
          setFilteredCompanies(fallback);
        }
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    }

    loadCompaniesByNation();
    return () => { cancelled = true; };
  }, [selectedNation, companies, selectCompany]);

  // Sync filteredCompanies with store when no nation is selected
  useEffect(() => {
    if (!selectedNation) {
      setFilteredCompanies(Array.isArray(companies) ? companies : []);
    }
  }, [companies, selectedNation]);

  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 400); return () => clearTimeout(t); }, []);

  return (
    <motion.aside
      className="w-[300px] min-w-[300px] bg-dire-panel border-r border-white/5 h-full overflow-y-auto p-4 flex flex-col gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: ready ? 1 : 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
    >
      {ready ? (
        <>
          {/* Company Creator */}
          <CompanyCreator />

          {/* Nation → Company drill-down — show if no player company or in arcade mode */}
          {(mode === 'arcade' || !playerCompany) && (
            <div className="space-y-2">
              {/* Step 1: Nation */}
              <label className="block text-[10px] font-medium text-dire-muted uppercase tracking-wider">
                Nation
              </label>
              <select
                value={selectedNation}
                onChange={(e) => {
                  setSelectedNation(e.target.value);
                }}
                disabled={nationsLoading}
                className="w-full bg-dire-card border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-dire-accent/50 transition-colors appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="">
                  {nationsLoading ? 'Loading nations...' : 'All Nations'}
                </option>
                {nations.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.name}
                  </option>
                ))}
              </select>

              {/* Step 2: Company (filtered by nation) */}
              <label className="block text-[10px] font-medium text-dire-muted uppercase tracking-wider mt-1">
                Company / Role
              </label>
              <div className="relative">
                <select
                  value={selectedCompany?.id || ''}
                  onChange={(e) => {
                    const company = filteredCompanies.find((c) => c.id === e.target.value);
                    selectCompany(company || null);
                  }}
                  disabled={companiesLoading}
                  className="w-full bg-dire-card border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-dire-accent/50 transition-colors appearance-none cursor-pointer disabled:opacity-50"
                >
                  <option value="">
                    {companiesLoading
                      ? 'Loading companies...'
                      : filteredCompanies.length === 0 && selectedNation
                      ? 'No companies in this nation'
                      : 'Select a company...'}
                  </option>
                  {filteredCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.sector || c.country || ''})
                    </option>
                  ))}
                </select>
                {companiesLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-dire-muted animate-pulse">
                    •••
                  </span>
                )}
              </div>

              {/* Empty state hint */}
              {!companiesLoading && filteredCompanies.length === 0 && selectedNation && (
                <p className="text-[10px] text-dire-muted px-1">
                  No companies found for this nation.
                </p>
              )}
            </div>
          )}

          {/* Resource Filter — hidden for Explorer tier */}
          {tier?.showResourceFilter !== false && (
            <div>
              <label className="block text-[10px] font-medium text-dire-muted uppercase tracking-wider mb-2">
                {selectedCompany ? `Resources — ${selectedCompany.name}` : 'Resource Filter'}
              </label>
              <ResourceFilter />
            </div>
          )}

          {/* Scenarios */}
          {mode === 'open_world' ? (
            <ScenarioTracker />
          ) : (
            <div>
              <label className="block text-[10px] font-medium text-dire-muted uppercase tracking-wider mb-2">
                Scenario
              </label>
              <motion.div className="flex flex-col gap-2" variants={staggerContainer} initial="hidden" animate="show">
                {scenarios.map((s) => (
                  <motion.div key={s} variants={staggerItem}>
                    <ScenarioCard scenario={s} selected={scenario === s} onClick={() => setScenario(s)} />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

          {/* Decision Input */}
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <DecisionInput />
            </motion.div>
          </AnimatePresence>

          {/* Strategic Actions — hidden for Explorer tier */}
          {tier?.showStrategicActions !== false && playerCompany && <StrategicActionsPanel />}

          {/* Branch Tree — hidden for Explorer tier */}
          {tier?.showBranchTree !== false && branches.length > 0 && (
            <div>
              <label className="block text-[10px] font-medium text-dire-muted uppercase tracking-wider mb-2">
                Decision Branches
              </label>
              <BranchTree />
            </div>
          )}
        </>
      ) : null}
    </motion.aside>
  );
}
