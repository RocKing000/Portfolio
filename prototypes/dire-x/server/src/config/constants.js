// ============================================
// DIRE-X Configuration Constants
// ============================================

const SRES_WEIGHTS = {
  demand: 0.35,
  supply: 0.30,
  geopolitical: 0.20,
  environmental: 0.15,
};

const SCENARIO_MULTIPLIERS = {
  stable: { supply: 1.0, demand: 1.0, geo: 1.0, env: 1.0 },
  supply_crisis: { supply: 1.8, demand: 1.3, geo: 1.2, env: 1.0 },
  war: { geo: 2.0, supply: 1.6, demand: 1.4, env: 1.3 },
  drought: { env: 2.2, supply: 1.5, demand: 1.2, geo: 1.1 },
  pandemic: { supply: 1.4, demand: 1.6, geo: 1.1, env: 1.0 },
  trade_war: { supply: 1.3, demand: 1.2, geo: 1.7, env: 1.0 },
  cyber_attack: { supply: 1.5, demand: 1.1, geo: 1.4, env: 1.0 },
  energy_crisis: { supply: 1.9, demand: 1.5, geo: 1.3, env: 1.4 },
};

const SIM_DAY_MS = 60000;

const SPEED_OPTIONS = [0.5, 1, 2, 5];

const SCENARIO_STAGES = ['emerging', 'growth', 'peak', 'decline', 'ended'];

const SCENARIO_LIFECYCLE = {
  supply_crisis: { growth: 0.15, decay: 0.08, maxDuration: 30, peakThreshold: 0.75 },
  war: { growth: 0.20, decay: 0.05, maxDuration: 45, peakThreshold: 0.80 },
  drought: { growth: 0.10, decay: 0.12, maxDuration: 25, peakThreshold: 0.70 },
  pandemic: { growth: 0.18, decay: 0.07, maxDuration: 40, peakThreshold: 0.85 },
  trade_war: { growth: 0.12, decay: 0.10, maxDuration: 20, peakThreshold: 0.65 },
  cyber_attack: { growth: 0.25, decay: 0.15, maxDuration: 15, peakThreshold: 0.70 },
  energy_crisis: { growth: 0.14, decay: 0.06, maxDuration: 35, peakThreshold: 0.75 },
};

const SCENARIO_INTERACTIONS = {
  drought: { supply_crisis: 0.3, trade_war: 0.15, energy_crisis: 0.2 },
  war: { supply_crisis: 0.5, trade_war: 0.4, energy_crisis: 0.35, cyber_attack: 0.3 },
  supply_crisis: { trade_war: 0.2, energy_crisis: 0.25 },
  pandemic: { supply_crisis: 0.35, trade_war: 0.25 },
  trade_war: { supply_crisis: 0.2 },
  cyber_attack: { supply_crisis: 0.2, energy_crisis: 0.15 },
  energy_crisis: { supply_crisis: 0.3, trade_war: 0.15 },
};

// ============================================
// INDUSTRY + RESOURCE MAPPING (expanded)
// ============================================

