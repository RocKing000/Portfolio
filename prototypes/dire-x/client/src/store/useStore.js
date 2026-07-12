import { create } from 'zustand';
import api, {
  getCompanies, getRisk, submitSimulation, getWorldState as fetchWorldAPI,
  getCountries, getTradeRoutes, getResourceMap as fetchResourceMap,
  getStrategicActions as fetchStrategic, getIdeas as fetchIdeasAPI,
  getMarketState as fetchMarketAPI,
  getGDPRanking, getCountryRelations, getCountryHealth,
  getComplianceProfile, getCountryPopulation, getGovernmentBudget, getCompetitionData,
  getDataStatus,
} from '../utils/api';
import { clamp } from '../utils/format';

const initialMetrics = { supply: 50, economy: 50, environment: 50, stability: 50 };

// --- Local company generator ---
function generateLocalCompany({ name, industry, country, strategy, scale }) {
  const INDUSTRY_MAP = {
    ev: ['Lithium', 'Cobalt', 'Copper', 'Semiconductors', 'Rare Earth Elements', 'Nickel', 'Graphite', 'Aluminum', 'Steel', 'Solar Capacity', 'Manganese'],
    agriculture: ['Wheat', 'Rice', 'Soybeans', 'Corn', 'Natural Gas', 'Crude Oil', 'Fertilizer', 'Fresh Water', 'Arable Land', 'Port Capacity'],
    defense: ['Rare Earth Elements', 'Semiconductors', 'Copper', 'Iron Ore', 'Uranium', 'Titanium', 'Aluminum', 'Steel', 'Crude Oil', 'Platinum'],
    electronics: ['Semiconductors', 'Rare Earth Elements', 'Copper', 'Lithium', 'Nickel', 'Fresh Water', 'Natural Gas', 'Petrochemicals', 'Graphite', 'Aluminum'],
    energy: ['Crude Oil', 'Natural Gas', 'Uranium', 'Copper', 'Coal', 'Solar Capacity', 'Wind Capacity', 'Steel', 'Power Grid', 'Fresh Water'],
    pharma: ['Natural Gas', 'Rare Earth Elements', 'Copper', 'Fresh Water', 'Petrochemicals', 'Platinum', 'Power Grid', 'Fiber Optic Cable', 'Aluminum', 'Cement'],
    mining: ['Iron Ore', 'Copper', 'Coal', 'Crude Oil', 'Fresh Water', 'Steel', 'Power Grid', 'Nickel', 'Manganese', 'Titanium'],
    automotive: ['Steel', 'Aluminum', 'Semiconductors', 'Copper', 'Crude Oil', 'Rare Earth Elements', 'Platinum', 'Natural Gas', 'Nickel'],
    telecom: ['Fiber Optic Cable', 'Semiconductors', 'Copper', 'Rare Earth Elements', 'Power Grid', 'Aluminum', 'Steel', 'Lithium', 'Cement'],
    construction: ['Cement', 'Steel', 'Aluminum', 'Copper', 'Timber', 'Iron Ore', 'Fresh Water', 'Crude Oil', 'Arable Land', 'Power Grid'],
  };
  const COUNTRY_RISK = {
    'United States': 0.3, 'China': 0.65, 'Germany': 0.25, 'India': 0.55,
    'Taiwan': 0.70, 'Japan': 0.20, 'South Korea': 0.35, 'Brazil': 0.50,
    'UK': 0.25, 'Australia': 0.20, 'Russia': 0.80, 'Nigeria': 0.75,
  };
  const stratMod = { cost: 1.15, balanced: 1.0, sustainable: 0.90 }[strategy] || 1.0;
  const scaleMod = { small: 0.85, medium: 1.0, large: 1.15 }[scale] || 1.0;
  const countryRisk = COUNTRY_RISK[country] || 0.5;

  const resources = (INDUSTRY_MAP[industry] || INDUSTRY_MAP.electronics).map((r) => ({
    name: r,
    dependency: Math.round(Math.min(1, (0.5 + Math.random() * 0.4) * stratMod * scaleMod) * 100) / 100,
    risk: Math.round((countryRisk * 70 + Math.random() * 30) * 10) / 10,
    category: 'supply',
  }));

  const sresScore = Math.round((50 + countryRisk * 30) * 10) / 10;
  const workforceSize = { small: 500, medium: 2000, large: 8000 }[scale] || 2000;

  return {
    id: `company-${Date.now()}`,
    name: name || `${industry.toUpperCase()} Corp`,
    industry, country, strategy, scale,
    resources, sresScore,
    metrics: {
      supply: 50 + countryRisk * 20,
      economy: 45 + countryRisk * 15,
      environment: strategy === 'sustainable' ? 30 : 50,
      stability: 50 + countryRisk * 20,
    },
    scores: { growth: 50, sustainability: strategy === 'sustainable' ? 65 : 45, stability: 50, supplyHealth: 50 },
    economics: { output_units: 100, total_cost: 500, revenue: 750, profit: 250, profit_margin: 33.3, raw_material_cost: 200, refining_cost: 100, manufacturing_cost: 200, market_price: 7.5 },
    workforce: { size: workforceSize, skill_level: 0.6, productivity: 0.7, cost_per_worker: 50, morale: 0.7 },
    pipeline: { pipelineHealth: 0.75, bottlenecks: [], refining: [], manufacturing: [] },
  };
}

