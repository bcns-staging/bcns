// Display-name spoofing: an attacker sets their "From" display name to
// match someone the recipient trusts (a CEO, a known vendor) while the
// underlying email address is entirely unrelated. Since mail clients often
// show only the display name by default, this is a very effective and very
// cheap attack -- no authentication mechanism catches it, because it isn't
// forging anything DNS-verifiable.
const store = require('../store');

function listKnownContacts() {
  return store.load('known-contacts');
}

function addKnownContact(name, email) {
  const contact = { name: name.trim(), email: email.trim().toLowerCase() };
  store.update('known-contacts', (list) => [...list.filter((c) => c.email !== contact.email), contact]);
  return listKnownContacts();
}

function removeKnownContact(email) {
  const e = email.trim().toLowerCase();
  store.update('known-contacts', (list) => list.filter((c) => c.email !== e));
  return listKnownContacts();
}

function check(displayName, fromEmail, knownContacts = null) {
  const name = (displayName || '').trim().toLowerCase();
  const email = (fromEmail || '').trim().toLowerCase();
  if (!name) return { flagged: false, findings: [] };

  const contacts = knownContacts || listKnownContacts();
  const findings = [];
  for (const contact of contacts) {
    if (contact.name.trim().toLowerCase() === name && contact.email !== email) {
      findings.push({ matchedContact: contact, reason: `display name matches known contact "${contact.name}" (${contact.email}), but the email address is ${email || '(none)'}` });
    }
  }
  return { flagged: findings.length > 0, findings };
}

module.exports = { listKnownContacts, addKnownContact, removeKnownContact, check };