const INDUSTRY_RESOURCE_MAP = {
  // EV / Clean Energy Manufacturing
  ev: [
    { resource: 'Lithium',             dep: 0.92 },
    { resource: 'Cobalt',              dep: 0.82 },
    { resource: 'Nickel',              dep: 0.78 },
    { resource: 'Graphite',            dep: 0.74 },
    { resource: 'Copper',              dep: 0.76 },
    { resource: 'Semiconductors',      dep: 0.86 },
    { resource: 'Rare Earth Elements', dep: 0.72 },
    { resource: 'Silicon',             dep: 0.48 },
    { resource: 'Steel',               dep: 0.55 },
    { resource: 'Aluminum',            dep: 0.62 },
  ],
  // Defense & Aerospace
  defense: [
    { resource: 'Rare Earth Elements', dep: 0.92 },
    { resource: 'Semiconductors',      dep: 0.90 },
    { resource: 'Advanced Alloys',     dep: 0.85 },
    { resource: 'Steel',               dep: 0.72 },
    { resource: 'Aluminum',            dep: 0.60 },
    { resource: 'Copper',              dep: 0.58 },
    { resource: 'Uranium',             dep: 0.45 },
    { resource: 'Graphite',            dep: 0.52 },
    { resource: 'Crude Oil',           dep: 0.50 },
    { resource: 'Nickel',              dep: 0.46 },
  ],
  // Electronics & Semiconductor Manufacturing
  electronics: [
    { resource: 'Semiconductors',      dep: 0.96 },
    { resource: 'Silicon',             dep: 0.82 },
    { resource: 'Rare Earth Elements', dep: 0.78 },
    { resource: 'Copper',              dep: 0.65 },
    { resource: 'Lithium',             dep: 0.60 },
    { resource: 'Nickel',              dep: 0.52 },
    { resource: 'Water',               dep: 0.68 },
    { resource: 'Natural Gas',         dep: 0.45 },
    { resource: 'Graphite',            dep: 0.44 },
    { resource: 'Aluminum',            dep: 0.38 },
  ],
  // Energy (Oil, Gas, Nuclear)
  energy: [
    { resource: 'Crude Oil',           dep: 0.90 },
    { resource: 'Natural Gas',         dep: 0.86 },
    { resource: 'Uranium',             dep: 0.56 },
    { resource: 'Copper',              dep: 0.50 },
    { resource: 'Steel',               dep: 0.45 },
    { resource: 'Aluminum',            dep: 0.42 },
    { resource: 'Advanced Alloys',     dep: 0.52 },
    { resource: 'Water',               dep: 0.42 },
    { resource: 'Nickel',              dep: 0.36 },
  ],
  // Pharma & Chemical Manufacturing
  pharma: [
    { resource: 'Crude Oil',           dep: 0.58 },
    { resource: 'Natural Gas',         dep: 0.46 },
    { resource: 'Water',               dep: 0.68 },
    { resource: 'Silicon',             dep: 0.42 },
    { resource: 'Copper',              dep: 0.32 },
    { resource: 'Rare Earth Elements', dep: 0.38 },
    { resource: 'Semiconductors',      dep: 0.36 },
    { resource: 'Advanced Alloys',     dep: 0.35 },
    { resource: 'Aluminum',            dep: 0.28 },
  ],
  // Critical Minerals Mining
  mining: [
    { resource: 'Copper',              dep: 0.92 },
    { resource: 'Nickel',              dep: 0.85 },
    { resource: 'Cobalt',              dep: 0.78 },
    { resource: 'Lithium',             dep: 0.72 },
    { resource: 'Rare Earth Elements', dep: 0.65 },
    { resource: 'Steel',               dep: 0.56 },
    { resource: 'Aluminum',            dep: 0.88 },
    { resource: 'Crude Oil',           dep: 0.46 },
    { resource: 'Natural Gas',         dep: 0.38 },
    { resource: 'Water',               dep: 0.64 },
  ],
  // Automotive (Traditional + Hybrid)
  automotive: [
    { resource: 'Steel',               dep: 0.86 },
    { resource: 'Aluminum',            dep: 0.72 },
    { resource: 'Semiconductors',      dep: 0.80 },
    { resource: 'Copper',              dep: 0.65 },
    { resource: 'Crude Oil',           dep: 0.52 },
    { resource: 'Rare Earth Elements', dep: 0.56 },
    { resource: 'Advanced Alloys',     dep: 0.46 },
    { resource: 'Natural Gas',         dep: 0.36 },
    { resource: 'Nickel',              dep: 0.42 },
    { resource: 'Graphite',            dep: 0.38 },
  ],
  // Telecom & Digital Infrastructure
  telecom: [
    { resource: 'Semiconductors',      dep: 0.92 },
    { resource: 'Silicon',             dep: 0.58 },
    { resource: 'Copper',              dep: 0.76 },
    { resource: 'Rare Earth Elements', dep: 0.62 },
    { resource: 'Aluminum',            dep: 0.46 },
    { resource: 'Steel',               dep: 0.38 },
    { resource: 'Lithium',             dep: 0.36 },
    { resource: 'Natural Gas',         dep: 0.32 },
    { resource: 'Advanced Alloys',     dep: 0.42 },
  ],
  // Industrial Construction & Infrastructure
  construction: [
    { resource: 'Steel',               dep: 0.90 },
    { resource: 'Aluminum',            dep: 0.70 },
    { resource: 'Copper',              dep: 0.60 },
    { resource: 'Water',               dep: 0.52 },
    { resource: 'Crude Oil',           dep: 0.46 },
    { resource: 'Natural Gas',         dep: 0.42 },
    { resource: 'Advanced Alloys',     dep: 0.56 },
    { resource: 'Nickel',              dep: 0.36 },
    { resource: 'Silicon',             dep: 0.30 },
  ],
  // Semiconductors Fabrication
  semiconductors: [
    { resource: 'Semiconductors',      dep: 0.98 },
    { resource: 'Silicon',             dep: 0.94 },
    { resource: 'Rare Earth Elements', dep: 0.88 },
    { resource: 'Copper',              dep: 0.74 },
    { resource: 'Natural Gas',         dep: 0.54 },
    { resource: 'Cobalt',              dep: 0.46 },
    { resource: 'Nickel',              dep: 0.42 },
    { resource: 'Water',               dep: 0.76 },
    { resource: 'Advanced Alloys',     dep: 0.56 },
    { resource: 'Graphite',            dep: 0.50 },
  ],
};

const STRATEGY_MODIFIERS = {
  cost: { dependency: 1.15, supply_risk: 1.10, env_risk: 1.20, geo_risk: 0.95 },
  balanced: { dependency: 1.0, supply_risk: 1.0, env_risk: 1.0, geo_risk: 1.0 },
  sustainable: { dependency: 0.90, supply_risk: 0.95, env_risk: 0.75, geo_risk: 1.05 },
};

const SCALE_MULTIPLIERS = {
  small: { dependency: 0.85, volatility: 1.2, workforce: 500, output: 0.7 },
  medium: { dependency: 1.0, volatility: 1.0, workforce: 2000, output: 1.0 },
  large: { dependency: 1.15, volatility: 0.85, workforce: 8000, output: 1.5 },
};

// ============================================
// GEOGRAPHIC DATA
// ============================================

const COUNTRY_RISK_MAP = {
  'United States': 0.3,
  'China': 0.65,
  'Germany': 0.25,
  'India': 0.55,
  'Brazil': 0.50,
  'South Korea': 0.35,
  'Japan': 0.20,
  'Taiwan': 0.70,
  'Russia': 0.80,
  'Nigeria': 0.75,
  'Australia': 0.20,
  'UK': 0.25,
  'Saudi Arabia': 0.60,
  'Mexico': 0.50,
  'Indonesia': 0.55,
  'Turkey': 0.60,
  'Vietnam': 0.50,
  'Thailand': 0.45,
  'South Africa': 0.55,
  'Egypt': 0.65,
  'Canada': 0.20,
  'France': 0.25,
  'Chile': 0.40,
  'Peru': 0.50,
  'DRC': 0.85,
  'Myanmar': 0.80,
  'Kazakhstan': 0.60,
  'Philippines': 0.55,
  'Bangladesh': 0.60,
  'Argentina': 0.55,
  'Zimbabwe': 0.75,
  'Gabon': 0.65,
  'Mozambique': 0.70,
  'Singapore': 0.15,
  'Switzerland': 0.15,
  'Iran': 0.85,
};

