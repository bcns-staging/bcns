const express = require('express');
const dmarcReport = require('../lib/dmarcReport');

const router = express.Router();

router.get('/:domain/messages', (req, res) => {
  res.json({ messages: dmarcReport.listMessages(req.params.domain) });
});

router.get('/:domain/aggregate', (req, res) => {
  res.json(dmarcReport.generateAggregateReport(req.params.domain));
});

router.get('/forensic/:messageId', (req, res) => {
  const report = dmarcReport.generateForensicReport(req.params.messageId);
  if (!report) return res.status(404).json({ error: 'message not found' });
  res.type('text/plain').send(report);
});

module.exports = router;
