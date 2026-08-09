const express = require('express');
const headers = require('../lib/headers');

const router = express.Router();

router.post('/received-chain', (req, res) => {
  const { hops } = req.body;
  if (!Array.isArray(hops) || hops.length === 0) return res.status(400).json({ error: 'hops array is required' });
  res.json({ chain: headers.buildReceivedChain(hops) });
});

router.post('/injection-demo', (req, res) => {
  const { subjectInput } = req.body;
  res.json(headers.demoHeaderInjection(subjectInput || ''));
});

module.exports = router;
