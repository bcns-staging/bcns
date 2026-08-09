const express = require('express');
const dlp = require('../lib/gateway/dlp');

const router = express.Router();

router.post('/scan', (req, res) => {
  const { text } = req.body;
  res.json(dlp.scan(text || ''));
});

module.exports = router;
