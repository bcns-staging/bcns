// The case-management queue: every policy match that isn't a clean "allow"
// lands here for a human to triage, exactly like a real DLP incident
// console. Mirrors the email lab's quarantine.js.
const crypto = require('crypto');
const store = require('./store');

function list() {
  return store.load('incidents');
}

function add(entry) {
  const record = { id: crypto.randomUUID(), status: 'open', createdAt: new Date().toISOString(), notes: [], ...entry };
  store.update('incidents', (list_) => {
    list_.push(record);
    return list_;
  });
  return record;
}

function setStatus(id, status) {
  let updated = null;
  store.update('incidents', (list_) => list_.map((item) => {
    if (item.id === id) {
      updated = { ...item, status, resolvedAt: ['resolved', 'false-positive'].includes(status) ? new Date().toISOString() : item.resolvedAt };
      return updated;
    }
    return item;
  }));
  return updated;
}

function addNote(id, note) {
  let updated = null;
  store.update('incidents', (list_) => list_.map((item) => {
    if (item.id === id) {
      updated = { ...item, notes: [...(item.notes || []), { text: note, at: new Date().toISOString() }] };
      return updated;
    }
    return item;
  }));
  return updated;
}

function severityFor(score) {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

module.exports = { list, add, setStatus, addNote, severityFor };
