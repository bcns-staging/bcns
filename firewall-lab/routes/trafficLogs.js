const express = require('express');
const trafficLog = require('../lib/trafficLog');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ logs: trafficLog.list(req.query) });
});

module.exports = router;
