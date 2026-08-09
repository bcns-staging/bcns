// MTA-STS (RFC 8461): unlike opportunistic STARTTLS, a published policy
// makes TLS *mandatory* for mail to a domain, and pins which MX hosts are
// allowed to receive it -- closing the silent-downgrade gap STARTTLS leaves
// open.
const crypto = require('crypto');
const store = require('./store');
const dnsZone = require('./dnsZone');

function computePolicyId(policy) {
  return crypto.createHash('sha256').update(JSON.stringify(policy)).digest('hex').slice(0, 12);
}

function setPolicy(domain, { mode, mx, maxAge = 604800 }) {
  const d = dnsZone.normalize(domain);
  const mxList = (Array.isArray(mx) ? mx : String(mx).split(',')).map((s) => s.trim()).filter(Boolean);
  const policy = { mode, mx: mxList, maxAge: Number(maxAge) };
  const id = computePolicyId(policy);
  const record = { ...policy, id, updatedAt: new Date().toISOString() };
  store.update('mta-sts-policies', (all) => {
    all[d] = record;
    return all;
  });
  dnsZone.setMtaStsRecord(d, `v=STSv1; id=${id}`);
  return record;
}

function getPolicy(domain) {
  return store.load('mta-sts-policies')[dnsZone.normalize(domain)] || null;
}

function getPolicyFileText(domain) {
  const policy = getPolicy(domain);
  if (!policy) return null;
  return [
    'version: STSv1',
    `mode: ${policy.mode}`,
    ...policy.mx.map((m) => `mx: ${m}`),
    `max_age: ${policy.maxAge}`,
    '',
  ].join('\n');
}

function matchMxPattern(pattern, host) {
  const p = pattern.toLowerCase();
  const h = host.toLowerCase();
  if (p.startsWith('*.')) {
    const pParts = p.split('.');
    const hParts = h.split('.');
    return hParts.length === pParts.length && hParts.slice(1).join('.') === pParts.slice(1).join('.');
  }
  return p === h;
}

function evaluateDelivery({ domain, mxHost, tlsAvailable }) {
  const dnsTxt = dnsZone.resolveTxt(`_mta-sts.${dnsZone.normalize(domain)}`)[0];
  const policy = getPolicy(domain);
  const trace = [];

  if (!dnsTxt || !policy) {
    trace.push(`No MTA-STS policy found for ${domain} -- TLS is opportunistic only (STARTTLS may be silently downgraded).`);
    return { enforced: false, allowed: true, trace };
  }
  trace.push(`_mta-sts.${domain} TXT: ${dnsTxt}`);
  trace.push(`Policy file (mode=${policy.mode}): mx=${policy.mx.join(', ')}, max_age=${policy.maxAge}`);

  const mxMatches = policy.mx.some((pattern) => matchMxPattern(pattern, mxHost));
  trace.push(`Connecting MX host ${mxHost} ${mxMatches ? 'matches' : 'does NOT match'} the policy's authorized mx list.`);
  trace.push(`TLS available on this connection: ${tlsAvailable ? 'yes' : 'no'}.`);

  const wouldFail = !mxMatches || !tlsAvailable;
  if (!wouldFail) {
    trace.push('Delivery proceeds over a validated, mandatory TLS connection.');
    return { enforced: policy.mode !== 'none', allowed: true, trace, policy };
  }

  if (policy.mode === 'enforce') {
    trace.push('mode=enforce -- delivery is REFUSED rather than falling back to an unvalidated or plaintext connection.');
    return { enforced: true, allowed: false, trace, policy };
  }
  if (policy.mode === 'testing') {
    trace.push('mode=testing -- delivery proceeds anyway, but a TLS-RPT failure report would be generated for the domain owner to review.');
    return { enforced: false, allowed: true, wouldHaveFailed: true, trace, policy };
  }
  trace.push('mode=none -- policy is not enforced.');
  return { enforced: false, allowed: true, trace, policy };
}

module.exports = { setPolicy, getPolicy, getPolicyFileText, evaluateDelivery, matchMxPattern };
