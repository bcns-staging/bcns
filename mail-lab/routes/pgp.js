const express = require('express');
const pgp = require('../lib/pgp');

const router = express.Router();

function asyncRoute(fn) {
  return (req, res) => fn(req, res).catch((err) => res.status(400).json({ error: err.message }));
}

router.post('/generate-keys', asyncRoute(async (req, res) => {
  const { name, email, passphrase } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  res.json(await pgp.generateKeyPair({ name, email, passphrase }));
}));

router.post('/encrypt', asyncRoute(async (req, res) => {
  const { text, publicKeyArmored, signingPrivateKeyArmored, passphrase } = req.body;
  if (!text || !publicKeyArmored) return res.status(400).json({ error: 'text and publicKeyArmored are required' });
  const armoredMessage = await pgp.encrypt({ text, publicKeyArmored, signingPrivateKeyArmored, passphrase });
  res.json({ armoredMessage });
}));

router.post('/decrypt', asyncRoute(async (req, res) => {
  const { armoredMessage, privateKeyArmored, passphrase, publicKeyArmoredForVerify } = req.body;
  if (!armoredMessage || !privateKeyArmored) return res.status(400).json({ error: 'armoredMessage and privateKeyArmored are required' });
  res.json(await pgp.decrypt({ armoredMessage, privateKeyArmored, passphrase, publicKeyArmoredForVerify }));
}));

router.post('/sign', asyncRoute(async (req, res) => {
  const { text, privateKeyArmored, passphrase } = req.body;
  if (!text || !privateKeyArmored) return res.status(400).json({ error: 'text and privateKeyArmored are required' });
  const armoredSignedMessage = await pgp.sign({ text, privateKeyArmored, passphrase });
  res.json({ armoredSignedMessage });
}));

router.post('/verify', asyncRoute(async (req, res) => {
  const { armoredSignedMessage, publicKeyArmored } = req.body;
  if (!armoredSignedMessage || !publicKeyArmored) return res.status(400).json({ error: 'armoredSignedMessage and publicKeyArmored are required' });
  res.json(await pgp.verify({ armoredSignedMessage, publicKeyArmored }));
}));

module.exports = router;
