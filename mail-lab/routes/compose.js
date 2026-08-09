const express = require('express');
const pipeline = require('../lib/pipeline');

const router = express.Router();

router.post('/send', (req, res) => {
  try {
    const result = pipeline.send(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
