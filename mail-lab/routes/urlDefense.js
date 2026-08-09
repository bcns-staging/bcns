const express = require('express');
const urlDefense = require('../lib/gateway/urlDefense');

const router = express.Router();

router.get('/blocklist', (req, res) => res.json({ patterns: urlDefense.blocklist() }));
router.post('/blocklist', (req, res) => {
  const { pattern } = req.body;
  if (!pattern) return res.status(400).json({ error: 'pattern is required' });
  res.json({ patterns: urlDefense.addBlockedUrl(pattern) });
});
router.delete('/blocklist/:pattern', (req, res) => res.json({ patterns: urlDefense.removeBlockedUrl(req.params.pattern) }));

router.post('/rewrite', (req, res) => {
  const { body } = req.body;
  res.json(urlDefense.rewriteLinksInBody(body || ''));
});

router.post('/scan', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  res.json(urlDefense.scanUrl(url));
});

// Simulates what happens when a rewritten link is actually clicked.
router.get('/click', (req, res) => {
  const { u, sig } = req.query;
  const result = urlDefense.resolveClick(u, sig);
  res.json(result);
});

module.exports = router;
