const express = require('express');
const sessionTable = require('../lib/engine/sessionTable');

const router = express.Router();

router.get('/', (req, res) => res.json({ sessions: sessionTable.all() }));
router.delete('/', (req, res) => { sessionTable.clear(); res.json({ ok: true }); });

module.exports = router;
