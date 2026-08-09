const express = require('express');
const spf = require('../lib/spf');

const router = express.Router();

router.post('/evaluate', (req, res) => {
  const { domain, ip } = req.body;
  if (!domain || !ip) return res.status(400).json({ error: 'domain and ip are required' });
  res.json(spf.evaluate(domain, ip));
});

module.exports = router;
