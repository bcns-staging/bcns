// S/MIME: real X.509 self-signed certificate generation (via node-forge) and
// real RSA-SHA256 signing/verification of message content (via Node's core
// crypto, keyed off the certificate's own keypair) -- the same trust model
// as production S/MIME, presented as a simplified single-signature block
// rather than a full ASN.1 CMS/PKCS#7 structure (see the tutorial notes).
const crypto = require('crypto');
const forge = require('node-forge');

function generateCert({ commonName, email }) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = crypto.randomBytes(8).toString('hex');
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [
    { name: 'commonName', value: commonName },
    { name: 'emailAddress', value: email },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs); // self-signed
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, nonRepudiation: true },
    { name: 'subjectAltName', altNames: [{ type: 1, value: email }] },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    certPem: forge.pki.certificateToPem(cert),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    publicKeyPem: forge.pki.publicKeyToPem(keys.publicKey),
  };
}

function inspectCert(certPem) {
  const cert = forge.pki.certificateFromPem(certPem);
  const now = new Date();
  return {
    subject: cert.subject.getField('CN')?.value,
    email: cert.subject.getField({ name: 'emailAddress' })?.value,
    serialNumber: cert.serialNumber,
    notBefore: cert.validity.notBefore,
    notAfter: cert.validity.notAfter,
    withinValidity: now >= cert.validity.notBefore && now <= cert.validity.notAfter,
    selfSignatureValid: (() => {
      try { return cert.verify(cert); } catch { return false; }
    })(),
  };
}

function sign({ message, certPem, privateKeyPem }) {
  const signature = crypto.sign('sha256', Buffer.from(message, 'utf8'), privateKeyPem).toString('base64');
  const boundary = `----=_SMIME_${crypto.randomBytes(8).toString('hex')}`;
  const mimeText = [
    `Content-Type: multipart/signed; protocol="application/pkcs7-signature"; micalg=sha-256; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    message,
    `--${boundary}`,
    'Content-Type: application/pkcs7-signature; name="smime.p7s"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="smime.p7s"',
    '',
    signature.match(/.{1,64}/g).join('\n'),
    `--${boundary}--`,
  ].join('\r\n');
  return { signature, mimeText };
}

function verify({ message, signature, certPem }) {
  const reasons = [];
  const certInfo = inspectCert(certPem);
  if (!certInfo.withinValidity) reasons.push(`certificate is not currently valid (validity window ${certInfo.notBefore.toISOString()} - ${certInfo.notAfter.toISOString()})`);
  if (!certInfo.selfSignatureValid) reasons.push('certificate self-signature does not validate -- certificate may be corrupted or forged');

  const cert = forge.pki.certificateFromPem(certPem);
  const publicKeyPem = forge.pki.publicKeyToPem(cert.publicKey);
  let sigValid = false;
  try {
    sigValid = crypto.verify('sha256', Buffer.from(message, 'utf8'), publicKeyPem, Buffer.from(signature, 'base64'));
  } catch (err) {
    reasons.push(`signature verification error: ${err.message}`);
  }
  if (!sigValid) reasons.push('signature does not match the message content -- message was altered, or signed with a different key');

  return { valid: sigValid && certInfo.withinValidity && certInfo.selfSignatureValid, reasons, certInfo };
}

module.exports = { generateCert, inspectCert, sign, verify };
