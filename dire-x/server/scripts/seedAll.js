#!/usr/bin/env node
// ============================================
// DIRE-X Master Seed — Loads ALL data to Supabase
// Run monthly: node scripts/seedAll.js
//
// Seeds: countries (120), companies (80), resources (16),
//        company_resources (200+), risk_metrics (16)
//
// Idempotent: uses upsert — safe to re-run anytime
// ============================================

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { COUNTRIES } = require('../data/countries');
const { COMPANIES } = require('../data/companies');
const { RESOURCES, COMPANY_RESOURCE_MAP, INITIAL_RISK_METRICS } = require('../data/resources');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const log = (msg) => console.log(`[Seed] ${msg}`);
const warn = (msg) => console.warn(`[Seed] ⚠ ${msg}`);

async function seedCountries() {
  log(`Seeding ${COUNTRIES.length} countries...`);

  // Use only columns that exist in the current countries_master schema
  const records = COUNTRIES.map(c => ({
    code: c.code,
    code2: c.code2,
    name: c.name,
    region: c.region,
    gdp: c.gdp,
    population: c.population,
    growth_rate: c.growth,
    gdp_norm: 0,
    eco_score: 0,
    last_updated: new Date().toISOString(),
  }));

  // Compute normalized fields
  const maxGdp = Math.max(...records.map(r => r.gdp));
  for (const r of records) {
    r.gdp_norm = Math.round((r.gdp / maxGdp) * 10000) / 10000;
    // Eco score: 50% GDP weight + 30% growth + 20% stability(inverse risk)
    const growthNorm = Math.min(1, Math.max(0, (r.growth_rate + 5) / 15));
    const stabilityNorm = 1 - r.risk_score;
    r.eco_score = Math.round((r.gdp_norm * 0.5 + growthNorm * 0.3 + stabilityNorm * 0.2) * 10000) / 10000;
  }

  // Batch upsert in chunks of 50
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await supabase
      .from('countries_master')
      .upsert(batch, { onConflict: 'code' });
    if (error) {
      warn(`Countries batch ${i}-${i + batch.length} failed: ${error.message}`);
    }
  }

  log(`✓ ${records.length} countries seeded`);
  return records.length;
}

async function seedResources() {
  log(`Seeding ${RESOURCES.length} resources...`);

  // Use only columns that exist in the current schema
  // New columns (baseline_price_usd, producer_concentration) need ALTER TABLE first
  const records = RESOURCES.map(r => ({
    name: r.name,
    category: r.category,
    unit: r.unit,
    strategic_importance: r.strategic_importance,
    supply_risk: r.supply_risk,
    geopolitical_sensitivity: r.geopolitical_sensitivity,
    refining_dependency: r.refining_dependency,
    description: r.description,
  }));

  const { error } = await supabase
    .from('resources')
    .upsert(records, { onConflict: 'name', ignoreDuplicates: false });

  if (error) {
    warn(`Resources upsert failed: ${error.message}`);
    // Fallback: try one by one
    let ok = 0;
    for (const r of records) {
      const { error: e2 } = await supabase.from('resources').upsert(r, { onConflict: 'name' });
      if (!e2) ok++;
    }
    log(`✓ ${ok}/${records.length} resources seeded (fallback mode)`);
    return ok;
  }

  log(`✓ ${records.length} resources seeded`);
  return records.length;
}

async function seedCompanies() {
  log(`Seeding ${COMPANIES.length} companies...`);

  const records = COMPANIES.map(c => ({
    name: c.name,
    sector: c.sector,
    country: c.country,
    description: c.description,
  }));

  const { error } = await supabase
    .from('companies')
    .upsert(records, { onConflict: 'name', ignoreDuplicates: false });

  if (error) {
    warn(`Companies upsert failed: ${error.message}`);
    let ok = 0;
    for (const r of records) {
      const { error: e2 } = await supabase.from('companies').upsert(r, { onConflict: 'name' });
      if (!e2) ok++;
    }
    log(`✓ ${ok}/${records.length} companies seeded (fallback mode)`);
    return ok;
  }

  log(`✓ ${records.length} companies seeded`);
  return records.length;
}

