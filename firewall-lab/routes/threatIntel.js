const express = require('express');
const crud = require('../lib/crud');
const threatIntel = require('../lib/intel/threatIntel');

const router = express.Router();
crud(router, 'threat-intel-feed', 'indicator');

router.post('/lookup', (req, res) => {
  res.json(threatIntel.lookup(req.body.indicator));
});

module.exports = router;
