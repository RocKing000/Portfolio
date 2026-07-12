// ============================================
// COMPLIANCE ENGINE — Regulatory, audit, and transparency system
// ============================================

const { v4: uuidv4 } = require('uuid');

const BASE_COMPLIANCE_BY_COUNTRY = {
  'United States':  { regulatory: 78, transparency: 72, auditRisk: 30 },
  'China':          { regulatory: 52, transparency: 38, auditRisk: 55 },
  'Germany':        { regulatory: 88, transparency: 88, auditRisk: 18 },
  'Japan':          { regulatory: 82, transparency: 80, auditRisk: 20 },
  'India':          { regulatory: 58, transparency: 52, auditRisk: 48 },
  'United Kingdom': { regulatory: 86, transparency: 84, auditRisk: 18 },
  'France':         { regulatory: 82, transparency: 78, auditRisk: 20 },
  'Brazil':         { regulatory: 55, transparency: 50, auditRisk: 52 },
  'Canada':         { regulatory: 84, transparency: 86, auditRisk: 16 },
  'Russia':         { regulatory: 40, transparency: 28, auditRisk: 65 },
  'South Korea':    { regulatory: 78, transparency: 72, auditRisk: 26 },
  'Australia':      { regulatory: 86, transparency: 88, auditRisk: 16 },
  'Mexico':         { regulatory: 52, transparency: 45, auditRisk: 55 },
  'Saudi Arabia':   { regulatory: 58, transparency: 42, auditRisk: 45 },
  'Taiwan':         { regulatory: 74, transparency: 70, auditRisk: 28 },
  'Nigeria':        { regulatory: 32, transparency: 28, auditRisk: 72 },
  'Norway':         { regulatory: 90, transparency: 92, auditRisk: 12 },
  'Switzerland':    { regulatory: 90, transparency: 88, auditRisk: 14 },
  'Netherlands':    { regulatory: 88, transparency: 86, auditRisk: 16 },
  'UAE':            { regulatory: 68, transparency: 62, auditRisk: 35 },
  'Singapore':      { regulatory: 88, transparency: 84, auditRisk: 15 },
  'Indonesia':      { regulatory: 50, transparency: 44, auditRisk: 55 },
  'Turkey':         { regulatory: 52, transparency: 42, auditRisk: 50 },
  'South Africa':   { regulatory: 58, transparency: 56, auditRisk: 45 },
};

const INDUSTRY_COMPLIANCE_PROFILE = {
  defense:      { baseScore: 75, regulatoryBurden: 85, auditFrequency: 'high' },
  pharma:       { baseScore: 78, regulatoryBurden: 90, auditFrequency: 'high' },
  energy:       { baseScore: 65, regulatoryBurden: 80, auditFrequency: 'high' },
  mining:       { baseScore: 55, regulatoryBurden: 75, auditFrequency: 'medium' },
  ev:           { baseScore: 70, regulatoryBurden: 72, auditFrequency: 'medium' },
  electronics:  { baseScore: 68, regulatoryBurden: 65, auditFrequency: 'medium' },
  agriculture:  { baseScore: 60, regulatoryBurden: 70, auditFrequency: 'medium' },
  automotive:   { baseScore: 70, regulatoryBurden: 75, auditFrequency: 'medium' },
  telecom:      { baseScore: 72, regulatoryBurden: 70, auditFrequency: 'low' },
  construction: { baseScore: 58, regulatoryBurden: 65, auditFrequency: 'low' },
};

const STRATEGY_COMPLIANCE_MOD = {
  sustainable: { scoreBoost: 8,  auditRiskReduction: 10 },
  balanced:    { scoreBoost: 0,  auditRiskReduction: 0 },
  cost:        { scoreBoost: -5, auditRiskReduction: -8 },
};

const AUDIT_ISSUE_TEMPLATES = [
  { type: 'environmental', severity: 3, title: 'Environmental compliance gap detected', impact: { score: -8, trust: -5 } },
  { type: 'financial',     severity: 4, title: 'Financial disclosure irregularity', impact: { score: -12, trust: -10 } },
  { type: 'labor',         severity: 2, title: 'Labor standards review triggered', impact: { score: -5, trust: -3 } },
  { type: 'data',          severity: 3, title: 'Data governance audit initiated', impact: { score: -7, trust: -5 } },
  { type: 'supply_chain',  severity: 3, title: 'Supply chain traceability gap', impact: { score: -6, trust: -4 } },
  { type: 'tax',           severity: 4, title: 'Transfer pricing investigation', impact: { score: -10, trust: -8 } },
  { type: 'sanctions',     severity: 5, title: 'Sanctions violation flagged', impact: { score: -20, trust: -18 } },
];

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

/**
 * Compute compliance profile for a company.
 */