// --- Local scenario evolution ---
function evolveLocalScenarios(scenarios) {
  return scenarios
    .map((s) => {
      let intensity = s.intensity;
      let stage = s.stage;
      if (stage === 'emerging' || stage === 'growth') {
        intensity = Math.min(1, intensity + 0.12 * (1 - intensity));
        if (intensity > 0.7) stage = 'peak';
        else if (intensity > 0.3) stage = 'growth';
      } else if (stage === 'peak') {
        if (s.day > s.maxDuration * 0.6) stage = 'decline';
      } else if (stage === 'decline') {
        intensity = Math.max(0, intensity - 0.08);
        if (intensity < 0.05) stage = 'ended';
      }
      return { ...s, intensity: Math.round(intensity * 100) / 100, stage, day: s.day + 1 };
    })
    .filter((s) => s.stage !== 'ended');
}

// Restore tier from localStorage synchronously to avoid AgeGate flicker on reload
import { getTierById } from '../config/ageTiers';

function getRestoredTier() {
  try {
    const savedAge = localStorage.getItem('dire-x-age');
    const savedTierId = localStorage.getItem('dire-x-tier');
    if (savedAge && savedTierId) {
      const tier = getTierById(savedTierId);
      if (tier) return { age: parseInt(savedAge, 10), tier };
    }
  } catch (_) { /* localStorage unavailable */ }
  return null;
}
const _restored = getRestoredTier();

