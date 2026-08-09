const express = require('express');
const crud = require('../lib/crud');
const ips = require('../lib/intel/ips');

const router = express.Router();
crud(router, 'ips-signatures', 'signature');

router.post('/match', (req, res) => {
  res.json(ips.match(req.body.payloadSignature));
});

module.exports = router;
