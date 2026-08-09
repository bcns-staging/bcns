// A minimal admin-console-style quarantine queue: messages the pipeline
// decided to hold get parked here for a human to release or deny, exactly
// like a real secure email gateway's quarantine digest/console.
const crypto = require('crypto');
const store = require('./store');

function list() {
  return store.load('quarantine');
}

function add(entry) {
  const record = { id: crypto.randomUUID(), status: 'pending', createdAt: new Date().toISOString(), ...entry };
  store.update('quarantine', (q) => {
    q.push(record);
    return q;
  });
  return record;
}

function setStatus(id, status) {
  let updated = null;
  store.update('quarantine', (q) => q.map((item) => {
    if (item.id === id) {
      updated = { ...item, status, resolvedAt: new Date().toISOString() };
      return updated;
    }
    return item;
  }));
  return updated;
}

const release = (id) => setStatus(id, 'released');
const deny = (id) => setStatus(id, 'denied');

module.exports = { list, add, release, deny };
