/**
 * Seed script — inserts initial data into Supabase for DIRE-X.
 * Usage: node scripts/seed.js
 *
 * Requires migration 001_strategic_resources.sql to have been run first.
 */

require('dotenv').config();

const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin: supabase } = require('../src/config/supabase');

// Validate env before seeding
const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[seed] Missing required env vars: ${missing.join(', ')}`);
  console.error('[seed] Copy server/.env.example → .env and fill in Supabase credentials.');
  process.exit(1);
}

// ---------- Companies ----------

const COMPANIES = [
  // United States
  { id: uuidv4(), name: 'Lockheed Martin',   sector: 'defense',        country: 'US', description: 'Global aerospace and defense corporation' },
  { id: uuidv4(), name: 'Tesla',             sector: 'ev',             country: 'US', description: 'Electric vehicle and clean energy company' },
  { id: uuidv4(), name: 'Intel',             sector: 'semiconductors', country: 'US', description: 'Global semiconductor and computing technology leader' },
  // South Korea
  { id: uuidv4(), name: 'Samsung',           sector: 'electronics',    country: 'KR', description: 'Multinational electronics and semiconductor conglomerate' },
  { id: uuidv4(), name: 'LG Energy Solution',sector: 'batteries',      country: 'KR', description: 'Major EV battery manufacturer' },
  // Australia
  { id: uuidv4(), name: 'Rio Tinto',         sector: 'mining',         country: 'AU', description: 'Global mining company specializing in critical minerals extraction' },
  { id: uuidv4(), name: 'BHP',               sector: 'mining',         country: 'AU', description: 'World\'s largest diversified mining company' },
  // Taiwan
  { id: uuidv4(), name: 'TSMC',              sector: 'semiconductors', country: 'TW', description: 'World\'s largest dedicated semiconductor foundry' },
  // China
  { id: uuidv4(), name: 'CATL',              sector: 'batteries',      country: 'CN', description: 'World\'s largest EV battery manufacturer' },
  { id: uuidv4(), name: 'Sinopec',           sector: 'energy',         country: 'CN', description: 'State-owned petroleum and chemical corporation' },
  { id: uuidv4(), name: 'China Minmetals',   sector: 'mining',         country: 'CN', description: 'State-owned metals and minerals conglomerate' },
  // Germany
  { id: uuidv4(), name: 'BMW',               sector: 'automotive',     country: 'DE', description: 'Premium automotive manufacturer transitioning to EVs' },
  { id: uuidv4(), name: 'BASF',              sector: 'chemicals',      country: 'DE', description: 'World\'s largest chemical producer' },
  { id: uuidv4(), name: 'Siemens',           sector: 'industrial',     country: 'DE', description: 'Global industrial manufacturing and energy technology' },
  // Japan
  { id: uuidv4(), name: 'Toyota',            sector: 'automotive',     country: 'JP', description: 'World\'s largest automotive manufacturer' },
  { id: uuidv4(), name: 'Sony',              sector: 'electronics',    country: 'JP', description: 'Global consumer electronics and entertainment company' },
  // United Kingdom
  { id: uuidv4(), name: 'BP',                sector: 'energy',         country: 'GB', description: 'Global oil and gas company transitioning to clean energy' },
  { id: uuidv4(), name: 'BAE Systems',       sector: 'defense',        country: 'GB', description: 'Major defense, security, and aerospace company' },
  // France
  { id: uuidv4(), name: 'TotalEnergies',     sector: 'energy',         country: 'FR', description: 'Major global energy company with renewables focus' },
  { id: uuidv4(), name: 'Airbus',            sector: 'aerospace',      country: 'FR', description: 'European multinational aerospace corporation' },
  // Russia
  { id: uuidv4(), name: 'Gazprom',           sector: 'energy',         country: 'RU', description: 'World\'s largest natural gas producer' },
  { id: uuidv4(), name: 'Nornickel',         sector: 'mining',         country: 'RU', description: 'World\'s largest producer of nickel and palladium' },
  // Brazil
  { id: uuidv4(), name: 'Vale',              sector: 'mining',         country: 'BR', description: 'World\'s largest iron ore and nickel producer' },
  { id: uuidv4(), name: 'Petrobras',         sector: 'energy',         country: 'BR', description: 'Brazilian multinational petroleum corporation' },
  // Canada
  { id: uuidv4(), name: 'Cameco',            sector: 'energy',         country: 'CA', description: 'World\'s largest publicly traded uranium producer' },
  { id: uuidv4(), name: 'Barrick Gold',      sector: 'mining',         country: 'CA', description: 'World\'s second-largest gold mining company' },
  // Chile
  { id: uuidv4(), name: 'Codelco',           sector: 'mining',         country: 'CL', description: 'World\'s largest copper producer' },
  { id: uuidv4(), name: 'SQM',               sector: 'mining',         country: 'CL', description: 'Leading lithium and specialty chemicals producer' },
  // Saudi Arabia
  { id: uuidv4(), name: 'Saudi Aramco',      sector: 'energy',         country: 'SA', description: 'World\'s largest oil producer and exporter' },
  // India
  { id: uuidv4(), name: 'Tata Steel',        sector: 'industrial_metals', country: 'IN', description: 'One of the world\'s largest steel producers' },
  { id: uuidv4(), name: 'Reliance Industries', sector: 'energy',       country: 'IN', description: 'India\'s largest conglomerate with energy and chemicals' },
  // South Africa
  { id: uuidv4(), name: 'Anglo American',    sector: 'mining',         country: 'ZA', description: 'Global mining company producing diamonds, platinum, copper' },
  // Indonesia
  { id: uuidv4(), name: 'Vale Indonesia',    sector: 'mining',         country: 'ID', description: 'Major nickel mining and processing company' },
  // Norway
  { id: uuidv4(), name: 'Equinor',           sector: 'energy',         country: 'NO', description: 'Norwegian energy company with global offshore operations' },
  // Israel
  { id: uuidv4(), name: 'Elbit Systems',     sector: 'defense',        country: 'IL', description: 'International defense electronics company' },
];

// ---------- Strategic Resources ----------
// 16 resources across 5 strategic categories.
// All fields are required for the updated resources table schema.

const RESOURCES = [
  // ── Critical Minerals ──────────────────────────────────────────
  {
    id: uuidv4(), name: 'Lithium',              category: 'critical_minerals',    unit: 'tonne',
    strategic_importance: 0.95, supply_risk: 0.80, geopolitical_sensitivity: 0.75,
    refining_dependency: 'battery_grade_processing',
    description: 'Essential for lithium-ion batteries; dominates EV and grid storage supply chains.',
  },
  {
    id: uuidv4(), name: 'Cobalt',               category: 'critical_minerals',    unit: 'tonne',
    strategic_importance: 0.90, supply_risk: 0.88, geopolitical_sensitivity: 0.88,
    refining_dependency: 'cobalt_refining',
    description: 'Critical battery cathode material; ~70% sourced from DRC — high geopolitical risk.',
  },
  {
    id: uuidv4(), name: 'Nickel',               category: 'critical_minerals',    unit: 'tonne',
    strategic_importance: 0.80, supply_risk: 0.65, geopolitical_sensitivity: 0.62,
    refining_dependency: 'nickel_smelting',
    description: 'High-energy battery cathode and stainless steel alloy input; growing EV demand.',
  },
  {
    id: uuidv4(), name: 'Graphite',             category: 'critical_minerals',    unit: 'tonne',
    strategic_importance: 0.75, supply_risk: 0.72, geopolitical_sensitivity: 0.82,
    refining_dependency: 'synthetic_graphite_processing',
    description: 'Dominant anode material for lithium-ion batteries; ~85% refined in China.',
  },
  {
    id: uuidv4(), name: 'Rare Earth Elements',  category: 'critical_minerals',    unit: 'tonne',
    strategic_importance: 0.95, supply_risk: 0.90, geopolitical_sensitivity: 0.95,
    refining_dependency: 'ree_separation_and_processing',
    description: 'Enables high-performance magnets, EV motors, defense avionics, and semiconductors.',
  },

  // ── Energy Resources ───────────────────────────────────────────
  {
    id: uuidv4(), name: 'Crude Oil',            category: 'energy_resources',     unit: 'barrel',
    strategic_importance: 0.90, supply_risk: 0.70, geopolitical_sensitivity: 0.87,
    refining_dependency: 'petroleum_refining',
    description: 'Primary global energy carrier and petrochemical feedstock; controls geopolitical power.',
  },
  {
    id: uuidv4(), name: 'Natural Gas',          category: 'energy_resources',     unit: 'MMBtu',
    strategic_importance: 0.85, supply_risk: 0.65, geopolitical_sensitivity: 0.76,
    refining_dependency: 'gas_processing_and_liquefaction',
    description: 'Fuel for power generation, industrial heating, and fertilizer synthesis.',
  },
  {
    id: uuidv4(), name: 'Uranium',              category: 'energy_resources',     unit: 'lb',
    strategic_importance: 0.80, supply_risk: 0.58, geopolitical_sensitivity: 0.92,
    refining_dependency: 'enrichment_and_fuel_fabrication',
    description: 'Nuclear fuel for baseload electricity; tightly controlled by non-proliferation regimes.',
  },

  // ── Industrial Metals ──────────────────────────────────────────
  {
    id: uuidv4(), name: 'Steel',                category: 'industrial_metals',    unit: 'tonne',
    strategic_importance: 0.85, supply_risk: 0.50, geopolitical_sensitivity: 0.55,
    refining_dependency: 'steelmaking',
    description: 'Foundation of industrial manufacturing: infrastructure, defense, automotive, construction.',
  },
  {
    id: uuidv4(), name: 'Aluminum',             category: 'industrial_metals',    unit: 'tonne',
    strategic_importance: 0.80, supply_risk: 0.52, geopolitical_sensitivity: 0.50,
    refining_dependency: 'aluminium_smelting',
    description: 'Lightweight structural metal for aerospace, EVs, packaging, and power lines.',
  },
  {
    id: uuidv4(), name: 'Copper',               category: 'industrial_metals',    unit: 'tonne',
    strategic_importance: 0.88, supply_risk: 0.62, geopolitical_sensitivity: 0.56,
    refining_dependency: 'copper_smelting_and_refining',
    description: 'Indispensable electrical conductor; demand grows with electrification and EV adoption.',
  },

  // ── Technology Materials ───────────────────────────────────────
  {
    id: uuidv4(), name: 'Semiconductors',       category: 'technology_materials', unit: 'wafer',
    strategic_importance: 0.98, supply_risk: 0.87, geopolitical_sensitivity: 0.92,
    refining_dependency: 'advanced_fab_processing',
    description: 'Foundation of all modern electronics, defense, AI, and automation systems.',
  },
  {
    id: uuidv4(), name: 'Silicon',              category: 'technology_materials', unit: 'tonne',
    strategic_importance: 0.85, supply_risk: 0.58, geopolitical_sensitivity: 0.65,
    refining_dependency: 'polysilicon_purification',
    description: 'Primary semiconductor substrate and solar cell material; precursor to chip manufacturing.',
  },
  {
    id: uuidv4(), name: 'Advanced Alloys',      category: 'technology_materials', unit: 'tonne',
    strategic_importance: 0.80, supply_risk: 0.70, geopolitical_sensitivity: 0.72,
    refining_dependency: 'specialty_alloy_processing',
    description: 'High-performance alloys for aerospace, defense, and precision manufacturing.',
  },

  // ── Strategic Environmental ────────────────────────────────────
  {
    id: uuidv4(), name: 'Water',                category: 'strategic_environmental', unit: 'cubic_meter',
    strategic_importance: 0.70, supply_risk: 0.55, geopolitical_sensitivity: 0.46,
    refining_dependency: 'industrial_water_treatment',
    description: 'Industrial process water for semiconductor fabs, mining, energy, and chemicals.',
  },
];

function getResourceId(name) {
  const r = RESOURCES.find((res) => res.name === name);
  return r ? r.id : null;
}

function getCompanyId(name) {
  const c = COMPANIES.find((co) => co.name === name);
  return c ? c.id : null;
}

// ---------- Company-Resource Dependencies ----------
// Each company maps to 6–10 strategic resources with dependency_score 0–1.

const COMPANY_RESOURCES = [
  // Lockheed Martin — defense
  { company: 'Lockheed Martin', resource: 'Rare Earth Elements', dependency: 0.90 },
  { company: 'Lockheed Martin', resource: 'Semiconductors',      dependency: 0.88 },
  { company: 'Lockheed Martin', resource: 'Advanced Alloys',     dependency: 0.82 },
  { company: 'Lockheed Martin', resource: 'Steel',               dependency: 0.70 },
  { company: 'Lockheed Martin', resource: 'Aluminum',            dependency: 0.62 },
  { company: 'Lockheed Martin', resource: 'Copper',              dependency: 0.58 },
  { company: 'Lockheed Martin', resource: 'Uranium',             dependency: 0.42 },
  { company: 'Lockheed Martin', resource: 'Graphite',            dependency: 0.50 },
  { company: 'Lockheed Martin', resource: 'Crude Oil',           dependency: 0.48 },
  { company: 'Lockheed Martin', resource: 'Nickel',              dependency: 0.44 },

  // Tesla — EV
  { company: 'Tesla', resource: 'Lithium',             dependency: 0.94 },
  { company: 'Tesla', resource: 'Cobalt',              dependency: 0.82 },
  { company: 'Tesla', resource: 'Nickel',              dependency: 0.80 },
  { company: 'Tesla', resource: 'Graphite',            dependency: 0.74 },
  { company: 'Tesla', resource: 'Copper',              dependency: 0.76 },
  { company: 'Tesla', resource: 'Semiconductors',      dependency: 0.86 },
  { company: 'Tesla', resource: 'Rare Earth Elements', dependency: 0.72 },
  { company: 'Tesla', resource: 'Silicon',             dependency: 0.50 },
  { company: 'Tesla', resource: 'Steel',               dependency: 0.55 },
  { company: 'Tesla', resource: 'Aluminum',            dependency: 0.60 },

  // Samsung — electronics
  { company: 'Samsung', resource: 'Semiconductors',      dependency: 0.96 },
  { company: 'Samsung', resource: 'Silicon',             dependency: 0.78 },
  { company: 'Samsung', resource: 'Rare Earth Elements', dependency: 0.74 },
  { company: 'Samsung', resource: 'Copper',              dependency: 0.60 },
  { company: 'Samsung', resource: 'Cobalt',              dependency: 0.48 },
  { company: 'Samsung', resource: 'Lithium',             dependency: 0.62 },
  { company: 'Samsung', resource: 'Nickel',              dependency: 0.52 },
  { company: 'Samsung', resource: 'Natural Gas',         dependency: 0.40 },
  { company: 'Samsung', resource: 'Water',               dependency: 0.68 },
  { company: 'Samsung', resource: 'Graphite',            dependency: 0.44 },

  // Rio Tinto — mining
  { company: 'Rio Tinto', resource: 'Copper',              dependency: 0.92 },
  { company: 'Rio Tinto', resource: 'Nickel',              dependency: 0.85 },
  { company: 'Rio Tinto', resource: 'Cobalt',              dependency: 0.78 },
  { company: 'Rio Tinto', resource: 'Lithium',             dependency: 0.72 },
  { company: 'Rio Tinto', resource: 'Rare Earth Elements', dependency: 0.65 },
  { company: 'Rio Tinto', resource: 'Steel',               dependency: 0.55 },
  { company: 'Rio Tinto', resource: 'Aluminum',            dependency: 0.88 },
  { company: 'Rio Tinto', resource: 'Crude Oil',           dependency: 0.45 },
  { company: 'Rio Tinto', resource: 'Natural Gas',         dependency: 0.38 },
  { company: 'Rio Tinto', resource: 'Water',               dependency: 0.62 },

  // TSMC — semiconductors
  { company: 'TSMC', resource: 'Semiconductors',      dependency: 0.98 },
  { company: 'TSMC', resource: 'Silicon',             dependency: 0.92 },
  { company: 'TSMC', resource: 'Rare Earth Elements', dependency: 0.88 },
  { company: 'TSMC', resource: 'Copper',              dependency: 0.72 },
  { company: 'TSMC', resource: 'Natural Gas',         dependency: 0.52 },
  { company: 'TSMC', resource: 'Cobalt',              dependency: 0.44 },
  { company: 'TSMC', resource: 'Nickel',              dependency: 0.40 },
  { company: 'TSMC', resource: 'Water',               dependency: 0.75 },
  { company: 'TSMC', resource: 'Advanced Alloys',     dependency: 0.55 },
  { company: 'TSMC', resource: 'Graphite',            dependency: 0.48 },

  // Intel — semiconductors (US)
  { company: 'Intel', resource: 'Semiconductors',      dependency: 0.97 },
  { company: 'Intel', resource: 'Silicon',             dependency: 0.90 },
  { company: 'Intel', resource: 'Rare Earth Elements', dependency: 0.80 },
  { company: 'Intel', resource: 'Copper',              dependency: 0.68 },
  { company: 'Intel', resource: 'Water',               dependency: 0.72 },

  // LG Energy Solution — batteries (KR)
  { company: 'LG Energy Solution', resource: 'Lithium',             dependency: 0.90 },
  { company: 'LG Energy Solution', resource: 'Cobalt',              dependency: 0.85 },
  { company: 'LG Energy Solution', resource: 'Nickel',              dependency: 0.82 },
  { company: 'LG Energy Solution', resource: 'Graphite',            dependency: 0.78 },
  { company: 'LG Energy Solution', resource: 'Copper',              dependency: 0.60 },

  // BHP — mining (AU)
  { company: 'BHP', resource: 'Copper',              dependency: 0.88 },
  { company: 'BHP', resource: 'Nickel',              dependency: 0.80 },
  { company: 'BHP', resource: 'Steel',               dependency: 0.75 },
  { company: 'BHP', resource: 'Crude Oil',           dependency: 0.50 },
  { company: 'BHP', resource: 'Natural Gas',         dependency: 0.55 },

  // CATL — batteries (CN)
  { company: 'CATL', resource: 'Lithium',             dependency: 0.95 },
  { company: 'CATL', resource: 'Cobalt',              dependency: 0.88 },
  { company: 'CATL', resource: 'Nickel',              dependency: 0.85 },
  { company: 'CATL', resource: 'Graphite',            dependency: 0.82 },
  { company: 'CATL', resource: 'Rare Earth Elements', dependency: 0.70 },

  // Sinopec — energy (CN)
  { company: 'Sinopec', resource: 'Crude Oil',   dependency: 0.95 },
  { company: 'Sinopec', resource: 'Natural Gas', dependency: 0.80 },
  { company: 'Sinopec', resource: 'Steel',       dependency: 0.55 },
  { company: 'Sinopec', resource: 'Aluminum',    dependency: 0.45 },

  // China Minmetals — mining (CN)
  { company: 'China Minmetals', resource: 'Rare Earth Elements', dependency: 0.92 },
  { company: 'China Minmetals', resource: 'Copper',              dependency: 0.80 },
  { company: 'China Minmetals', resource: 'Graphite',            dependency: 0.85 },
  { company: 'China Minmetals', resource: 'Cobalt',              dependency: 0.70 },
  { company: 'China Minmetals', resource: 'Nickel',              dependency: 0.65 },

  // BMW — automotive (DE)
  { company: 'BMW', resource: 'Lithium',             dependency: 0.82 },
  { company: 'BMW', resource: 'Cobalt',              dependency: 0.75 },
  { company: 'BMW', resource: 'Rare Earth Elements', dependency: 0.68 },
  { company: 'BMW', resource: 'Steel',               dependency: 0.78 },
  { company: 'BMW', resource: 'Aluminum',            dependency: 0.72 },
  { company: 'BMW', resource: 'Semiconductors',      dependency: 0.80 },

  // BASF — chemicals (DE)
  { company: 'BASF', resource: 'Natural Gas',  dependency: 0.88 },
  { company: 'BASF', resource: 'Crude Oil',    dependency: 0.82 },
  { company: 'BASF', resource: 'Nickel',       dependency: 0.60 },
  { company: 'BASF', resource: 'Cobalt',       dependency: 0.55 },
  { company: 'BASF', resource: 'Water',        dependency: 0.70 },

  // Siemens — industrial (DE)
  { company: 'Siemens', resource: 'Copper',              dependency: 0.75 },
  { company: 'Siemens', resource: 'Rare Earth Elements', dependency: 0.70 },
  { company: 'Siemens', resource: 'Steel',               dependency: 0.65 },
  { company: 'Siemens', resource: 'Semiconductors',      dependency: 0.72 },
  { company: 'Siemens', resource: 'Advanced Alloys',     dependency: 0.60 },

  // Toyota — automotive (JP)
  { company: 'Toyota', resource: 'Steel',               dependency: 0.82 },
  { company: 'Toyota', resource: 'Aluminum',            dependency: 0.75 },
  { company: 'Toyota', resource: 'Rare Earth Elements', dependency: 0.72 },
  { company: 'Toyota', resource: 'Lithium',             dependency: 0.68 },
  { company: 'Toyota', resource: 'Semiconductors',      dependency: 0.78 },
  { company: 'Toyota', resource: 'Copper',              dependency: 0.60 },

  // Sony — electronics (JP)
  { company: 'Sony', resource: 'Semiconductors',      dependency: 0.90 },
  { company: 'Sony', resource: 'Rare Earth Elements', dependency: 0.75 },
  { company: 'Sony', resource: 'Cobalt',              dependency: 0.62 },
  { company: 'Sony', resource: 'Lithium',             dependency: 0.65 },
  { company: 'Sony', resource: 'Copper',              dependency: 0.55 },

  // BP — energy (GB)
  { company: 'BP', resource: 'Crude Oil',   dependency: 0.92 },
  { company: 'BP', resource: 'Natural Gas', dependency: 0.85 },
  { company: 'BP', resource: 'Steel',       dependency: 0.50 },
  { company: 'BP', resource: 'Aluminum',    dependency: 0.40 },

  // BAE Systems — defense (GB)
  { company: 'BAE Systems', resource: 'Rare Earth Elements', dependency: 0.88 },
  { company: 'BAE Systems', resource: 'Semiconductors',      dependency: 0.85 },
  { company: 'BAE Systems', resource: 'Advanced Alloys',     dependency: 0.82 },
  { company: 'BAE Systems', resource: 'Steel',               dependency: 0.70 },
  { company: 'BAE Systems', resource: 'Aluminum',            dependency: 0.65 },

  // TotalEnergies — energy (FR)
  { company: 'TotalEnergies', resource: 'Crude Oil',   dependency: 0.90 },
  { company: 'TotalEnergies', resource: 'Natural Gas', dependency: 0.82 },
  { company: 'TotalEnergies', resource: 'Lithium',     dependency: 0.45 },
  { company: 'TotalEnergies', resource: 'Cobalt',      dependency: 0.40 },

  // Airbus — aerospace (FR)
  { company: 'Airbus', resource: 'Aluminum',            dependency: 0.88 },
  { company: 'Airbus', resource: 'Advanced Alloys',     dependency: 0.85 },
  { company: 'Airbus', resource: 'Rare Earth Elements', dependency: 0.78 },
  { company: 'Airbus', resource: 'Semiconductors',      dependency: 0.72 },
  { company: 'Airbus', resource: 'Steel',               dependency: 0.60 },

  // Gazprom — energy (RU)
  { company: 'Gazprom', resource: 'Natural Gas', dependency: 0.98 },
  { company: 'Gazprom', resource: 'Crude Oil',   dependency: 0.70 },
  { company: 'Gazprom', resource: 'Steel',       dependency: 0.60 },

  // Nornickel — mining (RU)
  { company: 'Nornickel', resource: 'Nickel',   dependency: 0.95 },
  { company: 'Nornickel', resource: 'Cobalt',   dependency: 0.80 },
  { company: 'Nornickel', resource: 'Copper',   dependency: 0.75 },

  // Vale — mining (BR)
  { company: 'Vale', resource: 'Nickel',   dependency: 0.88 },
  { company: 'Vale', resource: 'Copper',   dependency: 0.72 },
  { company: 'Vale', resource: 'Steel',    dependency: 0.80 },
  { company: 'Vale', resource: 'Cobalt',   dependency: 0.60 },

  // Petrobras — energy (BR)
  { company: 'Petrobras', resource: 'Crude Oil',   dependency: 0.95 },
  { company: 'Petrobras', resource: 'Natural Gas', dependency: 0.75 },
  { company: 'Petrobras', resource: 'Steel',       dependency: 0.50 },

  // Cameco — uranium (CA)
  { company: 'Cameco', resource: 'Uranium',     dependency: 0.98 },
  { company: 'Cameco', resource: 'Water',       dependency: 0.65 },
  { company: 'Cameco', resource: 'Steel',       dependency: 0.45 },

  // Barrick Gold — mining (CA)
  { company: 'Barrick Gold', resource: 'Copper',    dependency: 0.70 },
  { company: 'Barrick Gold', resource: 'Steel',     dependency: 0.60 },
  { company: 'Barrick Gold', resource: 'Crude Oil', dependency: 0.45 },

  // Codelco — mining (CL)
  { company: 'Codelco', resource: 'Copper',    dependency: 0.98 },
  { company: 'Codelco', resource: 'Steel',     dependency: 0.60 },
  { company: 'Codelco', resource: 'Water',     dependency: 0.70 },

  // SQM — mining (CL)
  { company: 'SQM', resource: 'Lithium',   dependency: 0.96 },
  { company: 'SQM', resource: 'Copper',    dependency: 0.55 },
  { company: 'SQM', resource: 'Water',     dependency: 0.75 },

  // Saudi Aramco — energy (SA)
  { company: 'Saudi Aramco', resource: 'Crude Oil',   dependency: 0.98 },
  { company: 'Saudi Aramco', resource: 'Natural Gas', dependency: 0.80 },
  { company: 'Saudi Aramco', resource: 'Steel',       dependency: 0.55 },

  // Tata Steel — industrial metals (IN)
  { company: 'Tata Steel', resource: 'Steel',    dependency: 0.95 },
  { company: 'Tata Steel', resource: 'Natural Gas', dependency: 0.70 },
  { company: 'Tata Steel', resource: 'Aluminum',    dependency: 0.55 },

  // Reliance Industries — energy (IN)
  { company: 'Reliance Industries', resource: 'Crude Oil',   dependency: 0.88 },
  { company: 'Reliance Industries', resource: 'Natural Gas', dependency: 0.72 },
  { company: 'Reliance Industries', resource: 'Copper',      dependency: 0.45 },

  // Anglo American — mining (ZA)
  { company: 'Anglo American', resource: 'Copper',              dependency: 0.85 },
  { company: 'Anglo American', resource: 'Nickel',              dependency: 0.72 },
  { company: 'Anglo American', resource: 'Rare Earth Elements', dependency: 0.65 },
  { company: 'Anglo American', resource: 'Cobalt',              dependency: 0.60 },

  // Vale Indonesia — mining (ID)
  { company: 'Vale Indonesia', resource: 'Nickel',   dependency: 0.95 },
  { company: 'Vale Indonesia', resource: 'Cobalt',   dependency: 0.70 },
  { company: 'Vale Indonesia', resource: 'Water',    dependency: 0.60 },

  // Equinor — energy (NO)
  { company: 'Equinor', resource: 'Natural Gas', dependency: 0.90 },
  { company: 'Equinor', resource: 'Crude Oil',   dependency: 0.85 },

  // Elbit Systems — defense (IL)
  { company: 'Elbit Systems', resource: 'Semiconductors',      dependency: 0.88 },
  { company: 'Elbit Systems', resource: 'Rare Earth Elements', dependency: 0.82 },
  { company: 'Elbit Systems', resource: 'Advanced Alloys',     dependency: 0.75 },
];

// ---------- Initial Risk Metrics ----------
// Realistic baseline scores (0–100) for each strategic resource.

const INITIAL_METRICS = [
  // Critical Minerals
  { resource: 'Lithium',             demand: 82, supply: 68, geopolitical: 72, environmental: 48 },
  { resource: 'Cobalt',              demand: 78, supply: 72, geopolitical: 85, environmental: 52 },
  { resource: 'Nickel',              demand: 70, supply: 60, geopolitical: 58, environmental: 45 },
  { resource: 'Graphite',            demand: 74, supply: 76, geopolitical: 80, environmental: 50 },
  { resource: 'Rare Earth Elements', demand: 80, supply: 82, geopolitical: 88, environmental: 44 },
  // Energy Resources
  { resource: 'Crude Oil',           demand: 75, supply: 60, geopolitical: 85, environmental: 62 },
  { resource: 'Natural Gas',         demand: 68, supply: 55, geopolitical: 74, environmental: 55 },
  { resource: 'Uranium',             demand: 55, supply: 58, geopolitical: 90, environmental: 58 },
  // Industrial Metals
  { resource: 'Steel',               demand: 65, supply: 50, geopolitical: 48, environmental: 40 },
  { resource: 'Aluminum',            demand: 62, supply: 52, geopolitical: 44, environmental: 42 },
  { resource: 'Copper',              demand: 72, supply: 58, geopolitical: 52, environmental: 38 },
  // Technology Materials
  { resource: 'Semiconductors',      demand: 90, supply: 78, geopolitical: 88, environmental: 32 },
  { resource: 'Silicon',             demand: 78, supply: 65, geopolitical: 62, environmental: 35 },
  { resource: 'Advanced Alloys',     demand: 72, supply: 68, geopolitical: 68, environmental: 38 },
  // Strategic Environmental
  { resource: 'Water',               demand: 60, supply: 55, geopolitical: 42, environmental: 70 },
];

// ---------- Seed functions ----------

// DB-resolved name → id maps (populated after upsert)
let companyIdMap = {};
let resourceIdMap = {};

async function seedCompanies() {
  console.log('Seeding companies...');
  const records = COMPANIES.map((c) => ({
    id: c.id,
    name: c.name,
    sector: c.sector,
    country: c.country,
    description: c.description,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('companies').upsert(records, { onConflict: 'name', ignoreDuplicates: true });
  if (error) throw new Error(`Companies seed failed: ${error.message}`);

  // Fetch real IDs from DB (existing rows keep their original IDs)
  const { data: rows, error: fetchErr } = await supabase.from('companies').select('id, name');
  if (fetchErr) throw new Error(`Companies fetch failed: ${fetchErr.message}`);
  for (const row of rows || []) companyIdMap[row.name] = row.id;
  console.log(`  Seeded ${Object.keys(companyIdMap).length} companies`);
}

async function seedResources() {
  console.log('Seeding strategic resources...');
  const records = RESOURCES.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    description: r.description,
    strategic_importance: r.strategic_importance,
    supply_risk: r.supply_risk,
    geopolitical_sensitivity: r.geopolitical_sensitivity,
    refining_dependency: r.refining_dependency,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('resources').upsert(records, { onConflict: 'name', ignoreDuplicates: true });
  if (error) throw new Error(`Resources seed failed: ${error.message}`);

  // Fetch real IDs from DB
  const { data: rows, error: fetchErr } = await supabase.from('resources').select('id, name');
  if (fetchErr) throw new Error(`Resources fetch failed: ${fetchErr.message}`);
  for (const row of rows || []) resourceIdMap[row.name] = row.id;
  console.log(`  Seeded ${Object.keys(resourceIdMap).length} resources`);
}

async function seedCompanyResources() {
  console.log('Seeding company-resource mappings...');
  const records = COMPANY_RESOURCES.map((cr) => ({
    id: uuidv4(),
    company_id: companyIdMap[cr.company],
    resource_id: resourceIdMap[cr.resource],
    dependency_score: cr.dependency,
    created_at: new Date().toISOString(),
  })).filter((r) => r.company_id && r.resource_id);

  const skipped = COMPANY_RESOURCES.length - records.length;
  if (skipped > 0) console.warn(`  Skipping ${skipped} mappings (unresolved company/resource name)`);

  // Insert only new mappings (skip duplicate company+resource pairs)
  const { error } = await supabase.from('company_resources')
    .upsert(records, { onConflict: 'company_id,resource_id', ignoreDuplicates: true });
  if (error) throw new Error(`Company resources seed failed: ${error.message}`);
  console.log(`  Seeded ${records.length} company-resource mappings`);
}

async function seedRiskMetrics() {
  console.log('Seeding risk metrics...');
  const records = INITIAL_METRICS.map((m) => ({
    resource_id: resourceIdMap[m.resource],
    demand_index: m.demand,
    supply_index: m.supply,
    geopolitical_index: m.geopolitical,
    environmental_index: m.environmental,
    updated_at: new Date().toISOString(),
  })).filter((r) => r.resource_id);

  const { error } = await supabase.from('risk_metrics').upsert(records, { onConflict: 'resource_id' });
  if (error) throw new Error(`Risk metrics seed failed: ${error.message}`);
  console.log(`  Seeded ${records.length} risk metrics`);
}

async function seedSnapshot() {
  console.log('Seeding initial data snapshot...');
  const snapshot = {
    id: uuidv4(),
    source: 'seed_v2_strategic',
    data: {
      seed_date: new Date().toISOString(),
      companies: COMPANIES.length,
      resources: RESOURCES.length,
      mappings: COMPANY_RESOURCES.length,
      categories: [...new Set(RESOURCES.map(r => r.category))],
      description: 'Strategic resource system seed for DIRE-X (migration 001)',
    },
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('data_snapshots').insert(snapshot);
  if (error) throw new Error(`Snapshot seed failed: ${error.message}`);
  console.log(`  Snapshot created: ${snapshot.id}`);
}

// ---------- Main ----------

(async () => {
  console.log('=== DIRE-X Strategic Resource Seed (v2) ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  try {
    await seedCompanies();
    await seedResources();
    await seedCompanyResources();
    await seedRiskMetrics();
    await seedSnapshot();

    console.log('');
    console.log('=== Seed Complete ===');
    console.log(`Companies  : ${COMPANIES.length}`);
    console.log(`Resources  : ${RESOURCES.length} (strategic only)`);
    console.log(`Mappings   : ${COMPANY_RESOURCES.length}`);
    console.log(`Metrics    : ${INITIAL_METRICS.length}`);
    process.exit(0);
  } catch (err) {
    console.error('');
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
