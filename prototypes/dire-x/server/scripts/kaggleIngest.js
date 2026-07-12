#!/usr/bin/env node
// ============================================
// DIRE-X Kaggle Data Ingestion Pipeline
// Fetches real-world datasets from Kaggle and loads into Supabase
//
// Usage:
//   node scripts/kaggleIngest.js                  # Run all ingestions
//   node scripts/kaggleIngest.js --only=gdp       # Run specific module
//   node scripts/kaggleIngest.js --only=minerals
//   node scripts/kaggleIngest.js --only=trade
//   node scripts/kaggleIngest.js --only=risk
//   node scripts/kaggleIngest.js --only=commodity
//   node scripts/kaggleIngest.js --only=military
//   node scripts/kaggleIngest.js --only=labor
//   node scripts/kaggleIngest.js --only=esg
//   node scripts/kaggleIngest.js --only=companies
//
// Prerequisites:
//   1. Install Kaggle CLI: pip install kaggle
//   2. Place kaggle.json in ~/.kaggle/ (from kaggle.com → Account → API)
//   3. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env
// ============================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DOWNLOAD_DIR = path.join(__dirname, '..', '.kaggle-data');
const log = (tag, msg) => console.log(`[Kaggle:${tag}] ${msg}`);
const warn = (tag, msg) => console.warn(`[Kaggle:${tag}] ⚠ ${msg}`);

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadDataset(slug, outputDir) {
  ensureDir(outputDir);
  log('DL', `Downloading ${slug}...`);
  try {
    execSync(`kaggle datasets download -d ${slug} --unzip -p "${outputDir}"`, {
      stdio: 'pipe', timeout: 120_000,
    });
    log('DL', `✓ ${slug} downloaded`);
    return true;
  } catch (e) {
    warn('DL', `Failed to download ${slug}: ${e.message?.substring(0, 200)}`);
    return false;
  }
}

