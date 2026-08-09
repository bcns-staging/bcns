const express = require('express');
const smime = require('../lib/smime');

const router = express.Router();

router.post('/generate-cert', (req, res) => {
  const { commonName, email } = req.body;
  if (!commonName || !email) return res.status(400).json({ error: 'commonName and email are required' });
  res.json(smime.generateCert({ commonName, email }));
});

router.post('/sign', (req, res) => {
  const { message, certPem, privateKeyPem } = req.body;
  if (!message || !certPem || !privateKeyPem) return res.status(400).json({ error: 'message, certPem and privateKeyPem are required' });
  res.json(smime.sign({ message, certPem, privateKeyPem }));
});

router.post('/verify', (req, res) => {
  const { message, signature, certPem } = req.body;
  if (!message || !signature || !certPem) return res.status(400).json({ error: 'message, signature and certPem are required' });
  res.json(smime.verify({ message, signature, certPem }));
});

module.exports = router;
