const express = require('express');
const crud = require('../lib/crud');

const router = express.Router();
crud(router, 'zones', 'zone');
crud(router, 'interfaces', 'interface');
crud(router, 'hosts', 'host');
crud(router, 'services', 'service');

module.exports = router;
