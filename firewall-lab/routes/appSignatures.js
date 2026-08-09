const express = require('express');
const crud = require('../lib/crud');
const appId = require('../lib/intel/appId');

const router = express.Router();
crud(router, 'app-signatures', 'signature');

router.post('/identify', (req, res) => {
  res.json(appId.identify({ dstPort: Number(req.body.dstPort), declaredApp: req.body.declaredApp || null }));
});

module.exports = router;