const useStore = create((set, get) => ({
  // Age tier — set during onboarding, persisted to localStorage
  userAge: _restored?.age || null,
  ageTier: _restored?.tier || null,
  onboarded: !!_restored,

  setAgeTier: (age, tier) => {
    localStorage.setItem('dire-x-age', String(age));
    localStorage.setItem('dire-x-tier', tier.id);
    set({ userAge: age, ageTier: tier, onboarded: true });
  },

  resetAgeTier: () => {
    localStorage.removeItem('dire-x-age');
    localStorage.removeItem('dire-x-tier');
    set({ userAge: null, ageTier: null, onboarded: false });
  },

  // Mode
  mode: 'open_world',

  // Company data
  companies: [],
  selectedCompany: null,

  // Scenario
  scenario: 'stable',

  // Simulation state
  currentDay: 0,
  isPlaying: false,
  speed: 1,
  events: [],
  metrics: { ...initialMetrics },
  baseMetrics: { ...initialMetrics },
  timeline: [],
  branches: [],
  currentBranch: null,
  narration: '',
  isSimulating: false,

  // Risk data
  riskData: null,

  // Globe
  globeData: { points: [], arcs: [] },
  countries: [],
  tradeRoutes: [],
  resourceHeatmap: null,
  selectedResource: null,
  selectedNation: '',
  showTradeRoutes: false,
  globeViewMode: 'risk', // 'risk' | 'availability' | 'combined'

  // Open World state
  activeScenarios: [],
  worldDay: 0,
  playerCompany: null,
  leaderboard: [],
  worldCompanies: [],
  isCreatingCompany: false,
  showLeaderboard: false,
  arcadeScenario: null,
  scores: { growth: 50, sustainability: 50, stability: 50, supplyHealth: 50 },

  // Economics
  economics: { output_units: 0, total_cost: 0, revenue: 0, profit: 0, profit_margin: 0 },
  marketState: { sentiment: 50, confidence: 50, volatility: 20, demand_index: 50, supply_index: 50 },
  publicPressure: { total_pressure: 25 },

  // Workforce
  workforce: null,
  population: null,

  // Strategic Actions
  strategicActions: [],
  availableStrategicActions: [],

  // Ideas / Creative Intelligence
  ideas: [],
  ideaBadges: {},
  showIdeaJournal: false,

  // Governance
  governancePolicies: [],

  // Pipeline
  pipeline: null,

  // GDP system
  gdpRanking: [],
  tradeVolume: null,

  // Geopolitical
  geopoliticalRelations: [],

  // Health / Literacy
  healthData: null,
  literacyData: null,

  // Compliance
  complianceData: null,

  // Population
  populationData: null,

  // Government Budget
  governmentBudget: null,

  // Competition
  competitionData: null,

  // Data freshness
  dataLastUpdated: null,

  // Causal intelligence
  causalLog: [],
  metricDeltas: { supply: 0, economy: 0, environment: 0, stability: 0 },

  // Sound
  soundEnabled: true,

  // Language
  language: 'en',

  // Active panel (right side)
  activeRightTab: 'metrics',

  // Center layout mode
  centerMode: 'dashboard',         // 'dashboard' | 'simulation'
  preCenterMode: null,             // centerMode before resource auto-switch

  // Globe readiness — used to sync all panel entrances
  globeReady: false,

  // ============ ACTIONS ============

  setGlobeReady: () => set({ globeReady: true }),
  setCenterMode: (centerMode) => set({ centerMode }),
  setMode: (mode) => set({ mode }),
  setCompanies: (companies) => set({ companies }),
  selectCompany: (company) => set({ selectedCompany: company }),

  setScenario: (scenario) => {
    const scenarioMetrics = {
      stable: { supply: 50, economy: 50, environment: 50, stability: 50 },
      supply_crisis: { supply: 25, economy: 40, environment: 50, stability: 45 },
      war: { supply: 30, economy: 30, environment: 40, stability: 15 },
      drought: { supply: 35, economy: 45, environment: 20, stability: 40 },
    };
    const base = scenarioMetrics[scenario] || scenarioMetrics.stable;
    set({
      scenario, metrics: { ...base }, baseMetrics: { ...base },
      currentDay: 0, events: [], timeline: [], narration: '', isPlaying: false,
    });
  },

  startSimulation: () => set({ isPlaying: true }),
  pauseSimulation: () => set({ isPlaying: false }),
  setSpeed: (speed) => set({ speed }),
  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),

  updateMetrics: (newMetrics) =>
    set((s) => ({
      metrics: {
        supply: clamp(newMetrics.supply ?? s.metrics.supply, 0, 100),
        economy: clamp(newMetrics.economy ?? s.metrics.economy, 0, 100),
        environment: clamp(newMetrics.environment ?? s.metrics.environment, 0, 100),
        stability: clamp(newMetrics.stability ?? s.metrics.stability, 0, 100),
      },
    })),

  addTimelineEntry: (entry) => set((s) => ({ timeline: [...s.timeline, entry] })),

  submitDecision: async (decision) => {
    const state = get();
    if (state.isSimulating) return;
    set({ isSimulating: true });

    try {
      const result = await submitSimulation({
        companyId: state.selectedCompany?.id || state.playerCompany?.id || 'default',
        scenario: state.scenario,
        decision,
        day: state.currentDay,
        metrics: state.metrics,
      });

      const newMetrics = result.metrics || state.metrics;
      const newEvents = result.events || [];
      const narration = result.narration || '';

      const decisionDeltas = {
        supply:      Math.round((clamp(newMetrics.supply,      0, 100) - state.metrics.supply)      * 10) / 10,
        economy:     Math.round((clamp(newMetrics.economy,     0, 100) - state.metrics.economy)     * 10) / 10,
        environment: Math.round((clamp(newMetrics.environment, 0, 100) - state.metrics.environment) * 10) / 10,
        stability:   Math.round((clamp(newMetrics.stability,   0, 100) - state.metrics.stability)   * 10) / 10,
      };
      const decisionCausal = {
        day: state.currentDay, metric: 'decision', delta: 0, direction: 'decision',
        reasons: [
          { factor: `"${decision.slice(0, 55)}"`, type: 'decision' },
          ...newEvents.slice(0, 2).map((e) => ({ factor: e.title, type: 'event' })),
        ],
        allDeltas: decisionDeltas,
      };

      set((s) => ({
        metrics: {
          supply:      clamp(newMetrics.supply,      0, 100),
          economy:     clamp(newMetrics.economy,     0, 100),
          environment: clamp(newMetrics.environment, 0, 100),
          stability:   clamp(newMetrics.stability,   0, 100),
        },
        events:      [...s.events, ...newEvents],
        narration,
        timeline:    [...s.timeline, { day: s.currentDay, events: newEvents, metrics: { ...newMetrics }, decision, narration }],
        isSimulating: false,
        metricDeltas: decisionDeltas,
        causalLog:    [...s.causalLog.slice(-19), decisionCausal],
      }));
      return result;
    } catch {
      // Fallback local simulation
      const state = get();
      const volatility = { stable: 3, supply_crisis: 8, war: 12, drought: 7 }[state.scenario] || 5;
      const delta = () => (Math.random() - 0.5) * volatility * 2;
      const newMetrics = {
        supply: clamp(state.metrics.supply + delta(), 0, 100),
        economy: clamp(state.metrics.economy + delta(), 0, 100),
        environment: clamp(state.metrics.environment + delta(), 0, 100),
        stability: clamp(state.metrics.stability + delta(), 0, 100),
      };

      const types = ['supply', 'economy', 'environment', 'stability'];
      const type = types[Math.floor(Math.random() * types.length)];
      const fallbackEvent = {
        id: `evt-${Date.now()}`, type,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} impact from decision`,
        description: `Decision "${decision.slice(0, 60)}..." caused ripple effects.`,
        severity: Math.ceil(Math.random() * 5), day: state.currentDay,
      };

      const fbDeltas = {
        supply:      Math.round((newMetrics.supply      - state.metrics.supply)      * 10) / 10,
        economy:     Math.round((newMetrics.economy     - state.metrics.economy)     * 10) / 10,
        environment: Math.round((newMetrics.environment - state.metrics.environment) * 10) / 10,
        stability:   Math.round((newMetrics.stability   - state.metrics.stability)   * 10) / 10,
      };
      const fbCausal = {
        day: state.currentDay, metric: 'decision', delta: 0, direction: 'decision',
        reasons: [
          { factor: `"${decision.slice(0, 55)}"`, type: 'decision' },
          { factor: fallbackEvent.title, type: 'event' },
        ],
        allDeltas: fbDeltas,
      };
      const fbNarration = `${fallbackEvent.description} Decision context: "${decision.slice(0, 80)}".`;
      set((s) => ({
        metrics: newMetrics,
        events:  [...s.events, fallbackEvent],
        narration: fbNarration,
        timeline: [...s.timeline, { day: s.currentDay, events: [fallbackEvent], metrics: { ...newMetrics }, decision, narration: fbNarration }],
        isSimulating: false,
        metricDeltas: fbDeltas,
        causalLog:    [...s.causalLog.slice(-19), fbCausal],
      }));
    }
  },

  fetchCompanies: async () => {
    try {
      const companies = await getCompanies();
      if (!Array.isArray(companies)) throw new Error('Invalid response');
      set({ companies });
    } catch {
      set({
        companies: [
          { id: 'tsmc', name: 'TSMC', sector: 'Semiconductors', country: 'Taiwan', sresScore: 65, resources: [{ name: 'Rare Earth Elements', dependency: 85, risk: 78, category: 'supply' }, { name: 'Semiconductors', dependency: 98, risk: 70, category: 'supply' }] },
          { id: 'tesla', name: 'Tesla', sector: 'Automotive & Energy', country: 'United States', sresScore: 58, resources: [{ name: 'Lithium', dependency: 95, risk: 72, category: 'supply' }, { name: 'Cobalt', dependency: 80, risk: 75, category: 'supply' }] },
          { id: 'samsung', name: 'Samsung Electronics', sector: 'Electronics', country: 'South Korea', sresScore: 52, resources: [{ name: 'Semiconductors', dependency: 95, risk: 70, category: 'supply' }] },
          { id: 'cargill', name: 'Cargill', sector: 'Agriculture & Food', country: 'United States', sresScore: 48, resources: [{ name: 'Wheat', dependency: 90, risk: 55, category: 'supply' }] },
          { id: 'lockheed', name: 'Lockheed Martin', sector: 'Defense & Aerospace', country: 'United States', sresScore: 62, resources: [{ name: 'Rare Earth Elements', dependency: 85, risk: 78, category: 'supply' }] },
        ],
      });
    }
  },

  fetchRisk: async (id) => {
    try {
      const riskData = await getRisk(id);
      set({ riskData });
    } catch {
      const company = get().companies.find((c) => c.id === id);
      if (company) {
        set({
          riskData: {
            companyId: id, sresScore: company.sresScore, resources: company.resources,
            trends: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, sres: company.sresScore + (Math.random() - 0.5) * 20 })),
          },
        });
      }
    }
  },

  setBranch: (branchId) => set({ currentBranch: branchId }),

  createBranch: (label) => {
    const state = get();
    const newBranch = {
      id: `branch-${Date.now()}`, label: label || `Branch at Day ${state.currentDay}`,
      fromDay: state.currentDay, entries: [...state.timeline], parentBranch: state.currentBranch,
    };
    set((s) => ({ branches: [...s.branches, newBranch], currentBranch: newBranch.id }));
  },

  // --- Company Creation ---
  createCompany: async ({ name, industry, country, strategy, scale }) => {
    set({ isCreatingCompany: true });
    try {
      const response = await api.post('/create-company', { name, industry, country, strategy, scale });
      const company = response.data;
      set({ playerCompany: company, isCreatingCompany: false, selectedCompany: company });
      return company;
    } catch {
      const fallback = generateLocalCompany({ name, industry, country, strategy, scale });
      set({ playerCompany: fallback, isCreatingCompany: false, selectedCompany: fallback });
      return fallback;
    }
  },

  // --- World State ---
  fetchWorldState: async () => {
    try {
      // Reset the server world so every fresh session starts at Day 0
      await api.post('/world-state/reset');
      const data = await fetchWorldAPI();
      set({
        activeScenarios: data.activeScenarios,
        worldDay: data.day,
        worldCompanies: data.companies,
        leaderboard: data.leaderboard,
        marketState: data.marketState || get().marketState,
        publicPressure: data.publicPressure || get().publicPressure,
        governancePolicies: data.governancePolicies || [],
      });
    } catch { /* use local state */ }
  },

  fetchLeaderboard: async () => {
    try {
      const { data } = await api.get('/leaderboard');
      set({ leaderboard: data.leaderboard });
    } catch { /* use local */ }
  },

  worldTick: async () => {
    try {
      const { data } = await api.post('/world-state/tick');
      set({
        activeScenarios: data.activeScenarios,
        worldDay: data.day,
        worldCompanies: data.companies,
        leaderboard: data.leaderboard,
        marketState: data.marketState || get().marketState,
        publicPressure: data.publicPressure || get().publicPressure,
        governancePolicies: data.governancePolicies || [],
      });
    } catch {
      set((state) => {
        const newDay = state.worldDay + 1;
        const evolved = evolveLocalScenarios(state.activeScenarios);
        return { worldDay: newDay, activeScenarios: evolved };
      });
    }
  },

  triggerScenario: async (type) => {
    try {
      await api.post('/world-state/trigger-scenario', { type });
    } catch {
      set((state) => ({
        activeScenarios: [...state.activeScenarios, {
          id: `scenario-${Date.now()}`, type, stage: 'emerging',
          intensity: 0.15 + Math.random() * 0.15, day: 0, maxDuration: 15 + Math.floor(Math.random() * 20),
        }],
      }));
    }
  },

  // --- Globe/Geo ---
  fetchGeoData: async () => {
    try {
      const countries = await getCountries();
      if (!Array.isArray(countries)) throw new Error('Invalid response');
      set({ countries });
    } catch {
      // Fallback with basic data
      set({
        countries: [
          { name: 'United States', lat: 39.8, lng: -98.5, risk: 0.3 },
          { name: 'China', lat: 35.8, lng: 104.1, risk: 0.65 },
          { name: 'Taiwan', lat: 23.7, lng: 120.9, risk: 0.70 },
          { name: 'Germany', lat: 51.2, lng: 10.4, risk: 0.25 },
          { name: 'India', lat: 20.6, lng: 78.9, risk: 0.55 },
          { name: 'Japan', lat: 36.2, lng: 138.2, risk: 0.20 },
          { name: 'Australia', lat: -25.3, lng: 133.8, risk: 0.20 },
          { name: 'Brazil', lat: -14.2, lng: -51.9, risk: 0.50 },
          { name: 'Russia', lat: 61.5, lng: 105.3, risk: 0.80 },
          { name: 'South Korea', lat: 35.9, lng: 127.7, risk: 0.35 },
        ],
      });
    }
  },

  fetchTradeRoutes: async () => {
    try {
      const routes = await getTradeRoutes();
      if (!Array.isArray(routes)) throw new Error('Invalid response');
      set({ tradeRoutes: routes });
    } catch {
      set({
        tradeRoutes: [
          { id: 'suez', name: 'Suez Canal', from: { lat: 30.0, lng: 32.3 }, to: { lat: 31.3, lng: 32.3 }, resources: ['Crude Oil'], status: 'stable' },
          { id: 'malacca', name: 'Strait of Malacca', from: { lat: 1.4, lng: 103.8 }, to: { lat: 4.2, lng: 100.0 }, resources: ['Semiconductors'], status: 'stable' },
          { id: 'hormuz', name: 'Strait of Hormuz', from: { lat: 26.6, lng: 56.2 }, to: { lat: 25.0, lng: 57.0 }, resources: ['Crude Oil'], status: 'stressed' },
        ],
      });
    }
  },

  setSelectedNation: (nation) => set({ selectedNation: nation }),

  setSelectedResource: async (resource) => {
    set({ selectedResource: resource });
    if (!resource) {
      const pre = get().preCenterMode;
      set({ resourceHeatmap: null, preCenterMode: null, ...(pre ? { centerMode: pre } : {}) });
      return;
    }
    // switching to dashboard — remember where we came from
    const prev = get().centerMode;
    if (prev !== 'dashboard') set({ preCenterMode: prev, centerMode: 'dashboard' });
    try {
      const data = await fetchResourceMap(resource);
      set({ resourceHeatmap: data });
    } catch {
      set({ resourceHeatmap: { resource, producers: [], totalCountries: 0 } });
    }
  },

  setShowTradeRoutes: (show) => set({ showTradeRoutes: show }),
  setGlobeViewMode: (mode) => set({ globeViewMode: mode }),
  setShowLeaderboard: (show) => set({ showLeaderboard: show }),
  setShowIdeaJournal: (show) => set({ showIdeaJournal: show }),
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
  setLanguage: (lang) => set({ language: lang }),

  // --- GDP ---
  fetchGDPRanking: async () => {
    try {
      const data = await getGDPRanking();
      set({ gdpRanking: data.ranking || [], tradeVolume: data.tradeVolume || null });
    } catch {
      // Generate deterministic fallback GDP data
      const fallback = [
        { country: 'United States', rank: 1, gdp: 26.9, adjustedGrowth: 2.5, population: 335, trend: 'up' },
        { country: 'China', rank: 2, gdp: 17.7, adjustedGrowth: 5.2, population: 1412, trend: 'up' },
        { country: 'Germany', rank: 3, gdp: 4.4, adjustedGrowth: 0.3, population: 84, trend: 'up' },
        { country: 'Japan', rank: 4, gdp: 4.2, adjustedGrowth: 1.9, population: 125, trend: 'up' },
        { country: 'India', rank: 5, gdp: 3.7, adjustedGrowth: 6.8, population: 1428, trend: 'up' },
        { country: 'United Kingdom', rank: 6, gdp: 3.1, adjustedGrowth: 0.4, population: 68, trend: 'up' },
        { country: 'France', rank: 7, gdp: 2.9, adjustedGrowth: 0.9, population: 68, trend: 'up' },
        { country: 'Brazil', rank: 8, gdp: 2.1, adjustedGrowth: 2.9, population: 215, trend: 'up' },
        { country: 'Canada', rank: 9, gdp: 2.1, adjustedGrowth: 1.2, population: 40, trend: 'up' },
        { country: 'Russia', rank: 10, gdp: 1.9, adjustedGrowth: -2.1, population: 144, trend: 'down' },
        { country: 'South Korea', rank: 11, gdp: 1.7, adjustedGrowth: 1.4, population: 52, trend: 'up' },
        { country: 'Australia', rank: 12, gdp: 1.7, adjustedGrowth: 1.9, population: 26, trend: 'up' },
      ];
      set({
        gdpRanking: fallback,
        tradeVolume: { totalWorldGDP: 105.2, tradeVolume: 57.9, avgGrowthRate: 2.4, tradeHealthIndex: 62 },
      });
    }
  },

  // --- Geopolitical ---
  fetchGeopoliticalRelations: async () => {
    const state = get();
    const country = state.playerCompany?.country || state.selectedCompany?.country || 'United States';
    try {
      const data = await getCountryRelations(country);
      set({ geopoliticalRelations: data.relations || [] });
    } catch {
      set({
        geopoliticalRelations: [
          { partner: 'United Kingdom', score: 92, status: 'Allied', tradeEfficiency: 0.94 },
          { partner: 'Germany', score: 85, status: 'Allied', tradeEfficiency: 0.90 },
          { partner: 'Japan', score: 88, status: 'Allied', tradeEfficiency: 0.92 },
          { partner: 'India', score: 65, status: 'Friendly', tradeEfficiency: 0.76 },
          { partner: 'Brazil', score: 60, status: 'Friendly', tradeEfficiency: 0.72 },
          { partner: 'China', score: 38, status: 'Tense', tradeEfficiency: 0.57 },
          { partner: 'Russia', score: 15, status: 'Hostile', tradeEfficiency: 0.41 },
        ],
      });
    }
  },

  // --- Health & Literacy ---
  fetchHealthData: async () => {
    const state = get();
    const country = state.playerCompany?.country || state.selectedCompany?.country || 'United States';
    try {
      const data = await getCountryHealth(country);
      set({ healthData: data.health || null, literacyData: data.literacy || null });
    } catch {
      set({
        healthData: { healthIndex: 72, healthcareCapacity: 85, diseaseRisk: 25, environmentalHealth: 65 },
        literacyData: { overallLiteracy: 99, maleLiteracy: 99, femaleLiteracy: 99, genderBalance: 98, educationQuality: 82, innovationIndex: 85 },
      });
    }
  },

  // --- Compliance ---
  fetchComplianceData: async () => {
    const state = get();
    const companyId = state.playerCompany?.id || state.selectedCompany?.id;
    if (!companyId) return;
    try {
      const data = await getComplianceProfile(companyId);
      set({ complianceData: data });
    } catch {
      set({
        complianceData: {
          complianceScore: 65, regulatoryBurden: 70, transparency: 62,
          auditRisk: 38, trustScore: 64, status: 'watch', auditFrequency: 'medium',
          taxProfile: { corporateTaxRate: 25, importTariffRate: 12, exportDutyRate: 5, subsidyRate: 3, netTaxBurden: 31 },
        },
      });
    }
  },

  // --- Population ---
  fetchPopulationData: async () => {
    const state = get();
    const country = state.playerCompany?.country || state.selectedCompany?.country || 'United States';
    try {
      const data = await getCountryPopulation(country);
      set({ populationData: data });
    } catch {
      // Deterministic fallback
      const seed = country.length;
      const empRate = 0.94 + (seed % 5) * 0.01;
      const workingRatio = 0.60 + (seed % 3) * 0.02;
      const totalM = 80 + (seed * 12);
      const workingM = totalM * workingRatio;
      const employedM = workingM * empRate;
      set({
        populationData: {
          country,
          totalPopulationM: Math.round(totalM * 10) / 10,
          workingRatio: Math.round(workingRatio * 100),
          workingPopulationM: Math.round(workingM * 10) / 10,
          employedM: Math.round(employedM * 10) / 10,
          unemployedM: Math.round((workingM - employedM) * 10) / 10,
          unemploymentRate: Math.round((1 - empRate) * 1000) / 10,
          employmentBreakdown: {
            privateM: Math.round(employedM * 0.72 * 10) / 10,
            governmentM: Math.round(employedM * 0.15 * 10) / 10,
            selfEmployedM: Math.round(employedM * 0.13 * 10) / 10,
            privateShare: 72, govShare: 15, selfShare: 13,
          },
        },
      });
    }
  },

  // --- Government Budget ---
  fetchGovernmentBudget: async () => {
    const state = get();
    const country = state.playerCompany?.country || state.selectedCompany?.country || 'United States';
    try {
      const data = await getGovernmentBudget(country);
      set({ governmentBudget: data });
    } catch {
      set({
        governmentBudget: {
          country,
          allocations: { infrastructure: 12, health: 28, education: 16, defense: 20, industry: 8, other: 16 },
          impacts: {
            health: 'neutral', infrastructure: 'neutral',
            education: '+innovation index', defense: 'neutral', industry: 'neutral',
          },
          totalBudgetIndexed: 84,
        },
      });
    }
  },

  // --- Competition ---
  fetchCompetitionData: async () => {
    const state = get();
    const company = state.playerCompany || state.selectedCompany;
    if (!company) return;
    try {
      const data = await getCompetitionData(company.id, {
        industry: company.industry, country: company.country,
        scale: company.scale, strategy: company.strategy, sresScore: company.sresScore,
      });
      set({ competitionData: data });
    } catch {
      const seed = (company.industry || 'x').length;
      set({
        competitionData: {
          sector: company.industry || 'electronics',
          companiesInSector: 25 + seed,
          competitionIntensity: 55 + seed,
          winProbability: 48 - seed,
          contractWinRate: 52 - seed,
          marketShare: Math.round((1.5 + seed * 0.2) * 10) / 10,
          marketGrowthRate: 8 + seed,
          avgIndustrBudgetB: 6.8,
          budgetPositionB: 0.5,
          topCompetitors: ['Global Corp A', 'National Leader B', 'Emerging Player C'],
          countryAdvantage: 100 + seed,
        },
      });
    }
  },

  // --- Data Status ---
  fetchDataStatus: async () => {
    try {
      const { lastUpdated } = await getDataStatus();
      set({ dataLastUpdated: lastUpdated });
    } catch {
      // non-critical, leave as null
    }
  },

  // --- Strategic Actions ---
  fetchStrategicActions: async () => {
    const state = get();
    const companyId = state.playerCompany?.id || state.selectedCompany?.id;
    if (!companyId) return;
    try {
      const data = await fetchStrategic(companyId, state.metrics);
      set({ strategicActions: data.active || [], availableStrategicActions: data.available || [] });
    } catch { /* use local */ }
  },

  launchStrategicAction: async (actionType, title) => {
    const state = get();
    const companyId = state.playerCompany?.id || state.selectedCompany?.id;
    if (!companyId) return;
    try {
      const { data } = await api.post('/strategic', { companyId, actionType, title, currentDay: state.currentDay });
      set((s) => ({ strategicActions: [...s.strategicActions, data.action] }));
    } catch {
      // Local fallback
      const delays = { diplomacy: 10, collaboration: 7, rd: 15, diversification: 8, vertical_integration: 20 };
      set((s) => ({
        strategicActions: [...s.strategicActions, {
          action_type: actionType, title: title || actionType,
          status: 'pending', started_day: s.currentDay,
          delay_days: delays[actionType] || 10,
          completion_day: s.currentDay + (delays[actionType] || 10) + 30,
        }],
      }));
    }
  },

  // --- Ideas ---
  submitIdea: async (text) => {
    const state = get();
    const companyId = state.playerCompany?.id || state.selectedCompany?.id || 'default';
    try {
      const { data } = await api.post('/ideas', { companyId, text, simulationDay: state.currentDay });
      set((s) => ({
        ideas: [data, ...s.ideas],
        ideaBadges: data.badges.reduce((acc, b) => ({ ...acc, [b]: (acc[b] || 0) + 1 }), { ...s.ideaBadges }),
      }));
      return data;
    } catch {
      // Local fallback scoring
      const novelty = Math.min(10, 3 + text.length / 50);
      const impact = Math.min(10, 3 + (text.match(/global|system|strategic|innovate/gi) || []).length * 2);
      const idea = {
        id: `idea-${Date.now()}`, content: text, novelty_score: novelty, impact_score: impact,
        combined_score: (novelty * 0.6 + impact * 0.4), category: 'general', badges: novelty > 6 ? ['innovator'] : [],
        simulation_day: state.currentDay, is_notable: novelty > 5,
      };
      set((s) => ({ ideas: [idea, ...s.ideas] }));
      return idea;
    }
  },

  fetchIdeas: async () => {
    const state = get();
    const companyId = state.playerCompany?.id || state.selectedCompany?.id;
    if (!companyId) return;
    try {
      const data = await fetchIdeasAPI(companyId);
      set({ ideas: data.ideas || [], ideaBadges: data.badges || {} });
    } catch { /* use local */ }
  },

  // --- Main Tick ---
  tick: () => {
    const state = get();
    if (!state.isPlaying) return;

    if (state.mode === 'open_world') {
      get().worldTick();
    }

    const volatility = { stable: 1.5, supply_crisis: 4, war: 6, drought: 3.5 }[state.scenario] || 2;
    const delta = () => (Math.random() - 0.5) * volatility;
    const newMetrics = {
      supply: clamp(state.metrics.supply + delta(), 0, 100),
      economy: clamp(state.metrics.economy + delta(), 0, 100),
      environment: clamp(state.metrics.environment + delta(), 0, 100),
      stability: clamp(state.metrics.stability + delta(), 0, 100),
    };

    const newDay = state.currentDay + 1;

    // Evolve economics locally
    const prevEcon = state.economics || {};
    const profitDelta = (Math.random() - 0.5) * 20;
    const newEconomics = {
      ...prevEcon,
      revenue: Math.max(0, (prevEcon.revenue || 750) + profitDelta),
      profit: (prevEcon.profit || 250) + profitDelta * 0.5,
      profit_margin: clamp((prevEcon.profit_margin || 33) + (Math.random() - 0.5) * 3, -20, 60),
    };

    // Evolve workforce locally
    const prevWf = state.workforce;
    let newWorkforce = prevWf;
    if (prevWf) {
      newWorkforce = {
        ...prevWf,
        productivity: clamp(prevWf.productivity + (Math.random() - 0.5) * 0.02, 0.2, 1.0),
        morale: clamp(prevWf.morale + (newMetrics.stability - 50) / 2000, 0.1, 1.0),
      };
    }

    // Compute metric deltas for causal log
    const metricDeltas = {
      supply:      Math.round((newMetrics.supply      - state.metrics.supply)      * 10) / 10,
      economy:     Math.round((newMetrics.economy     - state.metrics.economy)     * 10) / 10,
      environment: Math.round((newMetrics.environment - state.metrics.environment) * 10) / 10,
      stability:   Math.round((newMetrics.stability   - state.metrics.stability)   * 10) / 10,
    };

    // Random event with richer descriptions
    let newEvents = [];
    if (Math.random() < 0.3) {
      const types = ['supply', 'economy', 'environment', 'stability'];
      const type = types[Math.floor(Math.random() * types.length)];
      const severity = Math.min(5, Math.ceil(Math.random() * 3) + (state.scenario !== 'stable' ? 1 : 0));
      const templates = {
        supply: [
          ['Port congestion delays shipments', 'A logistics bottleneck is rippling upstream through the supply network, extending lead times by an estimated 4–7 days.'],
          ['Key supplier factory shutdown', 'A critical production facility has gone offline unexpectedly, tightening availability in downstream markets.'],
          ['Raw material shortage reported', 'Upstream scarcity is constraining downstream production capacity, pushing spot prices upward.'],
          ['Logistics route disrupted', 'A major trade corridor has been interrupted, rerouting cargo through longer and costlier alternatives.'],
        ],
        economy: [
          ['Currency fluctuation impacts costs', 'Exchange rate movement is increasing imported input costs, compressing margins for exposed manufacturers.'],
          ['Trade tariff announced', 'New trade measures are reshaping cost structures across the sector, triggering procurement reviews.'],
          ['Market volatility spike', 'Uncertainty is prompting risk-off behaviour in financial markets, raising the cost of capital.'],
          ['Consumer demand shift', 'Demand signals are diverging from recent trends, prompting inventory reassessment across the supply chain.'],
        ],
        environment: [
          ['Extreme weather forecast', 'Meteorological models indicate elevated climate stress conditions that may disrupt operations and logistics.'],
          ['Regulatory emissions update', 'New environmental compliance requirements are tightening operational constraints in key jurisdictions.'],
          ['Resource depletion warning', 'Extraction indicators suggest tightening availability of critical natural inputs in the medium term.'],
          ['Climate policy change', 'Regulatory shifts are reorienting capital flows, creating both transition costs and long-term resilience opportunities.'],
        ],
        stability: [
          ['Political tensions escalate', 'Diplomatic friction is increasing uncertainty across regional trade networks and investment decisions.'],
          ['Sanctions regime modified', 'Updated trade restrictions are altering market access and forcing supply chain reconfiguration.'],
          ['Election uncertainty rises', 'Political transition risk is elevating volatility in policy-sensitive sectors and cross-border agreements.'],
          ['Border dispute intensifies', 'Territorial friction is disrupting cross-border logistics and undermining investor confidence in the region.'],
        ],
      };
      const tpl = templates[type][Math.floor(Math.random() * templates[type].length)];
      const [title, description] = tpl;
      newEvents = [{ id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, title, description, severity, day: newDay }];
    }

    // Build causal analysis entry
    const causalReasons = [];
    if (newEvents.length > 0) {
      causalReasons.push({ factor: newEvents[0].title, type: 'event' });
    }
    const scenarioFactors = {
      supply_crisis: [{ factor: 'Active global supply disruption', type: 'scenario' }],
      war:           [{ factor: 'Active conflict zone pressure', type: 'scenario' }],
      drought:       [{ factor: 'Regional drought conditions', type: 'scenario' }],
    };
    (scenarioFactors[state.scenario] || []).forEach((f) => causalReasons.push(f));
    if ((state.marketState?.volatility || 0) > 40) {
      causalReasons.push({ factor: 'Elevated market volatility', type: 'market' });
    }

    const topMetric = Object.entries(metricDeltas)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    const causalEntry = {
      day: newDay,
      metric:    topMetric[0],
      delta:     topMetric[1],
      direction: topMetric[1] > 0.3 ? 'up' : topMetric[1] < -0.3 ? 'down' : 'flat',
      reasons:   causalReasons.slice(0, 3),
      allDeltas: { ...metricDeltas },
    };

    // Narration
    const narrationText = newEvents.length > 0 ? newEvents[0].description : '';

    const timelineEntry = {
      day: newDay, events: newEvents, metrics: { ...newMetrics },
      narration: narrationText,
    };

    // Auto-pause on critical events (severity 5)
    const hasCritical = newEvents.some(e => e.severity >= 5);

    set((s) => ({
      currentDay: newDay,
      metrics:    newMetrics,
      events:     [...s.events, ...newEvents],
      timeline:   [...s.timeline, timelineEntry],
      narration:  narrationText || s.narration,
      economics:  newEconomics,
      workforce:  newWorkforce,
      isPlaying:  hasCritical ? false : s.isPlaying,
      metricDeltas,
      causalLog: [...s.causalLog.slice(-19), causalEntry],
    }));
  },

  reset: () =>
    set({
      currentDay: 0, isPlaying: false, speed: 1, events: [], metrics: { ...initialMetrics },
      baseMetrics: { ...initialMetrics }, timeline: [], branches: [], currentBranch: null,
      narration: '', isSimulating: false, riskData: null, scenario: 'stable',
      economics: { output_units: 0, total_cost: 0, revenue: 0, profit: 0, profit_margin: 0 },
      strategicActions: [], ideas: [],
      causalLog: [], metricDeltas: { supply: 0, economy: 0, environment: 0, stability: 0 },
    }),
}));

export default useStore;
