/**
 * routes/ai.js
 * GET /api/ai/insight?nation=US&company=Lockheed+Martin&resources=Titanium,Aluminum
 */

const express = require('express');
const { getStrategicInsight } = require('../services/aiInsights.service');

const router = express.Router();

router.get('/insight', async (req, res, next) => {
  const { nation, company, resources } = req.query;

  // Validate required params
  if (!nation || !company) {
    return res.status(400).json({
      error: 'Missing required query params: nation, company',
      code: 'MISSING_PARAMS',
    });
  }

  const resourceList = resources
    ? resources.split(',').map((r) => r.trim()).filter(Boolean)
    : [];

  console.log(`[AI Route] Insight request — nation=${nation}, company=${company}, resources=[${resourceList.join(', ')}]`);

  try {
    const insight = await getStrategicInsight({ nation, company, resources: resourceList });
    res.json(insight);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
