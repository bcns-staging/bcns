// Persists DKIM keypairs generated in the lab so the Compose pipeline can
// sign with them later, and publishes the public half into the simulated
// DNS zone the moment a key is created (exactly like updating real DNS).
const store = require('./store');
const dkim = require('./dkim');
const dnsZone = require('./dnsZone');

function all() {
  return store.load('dkim-keys');
}

function listSelectors(domain) {
  const d = dnsZone.normalize(domain);
  return Object.entries(all()[d] || {}).map(([selector, key]) => ({
    selector,
    publicKeyPem: key.publicKeyPem,
    createdAt: key.createdAt,
  }));
}

function getKey(domain, selector) {
  const d = dnsZone.normalize(domain);
  return all()[d]?.[selector] || null;
}

function createKey(domain, selector) {
  const d = dnsZone.normalize(domain);
  const { publicKeyPem, privateKeyPem } = dkim.generateKeyPair();
  const record = { publicKeyPem, privateKeyPem, createdAt: new Date().toISOString() };
  store.update('dkim-keys', (keys) => {
    keys[d] = keys[d] || {};
    keys[d][selector] = record;
    return keys;
  });
  const dnsRecord = dnsZone.setDkimRecord(d, selector, dkim.publicKeyToDns(publicKeyPem));
  return { domain: d, selector, ...record, dnsRecord };
}

function deleteKey(domain, selector) {
  const d = dnsZone.normalize(domain);
  store.update('dkim-keys', (keys) => {
    if (keys[d]) delete keys[d][selector];
    return keys;
  });
  const name = `${selector}._domainkey.${d}`;
  const existing = dnsZone.findRecords(name, 'TXT')[0];
  if (existing) dnsZone.deleteRecord(d, existing.id);
}

module.exports = { listSelectors, getKey, createKey, deleteKey };
