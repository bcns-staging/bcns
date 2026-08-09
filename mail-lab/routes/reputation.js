const express = require('express');
const reputation = require('../lib/gateway/reputation');

const router = express.Router();

router.get('/blocklists', (req, res) => res.json(reputation.blocklists()));

router.post('/ips', (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'ip is required' });
  res.json({ ips: reputation.addBlockedIp(ip) });
});
router.delete('/ips/:ip', (req, res) => res.json({ ips: reputation.removeBlockedIp(req.params.ip) }));

router.post('/domains', (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain is required' });
  res.json({ domains: reputation.addBlockedDomain(domain) });
});
router.delete('/domains/:domain', (req, res) => res.json({ domains: reputation.removeBlockedDomain(req.params.domain) }));

router.post('/check-ip', (req, res) => res.json(reputation.checkIp(req.body.ip)));
router.post('/check-domain', (req, res) => res.json(reputation.checkDomain(req.body.domain)));

module.exports = router;
