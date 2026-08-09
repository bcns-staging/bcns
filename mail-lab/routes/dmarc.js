const express = require('express');
const dmarc = require('../lib/dmarc');

const router = express.Router();

router.post('/evaluate', (req, res) => {
  const { headerFromDomain, spfResult, spfDomain, dkimResults } = req.body;
  if (!headerFromDomain) return res.status(400).json({ error: 'headerFromDomain is required' });
  const result = dmarc.evaluate({
    headerFromDomain,
    spf: { result: spfResult || 'none', domain: spfDomain },
    dkimResults: dkimResults || [],
  });
  res.json(result);
});

module.exports = router;