const COUNTRY_COORDS = {
  // Americas
  'United States':             { lat: 39.8,   lng: -98.5  },
  'Canada':                    { lat: 56.1,   lng: -106.3 },
  'Mexico':                    { lat: 23.6,   lng: -102.6 },
  'Brazil':                    { lat: -14.2,  lng: -51.9  },
  'Argentina':                 { lat: -38.4,  lng: -63.6  },
  'Colombia':                  { lat: 4.6,    lng: -74.3  },
  'Chile':                     { lat: -35.7,  lng: -71.5  },
  'Peru':                      { lat: -9.2,   lng: -75.0  },
  'Venezuela':                 { lat: 6.4,    lng: -66.6  },
  'Ecuador':                   { lat: -1.8,   lng: -78.2  },
  'Bolivia':                   { lat: -16.3,  lng: -63.6  },
  'Paraguay':                  { lat: -23.4,  lng: -58.4  },
  'Uruguay':                   { lat: -32.5,  lng: -55.8  },
  'Guyana':                    { lat: 4.9,    lng: -59.0  },
  'Cuba':                      { lat: 21.5,   lng: -79.5  },
  'Guatemala':                 { lat: 15.8,   lng: -90.2  },
  'Honduras':                  { lat: 15.2,   lng: -86.2  },
  'Costa Rica':                { lat: 9.7,    lng: -83.8  },
  'Panama':                    { lat: 8.5,    lng: -80.8  },
  'Dominican Republic':        { lat: 18.7,   lng: -70.2  },
  'Jamaica':                   { lat: 18.1,   lng: -77.3  },
  'Trinidad and Tobago':       { lat: 10.7,   lng: -61.2  },
  // Europe
  'United Kingdom':            { lat: 55.4,   lng: -3.4   },
  'Germany':                   { lat: 51.2,   lng: 10.4   },
  'France':                    { lat: 46.2,   lng: 2.2    },
  'Italy':                     { lat: 42.5,   lng: 12.6   },
  'Spain':                     { lat: 40.5,   lng: -3.7   },
  'Poland':                    { lat: 51.9,   lng: 19.1   },
  'Netherlands':               { lat: 52.1,   lng: 5.3    },
  'Belgium':                   { lat: 50.5,   lng: 4.5    },
  'Sweden':                    { lat: 60.1,   lng: 18.6   },
  'Norway':                    { lat: 64.5,   lng: 17.9   },
  'Denmark':                   { lat: 56.3,   lng: 9.5    },
  'Finland':                   { lat: 64.0,   lng: 26.0   },
  'Switzerland':               { lat: 46.8,   lng: 8.2    },
  'Austria':                   { lat: 47.5,   lng: 14.6   },
  'Portugal':                  { lat: 39.4,   lng: -8.2   },
  'Greece':                    { lat: 39.1,   lng: 21.8   },
  'Czech Republic':            { lat: 49.8,   lng: 15.5   },
  'Hungary':                   { lat: 47.2,   lng: 19.5   },
  'Romania':                   { lat: 45.9,   lng: 24.9   },
  'Slovakia':                  { lat: 48.7,   lng: 19.7   },
  'Bulgaria':                  { lat: 42.7,   lng: 25.5   },
  'Serbia':                    { lat: 44.0,   lng: 21.0   },
  'Croatia':                   { lat: 45.1,   lng: 15.2   },
  'Ukraine':                   { lat: 48.4,   lng: 31.2   },
  'Belarus':                   { lat: 53.7,   lng: 27.9   },
  'Lithuania':                 { lat: 55.2,   lng: 23.9   },
  'Latvia':                    { lat: 56.9,   lng: 24.6   },
  'Estonia':                   { lat: 58.6,   lng: 25.0   },
  'Slovenia':                  { lat: 46.1,   lng: 14.9   },
  'Ireland':                   { lat: 53.4,   lng: -8.2   },
  'Iceland':                   { lat: 64.9,   lng: -18.7  },
  'Moldova':                   { lat: 47.4,   lng: 28.4   },
  // Russia & Central Asia
  'Russia':                    { lat: 61.5,   lng: 105.3  },
  'Kazakhstan':                { lat: 48.0,   lng: 68.0   },
  'Uzbekistan':                { lat: 41.4,   lng: 64.6   },
  'Turkmenistan':              { lat: 38.9,   lng: 59.6   },
  'Kyrgyzstan':                { lat: 41.2,   lng: 74.8   },
  'Tajikistan':                { lat: 38.9,   lng: 71.3   },
  // Middle East
  'Saudi Arabia':              { lat: 23.9,   lng: 45.1   },
  'Iran':                      { lat: 32.4,   lng: 53.7   },
  'Iraq':                      { lat: 33.2,   lng: 43.7   },
  'Israel':                    { lat: 31.5,   lng: 34.8   },
  'Turkey':                    { lat: 38.9,   lng: 35.2   },
  'United Arab Emirates':      { lat: 23.4,   lng: 53.8   },
  'Qatar':                     { lat: 25.4,   lng: 51.2   },
  'Kuwait':                    { lat: 29.3,   lng: 47.5   },
  'Oman':                      { lat: 21.5,   lng: 55.9   },
  'Bahrain':                   { lat: 26.0,   lng: 50.6   },
  'Jordan':                    { lat: 31.2,   lng: 36.8   },
  'Lebanon':                   { lat: 33.9,   lng: 35.9   },
  'Syria':                     { lat: 34.8,   lng: 38.9   },
  'Yemen':                     { lat: 15.6,   lng: 48.5   },
  'Afghanistan':               { lat: 33.9,   lng: 67.7   },
  'Pakistan':                  { lat: 30.4,   lng: 69.3   },
  // Asia-Pacific
  'China':                     { lat: 35.8,   lng: 104.1  },
  'Japan':                     { lat: 36.2,   lng: 138.2  },
  'India':                     { lat: 20.6,   lng: 78.9   },
  'South Korea':               { lat: 35.9,   lng: 127.7  },
  'Taiwan':                    { lat: 23.7,   lng: 120.9  },
  'Australia':                 { lat: -25.3,  lng: 133.8  },
  'New Zealand':               { lat: -40.9,  lng: 174.9  },
  'Indonesia':                 { lat: -0.8,   lng: 113.9  },
  'Malaysia':                  { lat: 4.2,    lng: 108.0  },
  'Thailand':                  { lat: 15.9,   lng: 100.9  },
  'Vietnam':                   { lat: 14.1,   lng: 108.3  },
  'Philippines':               { lat: 12.9,   lng: 121.8  },
  'Singapore':                 { lat: 1.4,    lng: 103.8  },
  'Myanmar':                   { lat: 17.1,   lng: 96.2   },
  'Cambodia':                  { lat: 12.6,   lng: 104.9  },
  'Bangladesh':                { lat: 23.7,   lng: 90.4   },
  'Sri Lanka':                 { lat: 7.9,    lng: 80.8   },
  'Nepal':                     { lat: 28.4,   lng: 84.1   },
  'Mongolia':                  { lat: 46.9,   lng: 103.8  },
  'North Korea':               { lat: 40.3,   lng: 127.5  },
  // Africa
  'Nigeria':                   { lat: 9.1,    lng: 8.7    },
  'South Africa':              { lat: -30.6,  lng: 22.9   },
  'Ethiopia':                  { lat: 9.1,    lng: 40.5   },
  'Egypt':                     { lat: 26.8,   lng: 30.8   },
  'Algeria':                   { lat: 28.0,   lng: 2.6    },
  'Sudan':                     { lat: 12.9,   lng: 30.2   },
  'Tanzania':                  { lat: -6.4,   lng: 34.9   },
  'Kenya':                     { lat: 0.0,    lng: 37.9   },
  'Morocco':                   { lat: 31.8,   lng: -7.1   },
  'Ghana':                     { lat: 7.9,    lng: -1.0   },
  "Cote d'Ivoire":             { lat: 7.5,    lng: -5.5   },
  'Cameroon':                  { lat: 3.9,    lng: 11.5   },
  'Angola':                    { lat: -11.2,  lng: 17.9   },
  'Mozambique':                { lat: -18.7,  lng: 35.5   },
  'Zambia':                    { lat: -13.1,  lng: 27.8   },
  'Zimbabwe':                  { lat: -19.0,  lng: 29.2   },
  'Uganda':                    { lat: 1.4,    lng: 32.3   },
  'Senegal':                   { lat: 14.5,   lng: -14.5  },
  'Democratic Republic of the Congo': { lat: -4.0, lng: 21.8 },
  'DRC':                       { lat: -4.0,   lng: 21.8   },
  'Mali':                      { lat: 17.6,   lng: -2.0   },
  'Madagascar':                { lat: -18.8,  lng: 46.9   },
  'Tunisia':                   { lat: 33.9,   lng: 9.5    },
  'Libya':                     { lat: 26.3,   lng: 17.2   },
  'Botswana':                  { lat: -22.3,  lng: 24.7   },
  'Namibia':                   { lat: -22.0,  lng: 17.1   },
  'Rwanda':                    { lat: -1.9,   lng: 29.9   },
};