async function seedCompanyResources() {
  log('Seeding company → resource mappings...');

  // Fetch real IDs from DB
  const { data: dbCompanies } = await supabase.from('companies').select('id, name');
  const { data: dbResources } = await supabase.from('resources').select('id, name');

  if (!dbCompanies || !dbResources) {
    warn('Could not fetch companies/resources from DB — skipping mappings');
    return 0;
  }

  const companyMap = {};
  for (const c of dbCompanies) companyMap[c.name] = c.id;

  const resourceMap = {};
  for (const r of dbResources) resourceMap[r.name] = r.id;

  const records = [];
  for (const [companyName, deps] of Object.entries(COMPANY_RESOURCE_MAP)) {
    const companyId = companyMap[companyName];
    if (!companyId) continue;

    for (const dep of deps) {
      const resourceId = resourceMap[dep.r];
      if (!resourceId) continue;

      records.push({
        company_id: companyId,
        resource_id: resourceId,
        dependency_score: dep.d,
      });
    }
  }

  // Batch upsert
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await supabase
      .from('company_resources')
      .upsert(batch, { onConflict: 'company_id,resource_id' });
    if (error) {
      warn(`Company-resources batch ${i} failed: ${error.message}`);
    }
  }

  log(`✓ ${records.length} company-resource mappings seeded`);
  return records.length;
}

async function seedRiskMetrics() {
  log('Seeding risk metrics...');

  const { data: dbResources } = await supabase.from('resources').select('id, name');
  if (!dbResources) {
    warn('Could not fetch resources — skipping risk metrics');
    return 0;
  }

  const resourceMap = {};
  for (const r of dbResources) resourceMap[r.name] = r.id;

  const records = [];
  for (const [name, metrics] of Object.entries(INITIAL_RISK_METRICS)) {
    const resourceId = resourceMap[name];
    if (!resourceId) continue;

    records.push({
      resource_id: resourceId,
      demand_index: metrics.demand,
      supply_index: metrics.supply,
      geopolitical_index: metrics.geopolitical,
      environmental_index: metrics.environmental,
      updated_at: new Date().toISOString(),
    });
  }

  const { error } = await supabase
    .from('risk_metrics')
    .upsert(records, { onConflict: 'resource_id' });

  if (error) {
    warn(`Risk metrics upsert failed: ${error.message}`);
    return 0;
  }

  log(`✓ ${records.length} risk metrics seeded`);
  return records.length;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const start = Date.now();
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   DIRE-X Master Seed v2.0            ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const results = {};

  try {
    results.countries = await seedCountries();
  } catch (err) {
    warn(`Countries failed: ${err.message}`);
    results.countries = 0;
  }

  try {
    results.resources = await seedResources();
  } catch (err) {
    warn(`Resources failed: ${err.message}`);
    results.resources = 0;
  }

  try {
    results.companies = await seedCompanies();
  } catch (err) {
    warn(`Companies failed: ${err.message}`);
    results.companies = 0;
  }

  try {
    results.companyResources = await seedCompanyResources();
  } catch (err) {
    warn(`Company-resources failed: ${err.message}`);
    results.companyResources = 0;
  }

  try {
    results.riskMetrics = await seedRiskMetrics();
  } catch (err) {
    warn(`Risk metrics failed: ${err.message}`);
    results.riskMetrics = 0;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('');
  console.log('─── Seed Results ───────────────────────');
  console.log(`  Countries:          ${results.countries}`);
  console.log(`  Resources:          ${results.resources}`);
  console.log(`  Companies:          ${results.companies}`);
  console.log(`  Company-Resources:  ${results.companyResources}`);
  console.log(`  Risk Metrics:       ${results.riskMetrics}`);
  console.log(`  Elapsed:            ${elapsed}s`);
  console.log('────────────────────────────────────────');
  console.log('');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
