-- DIRE-X Database Schema (Enhanced)
-- Decision Intelligence for Resource Evaluation - eXtended

-- ============================================
-- CORE TABLES
-- ============================================

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sector TEXT NOT NULL,
  country TEXT NOT NULL,
  strategy TEXT DEFAULT 'balanced' CHECK (strategy IN ('cost', 'balanced', 'sustainable')),
  scale TEXT DEFAULT 'medium' CHECK (scale IN ('small', 'medium', 'large')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Resources (strategic taxonomy — migration 001 required for existing DBs)
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN (
    'critical_minerals',
    'energy_resources',
    'industrial_metals',
    'technology_materials',
    'strategic_environmental'
  )),
  unit TEXT,
  description TEXT,
  strategic_importance   DECIMAL(4,3) DEFAULT 0.50 CHECK (strategic_importance   >= 0 AND strategic_importance   <= 1),
  supply_risk            DECIMAL(4,3) DEFAULT 0.50 CHECK (supply_risk            >= 0 AND supply_risk            <= 1),
  geopolitical_sensitivity DECIMAL(4,3) DEFAULT 0.50 CHECK (geopolitical_sensitivity >= 0 AND geopolitical_sensitivity <= 1),
  refining_dependency    TEXT,
  global_reserve DECIMAL(15,2),
  annual_production DECIMAL(15,2),
  top_producers JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Company-Resource mapping with dependency scores
CREATE TABLE IF NOT EXISTS company_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  dependency DECIMAL(4,3) NOT NULL CHECK (dependency >= 0 AND dependency <= 1),
  usage_context TEXT,
  usage_breakdown JSONB,
  UNIQUE(company_id, resource_id)
);

-- Risk metrics with snapshot tracking
CREATE TABLE IF NOT EXISTS risk_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  demand_score DECIMAL(5,2) NOT NULL CHECK (demand_score >= 0 AND demand_score <= 100),
  supply_score DECIMAL(5,2) NOT NULL CHECK (supply_score >= 0 AND supply_score <= 100),
  geopolitical_score DECIMAL(5,2) NOT NULL CHECK (geopolitical_score >= 0 AND geopolitical_score <= 100),
  environmental_score DECIMAL(5,2) NOT NULL CHECK (environmental_score >= 0 AND environmental_score <= 100),
  sres DECIMAL(5,2),
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(resource_id, snapshot_date)
);

-- Data snapshots for tracking ingestion runs
CREATE TABLE IF NOT EXISTS data_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  source TEXT NOT NULL,
  records_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- REFINING + MANUFACTURING PIPELINE
-- ============================================

