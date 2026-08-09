const express = require('express');
const dkimKeystore = require('../lib/dkimKeystore');
const dkim = require('../lib/dkim');

const router = express.Router();

router.get('/:domain/keys', (req, res) => {
  res.json({ keys: dkimKeystore.listSelectors(req.params.domain) });
});

router.post('/:domain/keys', (req, res) => {
  const { selector } = req.body;
  if (!selector) return res.status(400).json({ error: 'selector is required' });
  const key = dkimKeystore.createKey(req.params.domain, selector);
  res.json({
    domain: key.domain,
    selector: key.selector,
    publicKeyPem: key.publicKeyPem,
    privateKeyPem: key.privateKeyPem,
    dnsValue: dkim.publicKeyToDns(key.publicKeyPem),
    createdAt: key.createdAt,
  });
});

router.delete('/:domain/keys/:selector', (req, res) => {
  dkimKeystore.deleteKey(req.params.domain, req.params.selector);
  res.json({ ok: true });
});

// Sign/verify sandbox used by the DKIM lab page to show the mechanics
// without needing to go through the full Compose pipeline.
router.post('/:domain/try-sign', (req, res) => {
  const { selector, from, to, subject, body } = req.body;
  const key = dkimKeystore.getKey(req.params.domain, selector);
  if (!key) return res.status(404).json({ error: 'no such DKIM key -- generate one first' });
  const msgHeaders = [['From', from], ['To', to], ['Subject', subject], ['Date', new Date().toUTCString()]];
  const sig = dkim.sign({
    domain: req.params.domain,
    selector,
    privateKeyPem: key.privateKeyPem,
    headers: msgHeaders,
    body: body || '',
    headerFieldsToSign: ['from', 'to', 'subject', 'date'],
  });
  const verification = dkim.verify({ dkimValue: sig.value, headers: msgHeaders, body: body || '' });
  res.json({ header: sig.header, dataToSign: sig.dataToSign, verification, headers: msgHeaders });
});

module.exports = router;
