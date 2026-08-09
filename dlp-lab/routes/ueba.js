const express = require('express');
const ueba = require('../lib/ueba');

const router = express.Router();

router.post('/event', (req, res) => {
  const { user, channel, bytes } = req.body;
  if (!user || !channel || typeof bytes !== 'number') return res.status(400).json({ error: 'user, channel and bytes (number) are required' });
  res.json(ueba.checkAndRecord({ user, channel, bytes }));
});

router.get('/history/:user', (req, res) => res.json({ history: ueba.getHistory(req.params.user) }));

module.exports = router;
