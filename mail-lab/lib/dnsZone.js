// Simulated "internet DNS" for the lab. Every authentication feature
// (SPF/DKIM/DMARC/MTA-STS/TLS-RPT/BIMI/TLSA/reputation) reads and writes
// through this one module, so lookup semantics mirror a real resolver
// (case-insensitive names, TXT records can be multi-valued, missing name
// resolves to NXDOMAIN) without ever touching the real internet.
const crypto = require('crypto');
const store = require('./store');

function normalize(name) {
  return name.toLowerCase().replace(/\.$/, '');
}

function allRecords() {
  return store.load('dns-zones');
}

// zones shape: { [domain]: [{ id, name, type, value, priority? }] }

function listDomains() {
  return Object.keys(allRecords());
}

function listRecords(domain) {
  return allRecords()[normalize(domain)] || [];
}

function ensureDomain(domain) {
  const d = normalize(domain);
  store.update('dns-zones', (zones) => {
    if (!zones[d]) zones[d] = [];
    return zones;
  });
  return d;
}

function deleteDomain(domain) {
  const d = normalize(domain);
  store.update('dns-zones', (zones) => {
    delete zones[d];
    return zones;
  });
}

function addRecord(domain, { name, type, value, priority }) {
  const d = ensureDomain(domain);
  const record = {
    id: crypto.randomUUID(),
    name: normalize(name),
    type: type.toUpperCase(),
    value,
    ...(priority !== undefined ? { priority } : {}),
  };
  store.update('dns-zones', (zones) => {
    zones[d].push(record);
    return zones;
  });
  return record;
}

function deleteRecord(domain, id) {
  const d = normalize(domain);
  store.update('dns-zones', (zones) => {
    if (zones[d]) zones[d] = zones[d].filter((r) => r.id !== id);
    return zones;
  });
}

function updateRecord(domain, id, patch) {
  const d = normalize(domain);
  let updated = null;
  store.update('dns-zones', (zones) => {
    zones[d] = (zones[d] || []).map((r) => {
      if (r.id === id) {
        updated = { ...r, ...patch };
        return updated;
      }
      return r;
    });
    return zones;
  });
  return updated;
}

// --- Resolver-style lookups, searched across all zones by exact name ---

function findRecords(name, type) {
  const n = normalize(name);
  const results = [];
  for (const records of Object.values(allRecords())) {
    for (const r of records) {
      if (r.name === n && r.type === type.toUpperCase()) results.push(r);
    }
  }
  return results;
}

function resolveTxt(name) {
  return findRecords(name, 'TXT').map((r) => r.value);
}

function resolveA(name) {
  return findRecords(name, 'A').map((r) => r.value);
}

function resolveAAAA(name) {
  return findRecords(name, 'AAAA').map((r) => r.value);
}

function resolveMx(name) {
  return findRecords(name, 'MX')
    .map((r) => ({ priority: r.priority ?? 10, exchange: r.value }))
    .sort((a, b) => a.priority - b.priority);
}

function resolveTlsa(name) {
  return findRecords(name, 'TLSA').map((r) => r.value);
}

// --- Convenience builders used by feature modules / routes ---

function setSpfRecord(domain, value) {
  const d = normalize(domain);
  const existing = listRecords(d).find((r) => r.name === d && r.type === 'TXT' && /^v=spf1/i.test(r.value));
  if (existing) return updateRecord(d, existing.id, { value });
  return addRecord(d, { name: d, type: 'TXT', value });
}

function setDkimRecord(domain, selector, value) {
  const name = `${selector}._domainkey.${normalize(domain)}`;
  const existing = findRecords(name, 'TXT')[0];
  if (existing) return updateRecord(domain, existing.id, { value });
  return addRecord(domain, { name, type: 'TXT', value });
}

function setDmarcRecord(domain, value) {
  const name = `_dmarc.${normalize(domain)}`;
  const existing = findRecords(name, 'TXT')[0];
  if (existing) return updateRecord(domain, existing.id, { value });
  return addRecord(domain, { name, type: 'TXT', value });
}

function setMtaStsRecord(domain, value) {
  const name = `_mta-sts.${normalize(domain)}`;
  const existing = findRecords(name, 'TXT')[0];
  if (existing) return updateRecord(domain, existing.id, { value });
  return addRecord(domain, { name, type: 'TXT', value });
}

function setTlsRptRecord(domain, value) {
  const name = `_smtp._tls.${normalize(domain)}`;
  const existing = findRecords(name, 'TXT')[0];
  if (existing) return updateRecord(domain, existing.id, { value });
  return addRecord(domain, { name, type: 'TXT', value });
}

function setBimiRecord(domain, selector, value) {
  const name = `${selector || 'default'}._bimi.${normalize(domain)}`;
  const existing = findRecords(name, 'TXT')[0];
  if (existing) return updateRecord(domain, existing.id, { value });
  return addRecord(domain, { name, type: 'TXT', value });
}

module.exports = {
  normalize,
  listDomains,
  listRecords,
  ensureDomain,
  deleteDomain,
  addRecord,
  deleteRecord,
  updateRecord,
  findRecords,
  resolveTxt,
  resolveA,
  resolveAAAA,
  resolveMx,
  resolveTlsa,
  setSpfRecord,
  setDkimRecord,
  setDmarcRecord,
  setMtaStsRecord,
  setTlsRptRecord,
  setBimiRecord,
};
