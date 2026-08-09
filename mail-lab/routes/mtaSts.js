const express = require('express');
const mtaSts = require('../lib/mtaSts');

const router = express.Router();

router.get('/:domain/policy', (req, res) => {
  res.json({ policy: mtaSts.getPolicy(req.params.domain) });
});

router.post('/:domain/policy', (req, res) => {
  const { mode, mx, maxAge } = req.body;
  if (!mode || !mx) return res.status(400).json({ error: 'mode and mx are required' });
  res.json({ policy: mtaSts.setPolicy(req.params.domain, { mode, mx, maxAge }) });
});

// Simulated well-known policy file, e.g. https://mta-sts.<domain>/.well-known/mta-sts.txt
router.get('/:domain/policy-file', (req, res) => {
  const text = mtaSts.getPolicyFileText(req.params.domain);
  if (!text) return res.status(404).type('text/plain').send('policy not found');
  res.type('text/plain').send(text);
});

router.post('/:domain/evaluate', (req, res) => {
  const { mxHost, tlsAvailable } = req.body;
  res.json(mtaSts.evaluateDelivery({ domain: req.params.domain, mxHost, tlsAvailable: !!tlsAvailable }));
});

module.exports = router;
