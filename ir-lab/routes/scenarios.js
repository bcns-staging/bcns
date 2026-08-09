const express = require('express');
const scenarios = require('../lib/scenarios');
const runs = require('../lib/runs');

const router = express.Router();

router.get('/', (req, res) => {
  const list = scenarios.list().map((s) => ({ ...s, bestGrade: runs.bestGrade(s.id) }));
  res.json({ scenarios: list });
});

router.get('/:id', (req, res) => {
  const briefing = scenarios.briefing(req.params.id);
  if (!briefing) return res.status(404).json({ error: 'unknown scenario' });
  res.json({ scenario: briefing });
});

module.exports = router;
