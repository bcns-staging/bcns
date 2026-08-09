const express = require('express');
const crud = require('../lib/crud');
const urlCategory = require('../lib/intel/urlCategory');

const router = express.Router();
crud(router, 'url-categories', 'entry');

router.post('/categorize', (req, res) => {
  res.json(urlCategory.categorize(req.body.url));
});

module.exports = router;
