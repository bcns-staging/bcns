const express = require('express');
const patterns = require('../lib/detectors/patterns');
const proximityMatch = require('../lib/detectors/proximityMatch');
const edm = require('../lib/detectors/edm');
const { runAll } = require('../lib/textScan');

const router = express.Router();

router.post('/', (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') return res.status(400).json({ error: 'text is required' });
  res.json(runAll(text));
});

router.get('/pattern-types', (req, res) => {
  res.json({ patterns: patterns.PATTERNS.map((p) => ({ id: p.id, name: p.name, weight: p.weight, hasChecksum: !!p.validate })) });
});

router.get('/proximity-types', (req, res) => {
  res.json({ patterns: proximityMatch.LOOSE_PATTERNS.map((p) => ({ id: p.id, name: p.name, contextTerms: p.contextTerms })) });
});

// Lets the EDM page show a value being turned into a salted hash, so the
// "we never store plaintext" claim isn't just asserted -- it's visible.
router.post('/edm-hash-preview', (req, res) => {
  const { value, isNumeric } = req.body;
  if (typeof value !== 'string') return res.status(400).json({ error: 'value is required' });
  const normalized = edm.normalize(value, !!isNumeric);
  res.json({ normalized, hash: edm.hash(normalized) });
});

module.exports = { router, runAll };
