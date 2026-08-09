const express = require('express');
const spamScore = require('../lib/gateway/spamScore');

const router = express.Router();

router.post('/score', (req, res) => {
  const { subject, body } = req.body;
  res.json(spamScore.score({ subject, body }));
});

module.exports = router;
