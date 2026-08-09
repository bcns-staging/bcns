const express = require('express');
const compliance = require('../lib/compliancePacks');

const router = express.Router();

router.get('/packs', (req, res) => res.json({ packs: compliance.list() }));

router.post('/packs/:id/activate', (req, res) => {
  try {
    res.json(compliance.activate(req.params.id, req.body.channels));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
