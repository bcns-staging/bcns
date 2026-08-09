const express = require('express');
const pipeline = require('../lib/engine/pipeline');

const router = express.Router();

router.post('/evaluate', (req, res) => {
  const { connection, ruleset } = req.body;
  if (!connection) return res.status(400).json({ error: 'connection is required' });
  res.json(pipeline.evaluateConnection(connection, { ruleset: ruleset || 'traditional' }));
});

router.post('/evaluate-both', (req, res) => {
  const { connection } = req.body;
  if (!connection) return res.status(400).json({ error: 'connection is required' });
  res.json(pipeline.evaluateBoth(connection));
});

module.exports = router;