const GOVERNANCE_STYLES = {
  'United States': 'market_driven',
  'China': 'centralized',
  'Germany': 'responsive',
  'India': 'responsive',
  'Russia': 'centralized',
  'Japan': 'responsive',
  'South Korea': 'responsive',
  'Taiwan': 'responsive',
  'Saudi Arabia': 'interventionist',
  'Brazil': 'market_driven',
  'UK': 'market_driven',
  'Australia': 'market_driven',
  'Nigeria': 'interventionist',
  'Turkey': 'interventionist',
  'Indonesia': 'responsive',
  'Singapore': 'interventionist',
};

// ============================================
// TRADE ROUTES
// ============================================

const TRADE_ROUTES = [
  { id: 'suez',         name: 'Suez Canal',                    from: { lat: 30.0,  lng:  32.3 }, to: { lat: 31.3,  lng:  32.3  }, via: 'Suez Canal',      resources: ['Crude Oil', 'Natural Gas', 'Copper'],              status: 'stable'    },
  { id: 'malacca',      name: 'Strait of Malacca',             from: { lat:  1.4,  lng: 103.8 }, to: { lat:  4.2,  lng: 100.0  }, via: 'Malacca Strait',  resources: ['Crude Oil', 'Semiconductors', 'Rare Earth Elements'], status: 'stable'    },
  { id: 'hormuz',       name: 'Strait of Hormuz',              from: { lat: 26.6,  lng:  56.2 }, to: { lat: 25.0,  lng:  57.0  }, via: 'Hormuz Strait',   resources: ['Crude Oil', 'Natural Gas'],                        status: 'stressed'  },
  { id: 'panama',       name: 'Panama Canal',                  from: { lat:  9.1,  lng: -79.7 }, to: { lat:  8.9,  lng: -79.5  }, via: 'Panama Canal',    resources: ['Copper', 'Lithium', 'Aluminum'],                   status: 'stable'    },
  { id: 'china_us',     name: 'Trans-Pacific (China-US)',      from: { lat: 31.2,  lng: 121.5 }, to: { lat: 33.7,  lng: -118.2 }, via: 'Pacific Ocean',   resources: ['Semiconductors', 'Rare Earth Elements', 'Advanced Alloys'], status: 'stressed' },
  { id: 'aus_china',    name: 'Australia-China Minerals',      from: { lat: -20.7, lng: 116.8 }, to: { lat: 36.1,  lng: 120.4  }, via: 'South China Sea', resources: ['Lithium', 'Nickel', 'Copper'],                    status: 'stable'    },
  { id: 'persian_gulf', name: 'Persian Gulf-Asia',             from: { lat: 26.0,  lng:  50.5 }, to: { lat: 22.3,  lng: 114.2  }, via: 'Indian Ocean',    resources: ['Crude Oil', 'Natural Gas'],                        status: 'stressed'  },
  { id: 'baltic',       name: 'Baltic Pipeline Route',         from: { lat: 59.3,  lng:  24.7 }, to: { lat: 54.3,  lng:  10.1  }, via: 'Baltic Sea',      resources: ['Natural Gas'],                                     status: 'disrupted' },
  { id: 'chile_china',  name: 'Chile-China Copper-Lithium',    from: { lat: -23.6, lng: -70.4 }, to: { lat: 31.2,  lng: 121.5  }, via: 'Pacific Ocean',   resources: ['Copper', 'Lithium'],                               status: 'stable'    },
  { id: 'drc_china',    name: 'DRC-China Cobalt Route',        from: { lat: -11.7, lng:  27.5 }, to: { lat: 31.2,  lng: 121.5  }, via: 'Indian Ocean',    resources: ['Cobalt', 'Copper'],                                status: 'stressed'  },
  { id: 'brazil_eu',    name: 'Brazil-EU Industrial Metals',   from: { lat: -23.5, lng: -46.6 }, to: { lat: 51.5,  lng:   3.7  }, via: 'Atlantic Ocean',  resources: ['Copper', 'Nickel', 'Steel'],                       status: 'stable'    },
  { id: 'us_eu',        name: 'Trans-Atlantic',                from: { lat: 40.7,  lng: -74.0 }, to: { lat: 51.5,  lng:  -0.1  }, via: 'Atlantic Ocean',  resources: ['Natural Gas', 'Semiconductors', 'Advanced Alloys'], status: 'stable'   },
  { id: 'myanmar_cn',   name: 'Myanmar-China REE Route',       from: { lat: 25.0,  lng:  97.8 }, to: { lat: 24.9,  lng: 102.7  }, via: 'Overland',        resources: ['Rare Earth Elements', 'Graphite'],                 status: 'stressed'  },
];

