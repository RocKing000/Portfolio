import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import TopNav from './components/layout/TopNav';
import LeftPanel from './components/layout/LeftPanel';
import CenterPanel from './components/layout/CenterPanel';
import RightPanel from './components/layout/RightPanel';
import IdeaJournal from './components/simulation/IdeaJournal';
import AgeGate from './components/onboarding/AgeGate';
import useSimulationTimer from './hooks/useSimulationTimer';
import useStore from './store/useStore';
// ageTiers is imported by the store for synchronous restoration

// Remove the static HTML loader as soon as React mounts
// (it was previously only removed when GlobeView loaded,
//  which doesn't happen until after onboarding)
function removeAppLoader() {
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.classList.add('hide');
    setTimeout(() => loader.remove(), 750);
  }
}

export default function App() {
  const fetchCompanies = useStore((s) => s.fetchCompanies);
  const fetchWorldState = useStore((s) => s.fetchWorldState);
  const fetchGeoData = useStore((s) => s.fetchGeoData);
  const fetchGDPRanking = useStore((s) => s.fetchGDPRanking);
  const fetchGeopoliticalRelations = useStore((s) => s.fetchGeopoliticalRelations);
  const fetchHealthData = useStore((s) => s.fetchHealthData);
  const fetchComplianceData = useStore((s) => s.fetchComplianceData);
  const fetchPopulationData = useStore((s) => s.fetchPopulationData);
  const fetchGovernmentBudget = useStore((s) => s.fetchGovernmentBudget);
  const fetchCompetitionData = useStore((s) => s.fetchCompetitionData);
  const mode = useStore((s) => s.mode);
  const showIdeaJournal = useStore((s) => s.showIdeaJournal);
  const selectedCompany = useStore((s) => s.selectedCompany);
  const playerCompany = useStore((s) => s.playerCompany);

  // Age tier state
  const onboarded = useStore((s) => s.onboarded);
  const ageTier = useStore((s) => s.ageTier);
  const setAgeTier = useStore((s) => s.setAgeTier);

  // Remove HTML loader on mount (tier is restored synchronously in the store)
  useEffect(() => {
    removeAppLoader();
  }, []);

  // Fetch initial data only after onboarding
  useEffect(() => {
    if (!onboarded) return;
    fetchCompanies();
    fetchGeoData();
    fetchGDPRanking();
  }, [onboarded, fetchCompanies, fetchGeoData, fetchGDPRanking]);

  useEffect(() => {
    if (!onboarded) return;
    if (mode === 'open_world') {
      fetchWorldState();
    }
  }, [onboarded, mode, fetchWorldState]);

  // Refresh geo-dependent data when company changes
  const company = playerCompany || selectedCompany;
  useEffect(() => {
    if (!onboarded || !company) return;

    fetchGeopoliticalRelations();
    fetchHealthData();
    fetchComplianceData();

    // Only fetch advanced data for strategist/analyst tiers
    if (ageTier && ageTier.id !== 'explorer') {
      fetchPopulationData();
      fetchGovernmentBudget();
      fetchCompetitionData();
    }
  }, [onboarded, company?.id, company?.country, ageTier?.id]);

  useSimulationTimer();

  // ─── Age Gate (onboarding) ───────────────────────────────
  if (!onboarded) {
    return (
      <AgeGate
        onComplete={(age, tier) => {
          setAgeTier(age, tier);
        }}
      />
    );
  }

  // ─── Main Application ────────────────────────────────────
  const tier = ageTier;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-dire-dark">
      <TopNav tier={tier} />

      <div className="flex flex-1 pt-14 overflow-hidden">
        {tier.showLeftPanel && <LeftPanel tier={tier} />}
        <CenterPanel tier={tier} />
        {tier.showRightPanel && <RightPanel tier={tier} />}
      </div>

      {/* Idea Journal Overlay */}
      <AnimatePresence>
        {tier.showIdeaJournal && showIdeaJournal && <IdeaJournal />}
      </AnimatePresence>
    </div>
  );
}
