const express = require('express');
const crud = require('../lib/crud');

const router = express.Router();
crud(router, 'nat-rules', 'natRule');

module.exports = router;