function readCSV(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    warn('CSV', `File not found: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    ...options,
  });
}

function findCSV(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));
  if (pattern) {
    const match = files.find(f => f.toLowerCase().includes(pattern.toLowerCase()));
    if (match) return path.join(dir, match);
  }
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

function findXLSX(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  if (pattern) {
    const match = files.find(f => f.toLowerCase().includes(pattern.toLowerCase()));
    if (match) return path.join(dir, match);
  }
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

function readXLSX(filePath, sheetIndex = 0) {
  if (!fs.existsSync(filePath)) { warn('XLSX', `File not found: ${filePath}`); return []; }
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[sheetIndex]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function readCSVWithBOM(filePath, options = {}) {
  if (!fs.existsSync(filePath)) { warn('CSV', `File not found: ${filePath}`); return []; }
  let content = fs.readFileSync(filePath, 'utf8');
  // Strip UTF-8 BOM
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  return parse(content, {
    columns: true, skip_empty_lines: true, trim: true,
    relax_column_count: true, relax_quotes: true, ...options,
  });
}

function num(val) {
  if (val == null || val === '' || val === 'N/A' || val === '..') return null;
  const n = Number(String(val).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

// ISO country name → code mapping (common ones for joins)
const COUNTRY_NAME_TO_CODE = {
  'united states': 'USA', 'united states of america': 'USA',
  'china': 'CHN', "china, people's republic of": 'CHN',
  'japan': 'JPN', 'germany': 'DEU', 'india': 'IND',
  'united kingdom': 'GBR', 'france': 'FRA', 'italy': 'ITA',
  'brazil': 'BRA', 'canada': 'CAN', 'russia': 'RUS',
  'russian federation': 'RUS', 'korea, republic of': 'KOR',
  'south korea': 'KOR', 'australia': 'AUS', 'spain': 'ESP',
  'mexico': 'MEX', 'indonesia': 'IDN', 'netherlands': 'NLD',
  'saudi arabia': 'SAU', 'turkey': 'TUR', 'turkiye': 'TUR',
  'switzerland': 'CHE', 'poland': 'POL', 'taiwan': 'TWN',
  'taiwan, china': 'TWN', 'sweden': 'SWE', 'belgium': 'BEL',
  'argentina': 'ARG', 'norway': 'NOR', 'austria': 'AUT',
  'israel': 'ISR', 'ireland': 'IRL', 'nigeria': 'NGA',
  'south africa': 'ZAF', 'egypt': 'EGY', 'singapore': 'SGP',
  'malaysia': 'MYS', 'philippines': 'PHL', 'thailand': 'THA',
  'vietnam': 'VNM', 'colombia': 'COL', 'chile': 'CHL',
  'pakistan': 'PAK', 'bangladesh': 'BGD', 'peru': 'PER',
  'czech republic': 'CZE', 'czechia': 'CZE', 'romania': 'ROU',
  'portugal': 'PRT', 'new zealand': 'NZL', 'greece': 'GRC',
  'hungary': 'HUN', 'ukraine': 'UKR', 'kenya': 'KEN',
  'myanmar': 'MMR', 'democratic republic of the congo': 'COD',
  'congo, dem. rep.': 'COD', 'iran': 'IRN',
  'iran, islamic republic of': 'IRN', 'iraq': 'IRQ',
  'united arab emirates': 'ARE', 'qatar': 'QAT', 'kuwait': 'KWT',
  'morocco': 'MAR', 'ethiopia': 'ETH', 'tanzania': 'TZA',
  'ghana': 'GHA', 'algeria': 'DZA', 'angola': 'AGO',
  'finland': 'FIN', 'denmark': 'DNK', 'luxembourg': 'LUX',
  'north korea': 'PRK', "korea, dem. people's rep.": 'PRK',
};

function resolveCountryCode(name) {
  if (!name) return null;
  // Already a 3-letter code?
  if (/^[A-Z]{3}$/.test(name)) return name;
  return COUNTRY_NAME_TO_CODE[name.toLowerCase()] || null;
}

// ─── 1. GDP & Economic Indicators ─────────────────────────────────────────

async function ingestGDP() {
  const tag = 'GDP';
  const dir = path.join(DOWNLOAD_DIR, 'gdp');

  if (!downloadDataset('tanishksharma9905/global-economic-indicators-20102025', dir)) return;

  const csvPath = findCSV(dir);
  if (!csvPath) { warn(tag, 'No CSV found'); return; }

  const rows = readCSV(csvPath);
  log(tag, `Parsed ${rows.length} rows`);

  // Get latest year data per country
  const latestByCountry = new Map();
  for (const row of rows) {
    const country = row.country_name || row.Country || row['Country Name'];
    const year = num(row.year || row.Year);
    if (!country || !year) continue;

    const existing = latestByCountry.get(country);
    if (!existing || year > existing.year) {
      latestByCountry.set(country, { ...row, year, country });
    }
  }

  log(tag, `${latestByCountry.size} countries with latest-year data`);

  const updates = [];
  for (const [name, row] of latestByCountry) {
    const code = resolveCountryCode(name) || resolveCountryCode(row.country_id || row['Country Code']);
    if (!code) continue;

    const gdp = num(row['GDP (Current USD)'] || row.GDP || row.gdp);
    const growth = num(row['GDP Growth (% Annual)'] || row['GDP Growth'] || row.gdp_growth);
    const population = num(row.Population || row.population);
    const inflation = num(row['Inflation (CPI %)'] || row.Inflation || row.inflation);
    const unemployment = num(row['Unemployment Rate (%)'] || row.unemployment);
    const debt = num(row['Public Debt (% of GDP)'] || row.public_debt);

    updates.push({
      code,
      gdp: gdp ? Math.round(gdp / 1e9) : null,  // Convert to billions
      growth_rate: growth,
      population: population ? Math.round(population / 1e6) : null,  // Convert to millions
    });
  }

  log(tag, `Upserting ${updates.length} countries to DB...`);
  let updated = 0;
  for (const u of updates) {
    const updateFields = {};
    if (u.gdp != null) updateFields.gdp = u.gdp;
    if (u.growth_rate != null) updateFields.growth_rate = u.growth_rate;
    if (u.population != null) updateFields.population = u.population;
    updateFields.last_updated = new Date().toISOString();

    const { error } = await supabase
      .from('countries_master')
      .update(updateFields)
      .eq('code', u.code);
    if (!error) updated++;
  }
  log(tag, `✓ Updated ${updated} countries with real GDP data`);
}

// ─── 2. Minerals & Mining Data ────────────────────────────────────────────

async function ingestMinerals() {
  const tag = 'Minerals';
  const dir = path.join(DOWNLOAD_DIR, 'minerals');

  if (!downloadDataset('methoomirza/minerals-backbone-of-economy-world-mining-data', dir)) return;

  // This dataset has per-mineral Excel sheets in file 6.4
  const xlsxPath = findXLSX(dir, '6.4');
  if (!xlsxPath) { warn(tag, 'No 6.4 Excel file found'); return; }

  log(tag, `Reading ${path.basename(xlsxPath)}...`);
  const wb = XLSX.readFile(xlsxPath);

  // Map sheet names to our resource names
  const SHEET_MAP = {
    'cobalt': 'Cobalt', 'nickel': 'Nickel', 'copper': 'Copper',
    'graphite': 'Graphite', 'iron': 'Steel', 'aluminium': 'Aluminum',
    'aluminum': 'Aluminum', 'bauxite': 'Aluminum', 'lithium': 'Lithium',
    'uranium': 'Uranium', 'rare earth': 'Rare Earth Elements',
    'silicon': 'Silicon', 'titanium': 'Silicon',
  };

  // Aggregate production by resource and country
  const productionMap = new Map(); // resource -> [{country, production}]

  for (const sheetName of wb.SheetNames) {
    const sheetLower = sheetName.toLowerCase();
    const resourceName = Object.entries(SHEET_MAP).find(([k]) => sheetLower.includes(k))?.[1];
    if (!resourceName) continue;

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    // Row 0 = description, Row 1 = headers (Country, unit, years...), Row 2+ = data
    if (rows.length < 3) continue;

    // Use latest year column (index 6 = 2020, or last numeric column)
    const latestYearIdx = rows[1].findIndex((h, i) => i >= 2 && String(h) === '2020') || 6;

    for (let i = 2; i < rows.length; i++) {
      const country = rows[i][0];
      const production = num(rows[i][latestYearIdx] || rows[i][rows[i].length - 2]);
      if (!country || !production || String(country).toLowerCase().includes('total')) continue;

      if (!productionMap.has(resourceName)) productionMap.set(resourceName, []);
      productionMap.get(resourceName).push({ country, production });
    }
  }

  log(tag, `Mapped ${productionMap.size} resources from mining data`);

  // Calculate production shares and update risk metrics
  for (const [resource, producers] of productionMap) {
    const total = producers.reduce((s, p) => s + p.production, 0);
    const shares = producers
      .map(p => ({ country: p.country, share: p.production / total }))
      .sort((a, b) => b.share - a.share)
      .slice(0, 5);

    // Supply concentration = top producer share (higher = more concentrated = riskier)
    const topShare = shares[0]?.share || 0;
    const hhi = shares.reduce((s, p) => s + p.share * p.share, 0); // Herfindahl index
    const supplyConcentration = Math.round(hhi * 10000) / 100; // Convert to 0-100

    log(tag, `  ${resource}: top producer ${shares[0]?.country} (${Math.round(topShare*100)}%), HHI: ${supplyConcentration.toFixed(1)}`);

    // Update resource risk metrics via resource_id lookup
    const { data: resData } = await supabase
      .from('resources')
      .select('id')
      .eq('name', resource)
      .single();

    if (resData) {
      const { error } = await supabase
        .from('risk_metrics')
        .update({
          supply_index: Math.min(100, Math.round(supplyConcentration)),
          updated_at: new Date().toISOString(),
        })
        .eq('resource_id', resData.id);
      if (error) warn(tag, `  Update failed for ${resource}: ${error.message}`);
      else log(tag, `  ✓ Updated ${resource} supply_index = ${Math.round(supplyConcentration)}`);
    } else {
      warn(tag, `  Resource not found in DB: ${resource}`);
    }
  }

  log(tag, `✓ Minerals ingestion complete`);
}

// ─── 3. Trade Flows ──────────────────────────────────────────────────────

async function ingestTrade() {
  const tag = 'Trade';
  const dir = path.join(DOWNLOAD_DIR, 'trade');

  if (!downloadDataset('muhammadtalhaawan/world-export-and-import-dataset', dir)) return;

  const csvPath = findCSV(dir);
  if (!csvPath) { warn(tag, 'No CSV found'); return; }

  const rows = readCSV(csvPath);
  log(tag, `Parsed ${rows.length} rows`);

  // Aggregate trade volumes by country (latest year)
  const tradeByCountry = new Map();
  for (const row of rows) {
    const country = row['Partner Name'] || row.Country || row.country;
    const year = num(row.Year || row.year);
    const exports = num(row['Export (US$ Thousand)'] || row.exports);
    const imports = num(row['Import (US$ Thousand)'] || row.imports);

    if (!country || !year) continue;

    const existing = tradeByCountry.get(country);
    if (!existing || year > existing.year) {
      tradeByCountry.set(country, {
        year,
        exports: exports || 0,
        imports: imports || 0,
        balance: (exports || 0) - (imports || 0),
      });
    }
  }

  log(tag, `${tradeByCountry.size} countries with trade data`);

  // Compute trade dependency scores
  const allExports = [...tradeByCountry.values()].map(t => t.exports);
  const maxExports = Math.max(...allExports.filter(e => e > 0));

  let updated = 0;
  for (const [name, data] of tradeByCountry) {
    const code = resolveCountryCode(name);
    if (!code) continue;

    // Trade dependency = exports/maxExports normalized
    const tradeDependency = maxExports > 0 ? data.exports / maxExports : 0;
    const demandProxy = Math.round(tradeDependency * 100);

    const { error } = await supabase
      .from('countries_master')
      .update({
        demand: demandProxy,
        last_updated: new Date().toISOString(),
      })
      .eq('code', code);
    if (!error) updated++;
  }

  log(tag, `✓ Updated ${updated} countries with trade data`);
}

// ─── 4. Geopolitical Risk (Fragile State Index) ──────────────────────────

async function ingestRisk() {
  const tag = 'Risk';
  const dir = path.join(DOWNLOAD_DIR, 'risk');

  if (!downloadDataset('msjahid/fragile-state-index-fsi-data-2006-2023', dir)) return;

  const csvPath = findCSV(dir);
  if (!csvPath) { warn(tag, 'No CSV found'); return; }

  const rows = readCSV(csvPath);
  log(tag, `Parsed ${rows.length} rows`);

  // Get latest year per country
  const latestByCountry = new Map();
  for (const row of rows) {
    const country = row.Country || row.country;
    const year = num(row.Year || row.year);
    if (!country || !year) continue;

    const existing = latestByCountry.get(country);
    if (!existing || year > existing.year) {
      latestByCountry.set(country, { ...row, year, country });
    }
  }

  log(tag, `${latestByCountry.size} countries with FSI data`);

  // Map FSI to our risk_score (FSI total is 0-120, higher = more fragile)
  let updated = 0;
  for (const [name, row] of latestByCountry) {
    const code = resolveCountryCode(name);
    if (!code) continue;

    const total = num(row.Total || row.total);
    if (total == null) continue;

    // Normalize FSI (0-120) to our risk (0-1)
    const riskScore = Math.min(1, Math.max(0, total / 120));

    const security = num(row['Security Apparatus'] || row.security_apparatus);
    const economy = num(row['Economy'] || row.economic_decline);
    const humanRights = num(row['Human Rights'] || row.human_rights);
    const publicServices = num(row['Public Services'] || row.public_services);

    // Compute eco_score from FSI economy dimension (inverted — lower fragility = better economy)
    const ecoScore = economy != null ? Math.round((10 - economy) * 10) : null;

    const updateFields = { last_updated: new Date().toISOString() };
    if (ecoScore != null) updateFields.eco_score = ecoScore;

    const { error } = await supabase
      .from('countries_master')
      .update(updateFields)
      .eq('code', code);
    if (!error) updated++;
  }

  log(tag, `✓ Updated ${updated} countries with FSI risk data`);
}

// ─── 5. Commodity Prices ─────────────────────────────────────────────────

async function ingestCommodity() {
  const tag = 'Commodity';
  const dir = path.join(DOWNLOAD_DIR, 'commodity');

  if (!downloadDataset('debashish311601/commodity-prices', dir)) return;

  const csvPath = findCSV(dir);
  if (!csvPath) { warn(tag, 'No CSV found'); return; }

  const rows = readCSV(csvPath);
  log(tag, `Parsed ${rows.length} rows`);

  // Map commodity names to our resources
  const COMMODITY_MAP = {
    'copper': 'Copper', 'nickel': 'Nickel', 'aluminum': 'Aluminum',
    'aluminium': 'Aluminum', 'zinc': 'Steel', 'gold': null,
    'silver': null, 'crude': 'Crude Oil', 'wti': 'Crude Oil',
    'brent': 'Crude Oil', 'natural gas': 'Natural Gas',
  };

  // Get latest prices
  const latestPrices = new Map();
  for (const row of rows) {
    const date = row.Date || row.date;
    const cols = Object.keys(row).filter(k => k !== 'Date' && k !== 'date');

    for (const col of cols) {
      const price = num(row[col]);
      if (!price) continue;

      const resourceName = Object.entries(COMMODITY_MAP)
        .find(([k]) => col.toLowerCase().includes(k))?.[1];
      if (!resourceName) continue;

      const existing = latestPrices.get(resourceName);
      if (!existing || date > existing.date) {
        latestPrices.set(resourceName, { date, price, source: col });
      }
    }
  }

  log(tag, `Latest prices for ${latestPrices.size} resources`);
  for (const [resource, data] of latestPrices) {
    log(tag, `  ${resource}: $${data.price.toFixed(2)} (${data.date}, col: ${data.source})`);
  }

  log(tag, `✓ Commodity price ingestion complete`);
}

// ─── 6. Military Spending ────────────────────────────────────────────────

async function ingestMilitary() {
  const tag = 'Military';
  const dir = path.join(DOWNLOAD_DIR, 'military');

  if (!downloadDataset('nitinsss/military-expenditure-of-countries-19602019', dir)) return;

  const csvPath = findCSV(dir);
  if (!csvPath) { warn(tag, 'No CSV found'); return; }

  const rows = readCSV(csvPath);
  log(tag, `Parsed ${rows.length} rows`);

  // Get latest military spending per country
  const latestByCountry = new Map();
  for (const row of rows) {
    const country = row.Name || row.Country || row.country;
    // Find the latest year column with data
    const years = Object.keys(row).filter(k => /^\d{4}$/.test(k)).sort().reverse();

    for (const year of years) {
      const spending = num(row[year]);
      if (spending != null && spending > 0) {
        latestByCountry.set(country, { year: Number(year), spending });
        break;
      }
    }
  }

  log(tag, `${latestByCountry.size} countries with military data`);

  // Log top 10
  const sorted = [...latestByCountry.entries()]
    .sort((a, b) => b[1].spending - a[1].spending)
    .slice(0, 10);

  for (const [name, data] of sorted) {
    log(tag, `  ${name}: $${(data.spending / 1e9).toFixed(1)}B (${data.year})`);
  }

  log(tag, `✓ Military spending data loaded`);
}

// ─── 7. Labor / Workforce ────────────────────────────────────────────────

async function ingestLabor() {
  const tag = 'Labor';
  const dir = path.join(DOWNLOAD_DIR, 'labor');

  if (!downloadDataset('alenavorushilova/labour-force-world-stats-data-by-oecd', dir)) return;

  const csvPath = findCSV(dir);
  if (!csvPath) { warn(tag, 'No CSV found'); return; }

  const rows = readCSVWithBOM(csvPath);
  log(tag, `Parsed ${rows.length} rows`);

  // Extract employment/unemployment rates by country
  const laborByCountry = new Map();
  for (const row of rows) {
    const country = row.LOCATION || row.Country || row.country;
    const subject = row.SUBJECT || row.Subject || row.subject || '';
    const value = num(row.Value || row.value);
    const year = num(row.TIME || row.Time || row.Year || row.year);

    if (!country || !year || value == null) continue;

    const key = country;
    if (!laborByCountry.has(key)) laborByCountry.set(key, {});
    const entry = laborByCountry.get(key);

    if (!entry.year || year > entry.year) {
      entry.year = year;
      entry.country = country;
    }

    // OECD subjects: YGTT07L1_ST = Labour force, YGTT08L1_ST = Unemployment
    if (subject.includes('08') || subject.includes('UNR') || subject.includes('unemployment')) {
      entry.unemployment = value;
    }
    if (subject.includes('07') || subject.includes('EMP') || subject.includes('employment')) {
      entry.employment = value;
    }
  }

  log(tag, `${laborByCountry.size} countries with labor data`);

  // Update workforce field in countries_master
  let updated = 0;
  for (const [name, data] of laborByCountry) {
    const code = resolveCountryCode(name);
    if (!code) continue;

    if (data.employment != null) {
      const { error } = await supabase
        .from('countries_master')
        .update({
          workforce: Math.round(data.employment),
          last_updated: new Date().toISOString(),
        })
        .eq('code', code);
      if (!error) updated++;
    }
  }

  log(tag, `✓ Updated ${updated} countries with labor data`);
}

// ─── 8. ESG / Environmental ──────────────────────────────────────────────

async function ingestESG() {
  const tag = 'ESG';
  const dir = path.join(DOWNLOAD_DIR, 'esg');

  if (!downloadDataset('ulrikthygepedersen/co2-emissions-by-country', dir)) return;

  const csvPath = findCSV(dir);
  if (!csvPath) { warn(tag, 'No CSV found'); return; }

  const rows = readCSV(csvPath);
  log(tag, `Parsed ${rows.length} rows`);

  // Get latest CO2 emissions per country
  // CSV columns: country_code, country_name, year, value
  const latestByCountry = new Map();
  for (const row of rows) {
    const country = row.country_name || row.Country || row.country || row['Country Name'];
    const year = num(row.year || row.Year);
    const co2 = num(row.value || row.Value || row['CO2 Emissions'] || row.co2);

    if (!country || !year || co2 == null) continue;

    const existing = latestByCountry.get(country);
    if (!existing || year > existing.year) {
      latestByCountry.set(country, { year, co2, country });
    }
  }

  log(tag, `${latestByCountry.size} countries with CO2 data`);

  // Top emitters
  const sorted = [...latestByCountry.entries()]
    .sort((a, b) => b[1].co2 - a[1].co2)
    .slice(0, 10);

  for (const [name, data] of sorted) {
    log(tag, `  ${name}: ${data.co2.toLocaleString()} (${data.year})`);
  }

  log(tag, `✓ ESG/CO2 data loaded`);
}

// ─── 9. Fortune 500 Companies ────────────────────────────────────────────

async function ingestCompanies() {
  const tag = 'Companies';
  const dir = path.join(DOWNLOAD_DIR, 'companies');

  if (!downloadDataset('sneharangole/2024-fortune-global-500-companies', dir)) return;

  const csvPath = findCSV(dir);
  if (!csvPath) { warn(tag, 'No CSV found'); return; }

  const rows = readCSV(csvPath);
  log(tag, `Parsed ${rows.length} rows (Fortune Global 500)`);

  // Match with our companies
  const { data: ourCompanies } = await supabase
    .from('companies')
    .select('id, name, sector, country');

  if (!ourCompanies) { warn(tag, 'Could not fetch companies from DB'); return; }

  let matched = 0;
  for (const row of rows) {
    const name = row.NAME || row['Company Name'] || row.company || row.Name;
    const revenueStr = row['REVENUES ($M)'] || row.Revenue || row.revenue || '';
    const revenue = num(String(revenueStr).replace(/[$,]/g, ''));
    const profitStr = row['PROFITS ($M)'] || row.Profits || row.profits || '';
    const profits = num(String(profitStr).replace(/[$,]/g, ''));
    const employees = num(String(row.EMPLOYEES || row['Number of Employees'] || '').replace(/,/g, ''));
    const rank = num(row.RANK || row.Rank || row.rank);

    if (!name) continue;

    // Fuzzy match with our companies
    const nameLower = name.toLowerCase();
    const match = ourCompanies.find(c => {
      const cLower = c.name.toLowerCase();
      return cLower === nameLower ||
        nameLower.includes(cLower) ||
        cLower.includes(nameLower) ||
        // Handle common variations
        nameLower.replace(/[^a-z]/g, '').includes(cLower.replace(/[^a-z]/g, '')) ||
        cLower.replace(/[^a-z]/g, '').includes(nameLower.replace(/[^a-z]/g, ''));
    });

    if (match) {
      matched++;
      log(tag, `  Matched: ${name} → ${match.name} (rank #${rank}, revenue: $${revenue}M)`);
    }
  }

  log(tag, `✓ Matched ${matched}/${ourCompanies.length} companies with Fortune 500 data`);
}

