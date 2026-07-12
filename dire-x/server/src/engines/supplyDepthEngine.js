// ============================================
// Supply Chain Depth Analyzer
// Walks Tier-1 → Tier-N dependencies to find hidden fragilities
// ============================================

/**
 * Tier-2 and Tier-3 resource dependencies.
 * Maps refined/intermediate outputs to their sub-inputs
 * with producer concentration data.
 */
const RESOURCE_DEPENDENCY_GRAPH = {
  'Battery-grade Lithium': {
    tier: 2,
    inputs: ['Lithium', 'Sulfuric Acid', 'Sodium Hydroxide'],
    producers: { 'Sulfuric Acid': { CN: 0.35, US: 0.12, IN: 0.10 } },
  },
  'Battery-grade Cobalt': {
    tier: 2,
    inputs: ['Cobalt', 'Sulfuric Acid', 'Hydrogen'],
    producers: { Cobalt: { CD: 0.73, AU: 0.04, PH: 0.04 } },
  },
  'Battery-grade Nickel': {
    tier: 2,
    inputs: ['Nickel', 'Chlorine', 'Hydrogen'],
    producers: { Nickel: { ID: 0.37, PH: 0.13, RU: 0.09 } },
  },
  'Anode-grade Graphite': {
    tier: 2,
    inputs: ['Graphite', 'Hydrofluoric Acid'],
    producers: { Graphite: { CN: 0.65, MZ: 0.07, BR: 0.07 } },
  },
  'Ultra-pure Silicon': {
    tier: 2,
    inputs: ['Silicon', 'Hydrochloric Acid', 'Ultra-pure Water'],
    producers: { Silicon: { CN: 0.67, RU: 0.05, NO: 0.04 } },
  },
  'Processed Wafers': {
    tier: 2,
    inputs: ['Silicon', 'Neon Gas', 'Argon'],
    producers: { 'Neon Gas': { UA: 0.50, CN: 0.30 } },
  },
  'Patterned Dies': {
    tier: 2,
    inputs: ['Semiconductors', 'Photoresist', 'Neon Gas'],
    producers: { Photoresist: { JP: 0.72, US: 0.15 }, 'Neon Gas': { UA: 0.50, CN: 0.30 } },
  },
  'CMP Slurry': {
    tier: 2,
    inputs: ['Rare Earth Elements', 'Cerium Oxide', 'Deionized Water'],
    producers: { 'Cerium Oxide': { CN: 0.90 } },
  },
  'Purified REE': {
    tier: 2,
    inputs: ['Rare Earth Elements', 'Hydrochloric Acid', 'Solvent'],
    producers: { 'Rare Earth Elements': { CN: 0.60, MM: 0.10, AU: 0.07 } },
  },
  'Aerospace-grade Alloy': {
    tier: 2,
    inputs: ['Advanced Alloys', 'Titanium', 'Chromium'],
    producers: { Titanium: { CN: 0.45, RU: 0.13, JP: 0.10 } },
  },
  'Refined Petroleum': {
    tier: 2,
    inputs: ['Crude Oil', 'Catalyst', 'Hydrogen'],
    producers: { 'Crude Oil': { SA: 0.12, RU: 0.11, US: 0.15 } },
  },
  'Chemical Feedstock': {
    tier: 2,
    inputs: ['Crude Oil', 'Naphtha'],
    producers: { Naphtha: { SA: 0.15, KR: 0.10, JP: 0.08 } },
  },
  // Tier-3: sub-inputs of tier-2 resources
  'Neon Gas': {
    tier: 3,
    inputs: [],
    producers: { 'Neon Gas': { UA: 0.50, CN: 0.30 } },
    note: 'Critical for semiconductor lithography. Ukraine produces 50%.',
  },
  'Polyethylene Separator': {
    tier: 3,
    inputs: ['Crude Oil'],
    producers: { 'Polyethylene Separator': { JP: 0.40, KR: 0.25, CN: 0.20 } },
    note: 'Battery separator film. Asahi Kasei and Toray dominate.',
  },
  Manganese: {
    tier: 3,
    inputs: [],
    producers: { Manganese: { ZA: 0.37, GA: 0.18, AU: 0.14 } },
    note: 'Critical for NMC cathode chemistry.',
  },
  Photoresist: {
    tier: 3,
    inputs: [],
    producers: { Photoresist: { JP: 0.72, US: 0.15 } },
    note: 'Dominated by Japanese firms (JSR, TOK, Shin-Etsu).',
  },
};

