const express = require('express');
const router = express.Router();
const { computeCompanyCompliance, evaluateAuditTrigger, computeTaxProfile } = require('../engines/complianceEngine');
const { worldState } = require('../services/worldState');

// GET /api/compliance/:companyId — compliance profile for a company
router.get('/:companyId', (req, res) => {
  try {
    const state = worldState.getState();
    const company = state.companies.find(c => c.id === req.params.companyId);
    if (!company) {
      // Return generic compliance for demo purposes
      return res.json({
        companyId: req.params.companyId,
        complianceScore: 65,
        regulatoryBurden: 70,
        transparency: 60,
        auditRisk: 35,
        auditFrequency: 'medium',
        trustScore: 62,
        status: 'watch',
        taxProfile: { corporateTaxRate: 25, importTariffRate: 12, exportDutyRate: 5, subsidyRate: 0, netTaxBurden: 32 },
      });
    }

    const profile = computeCompanyCompliance(company, state.day || 0, state.activeScenarios || []);
    const taxProfile = computeTaxProfile(company);
    res.json({ ...profile, taxProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compliance/audit — simulate an audit event for a company
router.post('/audit', (req, res) => {
  try {
    const { companyId } = req.body;
    const state = worldState.getState();
    const company = state.companies.find(c => c.id === companyId);

    const baseProfile = company
      ? computeCompanyCompliance(company, state.day || 0, state.activeScenarios || [])
      : { complianceScore: 55, auditRisk: 50, auditFrequency: 'medium' };

    const auditEvent = evaluateAuditTrigger(baseProfile, state.day || 0);
    res.json({ auditEvent, triggered: !!auditEvent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