const STRATEGIC_STRAITS = [
  { name: 'Strait of Hormuz', lat: 26.6, lng: 56.2, importance: 'Critical oil chokepoint' },
  { name: 'Strait of Malacca', lat: 1.4, lng: 103.8, importance: 'Major shipping lane' },
  { name: 'Suez Canal', lat: 30.5, lng: 32.3, importance: 'Europe-Asia trade route' },
  { name: 'Panama Canal', lat: 9.0, lng: -79.6, importance: 'Pacific-Atlantic connector' },
  { name: 'Bab el-Mandeb', lat: 12.6, lng: 43.3, importance: 'Red Sea access point' },
  { name: 'Turkish Straits', lat: 41.1, lng: 29.0, importance: 'Black Sea access' },
  { name: 'Taiwan Strait', lat: 24.0, lng: 119.5, importance: 'Semiconductor supply route' },
  { name: 'Cape of Good Hope', lat: -34.4, lng: 18.5, importance: 'Alternative Suez route' },
];

// ============================================
// MANUFACTURING PIPELINE
// ============================================

const REFINING_PROFILES = {
  ev: {
    stages: [
      { name: 'Lithium Refining',   input: 'Lithium',  output: 'Battery-grade Lithium', efficiency: 0.85, costMultiplier: 1.20 },
      { name: 'Cobalt Processing',  input: 'Cobalt',   output: 'Battery-grade Cobalt',  efficiency: 0.80, costMultiplier: 1.30 },
      { name: 'Nickel Smelting',    input: 'Nickel',   output: 'Battery-grade Nickel',  efficiency: 0.82, costMultiplier: 1.15 },
      { name: 'Graphite Shaping',   input: 'Graphite', output: 'Anode-grade Graphite',  efficiency: 0.78, costMultiplier: 1.10 },
    ],
    manufacturing: [
      { name: 'Battery Cell Assembly',  inputs: ['Battery-grade Lithium', 'Battery-grade Cobalt', 'Battery-grade Nickel', 'Anode-grade Graphite'], output: 'Battery Pack',     efficiency: 0.88, waste: 0.05, energyIntensity: 75 },
      { name: 'Motor Assembly',         inputs: ['Copper', 'Rare Earth Elements', 'Steel'],                                                         output: 'Electric Motor',  efficiency: 0.92, waste: 0.03, energyIntensity: 45 },
      { name: 'Vehicle Assembly',       inputs: ['Battery Pack', 'Electric Motor', 'Aluminum', 'Semiconductors'],                                    output: 'Electric Vehicle', efficiency: 0.90, waste: 0.04, energyIntensity: 60 },
    ],
  },
  electronics: {
    stages: [
      { name: 'Wafer Fabrication',      input: 'Silicon',              output: 'Processed Wafers', efficiency: 0.75, costMultiplier: 2.0 },
      { name: 'Chip Lithography',       input: 'Semiconductors',       output: 'Patterned Dies',   efficiency: 0.72, costMultiplier: 2.5 },
      { name: 'REE Separation',         input: 'Rare Earth Elements',  output: 'Purified REE',     efficiency: 0.70, costMultiplier: 1.8 },
    ],
    manufacturing: [
      { name: 'Chip Packaging',  inputs: ['Patterned Dies', 'Copper', 'Purified REE'],        output: 'Finished Chips',    efficiency: 0.85, waste: 0.08, energyIntensity: 90 },
      { name: 'Device Assembly', inputs: ['Finished Chips', 'Lithium', 'Aluminum'],            output: 'Electronic Device', efficiency: 0.92, waste: 0.03, energyIntensity: 30 },
    ],
  },
  defense: {
    stages: [
      { name: 'Alloy Forging',     input: 'Advanced Alloys', output: 'Aerospace-grade Alloy', efficiency: 0.80, costMultiplier: 2.5 },
      { name: 'Steel Hardening',   input: 'Steel',           output: 'Military-grade Steel',   efficiency: 0.88, costMultiplier: 1.4 },
    ],
    manufacturing: [
      { name: 'Avionics Assembly',    inputs: ['Semiconductors', 'Rare Earth Elements', 'Copper'],              output: 'Avionics Suite',   efficiency: 0.82, waste: 0.06, energyIntensity: 70 },
      { name: 'Airframe Construction', inputs: ['Aerospace-grade Alloy', 'Military-grade Steel', 'Aluminum'],   output: 'Airframe',         efficiency: 0.85, waste: 0.07, energyIntensity: 85 },
      { name: 'Systems Integration',  inputs: ['Avionics Suite', 'Airframe'],                                   output: 'Defense Platform', efficiency: 0.80, waste: 0.05, energyIntensity: 55 },
    ],
  },
  mining: {
    stages: [
      { name: 'Ore Crushing',      input: 'Copper',  output: 'Copper Concentrate', efficiency: 0.82, costMultiplier: 0.9 },
      { name: 'Nickel Leaching',   input: 'Nickel',  output: 'Nickel Matte',       efficiency: 0.78, costMultiplier: 1.0 },
      { name: 'Cobalt Extraction', input: 'Cobalt',  output: 'Cobalt Hydroxide',   efficiency: 0.75, costMultiplier: 1.1 },
    ],
    manufacturing: [
      { name: 'Copper Cathode Production', inputs: ['Copper Concentrate'],                     output: 'Refined Copper', efficiency: 0.88, waste: 0.06, energyIntensity: 50 },
      { name: 'Battery Precursor',         inputs: ['Cobalt Hydroxide', 'Nickel Matte'],        output: 'Precursor Material', efficiency: 0.82, waste: 0.05, energyIntensity: 60 },
    ],
  },
  energy: {
    stages: [
      { name: 'Oil Refining',   input: 'Crude Oil',   output: 'Refined Petroleum', efficiency: 0.90, costMultiplier: 1.1 },
      { name: 'Gas Processing', input: 'Natural Gas', output: 'Processed Gas',     efficiency: 0.92, costMultiplier: 0.9 },
    ],
    manufacturing: [
      { name: 'Fuel Blending',  inputs: ['Refined Petroleum'],  output: 'Fuel Products', efficiency: 0.95, waste: 0.02, energyIntensity: 40 },
      { name: 'LNG Production', inputs: ['Processed Gas'],       output: 'LNG',           efficiency: 0.88, waste: 0.03, energyIntensity: 65 },
    ],
  },
  pharma: {
    stages: [
      { name: 'Crude Distillation', input: 'Crude Oil', output: 'Chemical Feedstock', efficiency: 0.78, costMultiplier: 2.2 },
    ],
    manufacturing: [
      { name: 'Active Ingredient Synthesis', inputs: ['Chemical Feedstock', 'Natural Gas'], output: 'Active Ingredients',   efficiency: 0.74, waste: 0.12, energyIntensity: 55 },
      { name: 'Drug Formulation',            inputs: ['Active Ingredients', 'Water'],        output: 'Pharmaceutical Product', efficiency: 0.86, waste: 0.08, energyIntensity: 35 },
    ],
  },
  semiconductors: {
    stages: [
      { name: 'Polysilicon Purification', input: 'Silicon',             output: 'Ultra-pure Silicon',  efficiency: 0.68, costMultiplier: 3.0 },
      { name: 'REE Polishing',            input: 'Rare Earth Elements', output: 'CMP Slurry',          efficiency: 0.72, costMultiplier: 2.2 },
      { name: 'Alloy Target Prep',        input: 'Advanced Alloys',     output: 'Sputtering Targets',  efficiency: 0.80, costMultiplier: 1.6 },
    ],
    manufacturing: [
      { name: 'Wafer Fabrication',  inputs: ['Ultra-pure Silicon', 'CMP Slurry', 'Sputtering Targets', 'Copper'], output: 'Logic Wafer',    efficiency: 0.72, waste: 0.10, energyIntensity: 110 },
      { name: 'Chip Packaging',     inputs: ['Logic Wafer', 'Advanced Alloys'],                                    output: 'Finished Chip',  efficiency: 0.85, waste: 0.06, energyIntensity:  45 },
    ],
  },
};

