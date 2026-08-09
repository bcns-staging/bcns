const express = require('express');
const dane = require('../lib/dane');

const router = express.Router();

router.get('/:mxHost/cert', (req, res) => {
  res.json({ cert: dane.getCert(req.params.mxHost) });
});

router.post('/:mxHost/cert', (req, res) => {
  res.json({ cert: dane.issueCert(req.params.mxHost) });
});

router.post('/:mxHost/tlsa', (req, res) => {
  const { port } = req.body;
  res.json({ record: dane.publishTlsa(req.params.mxHost, port || 25) });
});

router.post('/:mxHost/verify', (req, res) => {
  const { port } = req.body;
  res.json(dane.verify({ mxHost: req.params.mxHost, port: port || 25 }));
});

module.exports = router;
