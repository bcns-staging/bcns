const express = require('express');
const classifier = require('../lib/detectors/classifier');

const router = express.Router();

router.get('/stats', (req, res) => res.json(classifier.stats()));

router.post('/train', (req, res) => {
  const { examples } = req.body;
  if (!Array.isArray(examples) || !examples.length) return res.status(400).json({ error: 'examples array is required' });
  res.json(classifier.addExamples(examples));
});

router.post('/classify', (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') return res.status(400).json({ error: 'text is required' });
  res.json(classifier.classify(text));
});

router.post('/reset', (req, res) => {
  classifier.reset();
  res.json({ ok: true });
});

module.exports = router;
