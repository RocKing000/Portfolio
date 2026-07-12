const express = require('express');
const router = express.Router();
const { COUNTRY_COORDS, COUNTRY_RISK_MAP, TRADE_ROUTES, STRATEGIC_STRAITS } = require('../config/constants');

// Precompute static countries list once at startup
const _countriesList = Object.entries(COUNTRY_COORDS).map(([name, coords]) => ({
  name,
  lat: coords.lat,
  lng: coords.lng,
  risk: COUNTRY_RISK_MAP[name] || 0.5,
}));

// GET /api/geo/countries - Get all country data with coordinates and risk
router.get('/countries', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600'); // static data — cache 1 hour
  res.json(_countriesList);
});

// GET /api/geo/trade-routes - Get all trade routes
router.get('/trade-routes', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(TRADE_ROUTES);
});

// GET /api/geo/straits - Get strategic straits and chokepoints
router.get('/straits', (_req, res) => {
  res.json(STRATEGIC_STRAITS);
});

// GET /api/geo/resource-map/:resource - Get resource availability heatmap data
router.get('/resource-map/:resource', (req, res) => {
  const resourceName = decodeURIComponent(req.params.resource);

  // Generate heatmap based on top producers from constants
  const RESOURCE_PRODUCERS = {
    'Crude Oil': [
      { country: 'Saudi Arabia', share: 0.13 }, { country: 'United States', share: 0.12 }, { country: 'Russia', share: 0.11 },
      { country: 'Canada', share: 0.06 }, { country: 'Iran', share: 0.04 }, { country: 'Brazil', share: 0.04 },
    ],
    'Lithium': [
      { country: 'Australia', share: 0.47 }, { country: 'Chile', share: 0.30 }, { country: 'China', share: 0.15 },
      { country: 'Argentina', share: 0.06 },
    ],
    'Cobalt': [
      { country: 'DRC', share: 0.70 }, { country: 'Russia', share: 0.05 }, { country: 'Australia', share: 0.04 },
      { country: 'Philippines', share: 0.04 },
    ],
    'Semiconductors': [
      { country: 'Taiwan', share: 0.55 }, { country: 'South Korea', share: 0.18 }, { country: 'United States', share: 0.10 },
      { country: 'China', share: 0.08 }, { country: 'Japan', share: 0.06 },
    ],
    'Rare Earth Elements': [
      { country: 'China', share: 0.60 }, { country: 'Myanmar', share: 0.12 }, { country: 'Australia', share: 0.10 },
      { country: 'United States', share: 0.05 },
    ],
    'Copper': [
      { country: 'Chile', share: 0.27 }, { country: 'Peru', share: 0.10 }, { country: 'China', share: 0.08 },
      { country: 'DRC', share: 0.07 }, { country: 'United States', share: 0.06 },
    ],
    'Iron Ore': [
      { country: 'Australia', share: 0.37 }, { country: 'Brazil', share: 0.17 }, { country: 'China', share: 0.14 },
      { country: 'India', share: 0.09 },
    ],
    'Wheat': [
      { country: 'China', share: 0.17 }, { country: 'India', share: 0.14 }, { country: 'Russia', share: 0.11 },
      { country: 'United States', share: 0.06 }, { country: 'France', share: 0.05 },
    ],
    'Natural Gas': [
      { country: 'United States', share: 0.24 }, { country: 'Russia', share: 0.17 }, { country: 'Iran', share: 0.06 },
      { country: 'China', share: 0.05 }, { country: 'Canada', share: 0.04 },
    ],
    'Nickel': [
      { country: 'Indonesia', share: 0.48 }, { country: 'Philippines', share: 0.10 }, { country: 'Russia', share: 0.06 },
      { country: 'Australia', share: 0.05 },
    ],
  };

  const producers = RESOURCE_PRODUCERS[resourceName] || [];

  const heatmapData = producers
    .filter(p => COUNTRY_COORDS[p.country])
    .map(p => ({
      country: p.country,
      lat: COUNTRY_COORDS[p.country].lat,
      lng: COUNTRY_COORDS[p.country].lng,
      share: p.share,
      risk: COUNTRY_RISK_MAP[p.country] || 0.5,
      intensity: p.share * 100,
    }));

  res.json({
    resource: resourceName,
    producers: heatmapData,
    totalCountries: heatmapData.length,
  });
});

module.exports = router;
