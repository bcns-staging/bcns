const express = require('express');
const transport = require('../lib/transport');

const router = express.Router();

router.post('/simulate', (req, res) => {
  const { fromHost, toHost, useTls } = req.body;
  res.json(transport.simulateSmtpSession({
    fromHost: fromHost || 'sender.local',
    toHost: toHost || 'mx.lab.local',
    useTls: !!useTls,
  }));
});

module.exports = router;
