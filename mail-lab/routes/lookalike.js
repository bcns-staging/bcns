const express = require('express');
const lookalike = require('../lib/gateway/lookalike');

const router = express.Router();

router.get('/domains', (req, res) => res.json({ domains: lookalike.listProtectedDomains() }));

router.post('/domains', (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain is required' });
  res.json({ domains: lookalike.addProtectedDomain(domain) });
});

router.delete('/domains/:domain', (req, res) => {
  res.json({ domains: lookalike.removeProtectedDomain(req.params.domain) });
});

router.post('/check', (req, res) => {
  const { senderDomain } = req.body;
  if (!senderDomain) return res.status(400).json({ error: 'senderDomain is required' });
  res.json(lookalike.check(senderDomain));
});

module.exports = router;