-- Refining facilities
CREATE TABLE IF NOT EXISTS refining_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  resource_id UUID REFERENCES resources(id),
  capacity DECIMAL(12,2) NOT NULL DEFAULT 100,
  efficiency DECIMAL(4,3) NOT NULL DEFAULT 0.85 CHECK (efficiency >= 0 AND efficiency <= 1),
  cost_per_unit DECIMAL(10,2) NOT NULL DEFAULT 10,
  input_resources JSONB,
  output_resource TEXT,
  country TEXT,
  status TEXT DEFAULT 'operational' CHECK (status IN ('operational', 'degraded', 'offline')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Manufacturing facilities
CREATE TABLE IF NOT EXISTS manufacturing_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product TEXT NOT NULL,
  capacity DECIMAL(12,2) NOT NULL DEFAULT 100,
  efficiency DECIMAL(4,3) NOT NULL DEFAULT 0.80 CHECK (efficiency >= 0 AND efficiency <= 1),
  waste_rate DECIMAL(4,3) NOT NULL DEFAULT 0.05 CHECK (waste_rate >= 0 AND waste_rate <= 1),
  energy_intensity DECIMAL(8,2) NOT NULL DEFAULT 50,
  input_materials JSONB,
  country TEXT,
  status TEXT DEFAULT 'operational' CHECK (status IN ('operational', 'degraded', 'offline')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ECONOMIC SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS company_economics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  simulation_day INTEGER NOT NULL DEFAULT 0,
  output_units DECIMAL(12,2) DEFAULT 0,
  raw_material_cost DECIMAL(12,2) DEFAULT 0,
  refining_cost DECIMAL(12,2) DEFAULT 0,
  manufacturing_cost DECIMAL(12,2) DEFAULT 0,
  total_cost DECIMAL(12,2) DEFAULT 0,
  market_price DECIMAL(12,2) DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  profit DECIMAL(12,2) DEFAULT 0,
  profit_margin DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- MARKET + PUBLIC + GOVERNANCE
-- ============================================

CREATE TABLE IF NOT EXISTS market_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_day INTEGER NOT NULL DEFAULT 0,
  sentiment DECIMAL(5,2) DEFAULT 50 CHECK (sentiment >= 0 AND sentiment <= 100),
  confidence DECIMAL(5,2) DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  volatility DECIMAL(5,2) DEFAULT 20,
  demand_index DECIMAL(5,2) DEFAULT 50,
  supply_index DECIMAL(5,2) DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public_pressure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_day INTEGER NOT NULL DEFAULT 0,
  price_pressure DECIMAL(5,2) DEFAULT 30,
  environmental_pressure DECIMAL(5,2) DEFAULT 30,
  shortage_pressure DECIMAL(5,2) DEFAULT 20,
  total_pressure DECIMAL(5,2) DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS governance_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  response_style TEXT DEFAULT 'responsive' CHECK (response_style IN ('responsive', 'centralized', 'interventionist', 'market_driven')),
  active_policies JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- WORKFORCE + POPULATION
-- ============================================

CREATE TABLE IF NOT EXISTS company_workforce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  simulation_day INTEGER NOT NULL DEFAULT 0,
  size INTEGER DEFAULT 1000,
  skill_level DECIMAL(4,3) DEFAULT 0.5 CHECK (skill_level >= 0 AND skill_level <= 1),
  productivity DECIMAL(4,3) DEFAULT 0.7 CHECK (productivity >= 0 AND productivity <= 1),
  cost_per_worker DECIMAL(10,2) DEFAULT 50,
  morale DECIMAL(4,3) DEFAULT 0.7 CHECK (morale >= 0 AND morale <= 1),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS population_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  simulation_day INTEGER NOT NULL DEFAULT 0,
  demand_factor DECIMAL(5,2) DEFAULT 50,
  stability_index DECIMAL(5,2) DEFAULT 50,
  labor_pool_health DECIMAL(4,3) DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- STRATEGIC ACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS strategic_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('diplomacy', 'collaboration', 'rd', 'diversification', 'vertical_integration')),
  title TEXT NOT NULL,
  description TEXT,
  target JSONB,
  delay_days INTEGER NOT NULL DEFAULT 5,
  duration_days INTEGER DEFAULT 30,
  cost DECIMAL(12,2) DEFAULT 0,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  tradeoffs JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  started_day INTEGER,
  completion_day INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CREATIVE INTELLIGENCE + IDEA JOURNAL
-- ============================================

CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  novelty_score DECIMAL(4,2) DEFAULT 0,
  impact_score DECIMAL(4,2) DEFAULT 0,
  combined_score DECIMAL(4,2) DEFAULT 0,
  category TEXT,
  badges TEXT[] DEFAULT '{}',
  simulation_day INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SIMULATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  scenario TEXT NOT NULL,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed')),
  current_day INTEGER DEFAULT 0,
  mode TEXT DEFAULT 'open_world' CHECK (mode IN ('open_world', 'arcade')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Simulation results per day
CREATE TABLE IF NOT EXISTS simulation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  decision TEXT,
  metrics JSONB NOT NULL,
  events JSONB,
  economics JSONB,
  narration TEXT,
  branch_id TEXT,
  parent_branch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Active scenarios tracking
CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'emerging' CHECK (stage IN ('emerging', 'growth', 'peak', 'decline', 'ended')),
  intensity DECIMAL(4,3) NOT NULL DEFAULT 0.1 CHECK (intensity >= 0 AND intensity <= 1),
  start_day INTEGER NOT NULL DEFAULT 0,
  current_day INTEGER NOT NULL DEFAULT 0,
  max_duration INTEGER NOT NULL DEFAULT 30,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Scheduled/generated events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity INTEGER CHECK (severity >= 1 AND severity <= 5),
  impact JSONB,
  triggered_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_risk_metrics_resource ON risk_metrics(resource_id);
CREATE INDEX IF NOT EXISTS idx_risk_metrics_date ON risk_metrics(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_company_resources_company ON company_resources(company_id);
CREATE INDEX IF NOT EXISTS idx_simulation_results_sim ON simulation_results(simulation_id);
CREATE INDEX IF NOT EXISTS idx_simulation_results_day ON simulation_results(simulation_id, day);
CREATE INDEX IF NOT EXISTS idx_simulations_company ON simulations(company_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_stage ON scenarios(stage);
CREATE INDEX IF NOT EXISTS idx_events_sim_day ON events(simulation_id, day);
CREATE INDEX IF NOT EXISTS idx_company_economics_company ON company_economics(company_id, simulation_day);
CREATE INDEX IF NOT EXISTS idx_strategic_actions_company ON strategic_actions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_ideas_company ON ideas(company_id);
CREATE INDEX IF NOT EXISTS idx_workforce_company ON company_workforce(company_id, simulation_day);

-- ============================================
-- SEED DATA
-- ============================================

-- Companies
INSERT INTO companies (id, name, sector, country, strategy, scale, description) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Lockheed Martin', 'Defense & Aerospace', 'United States', 'balanced', 'large', 'Global defense technology and aerospace manufacturer'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Tesla', 'Automotive & Energy', 'United States', 'sustainable', 'large', 'Electric vehicle and clean energy company'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Samsung', 'Electronics', 'South Korea', 'balanced', 'large', 'Multinational electronics and semiconductor conglomerate'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Cargill', 'Agriculture & Food', 'United States', 'cost', 'large', 'Global food corporation and agricultural commodities trader'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'TSMC', 'Semiconductors', 'Taiwan', 'balanced', 'large', 'World largest dedicated semiconductor foundry')
ON CONFLICT (name) DO NOTHING;

-- Resources (expanded full taxonomy)
INSERT INTO resources (id, name, category, subcategory, unit, description, top_producers) VALUES
  -- Energy
  ('b1b2c3d4-0001-4000-8000-000000000001', 'Crude Oil', 'energy', 'fossil', 'barrel', 'Primary fossil fuel for energy and petrochemicals', '["Saudi Arabia","United States","Russia"]'),
  ('b1b2c3d4-0002-4000-8000-000000000002', 'Natural Gas', 'energy', 'fossil', 'mcf', 'Fossil fuel used for heating, electricity, and industrial processes', '["United States","Russia","Iran"]'),
  ('b1b2c3d4-0010-4000-8000-000000000010', 'Uranium', 'energy', 'nuclear', 'pound', 'Nuclear fuel for energy generation', '["Kazakhstan","Canada","Australia"]'),
  ('b1b2c3d4-0011-4000-8000-000000000011', 'Solar Capacity', 'energy', 'renewable', 'MW', 'Photovoltaic energy generation capacity', '["China","United States","India"]'),
  ('b1b2c3d4-0012-4000-8000-000000000012', 'Wind Capacity', 'energy', 'renewable', 'MW', 'Wind energy generation capacity', '["China","United States","Germany"]'),
  ('b1b2c3d4-0013-4000-8000-000000000013', 'Coal', 'energy', 'fossil', 'tonne', 'Fossil fuel for power generation and steel', '["China","India","Indonesia"]'),
  -- Minerals
  ('b1b2c3d4-0003-4000-8000-000000000003', 'Lithium', 'minerals', 'battery', 'tonne', 'Critical mineral for battery production', '["Australia","Chile","China"]'),
  ('b1b2c3d4-0004-4000-8000-000000000004', 'Cobalt', 'minerals', 'battery', 'tonne', 'Essential for lithium-ion battery cathodes', '["DRC","Russia","Australia"]'),
  ('b1b2c3d4-0005-4000-8000-000000000005', 'Copper', 'minerals', 'conductor', 'tonne', 'Essential conductor for electronics and power systems', '["Chile","Peru","China"]'),
  ('b1b2c3d4-0006-4000-8000-000000000006', 'Rare Earth Elements', 'minerals', 'strategic', 'tonne', 'Critical for electronics, magnets, and defense systems', '["China","Myanmar","Australia"]'),
  ('b1b2c3d4-0009-4000-8000-000000000009', 'Iron Ore', 'minerals', 'structural', 'tonne', 'Primary input for steel production', '["Australia","Brazil","China"]'),
  ('b1b2c3d4-0014-4000-8000-000000000014', 'Nickel', 'minerals', 'battery', 'tonne', 'Key component in stainless steel and batteries', '["Indonesia","Philippines","Russia"]'),
  ('b1b2c3d4-0015-4000-8000-000000000015', 'Manganese', 'minerals', 'battery', 'tonne', 'Essential for steel alloys and batteries', '["South Africa","Gabon","Australia"]'),
  ('b1b2c3d4-0016-4000-8000-000000000016', 'Titanium', 'minerals', 'aerospace', 'tonne', 'High-strength low-weight metal for aerospace', '["China","Russia","Japan"]'),
  ('b1b2c3d4-0017-4000-8000-000000000017', 'Graphite', 'minerals', 'battery', 'tonne', 'Anode material for lithium-ion batteries', '["China","Mozambique","Brazil"]'),
  ('b1b2c3d4-0018-4000-8000-000000000018', 'Platinum', 'minerals', 'catalyst', 'ounce', 'Catalyst for fuel cells and automotive', '["South Africa","Russia","Zimbabwe"]'),
  -- Environmental
  ('b1b2c3d4-0019-4000-8000-000000000019', 'Fresh Water', 'environmental', 'water', 'megaliter', 'Critical freshwater resources', '["Brazil","Russia","Canada"]'),
  ('b1b2c3d4-0020-4000-8000-000000000020', 'Arable Land', 'environmental', 'land', 'hectare', 'Productive agricultural land', '["United States","India","Russia"]'),
  ('b1b2c3d4-0021-4000-8000-000000000021', 'Timber', 'environmental', 'forestry', 'cubic_meter', 'Wood resources for construction and paper', '["United States","Russia","China"]'),
  -- Industrial
  ('b1b2c3d4-0008-4000-8000-000000000008', 'Semiconductors', 'industrial', 'electronics', 'unit', 'Integrated circuits and microchips', '["Taiwan","South Korea","United States"]'),
  ('b1b2c3d4-0022-4000-8000-000000000022', 'Steel', 'industrial', 'metal', 'tonne', 'Processed iron for construction and manufacturing', '["China","India","Japan"]'),
  ('b1b2c3d4-0023-4000-8000-000000000023', 'Aluminum', 'industrial', 'metal', 'tonne', 'Lightweight metal for transport and packaging', '["China","India","Russia"]'),
  ('b1b2c3d4-0024-4000-8000-000000000024', 'Cement', 'industrial', 'construction', 'tonne', 'Primary construction material', '["China","India","Vietnam"]'),
  ('b1b2c3d4-0025-4000-8000-000000000025', 'Petrochemicals', 'industrial', 'chemical', 'tonne', 'Chemical products derived from petroleum', '["United States","China","Saudi Arabia"]'),
  -- Infrastructure
  ('b1b2c3d4-0026-4000-8000-000000000026', 'Fiber Optic Cable', 'infrastructure', 'telecom', 'km', 'High-speed data transmission infrastructure', '["China","United States","Japan"]'),
  ('b1b2c3d4-0027-4000-8000-000000000027', 'Port Capacity', 'infrastructure', 'logistics', 'TEU', 'Container port throughput capacity', '["China","Singapore","South Korea"]'),
  ('b1b2c3d4-0028-4000-8000-000000000028', 'Power Grid', 'infrastructure', 'energy', 'GW', 'Electrical grid transmission capacity', '["United States","China","India"]'),
  -- Food
  ('b1b2c3d4-0007-4000-8000-000000000007', 'Wheat', 'food', 'grain', 'bushel', 'Global staple grain commodity', '["China","India","Russia"]'),
  ('b1b2c3d4-0029-4000-8000-000000000029', 'Rice', 'food', 'grain', 'tonne', 'Primary food staple for Asia', '["China","India","Bangladesh"]'),
  ('b1b2c3d4-0030-4000-8000-000000000030', 'Soybeans', 'food', 'oilseed', 'bushel', 'Key protein and oil crop', '["Brazil","United States","Argentina"]'),
  ('b1b2c3d4-0031-4000-8000-000000000031', 'Corn', 'food', 'grain', 'bushel', 'Versatile grain for food and fuel', '["United States","China","Brazil"]'),
  ('b1b2c3d4-0032-4000-8000-000000000032', 'Fertilizer', 'food', 'input', 'tonne', 'Agricultural chemical inputs (NPK)', '["China","Russia","Canada"]')
ON CONFLICT (name) DO NOTHING;

-- Company-Resource Dependencies with usage breakdowns
INSERT INTO company_resources (company_id, resource_id, dependency, usage_context, usage_breakdown) VALUES
  -- Lockheed Martin (Defense)
  ('a1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0006-4000-8000-000000000006', 0.85, 'Advanced electronics and guidance systems', '{"guidance_systems": 40, "radar": 30, "sensors": 20, "other": 10}'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0008-4000-8000-000000000008', 0.90, 'Avionics and computing systems', '{"avionics": 45, "computing": 30, "communications": 15, "other": 10}'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0005-4000-8000-000000000005', 0.60, 'Wiring and electrical systems', '{"wiring": 50, "motors": 30, "shielding": 20}'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0009-4000-8000-000000000009', 0.55, 'Structural steel components', '{"airframe": 40, "engine_parts": 35, "landing_gear": 25}'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0016-4000-8000-000000000016', 0.75, 'Titanium airframe components', '{"airframe": 60, "engine": 25, "fasteners": 15}'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0023-4000-8000-000000000023', 0.50, 'Aluminum structural panels', '{"fuselage": 50, "wings": 30, "other": 20}'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0022-4000-8000-000000000022', 0.65, 'Steel structures and armor', '{"armor": 40, "structure": 35, "fittings": 25}'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0001-4000-8000-000000000001', 0.40, 'Fuel for testing and logistics', '{"testing": 50, "logistics": 50}'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0010-4000-8000-000000000010', 0.30, 'Nuclear propulsion systems', '{"naval_reactors": 70, "research": 30}'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0018-4000-8000-000000000018', 0.25, 'Catalytic components', '{"sensors": 60, "coatings": 40}'),
  -- Tesla (EV + Energy)
  ('a1b2c3d4-0002-4000-8000-000000000002', 'b1b2c3d4-0003-4000-8000-000000000003', 0.95, 'Battery cell production', '{"battery_cells": 70, "energy_storage": 20, "other": 10}'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'b1b2c3d4-0004-4000-8000-000000000004', 0.80, 'Battery cathode materials', '{"cathode": 80, "recycling": 20}'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'b1b2c3d4-0005-4000-8000-000000000005', 0.75, 'Motor windings and wiring', '{"motors": 40, "wiring": 35, "charging": 25}'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'b1b2c3d4-0008-4000-8000-000000000008', 0.85, 'Autopilot and computing chips', '{"autopilot": 50, "infotainment": 25, "power_mgmt": 25}'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'b1b2c3d4-0006-4000-8000-000000000006', 0.70, 'Motor magnets and electronics', '{"permanent_magnets": 60, "electronics": 40}'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'b1b2c3d4-0014-4000-8000-000000000014', 0.75, 'Nickel for battery cathodes', '{"cathode_NCA": 70, "cathode_NMC": 30}'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'b1b2c3d4-0017-4000-8000-000000000017', 0.70, 'Graphite for battery anodes', '{"anode": 85, "lubricants": 15}'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'b1b2c3d4-0023-4000-8000-000000000023', 0.60, 'Aluminum body panels', '{"body": 60, "chassis": 25, "battery_housing": 15}'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'b1b2c3d4-0022-4000-8000-000000000022', 0.55, 'Steel chassis and structure', '{"chassis": 50, "subframe": 30, "other": 20}'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'b1b2c3d4-0011-4000-8000-000000000011', 0.50, 'Solar panel manufacturing', '{"solar_roof": 60, "supercharger": 40}'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'b1b2c3d4-0015-4000-8000-000000000015', 0.45, 'Manganese for battery cathodes', '{"cathode": 90, "other": 10}'),
  -- Samsung (Electronics)
  ('a1b2c3d4-0003-4000-8000-000000000003', 'b1b2c3d4-0008-4000-8000-000000000008', 0.95, 'Core semiconductor manufacturing', '{"memory": 40, "logic": 30, "foundry": 20, "sensors": 10}'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'b1b2c3d4-0006-4000-8000-000000000006', 0.75, 'Display and chip components', '{"displays": 40, "magnets": 30, "phosphors": 30}'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'b1b2c3d4-0005-4000-8000-000000000005', 0.65, 'Circuit board and wiring', '{"PCB": 40, "wiring": 35, "connectors": 25}'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'b1b2c3d4-0003-4000-8000-000000000003', 0.60, 'Battery production for devices', '{"mobile": 50, "wearable": 30, "EV_battery": 20}'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'b1b2c3d4-0014-4000-8000-000000000014', 0.55, 'Nickel for device batteries', '{"battery_cathode": 80, "plating": 20}'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'b1b2c3d4-0019-4000-8000-000000000019', 0.70, 'Ultra-pure water for fab', '{"wafer_cleaning": 60, "chemical_processes": 30, "cooling": 10}'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'b1b2c3d4-0002-4000-8000-000000000002', 0.45, 'Fab power generation', '{"cleanroom_HVAC": 50, "equipment_power": 40, "other": 10}'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'b1b2c3d4-0025-4000-8000-000000000025', 0.50, 'Chemical precursors', '{"photoresist": 40, "etchants": 35, "solvents": 25}'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'b1b2c3d4-0017-4000-8000-000000000017', 0.40, 'Graphite for anodes', '{"battery_anode": 80, "thermal_mgmt": 20}'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'b1b2c3d4-0023-4000-8000-000000000023', 0.35, 'Aluminum for casings', '{"phone_frames": 50, "laptop_chassis": 30, "heatsinks": 20}'),
  -- Cargill (Agriculture)
  ('a1b2c3d4-0004-4000-8000-000000000004', 'b1b2c3d4-0007-4000-8000-000000000007', 0.90, 'Global grain trading', '{"trading": 50, "processing": 30, "storage": 20}'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'b1b2c3d4-0029-4000-8000-000000000029', 0.75, 'Rice trading and processing', '{"trading": 55, "milling": 30, "distribution": 15}'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'b1b2c3d4-0030-4000-8000-000000000030', 0.85, 'Soybean processing', '{"crushing": 40, "oil_extraction": 35, "meal": 25}'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'b1b2c3d4-0031-4000-8000-000000000031', 0.80, 'Corn processing', '{"ethanol": 35, "feed": 35, "HFCS": 20, "starch": 10}'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'b1b2c3d4-0001-4000-8000-000000000001', 0.55, 'Transportation fuel and logistics', '{"truck": 40, "rail": 30, "ship": 30}'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'b1b2c3d4-0002-4000-8000-000000000002', 0.45, 'Fertilizer production and processing', '{"fertilizer_prod": 50, "grain_drying": 30, "processing": 20}'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'b1b2c3d4-0032-4000-8000-000000000032', 0.80, 'Fertilizer supply', '{"nitrogen": 40, "phosphate": 35, "potash": 25}'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'b1b2c3d4-0019-4000-8000-000000000019', 0.85, 'Water for processing', '{"irrigation_supply": 40, "processing": 35, "livestock": 25}'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'b1b2c3d4-0020-4000-8000-000000000020', 0.90, 'Agricultural land access', '{"crop_production": 60, "grazing": 25, "forestry": 15}'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'b1b2c3d4-0027-4000-8000-000000000027', 0.60, 'Port logistics for export', '{"grain_export": 60, "import": 25, "transship": 15}'),
  -- TSMC (Semiconductors)
  ('a1b2c3d4-0005-4000-8000-000000000005', 'b1b2c3d4-0008-4000-8000-000000000008', 0.98, 'Core chip fabrication', '{"logic": 45, "mobile": 25, "HPC": 20, "automotive": 10}'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'b1b2c3d4-0006-4000-8000-000000000006', 0.80, 'Photolithography materials', '{"photomask": 40, "CMP_slurry": 30, "dopants": 30}'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'b1b2c3d4-0005-4000-8000-000000000005', 0.70, 'Interconnects and packaging', '{"interconnects": 50, "bonding_wire": 30, "leadframes": 20}'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'b1b2c3d4-0002-4000-8000-000000000002', 0.50, 'Cleanroom HVAC and power', '{"HVAC": 40, "boiler": 30, "backup_power": 30}'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'b1b2c3d4-0019-4000-8000-000000000019', 0.85, 'Ultra-pure water for wafer fab', '{"wafer_rinse": 50, "chemical_dilution": 30, "cooling": 20}'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'b1b2c3d4-0025-4000-8000-000000000025', 0.75, 'Chemical precursors and gases', '{"process_gases": 35, "photoresist": 30, "etchants": 25, "CMP": 10}'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'b1b2c3d4-0028-4000-8000-000000000028', 0.80, 'Stable power grid access', '{"fab_operations": 70, "cooling": 20, "office": 10}'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'b1b2c3d4-0026-4000-8000-000000000026', 0.40, 'Data connectivity', '{"design_data": 50, "customer_comm": 30, "monitoring": 20}'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'b1b2c3d4-0018-4000-8000-000000000018', 0.30, 'Platinum for specialized processes', '{"catalytic": 60, "electrode": 40}'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'b1b2c3d4-0023-4000-8000-000000000023', 0.25, 'Aluminum for packaging', '{"wire_bonding": 50, "heat_spreaders": 50}')
ON CONFLICT DO NOTHING;

-- Seed Risk Metrics
INSERT INTO risk_metrics (resource_id, snapshot_date, demand_score, supply_score, geopolitical_score, environmental_score, sres, source) VALUES
  ('b1b2c3d4-0001-4000-8000-000000000001', CURRENT_DATE, 78.5, 65.2, 72.0, 58.3, 69.4, 'seed'),
  ('b1b2c3d4-0002-4000-8000-000000000002', CURRENT_DATE, 72.0, 58.5, 68.0, 45.2, 62.8, 'seed'),
  ('b1b2c3d4-0003-4000-8000-000000000003', CURRENT_DATE, 88.5, 82.0, 55.0, 42.0, 71.6, 'seed'),
  ('b1b2c3d4-0004-4000-8000-000000000004', CURRENT_DATE, 82.0, 78.5, 75.0, 38.5, 72.1, 'seed'),
  ('b1b2c3d4-0005-4000-8000-000000000005', CURRENT_DATE, 85.0, 62.0, 48.0, 35.0, 62.4, 'seed'),
  ('b1b2c3d4-0006-4000-8000-000000000006', CURRENT_DATE, 92.0, 88.0, 82.0, 30.0, 79.1, 'seed'),
  ('b1b2c3d4-0007-4000-8000-000000000007', CURRENT_DATE, 70.0, 55.0, 60.0, 72.0, 63.6, 'seed'),
  ('b1b2c3d4-0008-4000-8000-000000000008', CURRENT_DATE, 95.0, 85.0, 78.0, 25.0, 77.0, 'seed'),
  ('b1b2c3d4-0009-4000-8000-000000000009', CURRENT_DATE, 75.0, 52.0, 55.0, 48.0, 59.9, 'seed'),
  ('b1b2c3d4-0010-4000-8000-000000000010', CURRENT_DATE, 65.0, 70.0, 80.0, 55.0, 67.0, 'seed'),
  ('b1b2c3d4-0011-4000-8000-000000000011', CURRENT_DATE, 80.0, 40.0, 35.0, 25.0, 50.3, 'seed'),
  ('b1b2c3d4-0012-4000-8000-000000000012', CURRENT_DATE, 75.0, 45.0, 30.0, 28.0, 49.5, 'seed'),
  ('b1b2c3d4-0013-4000-8000-000000000013', CURRENT_DATE, 60.0, 50.0, 55.0, 85.0, 59.8, 'seed'),
  ('b1b2c3d4-0014-4000-8000-000000000014', CURRENT_DATE, 85.0, 72.0, 65.0, 45.0, 71.3, 'seed'),
  ('b1b2c3d4-0015-4000-8000-000000000015', CURRENT_DATE, 70.0, 55.0, 50.0, 40.0, 57.0, 'seed'),
  ('b1b2c3d4-0016-4000-8000-000000000016', CURRENT_DATE, 78.0, 68.0, 60.0, 35.0, 64.6, 'seed'),
  ('b1b2c3d4-0017-4000-8000-000000000017', CURRENT_DATE, 82.0, 75.0, 70.0, 35.0, 69.7, 'seed'),
  ('b1b2c3d4-0018-4000-8000-000000000018', CURRENT_DATE, 72.0, 65.0, 55.0, 30.0, 59.8, 'seed'),
  ('b1b2c3d4-0019-4000-8000-000000000019', CURRENT_DATE, 90.0, 70.0, 40.0, 85.0, 73.3, 'seed'),
  ('b1b2c3d4-0020-4000-8000-000000000020', CURRENT_DATE, 85.0, 65.0, 45.0, 80.0, 70.3, 'seed'),
  ('b1b2c3d4-0021-4000-8000-000000000021', CURRENT_DATE, 60.0, 50.0, 35.0, 75.0, 54.3, 'seed'),
  ('b1b2c3d4-0022-4000-8000-000000000022', CURRENT_DATE, 80.0, 55.0, 50.0, 60.0, 63.5, 'seed'),
  ('b1b2c3d4-0023-4000-8000-000000000023', CURRENT_DATE, 78.0, 58.0, 45.0, 55.0, 61.9, 'seed'),
  ('b1b2c3d4-0024-4000-8000-000000000024', CURRENT_DATE, 75.0, 45.0, 40.0, 70.0, 58.8, 'seed'),
  ('b1b2c3d4-0025-4000-8000-000000000025', CURRENT_DATE, 82.0, 60.0, 55.0, 65.0, 67.5, 'seed'),
  ('b1b2c3d4-0026-4000-8000-000000000026', CURRENT_DATE, 88.0, 50.0, 45.0, 20.0, 57.8, 'seed'),
  ('b1b2c3d4-0027-4000-8000-000000000027', CURRENT_DATE, 85.0, 60.0, 55.0, 35.0, 63.5, 'seed'),
  ('b1b2c3d4-0028-4000-8000-000000000028', CURRENT_DATE, 90.0, 55.0, 42.0, 50.0, 63.6, 'seed'),
  ('b1b2c3d4-0029-4000-8000-000000000029', CURRENT_DATE, 75.0, 60.0, 55.0, 65.0, 64.5, 'seed'),
  ('b1b2c3d4-0030-4000-8000-000000000030', CURRENT_DATE, 80.0, 58.0, 50.0, 55.0, 63.7, 'seed'),
  ('b1b2c3d4-0031-4000-8000-000000000031', CURRENT_DATE, 78.0, 55.0, 48.0, 50.0, 60.8, 'seed'),
  ('b1b2c3d4-0032-4000-8000-000000000032', CURRENT_DATE, 85.0, 72.0, 70.0, 55.0, 73.4, 'seed')
ON CONFLICT DO NOTHING;

-- Seed Snapshot
INSERT INTO data_snapshots (snapshot_date, source, records_count, status, metadata) VALUES
  (CURRENT_DATE, 'seed', 32, 'completed', '{"type": "initial_seed", "version": "2.0"}')
ON CONFLICT (snapshot_date) DO NOTHING;
