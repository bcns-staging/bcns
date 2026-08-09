const express = require('express');
const crud = require('../lib/crud');
const dnsSecurity = require('../lib/intel/dnsSecurity');

const router = express.Router();
crud(router, 'dns-blocklist', 'entry');

router.post('/resolve', (req, res) => {
  res.json(dnsSecurity.resolve(req.body.domain));
});

module.exports = router;