function computeCompanyCompliance(company, simulationDay, activeScenarios) {
  const countryBase = BASE_COMPLIANCE_BY_COUNTRY[company.country] || { regulatory: 60, transparency: 55, auditRisk: 45 };
  const industryProfile = INDUSTRY_COMPLIANCE_PROFILE[company.industry] || INDUSTRY_COMPLIANCE_PROFILE.electronics;
  const stratMod = STRATEGY_COMPLIANCE_MOD[company.strategy] || STRATEGY_COMPLIANCE_MOD.balanced;

  // Base compliance score
  const baseScore = (
    countryBase.regulatory * 0.35 +
    countryBase.transparency * 0.30 +
    industryProfile.baseScore * 0.35
  ) + stratMod.scoreBoost;

  // Scale affects audit exposure (large companies face more scrutiny)
  const scaleAuditMod = { small: -10, medium: 0, large: 12 }[company.scale] || 0;
  const auditRisk = clamp(countryBase.auditRisk + scaleAuditMod - stratMod.auditRiskReduction, 5, 95);

  // Simulation-day decay (compliance gradually drifts without active management)
  const dayDecay = Math.floor(simulationDay / 30) * 0.5; // -0.5 per month
  const complianceScore = clamp(baseScore - dayDecay, 20, 100);

  const trustScore = clamp(
    countryBase.transparency * 0.5 + complianceScore * 0.5 + stratMod.scoreBoost * 0.5,
    10, 100
  );

  return {
    companyId: company.id,
    complianceScore: Math.round(complianceScore),
    regulatoryBurden: industryProfile.regulatoryBurden,
    transparency: Math.round(countryBase.transparency + stratMod.scoreBoost * 0.5),
    auditRisk: Math.round(auditRisk),
    auditFrequency: industryProfile.auditFrequency,
    trustScore: Math.round(trustScore),
    status: complianceScore >= 75 ? 'compliant' : complianceScore >= 55 ? 'watch' : 'at_risk',
  };
}

/**
 * Evaluate whether an audit issue should be triggered.
 * Returns an audit event or null.
 */
function evaluateAuditTrigger(complianceProfile, simulationDay) {
  const { auditRisk, complianceScore, auditFrequency } = complianceProfile;

  // Frequency modifiers
  const freqMod = { high: 1.5, medium: 1.0, low: 0.6 }[auditFrequency] || 1.0;

  // Probability of audit issue this cycle
  const triggerProb = (auditRisk / 100) * freqMod * 0.08; // 8% max per tick

  if (Math.random() > triggerProb) return null;

  // Select an audit issue weighted by severity vs compliance score
  const filteredIssues = AUDIT_ISSUE_TEMPLATES.filter(
    issue => issue.severity <= Math.ceil((100 - complianceScore) / 20) + 1
  );

  if (filteredIssues.length === 0) return null;

  const issue = filteredIssues[Math.floor(Math.random() * filteredIssues.length)];

  return {
    id: uuidv4(),
    type: 'compliance',
    subtype: issue.type,
    title: issue.title,
    severity: issue.severity,
    day: simulationDay,
    impact: issue.impact,
    description: `Audit event at day ${simulationDay}: ${issue.title}. Compliance score impacted by ${issue.impact.score} points.`,
  };
}

/**
 * Compute tax and tariff rates for a company.
 * Returns structured tax/tariff profile.
 */
function computeTaxProfile(company, relationScore = 50) {
  const countryBase = BASE_COMPLIANCE_BY_COUNTRY[company.country] || { regulatory: 60 };

  // Corporate tax: high-regulatory countries tend to have clearer tax codes (lower effective rate with compliance)
  const baseTaxRate = Math.round(25 - (countryBase.regulatory - 60) * 0.1);
  const strategyTaxMod = { sustainable: -3, balanced: 0, cost: 2 }[company.strategy] || 0;
  const effectiveTaxRate = clamp(baseTaxRate + strategyTaxMod, 10, 45);

  // Import tariffs: based on relation score with trade partners
  const importTariffRate = clamp(Math.round(25 - (relationScore / 100) * 20), 2, 40);

  // Export duties
  const exportDutyRate = clamp(Math.round(8 - (countryBase.regulatory / 100) * 6), 0, 20);

  // Subsidies: sustainable strategy benefits
  const subsidyRate = company.strategy === 'sustainable' ? 8 : company.strategy === 'balanced' ? 3 : 0;

  return {
    corporateTaxRate: effectiveTaxRate,
    importTariffRate,
    exportDutyRate,
    subsidyRate,
    netTaxBurden: clamp(effectiveTaxRate + importTariffRate * 0.3 + exportDutyRate * 0.2 - subsidyRate, 5, 60),
  };
}

module.exports = {
  computeCompanyCompliance,
  evaluateAuditTrigger,
  computeTaxProfile,
  BASE_COMPLIANCE_BY_COUNTRY,
  INDUSTRY_COMPLIANCE_PROFILE,
};
