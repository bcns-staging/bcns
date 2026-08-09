// DANE/TLSA (RFC 6698): pins a mail server's TLS certificate directly in
// DNSSEC-secured DNS, so a receiver doesn't have to trust the public CA
// system at all for that connection. We simulate "the certificate an MX
// host currently presents" as a rotatable fingerprint, and TLSA records as
// a pinned copy of it -- so you can see DANE succeed, and see it break the
// moment a cert is rotated without updating the pin (a real, common
// DANE operational failure mode).
const crypto = require('crypto');
const store = require('./store');
const dnsZone = require('./dnsZone');

function currentCerts() {
  return store.load('mx-certs');
}

function issueCert(mxHost) {
  const fingerprint = crypto.randomBytes(32).toString('hex');
  store.update('mx-certs', (all) => {
    all[mxHost.toLowerCase()] = { fingerprint, issuedAt: new Date().toISOString() };
    return all;
  });
  return currentCerts()[mxHost.toLowerCase()];
}

function getCert(mxHost) {
  return currentCerts()[mxHost.toLowerCase()] || null;
}

function publishTlsa(mxHost, port = 25) {
  let cert = getCert(mxHost);
  if (!cert) cert = issueCert(mxHost);
  const name = `_${port}._tcp.${mxHost.toLowerCase()}`;
  dnsZone.ensureDomain(mxHost);
  const value = `3 1 1 ${cert.fingerprint}`;
  const existing = dnsZone.findRecords(name, 'TLSA')[0];
  if (existing) return dnsZone.updateRecord(mxHost, existing.id, { value });
  return dnsZone.addRecord(mxHost, { name, type: 'TLSA', value });
}

function verify({ mxHost, port = 25 }) {
  const name = `_${port}._tcp.${mxHost.toLowerCase()}`;
  const tlsaRecords = dnsZone.resolveTlsa(name);
  const cert = getCert(mxHost);
  const trace = [`TLSA lookup for ${name}: ${tlsaRecords.length ? tlsaRecords.join(', ') : '(none published)'}`];

  if (tlsaRecords.length === 0) {
    trace.push('No TLSA record published -- DANE is not used for this host; falls back to normal CA-based trust (or no validation at all in opportunistic TLS).');
    return { daneUsed: false, valid: null, trace };
  }
  if (!cert) {
    trace.push(`No certificate currently on file for ${mxHost}.`);
    return { daneUsed: true, valid: false, trace };
  }
  trace.push(`Certificate currently presented by ${mxHost} has fingerprint: ${cert.fingerprint}`);
  const matches = tlsaRecords.some((r) => r.split(/\s+/)[3] === cert.fingerprint);
  trace.push(matches
    ? 'Presented certificate matches the pinned TLSA record -- connection is authenticated via DANE.'
    : 'Presented certificate does NOT match the pinned TLSA record. Either the certificate was rotated without updating DNS, or this could be a man-in-the-middle presenting a different certificate. A DANE-validating receiver must refuse this connection.');
  return { daneUsed: true, valid: matches, trace };
}

module.exports = { issueCert, getCert, publishTlsa, verify };
