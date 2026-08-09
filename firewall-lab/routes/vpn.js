const express = require('express');
const crud = require('../lib/crud');

const router = express.Router();
crud(router, 'vpn-tunnels', 'tunnel');

module.exports = router;
