# DIRE-X: Complete System Documentation
## Decision Intelligence & Resource Evaluation — eXtended

**Version:** 2.0 | **Author:** Shubham Agarwal | **Date:** March 2026

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Architecture](#2-architecture)
3. [Project Structure](#3-project-structure)
4. [Server Backend (Node.js/Express)](#4-server-backend)
5. [Client Frontend (React/Vite)](#5-client-frontend)
6. [FastAPI Scoring Backend (Python)](#6-fastapi-scoring-backend)
7. [Database (Supabase/PostgreSQL)](#7-database)
8. [Simulation Engines](#8-simulation-engines)
9. [API Reference (84 Endpoints)](#9-api-reference)
10. [Middleware & Security](#10-middleware--security)
11. [Data Pipeline (Kaggle + External APIs)](#11-data-pipeline)
12. [Training Data Generation](#12-training-data-generation)
13. [Deployment](#13-deployment)
14. [Environment Variables](#14-environment-variables)
15. [Dependencies](#15-dependencies)

---

## 1. Platform Overview

DIRE-X is a **real-time geopolitical supply chain simulation platform** that models the global economy across 92 countries, 80+ companies, 15 strategic resources, and 13 trade routes. It provides:

- **Strategic Resource Evaluation Score (SRES)** — 4-factor weighted risk scoring (0-100)
- **Multi-scenario simulation** — 7 crisis types with lifecycle management
- **Company creation & management** — P&L, workforce, compliance, strategic actions
- **AI-powered insights** — Via OpenRouter (Claude/GPT models)
- **3D globe visualization** — Risk heatmaps, trade routes, resource availability
- **Age-adaptive UI** — 3 tiers (Explorer 13-17, Strategist 18-24, Analyst 25+)
- **Training data generation** — Multi-agent simulation for ML model training
- **Enterprise API** — Tiered API keys, rate limiting, usage tracking

### Core Formula: SRES (Strategic Resource Evaluation Score)

```
SRES = 0.35 x Demand + 0.30 x Supply + 0.20 x Geopolitical + 0.15 x Environmental
```

Each dimension scored 0-100, clamped. Company SRES = weighted average across all resource dependencies.

### Risk Score Formula (5-factor, 0-100)

```
RiskScore = 0.30 x ResourceCriticality
          + 0.25 x GeopoliticalStability
          + 0.20 x SupplyConcentration
          + 0.15 x ConflictExposure
          + 0.10 x TradeDependency
```

---

## 2. Architecture

```
                    [Vercel - dire-x.vercel.app]
                              |
                        React/Vite SPA
                     (3D Globe, Recharts)
                              |
              ________________|________________
              |                                |
     /api/* (Vite proxy)              /direx/* (Vite proxy)
              |                                |
   [Render - Node.js:4000]        [Render - FastAPI:8000]
      Express Game Server            Scoring Engine
              |                                |
              |_________________ ______________|
                                |
                    [Supabase - PostgreSQL]
                     countries_master (92)
                     companies (80+)
                     resources (15)
                     company_resources (200+)
                     risk_metrics (15)
                     dp_scenarios (100+)
                     dp_supplier_nodes/edges
                     api_keys, api_usage_logs
                     dp_validation_results
                     commodity_prices_ts
                     country_economics_ts
                     mining_production
                     trade_flows
                     company_benchmarks

   External APIs:
     - OpenRouter (AI narration/insights)
     - World Bank (GDP, population)
     - OpenWeather (environmental data)
     - Kaggle (9 real-world datasets)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18.2, Vite 5.1, Zustand 4.5, Tailwind CSS 3.4, Framer Motion 11 |
| 3D Visualization | react-globe.gl 2.27, Three.js 0.183 |
| Charts | Recharts 2.12 |
| Game Server | Node.js 18+, Express 4.19 |
| Scoring Engine | Python 3.10, FastAPI 0.111, SQLAlchemy 2.0 |
| Database | Supabase (PostgreSQL), Redis (optional caching) |
| AI | OpenRouter API (Claude/GPT free tier) |
| Deployment | Vercel (frontend), Render (backends) |

---

## 3. Project Structure

```
dire-x/
├── client/                          # React/Vite frontend (Vercel)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/              # TopNav, LeftPanel, CenterPanel, RightPanel
│   │   │   ├── simulation/          # MetricsPanel, DecisionInput, CompanyCreator,
│   │   │   │                        # EconomicDashboard, WorkforcePanel, GDPPanel,
│   │   │   │                        # GeopoliticalPanel, HealthLiteracyPanel,
│   │   │   │                        # CompliancePanel, GovernancePanel, Leaderboard,
│   │   │   │                        # IdeaJournal, EventCard, ExplanationPanel,
│   │   │   │                        # ScenarioTracker, SimulationTimeline,
│   │   │   │                        # StrategicActionsPanel, BranchTree
│   │   │   ├── visualization/       # GlobeView, RiskHeatmap, ResourceFilter, GeoIntelGlobe
│   │   │   └── shared/              # ErrorBoundary, LoadingSpinner, AnimatedNumber, ScenarioCard
│   │   ├── config/
│   │   │   └── ageTiers.js          # Explorer/Strategist/Analyst tier configs
│   │   ├── hooks/
│   │   │   └── useSimulationTimer.js # Main game loop
│   │   ├── store/
│   │   │   └── useStore.js          # Zustand store (959 lines, 40+ state slices)
│   │   ├── utils/
│   │   │   ├── api.js               # Axios client (40+ API functions)
│   │   │   ├── direxApi.js          # FastAPI scoring client
│   │   │   ├── format.js            # Formatting & color utilities
│   │   │   └── soundSystem.js       # Web Audio API (11 sound cues)
│   │   ├── App.jsx                  # Root layout + data fetching
│   │   ├── main.jsx                 # Entry point + GeoJSON prefetch
│   │   └── index.css                # Tailwind + custom styles
│   ├── vercel.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                           # Node.js/Express backend (Render)
│   ├── src/
│   │   ├── engines/                  # 20 simulation engines
│   │   │   ├── riskEngine.js         # 5-factor weighted risk scoring
│   │   │   ├── sresEngine.js         # SRES calculation
│   │   │   ├── gdpEngine.js          # GDP ranking with scenario impact
│   │   │   ├── economicEngine.js     # Company-level P&L calculation
│   │   │   ├── competitionEngine.js  # Sector competition modeling
│   │   │   ├── impactEngine.js       # 4D impact distribution
│   │   │   ├── consequenceGraph.js   # Cause-effect attribution
│   │   │   ├── scenarioLifecycleEngine.js # Scenario state machine
│   │   │   ├── strategicEngine.js    # Long-term strategic actions
│   │   │   ├── logisticsEngine.js    # Trade route disruptions
│   │   │   ├── supplyDepthEngine.js  # Tier-2/3 dependency walking
│   │   │   ├── healthLiteracyEngine.js # Country social indicators
│   │   │   ├── equilibriumEngine.js  # Supply-demand balance
│   │   │   ├── eventEngine.js        # Event generation & cascading
│   │   │   ├── manufacturingEngine.js # Production pipeline
│   │   │   ├── workforceEngine.js    # Workforce modeling
│   │   │   ├── geopoliticalEngine.js # Diplomatic tensions
│   │   │   ├── complianceEngine.js   # Regulatory risk
│   │   │   ├── creativeIntelligence.js # Idea scoring
│   │   │   └── timeEngine.js         # Simulation tick math
│   │   ├── config/
│   │   │   ├── constants.js          # 793 lines: SRES weights, scenario multipliers,
│   │   │   │                         # industry-resource maps, lifecycle configs
│   │   │   ├── server.js             # Cache TTLs, AI config
│   │   │   └── supabase.js           # DB client setup
│   │   ├── services/
│   │   │   ├── worldState.js         # Global state container (500+ lines)
│   │   │   ├── simulationOrchestrator.js # Full simulation pipeline
│   │   │   ├── aiInsights.service.js # OpenRouter AI integration
│   │   │   ├── aiNarration.js        # Story generation
│   │   │   ├── statePersistence.js   # Snapshot/restore to Supabase
│   │   │   ├── companyCreator.js     # Company factory
│   │   │   └── dataIngestion.js      # World Bank/OpenWeather sync
│   │   ├── middleware/
│   │   │   ├── auth.js               # Session + ownership + admin
│   │   │   ├── rateLimiter.js        # Per-session sliding window
│   │   │   └── inputSanitizer.js     # XSS + prompt injection defense
│   │   ├── routes/                   # 20+ route files
│   │   ├── api/                      # Data product API (v1)
│   │   │   ├── routes/               # scenarios, riskScore, dependencyMap, etc.
│   │   │   ├── db/                   # schema.sql, validation_schema.sql
│   │   │   └── validation/           # 5-stage validation pipeline
│   │   ├── jobs/
│   │   │   ├── scheduler.js          # Cron jobs (daily ingestion, nightly validation)
│   │   │   └── dailyIngestion.js     # World Bank + OpenWeather fetch
│   │   ├── lib/
│   │   │   └── openrouter.js         # OpenRouter API wrapper
│   │   └── index.js                  # Express app setup (164 lines)
│   ├── data/
│   │   ├── countries.js              # 92 countries with GDP, population, resources
│   │   ├── companies.js              # 80 companies across 10 sectors
│   │   └── resources.js              # 15+ strategic resources with producers
│   ├── scripts/
│   │   ├── seedAll.js                # Master DB seeder
│   │   ├── kaggleIngest.js           # 9-module Kaggle data pipeline
│   │   ├── trainingSim.js            # Training data generator v1
│   │   ├── trainingSimV2.js          # Training data generator v2
│   │   ├── seedDataProduct.js        # 100-scenario synthetic dataset
│   │   ├── createCountriesTable.sql  # Countries DDL
│   │   └── createKaggleTables.sql    # Kaggle enrichment DDL
│   └── package.json
│
├── backend/                          # FastAPI scoring engine (Render)
│   ├── app/
│   │   ├── api/routes/               # scenarios.py, batch.py
│   │   ├── database/                 # db.py, schema.sql
│   │   ├── models/                   # scenario.py, batch.py
│   │   ├── services/                 # scoring_engine.py, validation_engine.py,
│   │   │                             # pipeline.py, cache.py
│   │   └── main.py                   # FastAPI entry point
│   ├── requirements.txt
│   └── Procfile
│
├── supabase/
│   ├── schema.sql                    # Core tables
│   ├── dire-x-setup.sql              # Fresh install
│   └── migrations/
│       └── 001_strategic_resources.sql
│
├── render.yaml                       # Render deployment manifest
├── vercel.json                       # Root Vercel config
├── package.json                      # Monorepo root
├── .gitignore
└── SETUP.md
```

---

## 4. Server Backend

### 4.1 Entry Point (index.js)

Middleware chain: `compression` -> `CORS` -> `JSON` -> `playerSession` -> `sanitizerMiddleware` -> `rateLimiter`

### 4.2 Route Mounting

```
/api/companies              → companiesRoutes
/api/risk                   → riskRoutes
/api/simulate               → simulateRoutes (rate-limited 10/min)
/api/world-state            → worldRoutes
/api/create-company         → createCompanyRoutes (rate-limited 5/min)
/api/leaderboard            → leaderboardRoutes
/api/strategic              → strategicRoutes (rate-limited 10/min)
/api/economy                → economyRoutes
/api/workforce              → workforceRoutes
/api/ideas                  → ideasRoutes
/api/geo                    → geoRoutes
/api/gdp                    → gdpRoutes
/api/geopolitical           → geopoliticalRoutes
/api/health                 → healthRoutes
/api/compliance             → complianceRoutes
/api/competition            → competitionRoutes
/api/countries              → countriesRoutes
/api/nations                → nationsRoutes
/api/strategic-resources    → strategicResourcesRoutes
/api/ai                     → aiRoutes (rate-limited 15/min)
/api/consequences/:id       → consequenceGraph
/api/v1/                    → dataProductRouter (API key auth)
/api/admin/keys             → adminKeysRouter (admin only)
/api/admin/validation       → validateScenario (admin only)
/api/admin/scoring-engine   → scoringEngine (admin only)
/api/admin/trigger-pipeline → ingestion trigger (admin only)
```

### 4.3 Startup Sequence

1. Load middleware chain
2. Mount all routes
3. Restore world state from Supabase (`hydrateState()`)
4. Sync GDP engine from DB (`syncGDPFromDB()`)
5. Start cron scheduler (daily ingestion 08:00 UTC, nightly validation 02:00 UTC)
6. Listen on PORT (default 4000)

---

## 5. Client Frontend

### 5.1 Component Architecture (34 React components, ~7,400 lines)

**Layout (4):** TopNav (318L), LeftPanel (259L), CenterPanel (223L), RightPanel (202L)

**Simulation (16):** MetricsPanel (164L), DecisionInput (218L), CompanyCreator (323L), EconomicDashboard (139L), WorkforcePanel (159L), GDPPanel (132L), GeopoliticalPanel (153L), HealthLiteracyPanel (166L), CompliancePanel (155L), GovernancePanel (196L), Leaderboard (157L), IdeaJournal (115L), EventCard (95L), ExplanationPanel (170L), ScenarioTracker (102L), SimulationTimeline (123L), StrategicActionsPanel (121L), BranchTree (72L)

**Visualization (4):** GlobeView (457L), RiskHeatmap (420L), ResourceFilter (177L), GeoIntelGlobe (691L)

**Shared (4):** ErrorBoundary (27L), LoadingSpinner (22L), AnimatedNumber (41L), ScenarioCard (72L)

### 5.2 Age-Adaptive Tier System

| Feature | Explorer (13-17) | Strategist (18-24) | Analyst (25+) |
|---------|:-:|:-:|:-:|
| Resource Filter | - | Y | Y |
| Trade Routes | - | Y | Y |
| Strategic Actions | - | Y | Y |
| Branch Tree | - | Y | Y |
| Heatmap View | - | Y | Y |
| Intel Globe | - | - | Y |
| Max Speed | 2x | 5x | 5x |
| Right Tabs | 4 | 6 | 8 |
| Data Status | - | - | Y |

### 5.3 UI Color Palette

```
dire.dark:    #0a0f1a  — main background
dire.panel:   #111827  — panel background
dire.card:    #1a2332  — card background
dire.accent:  #00d4ff  — primary cyan
dire.warning: #ff6b35  — warning orange
dire.danger:  #ef4444  — critical red
dire.success: #22c55e  — success green
dire.muted:   #64748b  — muted gray
Font: JetBrains Mono, Fira Code
```

### 5.4 State Management (Zustand, 959 lines)

40+ state slices organized into:
- Age & Onboarding (userAge, ageTier, onboarded)
- Game Mode & Selection (mode, selectedCompany, playerCompany, scenario)
- Simulation State (currentDay, isPlaying, speed, events, metrics, timeline, branches)
- Risk Data (riskData, companies)
- Globe & Geography (countries, tradeRoutes, resourceHeatmap)
- Open World (activeScenarios, worldDay, leaderboard)
- Economics (economics, marketState, publicPressure, scores)
- Workforce (workforce, population)
- Strategic Actions (strategicActions, availableStrategicActions)
- Ideas (ideas, ideaBadges)
- GDP & Geopolitical (gdpRanking, geopoliticalRelations)
- Health & Compliance (healthData, literacyData, complianceData, competitionData)
- UI State (soundEnabled, language, activeRightTab, centerMode)

### 5.5 API Client (40+ endpoints in api.js)

Axios client with HTML-detection interceptor (rejects Vercel SPA rewrite responses).

### 5.6 Sound System (Web Audio API, no dependencies)

11 named cues: simulationStart, tick, decisionSubmit, eventLow/Medium/High/Critical, success, scenarioStart, ideaSubmit, strategicAction

### 5.7 Build Configuration (Vite)

Manual chunk splitting: vendor (React), charts (Recharts), animation (Framer Motion), state (Zustand/Axios), globe (Three.js/react-globe.gl)

---

## 6. FastAPI Scoring Backend

### Entry: backend/app/main.py

**Endpoints:**
- `GET /health` — Service health + scoring engine + Redis status
- `POST /scenario/analyze` — Score a scenario (validation + impact + risk + fragility)
- `GET /scenario/{id}` — Fetch cached scenario (Redis 1h TTL)
- `GET /scenario/list` — Paginated scenario listing
- `POST /batch/analyze` — Batch scoring (multiple scenarios)

**Scoring Pipeline:**
1. Input validation (Pydantic models)
2. Impact score calculation
3. Exposure score
4. Temporal factor
5. Risk score
6. Fragility score
7. Final composite score + tier assignment
8. Shock trigger detection
9. Persist to PostgreSQL

**Dependencies:** FastAPI, Uvicorn, SQLAlchemy (async), asyncpg, Pydantic, Redis

---

## 7. Database (Supabase/PostgreSQL)

### Core Tables

| Table | Records | Purpose |
|-------|---------|---------|
| `countries_master` | 92 | Country macroeconomic data (GDP, population, growth) |
| `companies` | 80+ | Company profiles (name, sector, country) |
| `resources` | 15 | Strategic resource taxonomy |
| `company_resources` | 200+ | Company-resource dependency mappings |
| `risk_metrics` | 15 | Per-resource risk indices (demand, supply, geo, env) |

### Data Product Tables

| Table | Purpose |
|-------|---------|
| `dp_scenarios` | 100+ geopolitical scenarios with full scoring |
| `dp_cascade_phases` | Time-phased impact records per scenario |
| `dp_supplier_nodes` | Multi-tier supplier graph nodes |
| `dp_supplier_edges` | Supplier dependency edges (tier 1-6) |
| `dp_country_risk` | Extended country risk with sanctions data |
| `dp_live_alerts` | Real-time alert queue |
| `api_keys` | API key management (hash, tier, limits) |
| `api_usage_logs` | Per-key usage tracking |
| `dp_validation_results` | Scenario validation audit trail |
| `dp_correction_queue` | Auto-correction patches |

### Kaggle Enrichment Tables

| Table | Purpose |
|-------|---------|
| `country_economics_ts` | Time-series GDP, inflation, unemployment |
| `commodity_prices_ts` | Historical commodity prices |
| `mining_production` | Mining output by country/mineral |
| `trade_flows` | Bilateral trade flows |
| `company_benchmarks` | Fortune 500 benchmark data |
| `kaggle_ingestion_log` | Ingestion audit trail |

---

## 8. Simulation Engines (20 engines)

### 8.1 SRES Engine (sresEngine.js)

```
SRES_resource = 0.35 x Demand + 0.30 x Supply + 0.20 x Geopolitical + 0.15 x Environmental
SRES_company  = Sum(dependency_i x sres_i) / Sum(dependency_i)
```

### 8.2 Risk Engine (riskEngine.js)

5-factor weighted risk with hardcoded nation baselines:
- US (conflict:15, trade:20), CN (55, 60), RU (82, 45), TW (72, 65), IL (76, 50)

Resource criticality baselines: Rare Earth (95), Semiconductors (92), Lithium (86), Cobalt (83)

### 8.3 GDP Engine (gdpEngine.js)

24-country base GDP database. Deterministic drift (sin-wave seeded by country name). Scenario multipliers: war (0.5x growth), pandemic (0.55x), supply_crisis (0.7x), stable (1.0x).

### 8.4 Economic Engine (economicEngine.js)

```
rawMaterialCost = Sum(baseCost x supplyPressure x demandPressure x ratePressure)
refiningCost    = Sum(15 x costMultiplier x efficiencyPenalty)
manufacturingCost = Sum(20 x energyIntensity + laborCost) x wastePenalty
totalCost       = raw + refining + manufacturing
marketPrice     = baseCost x 1.3 x demandFactor x supplyFactor x sentimentFactor
profit          = revenue - totalCost
```

### 8.5 Scenario Lifecycle Engine

State machine: `emerging` -> `growth` -> `peak` -> `decline` -> `ended`

7 scenario types with lifecycle parameters:

| Type | Growth Rate | Decay Rate | Max Days | Peak Threshold |
|------|:-:|:-:|:-:|:-:|
| supply_crisis | 0.15 | 0.08 | 30 | 75% |
| war | 0.20 | 0.05 | 45 | 80% |
| drought | 0.10 | 0.12 | 25 | 70% |
| pandemic | 0.18 | 0.07 | 40 | 85% |
| trade_war | 0.12 | 0.10 | 20 | 65% |
| cyber_attack | 0.25 | 0.15 | 15 | 70% |
| energy_crisis | 0.14 | 0.06 | 35 | 75% |

### 8.6 Scenario Multipliers (applied per dimension)

| Scenario | Supply | Demand | Geopolitical | Environmental |
|----------|:-:|:-:|:-:|:-:|
| stable | 1.0 | 1.0 | 1.0 | 1.0 |
| supply_crisis | 1.8 | 1.0 | 1.3 | 1.2 |
| war | 1.6 | 1.4 | 2.0 | 1.3 |
| drought | 1.5 | 1.2 | 1.1 | 2.2 |
| pandemic | 1.4 | 1.6 | 1.1 | 1.0 |
| trade_war | 1.3 | 1.2 | 1.7 | 1.0 |
| cyber_attack | 1.5 | 1.1 | 1.4 | 1.0 |
| energy_crisis | 1.9 | 1.5 | 1.3 | 1.4 |

### 8.7 Scenario Cascade Probabilities

```
war         -> supply_crisis (0.5), trade_war (0.4), energy_crisis (0.35), cyber (0.3)
drought     -> supply_crisis (0.3), energy_crisis (0.2), trade_war (0.15)
pandemic    -> supply_crisis (0.35), trade_war (0.25)
cyber_attack -> supply_crisis (0.2), energy_crisis (0.15)
```

### 8.8 Impact Engine (4D distribution)

| Event Type | Supply | Economy | Environment | Stability |
|-----------|:-:|:-:|:-:|:-:|
| Supply | 45% | 25% | 10% | 20% |
| Economy | 15% | 45% | 10% | 30% |
| Environment | 20% | 15% | 45% | 20% |
| Stability | 15% | 25% | 10% | 50% |

### 8.9 Competition Engine

10 sectors: EV (18 companies, 18% growth), Defense (12, 6%), Electronics (45, 12%), Energy (28, 8%), Mining (20, 4%), Automotive (15, 3%), Pharma (10, 9%), Telecom (8, 7%), Agriculture (32, 2.5%), Construction (25, 5%)

### 8.10 Supply Depth Engine

Tier-2/3 dependency graph revealing hidden fragilities: Neon Gas (Ukraine 50% - critical for semiconductor lithography), Polyethylene Separator (China 40%), Photoresist (Japan 70%)

### 8.11 Logistics Engine

13 trade routes with disruption multipliers: stable (1.0x), stressed (1.4x, +3 day delay), disrupted (2.5x, +12 day delay)

### 8.12 Health/Literacy Engine

24 countries with base health indices. Scenario impact: pandemic (-12 health, +25 disease, -15 capacity), war (-8, +12, -10)

### 8.13 Additional Engines

- **Consequence Graph** — Records every cause-effect edge (5000 rolling buffer)
- **Strategic Engine** — R&D, diversification, diplomacy, vertical integration (10-30 day delay, 15-60 day duration)
- **Workforce Engine** — Size, morale, productivity, attrition
- **Manufacturing Engine** — Production pipeline with bottleneck detection
- **Equilibrium Engine** — Supply-demand price discovery
- **Event Engine** — Random event generation from stress levels
- **Compliance Engine** — Regulatory risk, tax burden, audit probability
- **Geopolitical Engine** — Diplomatic tension, alliance strength
- **Creative Intelligence** — Idea novelty/impact scoring with badges

### 8.14 Industry-Resource Dependency Map (10 industries)

```
EV:             Lithium (0.92), Cobalt (0.82), Nickel (0.78), Graphite (0.74), Semiconductors (0.86)
Defense:        Rare Earth (0.92), Semiconductors (0.90), Advanced Alloys (0.85)
Electronics:    Semiconductors (0.96), Silicon (0.82), Rare Earth (0.78)
Energy:         Crude Oil (0.90), Natural Gas (0.86), Uranium (0.56)
Mining:         Copper (0.88), Nickel (0.82), Cobalt (0.78)
Automotive:     Steel (0.85), Aluminum (0.78), Semiconductors (0.72)
Pharma:         Silicon (0.45), Water (0.60)
Telecom:        Semiconductors (0.88), Copper (0.72), Rare Earth (0.65)
Agriculture:    Water (0.95), Natural Gas (0.45), Copper (0.30)
Construction:   Steel (0.92), Copper (0.78), Aluminum (0.72)
```

---

## 9. API Reference (84 Endpoints)

### Core Game API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /health | Server health check |
| GET | /api/nations | All distinct nations |
| GET | /api/companies | List companies (?nationId filter) |
| GET | /api/companies/:id | Company detail with resources |
| POST | /api/create-company | Create player company |
| GET | /api/world-state | Current world state |
| POST | /api/world-state/tick | Advance 1 day |
| POST | /api/world-state/trigger-scenario | Trigger scenario (admin) |
| POST | /api/world-state/reset | Reset world (admin) |
| POST | /api/simulate | Run simulation step |
| GET | /api/leaderboard | Company rankings |

### Risk & Intelligence

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/risk/heatmap | Nation risk scores (?resource filter) |
| GET | /api/risk/global | Global risk overview |
| GET | /api/risk/:companyId | Company SRES risk |
| GET | /api/ai/insight | AI strategic insight (?nation, ?company) |

### Economy & Finance

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/economy/market | Market state (sentiment, confidence) |
| POST | /api/economy/calculate | Company P&L calculation |
| POST | /api/economy/tick | Evolve market state |
| GET | /api/gdp | Global GDP ranking |
| GET | /api/gdp/company/:id | Company GDP contribution |

### Geography & Trade

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/geo/countries | Countries with coordinates |
| GET | /api/geo/trade-routes | Trade route status |
| GET | /api/geo/straits | Strategic chokepoints |
| GET | /api/geo/resource-map/:resource | Resource producer heatmap |

### Strategic Actions & Ideas

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/strategic/:companyId | Available actions |
| POST | /api/strategic | Execute action |
| POST | /api/strategic/process | Process tick |
| POST | /api/ideas | Submit idea |
| GET | /api/ideas/:companyId | Company ideas |
| GET | /api/ideas/:companyId/badges | Badge summary |

### Workforce & Social

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/workforce/init | Initialize workforce |
| GET | /api/workforce/:companyId | Workforce state |
| POST | /api/workforce/tick | Evolve workforce |
| GET | /api/health/:country | Health & literacy |
| GET | /api/health/population/:country | Population breakdown |
| GET | /api/health/budget/:country | Government budget |
| GET | /api/health/all | All social indicators |

### Geopolitical

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/geopolitical/relations/:country | Country relations |
| GET | /api/geopolitical/snapshot | Global relations heatmap |
| GET | /api/geopolitical/supply-risk/:country | Supply risk modifier |

### Competition & Compliance

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/competition/:companyId | Competition profile |
| GET | /api/competition/sector/:industry | Sector snapshot |
| GET | /api/competition/overview/all | All sectors |
| GET | /api/compliance/:companyId | Compliance profile |
| POST | /api/compliance/audit | Simulate audit |

### Country Database (Supabase-backed)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/countries | All countries (?region filter) |
| GET | /api/countries/:code | Country by ISO3 |
| GET | /api/countries/ranking/gdp | GDP ranking from DB |
| GET | /api/countries/status | Last updated timestamp |
| GET | /api/strategic-resources | All resources (?companyId) |
| GET | /api/consequences/:companyId | Consequence attribution |

### Data Product API (v1, API key required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/ | Service info |
| GET | /api/v1/scenarios | Scenario catalog (paginated, filtered) |
| GET | /api/v1/scenarios/search | Full-text search |
| GET | /api/v1/scenarios/:id | Scenario detail + cascade phases |
| GET | /api/v1/risk-score | Risk score queries |
| GET | /api/v1/dependency-map | Supplier dependency graph |
| POST | /api/v1/simulate-scenario | Run simulation (professional+) |
| POST | /api/v1/validate-exposure | Score supplier list (professional+) |

### Admin API (admin key required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/admin/keys | Provision API key |
| PATCH | /api/admin/keys/:id | Update key |
| DELETE | /api/admin/keys/:id | Deactivate key |
| GET | /api/admin/keys/usage | Usage stats |
| POST | /api/admin/validation/run/:id | Validate scenario |
| POST | /api/admin/validation/batch | Batch validation |
| GET | /api/admin/validation/results/:id | Validation results |
| GET | /api/admin/validation/queue | Correction queue |
| POST | /api/admin/validation/corrections/:id/apply | Apply correction |
| POST | /api/admin/validation/corrections/:id/reject | Reject correction |
| GET | /api/admin/validation/stats | Validation stats |
| GET | /api/admin/scoring-engine/health | Scoring engine health |
| POST | /api/admin/scoring-engine/score | Score scenario |
| POST | /api/admin/scoring-engine/calibrate | Calibrate weights |
| POST | /api/admin/trigger-pipeline | Trigger data pipeline |

---

## 10. Middleware & Security

### Authentication (auth.js)

- **playerSession**: Auto-generates session token (X-Session-Token header), 24h TTL, in-memory Map
- **requireOwnership**: Verifies session owns the company or admin bypass
- **requireAdmin**: Validates X-Admin-Key header

### Rate Limiting (rateLimiter.js)

Per-session sliding window (1-minute windows):

| Category | Limit/min |
|----------|:-:|
| default | 60 |
| simulate | 10 |
| createCompany | 5 |
| triggerScenario | 2 |
| reset | 1 |
| aiInsight | 15 |
| audit | 5 |
| strategicAction | 10 |
| tick | 30 |

### Input Sanitization (inputSanitizer.js)

- Prompt injection detection (10 patterns: "ignore previous", "system note:", etc.)
- XSS prevention (strips `<>"'&;{}()\\/`)
- Keyword stuffing detection
- Company name: max 100 chars, dangerous chars stripped
- Decision text: max 500 chars, trust penalty [0-1]

### API Key Authentication (v1 endpoints)

- SHA-256 key hashing
- 4 tiers: starter, professional, enterprise, oem
- Per-hour rate limits, monthly simulation quotas
- 5-minute in-memory cache

---

## 11. Data Pipeline

### 11.1 External APIs

| Source | Data | Frequency |
|--------|------|-----------|
| World Bank API | GDP, population, growth | Daily (08:00 UTC) |
| REST Countries | Country metadata | On demand |
| OpenWeather | Weather/environmental severity | Daily |
| OpenRouter | AI narration/insights | On demand |

### 11.2 Kaggle Datasets (9 modules)

| Module | Dataset | Records | Purpose |
|--------|---------|---------|---------|
| GDP | Global Economic Indicators 2010-2025 | 62 countries | GDP, population, growth |
| Minerals | Minerals Backbone of Economy | 10 resources | Supply concentration HHI |
| Trade | World Export & Import 1989-2023 | 61 countries | Trade dependency |
| Risk | Fragile State Index 2006-2023 | 66 countries | Geopolitical risk |
| Commodity | Commodity Prices (daily) | 6 resources | Market prices |
| Military | Military Spending 1960-2019 | 209 countries | Defense budgets |
| Labor | Labour Force Stats (OECD) | 40 countries | Employment data |
| ESG | CO2 Emissions by Country | 256 countries | Environmental data |
| Companies | Fortune Global 500 2024 | 58 matched | Revenue benchmarks |

**Run:** `node scripts/kaggleIngest.js` (requires `pip install kaggle` + API token)

### 11.3 Real-World Data Accuracy

| Metric | DIRE-X Value | Real World | Match |
|--------|:-:|:-:|:-:|
| US GDP | $26,950B | ~$27T | 99% |
| China GDP | $17,700B | ~$17.8T | 99% |
| India GDP | $3,730B | ~$3.7T | 99% |
| US Population | 334M | 334M | Exact |
| India Population | 1,428M | 1,430M | 99% |
| Lithium: Australia share | 47% | 47% | Exact |
| Cobalt: Congo DR share | 67% | ~70% | 96% |
| Rare Earth: China share | 62% | ~60% | 97% |
| Risk ranking | Israel > Taiwan > Russia | Matches geopolitical reality | Correct |

---

## 12. Training Data Generation

### 12.1 v1 Generator (trainingSim.js)

6 agents (Geopolitical, Resource, Environment, Cyber, Economic, Observer) running 20 rounds x 5 ticks/round = 100 simulation days.

**Output:** 3,115 rows across 13 sheets.

### 12.2 v2 Generator (trainingSimV2.js)

Enhanced with 7 agents (Cascade, Recovery, Regional, BoomBust, StressTest, Social, DeepObserver) running 20 rounds x 7 ticks/round = 140 simulation days.

**New features:** Cascading crisis patterns, recovery cycles, boom/bust, delta tracking, company P&L, workforce evolution, compliance stress, health impact.

**Output:** 3,279 rows across 20 sheets.

### 12.3 Master Workbook (DIRE-X_Training_Master.xlsx)

Combined v1 + v2 = **6,394 total rows** across **31 sheets** with module-to-sheet mapping index.

**Module-to-Sheet Mapping:**

| Module | Sheets |
|--------|--------|
| SimCore | WorldTimeline, ScenarioCascade |
| Economic | CompanyPnL, MarketCycles, GDPDelta |
| SupplyChain | RouteDisruption, Concentration |
| Geopolitical | RelationDelta, SanctionsImpact |
| Risk | NationRiskEvo, CompanySRES, GlobalRiskTrend |
| Social | HealthStress, WorkforceEvo, PopulationShift |
| Competition | SectorDynamics, CompanyRankings |
| Strategic | ActionsOutcome, Innovation, ComplianceStress |
| v1:* | 10 sheets with v1_ prefix |

### 12.4 Cascade Patterns Used

1. **Military Escalation:** war -> supply_crisis -> energy_crisis
2. **Health Crisis Chain:** pandemic -> supply_crisis -> trade_war
3. **Infrastructure Attack:** cyber_attack -> energy_crisis -> supply_crisis
4. **Climate Cascade:** drought -> energy_crisis -> trade_war
5. **Economic Warfare:** trade_war -> supply_crisis -> cyber_attack

---

## 13. Deployment

### 13.1 Frontend (Vercel)

- **Domain:** dire-x.vercel.app
- **Root Directory:** client/
- **Build:** `npm run build` (Vite)
- **Output:** dist/
- **Rewrites:** `/(.*) -> /index.html` (SPA)
- **Env Vars:** `VITE_DIREX_API_URL=https://dire-x-backend.onrender.com`

### 13.2 Game Server (Render)

- **Service:** dire-x-api
- **Runtime:** Node.js 18+
- **Root:** server/
- **Build:** `npm install`
- **Start:** `npm start` (node src/index.js)
- **Health:** GET /health
- **Env Vars:** SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY, CORS_ORIGIN, ADMIN_API_KEY

### 13.3 Scoring Backend (Render)

- **Service:** dire-x-backend
- **Runtime:** Python 3.10
- **Root:** backend/
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health:** GET /health
- **Env Vars:** DATABASE_URL, REDIS_URL, APP_ENV

### 13.4 Database (Supabase)

- **Project:** xywqmkjklapfdfkcffox.supabase.co
- **Tables:** 20+ (core + data product + kaggle enrichment)
- **Auth:** Anon key (frontend) + Service role key (backend)

### 13.5 Local Development

```bash
# Terminal 1: Server
cd server && node src/index.js       # Port 4000

# Terminal 2: Client
cd client && npm run dev             # Port 3000 (proxies /api -> 4000)

# Or both:
npm run dev                          # Uses concurrently
```

---

## 14. Environment Variables

### Server (.env)

```bash
PORT=4000
NODE_ENV=development
SUPABASE_URL=https://xywqmkjklapfdfkcffox.supabase.co
SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>
OPENROUTER_API_KEY=sk-or-v1-<key>
CORS_ORIGIN=http://localhost:5173
ADMIN_API_KEY=direx-admin-2026-secure-key
```

### Client (.env)

```bash
VITE_API_URL=                                         # Empty for dev (Vite proxy)
VITE_DIREX_API_URL=https://dire-x-backend.onrender.com
VITE_DIREX_DEV_URL=http://localhost:8000
```

### Backend (.env)

```bash
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/direx
REDIS_URL=redis://localhost:6379/0
APP_ENV=development
```

---

## 15. Dependencies

### Server (Node.js)

| Package | Version | Purpose |
|---------|---------|---------|
| express | 4.19 | Web framework |
| @supabase/supabase-js | 2.100 | PostgreSQL client |
| axios | 1.13 | HTTP client |
| node-cron | 3.0 | Background scheduler |
| xlsx | 0.18 | Excel file processing |
| csv-parse | 6.2 | CSV parsing |
| compression | 1.8 | Gzip responses |
| cors | 2.8 | Cross-origin support |
| dotenv | 16.4 | Environment variables |
| uuid | 9.0 | Unique ID generation |
| pg | 8.20 | Direct PostgreSQL (dev) |

### Client (React)

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.2 | UI library |
| zustand | 4.5 | State management |
| axios | 1.6 | HTTP client |
| react-globe.gl | 2.27 | 3D globe |
| three | 0.183 | 3D rendering |
| recharts | 2.12 | Charts |
| framer-motion | 11.0 | Animations |
| tailwindcss | 3.4 | CSS framework |
| vite | 5.1 | Build tool |
| clsx | 2.1 | Classname utility |

### Backend (Python)

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.111+ | Web framework |
| uvicorn | 0.29+ | ASGI server |
| sqlalchemy | 2.0+ | ORM (async) |
| asyncpg | 0.29+ | PostgreSQL driver |
| pydantic | 2.7+ | Validation |
| redis | 5.0+ | Caching |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total Lines of Code** | ~15,000+ |
| **React Components** | 34 |
| **Simulation Engines** | 20 |
| **API Endpoints** | 84 |
| **Database Tables** | 20+ |
| **Countries** | 92 |
| **Companies** | 80+ |
| **Strategic Resources** | 15 |
| **Trade Routes** | 13 |
| **Industries** | 10 |
| **Scenario Types** | 7 |
| **Kaggle Datasets** | 9 |
| **Training Data Rows** | 6,394 |
| **Supported Languages** | 8 |
| **Age Tiers** | 3 |

---

*DIRE-X: A comprehensive supply chain risk modeling engine with deterministic simulation, AI-enhanced insights, persistent state management, and enterprise-grade API.*
