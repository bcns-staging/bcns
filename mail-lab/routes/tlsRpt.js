const express = require('express');
const tlsRpt = require('../lib/tlsRpt');

const router = express.Router();

router.get('/:domain/record', (req, res) => {
  res.json({ record: tlsRpt.getRecord(req.params.domain) });
});

router.post('/:domain/record', (req, res) => {
  const { rua } = req.body;
  if (!rua) return res.status(400).json({ error: 'rua is required' });
  res.json({ record: tlsRpt.setRecord(req.params.domain, rua) });
});

router.post('/:domain/simulate-delivery', (req, res) => {
  const { mxHost, success, failureReason } = req.body;
  res.json(tlsRpt.recordAttempt({ domain: req.params.domain, mxHost, success: !!success, failureReason }));
});

router.get('/:domain/report', (req, res) => {
  res.json(tlsRpt.generateReport(req.params.domain));
});

module.exports = router;