/**
 * Walk the dependency tree for a company.
 * @param {Array} companyResources - [{ name, dependency }]
 * @param {object} refiningProfile - from REFINING_PROFILES
 * @returns {object} depth analysis with hidden fragilities
 */
function analyzeSupplyDepth(companyResources, refiningProfile) {
  const tiers = { 1: [], 2: [], 3: [] };
  const hiddenFragilities = [];
  const seen = new Set();

  // Tier 1: direct company resources
  for (const r of companyResources || []) {
    tiers[1].push({ name: r.name, dependency: r.dependency, tier: 1 });
  }

  // Walk refining + manufacturing stages to discover tier-2/3 deps
  const allStages = [
    ...(refiningProfile?.stages || []),
    ...(refiningProfile?.manufacturing || []),
  ];

  for (const stage of allStages) {
    const depNode = RESOURCE_DEPENDENCY_GRAPH[stage.output];
    if (!depNode) continue;

    for (const input of depNode.inputs) {
      const key = `${stage.output}:${input}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const producerData = depNode.producers?.[input] || {};
      const subDep = {
        name: input,
        tier: depNode.tier,
        neededBy: stage.name,
        producers: producerData,
      };

      tiers[depNode.tier].push(subDep);

      // Check concentration risk
      const concentrations = Object.values(producerData);
      const maxConc = Math.max(...concentrations, 0);
      if (maxConc > 0.4) {
        const dominant = Object.entries(producerData).sort((a, b) => b[1] - a[1])[0];
        hiddenFragilities.push({
          resource: input,
          tier: depNode.tier,
          concentration: maxConc,
          dominantProducer: dominant ? { country: dominant[0], share: dominant[1] } : null,
          risk: maxConc > 0.7 ? 'critical' : maxConc > 0.5 ? 'elevated' : 'moderate',
          neededBy: stage.name,
          note: RESOURCE_DEPENDENCY_GRAPH[input]?.note || null,
        });
      }

      // Check if this sub-input has its own tier-3 dependencies
      const tier3Node = RESOURCE_DEPENDENCY_GRAPH[input];
      if (tier3Node && tier3Node.tier === 3) {
        // Flatten all producer values from all keys in this node's producers
        const allT3Producers = {};
        for (const [, producerMap] of Object.entries(tier3Node.producers || {})) {
          for (const [country, share] of Object.entries(producerMap)) {
            allT3Producers[country] = Math.max(allT3Producers[country] || 0, share);
          }
        }
        const t3Conc = Math.max(...Object.values(allT3Producers), 0);
        if (t3Conc > 0.4) {
          const t3Dominant = Object.entries(allT3Producers).sort((a, b) => b[1] - a[1])[0];
          const t3Key = `t3:${input}`;
          if (!seen.has(t3Key)) {
            seen.add(t3Key);
            tiers[3].push({ name: input, tier: 3, neededBy: stage.name, producers: allT3Producers });
            hiddenFragilities.push({
              resource: input,
              tier: 3,
              concentration: t3Conc,
              dominantProducer: t3Dominant ? { country: t3Dominant[0], share: t3Dominant[1] } : null,
              risk: t3Conc > 0.7 ? 'critical' : t3Conc > 0.5 ? 'elevated' : 'moderate',
              neededBy: stage.name,
              note: tier3Node.note || null,
            });
          }
        }
      }
    }
  }

  // Compute Hidden Fragility Index
  const tier1AvgDep =
    tiers[1].reduce((s, r) => s + (r.dependency || 0), 0) / (tiers[1].length || 1);
  const hiddenRiskAvg =
    hiddenFragilities.length > 0
      ? hiddenFragilities.reduce((s, f) => s + f.concentration, 0) / hiddenFragilities.length
      : 0;
  const hfi = tier1AvgDep > 0 ? hiddenRiskAvg / tier1AvgDep : 0;

  return {
    tiers,
    hiddenFragilities: hiddenFragilities.sort((a, b) => b.concentration - a.concentration),
    hiddenFragilityIndex: Math.round(hfi * 100) / 100,
    totalDependencies: tiers[1].length + tiers[2].length + tiers[3].length,
    deepestTierReached: tiers[3].length > 0 ? 3 : tiers[2].length > 0 ? 2 : 1,
  };
}

module.exports = { analyzeSupplyDepth, RESOURCE_DEPENDENCY_GRAPH };
