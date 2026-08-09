const express = require('express');
const bec = require('../lib/gateway/bec');

const router = express.Router();

router.post('/score', (req, res) => {
  const { displayName, fromEmail, replyTo, subject, body } = req.body;
  res.json(bec.score({ displayName, fromEmail, replyTo, subject, body }));
});

module.exports = router;