// ============================================
// WORKFORCE PROFILES
// ============================================

const WORKFORCE_PROFILES = {
  ev: { baseSize: 5000, avgSkill: 0.65, avgProductivity: 0.70, costPerWorker: 65 },
  agriculture: { baseSize: 8000, avgSkill: 0.45, avgProductivity: 0.60, costPerWorker: 35 },
  defense: { baseSize: 6000, avgSkill: 0.75, avgProductivity: 0.72, costPerWorker: 80 },
  electronics: { baseSize: 4000, avgSkill: 0.80, avgProductivity: 0.75, costPerWorker: 70 },
  energy: { baseSize: 3000, avgSkill: 0.60, avgProductivity: 0.68, costPerWorker: 55 },
  pharma: { baseSize: 2500, avgSkill: 0.85, avgProductivity: 0.78, costPerWorker: 90 },
  mining: { baseSize: 7000, avgSkill: 0.50, avgProductivity: 0.55, costPerWorker: 45 },
  automotive: { baseSize: 10000, avgSkill: 0.60, avgProductivity: 0.65, costPerWorker: 50 },
  telecom: { baseSize: 3000, avgSkill: 0.72, avgProductivity: 0.70, costPerWorker: 65 },
  construction: { baseSize: 12000, avgSkill: 0.45, avgProductivity: 0.55, costPerWorker: 40 },
};

// ============================================
// STRATEGIC ACTIONS
// ============================================

