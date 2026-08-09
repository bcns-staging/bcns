// Simplified but real-crypto ARC (RFC 8617): when a message passes through
// an intermediary (mailing list, forwarder) that would otherwise break SPF
// and/or DKIM, ARC lets that intermediary "seal" the original authentication
// results so the next hop can still trust them. We model exactly one
// simulated intermediary hop (instance i=1), which is enough to teach why
// ARC exists and how the seal chain can be validated or broken.
const crypto = require('crypto');
const dnsZone = require('./dnsZone');
const dkim = require('./dkim');

function buildAuthResultsTag({ authServId, spf, dkimRes, dmarcRes, headerFromDomain }) {
  return `i=1; ${authServId}; spf=${spf.result} smtp.mailfrom=${spf.domain || ''}; dkim=${dkimRes ? (dkimRes.valid ? 'pass' : 'fail') : 'none'} header.d=${dkimRes?.domain || ''}; dmarc=${dmarcRes.result} header.from=${headerFromDomain}`;
}

function seal({ authServId, spf, dkimRes, dmarcRes, headerFromDomain, domain, selector, privateKeyPem, headers, body }) {
  const aarValue = buildAuthResultsTag({ authServId, spf, dkimRes, dmarcRes, headerFromDomain });
  const now = Math.floor(Date.now() / 1000);
  const workingHeaders = [...headers, ['ARC-Authentication-Results', aarValue]];

  // ARC-Message-Signature: signs the same content a DKIM signature would,
  // plus this instance's ARC-Authentication-Results header.
  const amsFieldsToSign = ['from', 'to', 'subject', 'date', 'arc-authentication-results'];
  const canonicalBody = dkim.canonicalizeBodyRelaxed(body);
  const bh = crypto.createHash('sha256').update(canonicalBody, 'utf8').digest('base64');
  const amsPreTags = [
    ['i', '1'], ['a', 'rsa-sha256'], ['c', 'relaxed/relaxed'], ['d', domain], ['s', selector],
    ['t', String(now)], ['h', amsFieldsToSign.join(':')], ['bh', bh], ['b', ''],
  ];
  const amsPreString = amsPreTags.map(([k, v]) => `${k}=${v}`).join('; ');
  function findHeader(list, name) {
    const found = [...list].reverse().find(([n]) => n.toLowerCase() === name.toLowerCase());
    return found ? found[1] : '';
  }
  const amsLines = amsFieldsToSign.map((name) => dkim.canonicalizeHeaderRelaxed(name, findHeader(workingHeaders, name)));
  amsLines.push(dkim.canonicalizeHeaderRelaxed('ARC-Message-Signature', amsPreString));
  const amsSignature = crypto.sign('sha256', Buffer.from(amsLines.join('\r\n'), 'utf8'), privateKeyPem).toString('base64');
  const amsValue = amsPreString.replace(/b=$/, `b=${amsSignature}`);

  // ARC-Seal: signs the AAR + AMS of this instance (cv=none since this is
  // the first/only simulated hop).
  const asPreTags = [['i', '1'], ['a', 'rsa-sha256'], ['cv', 'none'], ['d', domain], ['s', selector], ['t', String(now)], ['b', '']];
  const asPreString = asPreTags.map(([k, v]) => `${k}=${v}`).join('; ');
  const asLines = [
    dkim.canonicalizeHeaderRelaxed('ARC-Authentication-Results', aarValue),
    dkim.canonicalizeHeaderRelaxed('ARC-Message-Signature', amsValue),
    dkim.canonicalizeHeaderRelaxed('ARC-Seal', asPreString),
  ];
  const asSignature = crypto.sign('sha256', Buffer.from(asLines.join('\r\n'), 'utf8'), privateKeyPem).toString('base64');
  const asValue = asPreString.replace(/b=$/, `b=${asSignature}`);

  return {
    headers: [
      ['ARC-Authentication-Results', aarValue],
      ['ARC-Message-Signature', amsValue],
      ['ARC-Seal', asValue],
    ],
  };
}

