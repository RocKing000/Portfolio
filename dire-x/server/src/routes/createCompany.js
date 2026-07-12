const router = require('express').Router();
const { createCompany } = require('../services/companyCreator');
const { worldState } = require('../services/worldState');
const { registerOwnership } = require('../middleware/auth');
const { sanitizeCompanyName } = require('../middleware/inputSanitizer');

// Max companies per session
const MAX_COMPANIES_PER_SESSION = 5;
// Max companies in world
const MAX_COMPANIES_TOTAL = 100;

// POST /api/create-company
router.post('/', async (req, res) => {
  try {
    const { industry, country, strategy, scale } = req.body;
    const name = sanitizeCompanyName(req.body.name);

    if (!industry || !country || !strategy || !scale) {
      return res.status(400).json({
        error: 'Missing required fields: industry, country, strategy, scale',
        code: 'MISSING_FIELD',
      });
    }

    // Guard: limit companies per session
    if (req.session && req.session.companyIds.length >= MAX_COMPANIES_PER_SESSION) {
      return res.status(400).json({
        error: `Maximum ${MAX_COMPANIES_PER_SESSION} companies per session`,
        code: 'SESSION_LIMIT',
      });
    }

    // Guard: limit total companies in world
    if (worldState.companies.size >= MAX_COMPANIES_TOTAL) {
      return res.status(400).json({
        error: `Maximum ${MAX_COMPANIES_TOTAL} companies in simulation`,
        code: 'WORLD_LIMIT',
      });
    }

    const company = await createCompany({ name, industry, country, strategy, scale });

    worldState.addCompany(company);

    // Register ownership so only this session can control this company
    registerOwnership(req.session, company.id);

    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