const STRATEGIC_ACTION_TYPES = {
  diplomacy: {
    label: 'Diplomacy & Trade Agreements',
    delayDays: 10,
    durationDays: 60,
    costMultiplier: 0.5,
    effects: { supply: -5, stability: -8, economy: -3 },
    tradeoffs: { environment: 2 },
  },
  collaboration: {
    label: 'Industry Collaboration',
    delayDays: 7,
    durationDays: 45,
    costMultiplier: 0.8,
    effects: { supply: -4, economy: -5, stability: -3 },
    tradeoffs: { environment: 1 },
  },
  rd: {
    label: 'Research & Development',
    delayDays: 15,
    durationDays: 90,
    costMultiplier: 1.5,
    effects: { supply: -10, economy: -8, environment: -5 },
    tradeoffs: { economy: 5 },
  },
  diversification: {
    label: 'Supply Diversification',
    delayDays: 8,
    durationDays: 30,
    costMultiplier: 1.0,
    effects: { supply: -12, stability: -5 },
    tradeoffs: { economy: 3 },
  },
  vertical_integration: {
    label: 'Vertical Integration',
    delayDays: 20,
    durationDays: 120,
    costMultiplier: 2.0,
    effects: { supply: -15, economy: -10, stability: -8 },
    tradeoffs: { environment: 5, economy: 8 },
  },
};

// ============================================
// LEADERBOARD
// ============================================

const LEADERBOARD_WEIGHTS = {
  growth: 0.30,
  sustainability: 0.25,
  stability: 0.25,
  supplyHealth: 0.20,
};

// ============================================
// EVENTS
// ============================================

const MAX_EVENTS_PER_DAY = 3;

const EVENT_TEMPLATES = [
  {
    id: 'evt_oil_embargo',
    type: 'supply',
    titleTemplate: 'Oil Embargo Imposed on {region}',
    descriptionTemplate: 'A major oil-producing nation in {region} has announced export restrictions, cutting supply by {percentage}%.',
    minStress: 60,
    impact: { supply: 1.8, economy: 1.5, environment: 0.9, stability: 1.4 },
  },
  {
    id: 'evt_port_closure',
    type: 'supply',
    titleTemplate: 'Critical Port {port} Closed Due to {cause}',
    descriptionTemplate: 'Port {port} has been shut down due to {cause}, disrupting shipping routes and delaying deliveries across the region.',
    minStress: 45,
    impact: { supply: 1.6, economy: 1.3, environment: 1.0, stability: 1.2 },
  },
  {
    id: 'evt_rare_earth_shortage',
    type: 'supply',
    titleTemplate: 'Rare Earth Export Quota Tightened by {country}',
    descriptionTemplate: '{country} has reduced rare earth export quotas by {percentage}%, threatening downstream manufacturing.',
    minStress: 50,
    impact: { supply: 1.7, economy: 1.4, environment: 1.0, stability: 1.3 },
  },
  {
    id: 'evt_currency_crash',
    type: 'economy',
    titleTemplate: '{currency} Plunges {percentage}% Against USD',
    descriptionTemplate: 'The {currency} experienced a sharp devaluation, increasing import costs and triggering capital flight.',
    minStress: 55,
    impact: { supply: 1.1, economy: 1.9, environment: 1.0, stability: 1.5 },
  },
  {
    id: 'evt_trade_war_escalation',
    type: 'economy',
    titleTemplate: 'Trade Tariffs Escalate Between {countryA} and {countryB}',
    descriptionTemplate: 'New tariffs of {percentage}% imposed on {sector} goods between {countryA} and {countryB}.',
    minStress: 40,
    impact: { supply: 1.3, economy: 1.7, environment: 1.0, stability: 1.3 },
  },
  {
    id: 'evt_sanctions_imposed',
    type: 'economy',
    titleTemplate: 'Sanctions Imposed on {country} {sector} Sector',
    descriptionTemplate: 'International coalition has imposed comprehensive sanctions on {country}\'s {sector} sector, freezing assets and banning transactions.',
    minStress: 65,
    impact: { supply: 1.5, economy: 1.8, environment: 1.0, stability: 1.6 },
  },
  {
    id: 'evt_drought_crisis',
    type: 'environment',
    titleTemplate: 'Industrial Water Shortage Grips {region}',
    descriptionTemplate: 'Severe drought in {region} has critically reduced industrial water availability, disrupting semiconductor fabs, mining, and energy operations by {percentage}%.',
    minStress: 35,
    impact: { supply: 1.5, economy: 1.3, environment: 1.9, stability: 1.2 },
  },
  {
    id: 'evt_flood_disruption',
    type: 'environment',
    titleTemplate: 'Catastrophic Flooding in {region} Industrial Zone',
    descriptionTemplate: 'Record flooding has inundated industrial facilities in {region}, disrupting production of {resource} for an estimated {duration}.',
    minStress: 40,
    impact: { supply: 1.4, economy: 1.2, environment: 1.8, stability: 1.1 },
  },
  {
    id: 'evt_mine_collapse',
    type: 'environment',
    titleTemplate: 'Major Mine Collapse at {location}',
    descriptionTemplate: 'A structural failure at the {location} mining complex has halted extraction operations, removing {percentage}% of global {resource} output.',
    minStress: 50,
    impact: { supply: 1.7, economy: 1.3, environment: 1.6, stability: 1.2 },
  },
  {
    id: 'evt_coup_attempt',
    type: 'stability',
    titleTemplate: 'Political Upheaval in {country}',
    descriptionTemplate: 'An attempted coup in {country} has destabilized the government, raising concerns over resource export continuity.',
    minStress: 70,
    impact: { supply: 1.4, economy: 1.5, environment: 1.0, stability: 2.0 },
  },
  {
    id: 'evt_border_conflict',
    type: 'stability',
    titleTemplate: 'Armed Conflict Erupts at {border} Border',
    descriptionTemplate: 'Military clashes at the {border} border region have escalated, threatening key transit routes for {resource}.',
    minStress: 60,
    impact: { supply: 1.5, economy: 1.4, environment: 1.1, stability: 1.9 },
  },
  {
    id: 'evt_cyber_attack',
    type: 'stability',
    titleTemplate: 'Cyber Attack Targets {target} Infrastructure',
    descriptionTemplate: 'A sophisticated cyber operation has disrupted {target} systems across {region}, causing widespread operational downtime.',
    minStress: 45,
    impact: { supply: 1.3, economy: 1.4, environment: 1.0, stability: 1.7 },
  },
  {
    id: 'evt_pipeline_sabotage',
    type: 'supply',
    titleTemplate: '{pipeline} Pipeline Sabotaged',
    descriptionTemplate: 'The {pipeline} pipeline has been damaged in a suspected act of sabotage, cutting throughput by {percentage}%.',
    minStress: 55,
    impact: { supply: 1.9, economy: 1.4, environment: 1.3, stability: 1.5 },
  },
  {
    id: 'evt_semiconductor_shortage',
    type: 'supply',
    titleTemplate: 'Global Chip Shortage Worsens as {factory} Halts Production',
    descriptionTemplate: '{factory} has suspended chip fabrication due to {cause}, exacerbating the global semiconductor deficit.',
    minStress: 50,
    impact: { supply: 1.8, economy: 1.6, environment: 1.0, stability: 1.2 },
  },
  {
    id: 'evt_energy_grid_failure',
    type: 'environment',
    titleTemplate: 'Power Grid Failure Across {region}',
    descriptionTemplate: 'A cascading power grid failure has left {region} without electricity, halting industrial output and raising humanitarian concerns.',
    minStress: 55,
    impact: { supply: 1.5, economy: 1.6, environment: 1.4, stability: 1.5 },
  },
  {
    id: 'evt_labor_strike',
    type: 'economy',
    titleTemplate: 'Massive Labor Strike in {country} {sector} Sector',
    descriptionTemplate: 'Workers across {country}\'s {sector} industry have launched a nationwide strike, demanding better wages and conditions.',
    minStress: 40,
    impact: { supply: 1.4, economy: 1.5, environment: 1.0, stability: 1.3 },
  },
  {
    id: 'evt_subsidy_announced',
    type: 'economy',
    titleTemplate: '{country} Announces {amount} Subsidy for {sector}',
    descriptionTemplate: 'Government stimulus package targets {sector} sector with significant subsidies, potentially reshaping competitive dynamics.',
    minStress: 30,
    impact: { supply: 0.9, economy: 0.8, environment: 1.0, stability: 0.9 },
  },
  {
    id: 'evt_critical_mineral_export_restriction',
    type: 'supply',
    titleTemplate: '{country} Imposes Export Controls on Critical Minerals',
    descriptionTemplate: '{country} has announced export licensing requirements for {resource}, disrupting {percentage}% of global supply and forcing manufacturers to seek alternative sources.',
    minStress: 55,
    impact: { supply: 1.8, economy: 1.5, environment: 1.0, stability: 1.4 },
  },
  {
    id: 'evt_uranium_enrichment_sanctions',
    type: 'stability',
    titleTemplate: 'Uranium Enrichment Sanctions Imposed on {country}',
    descriptionTemplate: 'International authorities have imposed sanctions on {country}\'s uranium enrichment program, triggering concerns over nuclear fuel supply chains.',
    minStress: 65,
    impact: { supply: 1.6, economy: 1.4, environment: 1.0, stability: 1.8 },
  },
  {
    id: 'evt_lithium_triangle_disruption',
    type: 'supply',
    titleTemplate: 'Lithium Triangle Supply Disruption in {country}',
    descriptionTemplate: 'Political unrest in {country} has suspended lithium extraction operations, threatening {percentage}% of global battery-grade lithium supply.',
    minStress: 50,
    impact: { supply: 1.7, economy: 1.4, environment: 1.1, stability: 1.5 },
  },
];