function verify({ arcHeaders, headers, body }) {
  const get = (name) => arcHeaders.find(([n]) => n.toLowerCase() === name.toLowerCase())?.[1];
  const aarValue = get('ARC-Authentication-Results');
  const amsValue = get('ARC-Message-Signature');
  const asValue = get('ARC-Seal');
  if (!aarValue || !amsValue || !asValue) {
    return { valid: false, cv: 'fail', reasons: ['incomplete ARC set -- missing AAR, AMS, or AS header'] };
  }

  const amsTags = Object.fromEntries(dkim.parseTags(amsValue));
  const asTags = Object.fromEntries(dkim.parseTags(asValue));
  const reasons = [];

  const dnsName = `${asTags.s}._domainkey.${asTags.d}`;
  const dnsTxt = dnsZone.resolveTxt(dnsName)[0];
  if (!dnsTxt) return { valid: false, cv: 'fail', reasons: [`no public key found at ${dnsName} to verify ARC seal`] };
  const pMatch = /p=([A-Za-z0-9+/=]+)/.exec(dnsTxt);
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${pMatch[1].match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----\n`;

  // Verify ARC-Message-Signature (covers headers + AAR + body)
  const workingHeaders = [...headers, ['ARC-Authentication-Results', aarValue]];
  function findHeader(list, name) {
    const found = [...list].reverse().find(([n]) => n.toLowerCase() === name.toLowerCase());
    return found ? found[1] : '';
  }
  const signedFields = (amsTags.h || '').split(':').filter(Boolean);
  const canonicalBody = dkim.canonicalizeBodyRelaxed(body);
  const bh = crypto.createHash('sha256').update(canonicalBody, 'utf8').digest('base64');
  if (bh !== amsTags.bh) reasons.push('ARC-Message-Signature body hash mismatch -- body changed after sealing');

  const amsLines = signedFields.map((name) => dkim.canonicalizeHeaderRelaxed(name, findHeader(workingHeaders, name)));
  const amsPreString = dkim
    .parseTags(amsValue)
    .map(([k, v]) => (k === 'b' ? 'b=' : `${k}=${v}`))
    .join('; ');
  amsLines.push(dkim.canonicalizeHeaderRelaxed('ARC-Message-Signature', amsPreString));
  let amsValid = false;
  try {
    amsValid = crypto.verify('sha256', Buffer.from(amsLines.join('\r\n'), 'utf8'), publicKeyPem, Buffer.from(amsTags.b, 'base64'));
  } catch { /* falls through to reasons below */ }
  if (!amsValid) reasons.push('ARC-Message-Signature cryptographic verification failed -- headers changed after sealing');

  // Verify ARC-Seal (covers AAR + AMS, with this seal's b= emptied)
  const asPreString = dkim
    .parseTags(asValue)
    .map(([k, v]) => (k === 'b' ? 'b=' : `${k}=${v}`))
    .join('; ');
  const asLines = [
    dkim.canonicalizeHeaderRelaxed('ARC-Authentication-Results', aarValue),
    dkim.canonicalizeHeaderRelaxed('ARC-Message-Signature', amsValue),
    dkim.canonicalizeHeaderRelaxed('ARC-Seal', asPreString),
  ];
  let asValid = false;
  try {
    asValid = crypto.verify('sha256', Buffer.from(asLines.join('\r\n'), 'utf8'), publicKeyPem, Buffer.from(asTags.b, 'base64'));
  } catch { /* falls through to reasons below */ }
  if (!asValid) reasons.push('ARC-Seal cryptographic verification failed -- ARC set was tampered with after sealing');

  const valid = amsValid && asValid && reasons.length === 0;
  return { valid, cv: valid ? 'pass' : 'fail', reasons, aar: aarValue, instance: asTags.i };
}

module.exports = { seal, verify, buildAuthResultsTag };
