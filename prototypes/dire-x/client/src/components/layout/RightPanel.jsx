import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import MetricsPanel from '../simulation/MetricsPanel';
import ExplanationPanel from '../simulation/ExplanationPanel';
import Leaderboard from '../simulation/Leaderboard';
import EconomicDashboard from '../simulation/EconomicDashboard';
import WorkforcePanel from '../simulation/WorkforcePanel';
import GovernancePanel from '../simulation/GovernancePanel';
import GDPPanel from '../simulation/GDPPanel';
import GeopoliticalPanel from '../simulation/GeopoliticalPanel';
import HealthLiteracyPanel from '../simulation/HealthLiteracyPanel';
import CompliancePanel from '../simulation/CompliancePanel';
import useStore from '../../store/useStore';

// Fallback tabs if no tier provided
const DEFAULT_TABS = [
  { id: 'metrics',     label: 'Metrics',  short: 'M' },
  { id: 'economy',     label: 'Economy',  short: 'E' },
  { id: 'workforce',   label: 'Workforce', short: 'W' },
  { id: 'gdp',         label: 'GDP',      short: 'G' },
  { id: 'geo',         label: 'Geo',      short: '🌍' },
  { id: 'health',      label: 'Health',   short: 'H' },
  { id: 'compliance',  label: 'Comply',   short: 'C' },
  { id: 'governance',  label: 'Gov',      short: '⚖' },
];

export default function RightPanel({ tier }) {
  const selectedCompany = useStore((s) => s.selectedCompany);
  const playerCompany = useStore((s) => s.playerCompany);
  const showLeaderboard = useStore((s) => s.showLeaderboard);
  const setShowLeaderboard = useStore((s) => s.setShowLeaderboard);
  const activeRightTab = useStore((s) => s.activeRightTab);
  const setActiveRightTab = useStore((s) => s.setActiveRightTab);

  const company = playerCompany || selectedCompany;
  const resources = company?.resources || [
    { name: 'Semiconductors', dependency: 0.85, risk: 70, category: 'supply' },
    { name: 'Rare Earth Elements', dependency: 0.78, risk: 75, category: 'supply' },
    { name: 'Natural Gas', dependency: 0.60, risk: 82, category: 'stability' },
  ];

  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 400); return () => clearTimeout(t); }, []);

  return (
    <motion.aside
      className={`${tier?.rightPanelWidth || 'w-[320px] min-w-[320px]'} bg-dire-panel border-l border-white/5 h-full overflow-y-auto p-4 flex flex-col gap-4`}
      initial={{ opacity: 0 }}
      animate={{ opacity: ready ? 1 : 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
    >
      {ready ? (
        <>
          {/* Leaderboard Toggle */}
          <motion.button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className={clsx(
              'w-full py-2 text-[10px] font-medium rounded-lg border transition-colors',
              showLeaderboard
                ? 'bg-dire-accent/20 text-dire-accent border-dire-accent/30'
                : 'bg-dire-dark text-dire-muted border-white/5 hover:border-white/10 hover:text-white'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {showLeaderboard ? '▲ Hide Leaderboard' : '▼ Show Leaderboard'}
          </motion.button>

          {showLeaderboard ? (
            <Leaderboard />
          ) : (
            <>
              {/* Tab Selector — adaptive based on age tier */}
              {(() => {
                const tabs = tier?.rightTabs || DEFAULT_TABS;
                const midpoint = Math.ceil(tabs.length / 2);
                return (
                  <div className="space-y-0.5">
                    <div className="flex bg-dire-dark rounded-t-lg p-0.5 gap-0.5">
                      {tabs.slice(0, midpoint).map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveRightTab(tab.id)}
                          className={clsx(
                            'flex-1 py-1.5 text-[9px] font-medium rounded-md transition-colors',
                            activeRightTab === tab.id
                              ? 'bg-dire-accent/20 text-dire-accent'
                              : 'text-dire-muted hover:text-white/70'
                          )}
                          title={tab.label}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    {tabs.length > midpoint && (
                      <div className="flex bg-dire-dark rounded-b-lg p-0.5 gap-0.5">
                        {tabs.slice(midpoint).map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveRightTab(tab.id)}
                            className={clsx(
                              'flex-1 py-1.5 text-[9px] font-medium rounded-md transition-colors',
                              activeRightTab === tab.id
                                ? 'bg-dire-accent/20 text-dire-accent'
                                : 'text-dire-muted hover:text-white/70'
                            )}
                            title={tab.label}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tab Content — guard: if active tab not in tier, fall back to first tab */}
              {(() => {
                const tabs = tier?.rightTabs || DEFAULT_TABS;
                const allowedIds = tabs.map(t => t.id);
                if (!allowedIds.includes(activeRightTab)) {
                  // Auto-correct to first allowed tab
                  setTimeout(() => setActiveRightTab(allowedIds[0] || 'metrics'), 0);
                }
                return null;
              })()}
              {activeRightTab === 'metrics' && (
                <>
                  <MetricsPanel />
                  <ExplanationPanel />

                  {/* Resource Dependencies */}
                  <div>
                    <h3 className="text-[10px] font-medium text-dire-muted uppercase tracking-wider mb-3">
                      Resource Dependencies ({resources.length})
                    </h3>
                    <div className="space-y-1.5">
                      {resources.slice(0, 8).map((resource, i) => (
                        <motion.div
                          key={resource.name}
                          className="bg-dire-card rounded-lg p-2.5 border border-white/5"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-medium text-white truncate">{resource.name}</span>
                            <span className="text-[9px] text-dire-muted ml-2">{resource.category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-dire-dark rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${
                                  (resource.risk || resource.dependency * 100) >= 70 ? 'bg-dire-danger'
                                  : (resource.risk || resource.dependency * 100) >= 40 ? 'bg-dire-warning'
                                  : 'bg-dire-success'
                                }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${resource.risk || resource.dependency * 100}%` }}
                                transition={{ duration: 0.8, delay: i * 0.03 }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-dire-muted w-8 text-right">
                              {typeof resource.dependency === 'number' && resource.dependency <= 1
                                ? `${Math.round(resource.dependency * 100)}%`
                                : `${resource.dependency}%`}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                      {resources.length > 8 && (
                        <div className="text-[10px] text-dire-muted text-center py-1">
                          +{resources.length - 8} more resources
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeRightTab === 'economy' && <EconomicDashboard />}
              {activeRightTab === 'workforce' && <WorkforcePanel />}
              {activeRightTab === 'gdp' && <GDPPanel />}
              {activeRightTab === 'geo' && <GeopoliticalPanel />}
              {activeRightTab === 'health' && <HealthLiteracyPanel />}
              {activeRightTab === 'compliance' && <CompliancePanel />}
              {activeRightTab === 'governance' && <GovernancePanel />}
            </>
          )}

          {/* Privacy Footer */}
          <div className="mt-auto pt-4 text-[9px] text-dire-muted/50 text-center border-t border-white/5">
            This is a simulation tool. Your session context is not stored.
          </div>
        </>
      ) : null}
    </motion.aside>
  );
}
