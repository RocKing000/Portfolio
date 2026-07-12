// ============================================
// Country Resolver — Canonical bidirectional mapping
// Solves ISO2 vs full-name mismatch across all engines
// ============================================

const COUNTRY_MAP = {
  US: 'United States', CN: 'China', DE: 'Germany', IN: 'India',
  BR: 'Brazil', KR: 'South Korea', JP: 'Japan', TW: 'Taiwan',
  RU: 'Russia', NG: 'Nigeria', AU: 'Australia', GB: 'United Kingdom',
  SA: 'Saudi Arabia', MX: 'Mexico', ID: 'Indonesia', TR: 'Turkey',
  VN: 'Vietnam', TH: 'Thailand', ZA: 'South Africa', EG: 'Egypt',
  CA: 'Canada', FR: 'France', CL: 'Chile', PE: 'Peru',
  CD: 'DRC', MM: 'Myanmar', KZ: 'Kazakhstan', PH: 'Philippines',
  BD: 'Bangladesh', AR: 'Argentina', ZW: 'Zimbabwe', GA: 'Gabon',
  MZ: 'Mozambique', SG: 'Singapore', CH: 'Switzerland', IR: 'Iran',
  NO: 'Norway', NL: 'Netherlands', SE: 'Sweden', IL: 'Israel',
  UA: 'Ukraine', PK: 'Pakistan', AE: 'United Arab Emirates',
  QA: 'Qatar', KW: 'Kuwait', IQ: 'Iraq', PL: 'Poland',
  IT: 'Italy', ES: 'Spain', PT: 'Portugal', GR: 'Greece',
  AT: 'Austria', BE: 'Belgium', DK: 'Denmark', FI: 'Finland',
  IE: 'Ireland', NZ: 'New Zealand', MY: 'Malaysia', CO: 'Colombia',
  KE: 'Kenya', GH: 'Ghana', TZ: 'Tanzania', ET: 'Ethiopia',
  DZ: 'Algeria', MA: 'Morocco', AO: 'Angola', ZM: 'Zambia',
  BY: 'Belarus', RS: 'Serbia', HR: 'Croatia', RO: 'Romania',
  HU: 'Hungary', CZ: 'Czech Republic', SK: 'Slovakia', BG: 'Bulgaria',
  LT: 'Lithuania', LV: 'Latvia', EE: 'Estonia', SI: 'Slovenia',
  KH: 'Cambodia', LK: 'Sri Lanka', NP: 'Nepal', MN: 'Mongolia',
  KP: 'North Korea',
};

// Build reverse: name → ISO2
const NAME_TO_ISO2 = {};
for (const [iso, name] of Object.entries(COUNTRY_MAP)) {
  NAME_TO_ISO2[name.toLowerCase()] = iso;
}

// Aliases
const ALIASES = {
  uk: 'GB', 'united kingdom': 'GB', england: 'GB', britain: 'GB',
  usa: 'US', america: 'US', 'united states of america': 'US',
  'south korea': 'KR', 'republic of korea': 'KR', korea: 'KR',
  drc: 'CD', 'democratic republic of the congo': 'CD', congo: 'CD',
  uae: 'AE', 'united arab emirates': 'AE',
  'czech republic': 'CZ', czechia: 'CZ',
  'ivory coast': 'CI', "cote d'ivoire": 'CI',
};
for (const [alias, iso] of Object.entries(ALIASES)) {
  NAME_TO_ISO2[alias] = iso;
}

/**
 * Resolve any country input to { iso2, name }.
 * Accepts ISO2, full name, alias, or partial match.
 */
function resolveCountry(input) {
  if (!input || typeof input !== 'string') return { iso2: 'US', name: 'United States', unknown: true };

  const clean = input.trim();

  // Try as ISO2 (2-letter code)
  if (clean.length <= 3) {
    const upper = clean.toUpperCase();
    if (COUNTRY_MAP[upper]) {
      return { iso2: upper, name: COUNTRY_MAP[upper] };
    }
  }

  // Try exact name or alias match
  const lower = clean.toLowerCase();
  if (NAME_TO_ISO2[lower]) {
    const iso2 = NAME_TO_ISO2[lower];
    return { iso2, name: COUNTRY_MAP[iso2] };
  }

  // Partial match: input starts with or is contained in known name
  for (const [name, iso] of Object.entries(NAME_TO_ISO2)) {
    if (lower.startsWith(name) || name.startsWith(lower)) {
      return { iso2: iso, name: COUNTRY_MAP[iso] };
    }
  }

  // Unknown — return as-is with flag
  return { iso2: clean.toUpperCase().slice(0, 2), name: clean, unknown: true };
}

/**
 * Get ISO2 code for any country input. Convenience wrapper.
 */
function toISO2(input) {
  return resolveCountry(input).iso2;
}

/**
 * Get full name for any country input. Convenience wrapper.
 */
function toFullName(input) {
  return resolveCountry(input).name;
}

module.exports = { resolveCountry, toISO2, toFullName, COUNTRY_MAP, NAME_TO_ISO2 };
