const express = require('express');
const quarantine = require('../lib/quarantine');

const router = express.Router();

router.get('/', (req, res) => res.json({ items: quarantine.list() }));

router.post('/:id/release', (req, res) => {
  const item = quarantine.release(req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });
  res.json({ item });
});

router.post('/:id/deny', (req, res) => {
  const item = quarantine.deny(req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });
  res.json({ item });
});

module.exports = router;
