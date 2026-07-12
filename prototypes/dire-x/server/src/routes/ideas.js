const express = require('express');
const router = express.Router();
const { evaluateIdea } = require('../engines/creativeIntelligence');

// In-memory idea store
const companyIdeas = new Map();

// POST /api/ideas - Evaluate and store an idea
router.post('/', (req, res) => {
  const { companyId, text, simulationDay } = req.body;

  if (!text || text.trim().length < 5) {
    return res.status(400).json({ error: 'Idea text must be at least 5 characters' });
  }

  const evaluated = evaluateIdea(text, simulationDay || 0);
  evaluated.id = `idea-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  evaluated.company_id = companyId;
  evaluated.created_at = new Date().toISOString();

  const existing = companyIdeas.get(companyId) || [];
  existing.push(evaluated);
  companyIdeas.set(companyId, existing);

  res.json(evaluated);
});

// GET /api/ideas/:companyId - Get all ideas for a company
router.get('/:companyId', (req, res) => {
  const ideas = companyIdeas.get(req.params.companyId) || [];

  // Sort by combined score descending
  const sorted = [...ideas].sort((a, b) => b.combined_score - a.combined_score);

  // Compute badge summary
  const allBadges = {};
  for (const idea of sorted) {
    for (const badge of idea.badges) {
      allBadges[badge] = (allBadges[badge] || 0) + 1;
    }
  }

  res.json({
    ideas: sorted,
    total: sorted.length,
    notable: sorted.filter(i => i.is_notable).length,
    badges: allBadges,
  });
});

// GET /api/ideas/:companyId/badges - Get badge summary
router.get('/:companyId/badges', (req, res) => {
  const ideas = companyIdeas.get(req.params.companyId) || [];
  const badges = {};
  for (const idea of ideas) {
    for (const badge of idea.badges) {
      badges[badge] = (badges[badge] || 0) + 1;
    }
  }
  res.json({ badges, totalIdeas: ideas.length });
});

module.exports = router;
