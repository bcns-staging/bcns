const express = require('express');
const labels = require('../lib/labels');

const router = express.Router();

router.get('/', (req, res) => res.json({ labels: labels.list() }));

router.post('/', (req, res) => {
  const { name, rank } = req.body;
  if (!name || rank === undefined) return res.status(400).json({ error: 'name and rank are required' });
  res.json({ labels: labels.add(name, rank) });
});

router.delete('/:name', (req, res) => res.json({ labels: labels.remove(req.params.name) }));

module.exports = router;
