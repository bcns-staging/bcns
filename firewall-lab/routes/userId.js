const express = require('express');
const crud = require('../lib/crud');
const userId = require('../lib/intel/userId');

const router = express.Router();
crud(router, 'users', 'user');

router.get('/resolve/:ip', (req, res) => {
  res.json(userId.resolve(req.params.ip) || { user: null, groups: [] });
});

module.exports = router;
