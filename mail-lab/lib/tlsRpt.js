// TLS-RPT (RFC 8460): lets a domain owner ask receivers/senders to email
// back a JSON report of TLS delivery successes and failures, so they can
// notice MTA-STS or DANE problems without manually digging through logs.
const crypto = require('crypto');
const dnsZone = require('./dnsZone');
const store = require('./store');

function setRecord(domain, rua) {
  const value = `v=TLSRPTv1; rua=${rua}`;
  dnsZone.setTlsRptRecord(domain, value);
  return value;
}

function getRecord(domain) {
  return dnsZone.resolveTxt(`_smtp._tls.${dnsZone.normalize(domain)}`)[0] || null;
}

function recordAttempt({ domain, mxHost, success, failureReason }) {
  const entry = {
    id: crypto.randomUUID(),
    domain: dnsZone.normalize(domain),
    mxHost,
    success,
    failureReason: failureReason || null,
    timestamp: new Date().toISOString(),
  };
  store.update('tls-attempts', (list) => {
    list.push(entry);
    return list;
  });
  return entry;
}

function generateReport(domain) {
  const d = dnsZone.normalize(domain);
  const attempts = store.load('tls-attempts').filter((a) => a.domain === d);
  const successCount = attempts.filter((a) => a.success).length;
  const failures = attempts.filter((a) => !a.success);

  const failuresByReason = {};
  for (const f of failures) {
    failuresByReason[f.failureReason || 'unknown'] = failuresByReason[f.failureReason || 'unknown'] || [];
    failuresByReason[f.failureReason || 'unknown'].push(f.mxHost);
  }

  return {
    'organization-name': 'Email Security Lab (simulated reporter)',
    'date-range': { 'start-datetime': attempts[0]?.timestamp || new Date().toISOString(), 'end-datetime': new Date().toISOString() },
    'contact-info': 'tls-reports@lab.local',
    'report-id': crypto.randomUUID(),
    policies: [
      {
        policy: { 'policy-type': 'sts', 'policy-domain': d },
        summary: { 'total-successful-session-count': successCount, 'total-failure-session-count': failures.length },
        'failure-details': Object.entries(failuresByReason).map(([reason, hosts]) => ({
          'result-type': reason,
          'sending-mta-ip': 'n/a (simulated)',
          'receiving-mx-hostname': [...new Set(hosts)].join(', '),
          'failed-session-count': hosts.length,
        })),
      },
    ],
  };
}

module.exports = { setRecord, getRecord, recordAttempt, generateReport };
