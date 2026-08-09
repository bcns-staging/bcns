const express = require('express');
const ha = require('../lib/ha');

const router = express.Router();

router.get('/state', (req, res) => res.json(ha.getState()));
router.post('/failover', (req, res) => res.json(ha.failover()));
router.post('/session-sync', (req, res) => res.json(ha.toggleSessionSync(!!req.body.enabled)));

module.exports = router;