// ============================================
// CREATIVE INTELLIGENCE BADGES
// ============================================

const IDEA_BADGES = {
  innovator: { label: 'Innovator', description: 'Novel approach to supply chain management', minNovelty: 7 },
  systems_thinker: { label: 'Systems Thinker', description: 'Demonstrated understanding of system interconnections', minNovelty: 5 },
  strategist: { label: 'Strategist', description: 'Long-term strategic thinking', minNovelty: 6 },
  optimizer: { label: 'Optimizer', description: 'Efficient resource optimization', minNovelty: 4 },
};

// ============================================
// POLICY TYPES
// ============================================

const POLICY_TYPES = {
  subsidy: { label: 'Subsidy', effect: { economy: -5, supply: -3 }, trigger: 'high_price' },
  export_ban: { label: 'Export Ban', effect: { supply: 8, economy: 5, stability: 3 }, trigger: 'shortage' },
  regulation: { label: 'Regulation', effect: { environment: -8, economy: 3 }, trigger: 'environmental_pressure' },
  tariff: { label: 'Tariff', effect: { economy: 5, supply: 3 }, trigger: 'trade_imbalance' },
  import_quota: { label: 'Import Quota', effect: { supply: 5, economy: 2 }, trigger: 'dependency' },
};

module.exports = {
  SRES_WEIGHTS,
  SCENARIO_MULTIPLIERS,
  SIM_DAY_MS,
  SPEED_OPTIONS,
  SCENARIO_STAGES,
  SCENARIO_LIFECYCLE,
  SCENARIO_INTERACTIONS,
  INDUSTRY_RESOURCE_MAP,
  STRATEGY_MODIFIERS,
  SCALE_MULTIPLIERS,
  COUNTRY_RISK_MAP,
  COUNTRY_COORDS,
  GOVERNANCE_STYLES,
  TRADE_ROUTES,
  STRATEGIC_STRAITS,
  REFINING_PROFILES,
  WORKFORCE_PROFILES,
  STRATEGIC_ACTION_TYPES,
  LEADERBOARD_WEIGHTS,
  MAX_EVENTS_PER_DAY,
  EVENT_TEMPLATES,
  IDEA_BADGES,
  POLICY_TYPES,
};
