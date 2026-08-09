const express = require('express');
const impersonation = require('../lib/gateway/impersonation');

const router = express.Router();

router.get('/contacts', (req, res) => res.json({ contacts: impersonation.listKnownContacts() }));

router.post('/contacts', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  res.json({ contacts: impersonation.addKnownContact(name, email) });
});

router.delete('/contacts/:email', (req, res) => {
  res.json({ contacts: impersonation.removeKnownContact(req.params.email) });
});

router.post('/check', (req, res) => {
  const { displayName, fromEmail } = req.body;
  res.json(impersonation.check(displayName, fromEmail));
});

module.exports = router;