// ─── Orchestrator ────────────────────────────────────────────────────────

const MODULES = {
  gdp: { fn: ingestGDP, label: 'GDP & Economic Indicators' },
  minerals: { fn: ingestMinerals, label: 'Minerals & Mining' },
  trade: { fn: ingestTrade, label: 'Trade Flows' },
  risk: { fn: ingestRisk, label: 'Geopolitical Risk (FSI)' },
  commodity: { fn: ingestCommodity, label: 'Commodity Prices' },
  military: { fn: ingestMilitary, label: 'Military Spending' },
  labor: { fn: ingestLabor, label: 'Labor / Workforce' },
  esg: { fn: ingestESG, label: 'ESG / CO2 Emissions' },
  companies: { fn: ingestCompanies, label: 'Fortune 500 Companies' },
};

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  DIRE-X Kaggle Data Ingestion v1.0   ║');
  console.log('╚══════════════════════════════════════╝');

  // Check Kaggle CLI
  try {
    execSync('kaggle --version', { stdio: 'pipe' });
    log('Init', '✓ Kaggle CLI available');
  } catch {
    console.error('\n❌ Kaggle CLI not found. Install: pip install kaggle');
    console.error('   Then place kaggle.json in ~/.kaggle/');
    console.error('   Get it from: https://www.kaggle.com → Account → API → Create New Token\n');
    process.exit(1);
  }

  // Check Supabase
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env');
    process.exit(1);
  }

  ensureDir(DOWNLOAD_DIR);

  // Parse --only flag
  const onlyArg = process.argv.find(a => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.split('=')[1] : null;

  const modulesToRun = only
    ? { [only]: MODULES[only] }
    : MODULES;

  if (only && !MODULES[only]) {
    console.error(`❌ Unknown module: ${only}. Available: ${Object.keys(MODULES).join(', ')}`);
    process.exit(1);
  }

  const startTime = Date.now();
  const results = {};

  for (const [key, mod] of Object.entries(modulesToRun)) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`▶ ${mod.label}`);
    console.log('─'.repeat(50));
    try {
      await mod.fn();
      results[key] = '✓';
    } catch (e) {
      warn(key, `Failed: ${e.message}`);
      results[key] = '✗';
    }
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'═'.repeat(50)}`);
  console.log('  INGESTION SUMMARY');
  console.log('═'.repeat(50));
  for (const [key, status] of Object.entries(results)) {
    console.log(`  ${status} ${MODULES[key].label}`);
  }
  console.log(`\n  Elapsed: ${elapsed}s`);
  console.log(`  Data dir: ${DOWNLOAD_DIR}`);
  console.log('═'.repeat(50));
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
