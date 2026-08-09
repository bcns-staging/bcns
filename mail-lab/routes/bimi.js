const express = require('express');
const bimi = require('../lib/bimi');

const router = express.Router();

router.post('/:domain/record', (req, res) => {
  const { selector, logoUrl, vmcUrl } = req.body;
  if (!logoUrl) return res.status(400).json({ error: 'logoUrl is required' });
  const value = bimi.setRecord(req.params.domain, selector || 'default', { logoUrl, vmcUrl });
  res.json({ value });
});

router.get('/:domain/evaluate', (req, res) => {
  res.json(bimi.evaluateDisplay(req.params.domain, req.query.selector || 'default'));
});

module.exports = router;
