// Real DKIM: RSA keypair generation, RFC 6376 canonicalization (simple &
// relaxed), real RSA-SHA256 signing, and real signature verification against
// a public key published in the simulated DNS zone.
const crypto = require('crypto');
const dnsZone = require('./dnsZone');

function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

function publicKeyToDns(publicKeyPem) {
  const der = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  return `v=DKIM1; k=rsa; p=${der}`;
}

function canonicalizeHeaderRelaxed(name, value) {
  const n = name.toLowerCase().trim();
  let v = String(value).replace(/\r\n[ \t]+/g, ' ').trim().replace(/[ \t]+/g, ' ');
  return `${n}:${v}`;
}

function canonicalizeHeaderSimple(name, value) {
  return `${name}: ${value}`;
}

function canonicalizeBodyRelaxed(body) {
  let lines = String(body).replace(/\r\n/g, '\n').split('\n');
  lines = lines.map((l) => l.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/, ''));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0) return '';
  return lines.join('\r\n') + '\r\n';
}

function canonicalizeBodySimple(body) {
  let normalized = String(body).replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  normalized = normalized.replace(/(\r\n)+$/, '');
  if (normalized === '') return '';
  return normalized + '\r\n';
}

function canonBody(method, body) {
  return method === 'simple' ? canonicalizeBodySimple(body) : canonicalizeBodyRelaxed(body);
}

function canonHeaderFn(method) {
  return method === 'simple' ? canonicalizeHeaderSimple : canonicalizeHeaderRelaxed;
}

// headers: array of [name, value] pairs in message order.
function sign({ domain, selector, privateKeyPem, headers, body, headerFieldsToSign, canonicalization = 'relaxed/relaxed', timestamp }) {
  const [headerCanon, bodyCanon] = canonicalization.split('/');
  const canonicalBody = canonBody(bodyCanon, body);
  const bh = crypto.createHash('sha256').update(canonicalBody, 'utf8').digest('base64');

  const now = timestamp || Math.floor(Date.now() / 1000);
  const preTags = [
    ['v', '1'],
    ['a', 'rsa-sha256'],
    ['c', canonicalization],
    ['d', domain],
    ['s', selector],
    ['t', String(now)],
    ['h', headerFieldsToSign.join(':')],
    ['bh', bh],
    ['b', ''],
  ];
  const preTagsString = preTags.map(([k, v]) => `${k}=${v}`).join('; ');

  function findHeaderValue(name) {
    const found = [...headers].reverse().find(([n]) => n.toLowerCase() === name.toLowerCase());
    return found ? found[1] : '';
  }

  const canonFn = canonHeaderFn(headerCanon);
  const lines = headerFieldsToSign.map((name) => canonFn(name, findHeaderValue(name)));
  lines.push(canonFn('DKIM-Signature', preTagsString));
  const dataToSign = lines.join('\r\n');

  const signature = crypto.sign('sha256', Buffer.from(dataToSign, 'utf8'), privateKeyPem).toString('base64');
  const fullTagsString = preTagsString.replace(/b=$/, `b=${signature}`);

  return {
    header: `DKIM-Signature: ${fullTagsString}`,
    value: fullTagsString,
    tags: Object.fromEntries([...preTags.filter(([k]) => k !== 'b'), ['b', signature]]),
    dataToSign,
    bh,
  };
}

function parseTags(dkimValue) {
  return dkimValue
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=');
      return [pair.slice(0, idx).trim(), pair.slice(idx + 1).trim()];
    });
}

// Verifies against whatever public key is published for d=/s= in the
// simulated DNS zone -- exactly like a real verifier would.
function verify({ dkimValue, headers, body }) {
  const orderedTags = parseTags(dkimValue);
  const tags = Object.fromEntries(orderedTags);
  const reasons = [];

  if (tags.v !== '1') reasons.push('unsupported DKIM version');
  if (tags.a !== 'rsa-sha256') reasons.push(`unsupported algorithm ${tags.a}`);

  const domain = tags.d;
  const selector = tags.s;
  const dnsName = `${selector}._domainkey.${domain}`;
  const dnsTxt = dnsZone.resolveTxt(dnsName)[0];
  if (!dnsTxt) {
    return { valid: false, reasons: [`no public key found at ${dnsName}`], tags, dnsName };
  }
  const pMatch = /p=([A-Za-z0-9+/=]+)/.exec(dnsTxt);
  if (!pMatch) return { valid: false, reasons: ['DNS record has no p= public key'], tags, dnsName };
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${pMatch[1].match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----\n`;

  const [headerCanon, bodyCanon] = (tags.c || 'simple/simple').split('/');
  const canonicalBody = canonBody(bodyCanon || 'simple', body);
  const bh = crypto.createHash('sha256').update(canonicalBody, 'utf8').digest('base64');
  const bodyHashMatches = bh === tags.bh;
  if (!bodyHashMatches) reasons.push('body hash (bh=) does not match -- body was modified in transit');

  function findHeaderValue(name) {
    const found = [...headers].reverse().find(([n]) => n.toLowerCase() === name.toLowerCase());
    return found ? found[1] : '';
  }

  const canonFn = canonHeaderFn(headerCanon);
  const signedHeaderNames = (tags.h || '').split(':').filter(Boolean);
  const lines = signedHeaderNames.map((name) => canonFn(name, findHeaderValue(name)));
  const preTagsString = orderedTags.map(([k, v]) => (k === 'b' ? 'b=' : `${k}=${v}`)).join('; ');
  lines.push(canonFn('DKIM-Signature', preTagsString));
  const dataToVerify = lines.join('\r\n');

  let sigValid = false;
  try {
    sigValid = crypto.verify('sha256', Buffer.from(dataToVerify, 'utf8'), publicKeyPem, Buffer.from(tags.b, 'base64'));
  } catch (err) {
    reasons.push(`signature verification error: ${err.message}`);
  }
  if (!sigValid) reasons.push('cryptographic signature (b=) does not match -- headers were modified or wrong key');

  return {
    valid: bodyHashMatches && sigValid && reasons.length === 0,
    reasons,
    tags,
    dnsName,
    domain,
    selector,
  };
}

module.exports = {
  generateKeyPair,
  publicKeyToDns,
  sign,
  verify,
  parseTags,
  canonicalizeHeaderRelaxed,
  canonicalizeHeaderSimple,
  canonicalizeBodyRelaxed,
  canonicalizeBodySimple,
};
