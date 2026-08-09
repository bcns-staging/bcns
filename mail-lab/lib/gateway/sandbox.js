// Attachment "sandboxing": real secure email gateways detonate attachments
// in an isolated VM and watch what they do. We don't execute anything here
// (that would mean running arbitrary uploaded files -- never do that) --
// instead we apply the same static red flags a gateway checks before ever
// bothering with dynamic analysis: extension risk, double extensions,
// macro-enabled documents, and known-bad file hashes.
const crypto = require('crypto');
const store = require('../store');

const DANGEROUS_EXTENSIONS = ['exe', 'scr', 'bat', 'cmd', 'com', 'js', 'vbs', 'jar', 'ps1', 'msi', 'wsf', 'hta'];
const MACRO_EXTENSIONS = ['docm', 'xlsm', 'pptm'];
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'gz', 'tar'];

function extOf(filename) {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function hasDoubleExtension(filename) {
  const parts = filename.toLowerCase().split('.');
  if (parts.length < 3) return false;
  const finalExt = parts[parts.length - 1];
  const priorExt = parts[parts.length - 2];
  const commonDocExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'png'];
  return commonDocExts.includes(priorExt) && DANGEROUS_EXTENSIONS.includes(finalExt);
}

function hashOf(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function blocklist() {
  return store.load('blocklists').hashes || [];
}

function addBlockedHash(hash) {
  store.update('blocklists', (b) => {
    b.hashes = b.hashes || [];
    if (!b.hashes.includes(hash)) b.hashes.push(hash);
    return b;
  });
  return blocklist();
}

function analyze({ filename, contentBuffer }) {
  const reasons = [];
  const ext = extOf(filename);
  const hash = contentBuffer ? hashOf(contentBuffer) : null;

  if (hash && blocklist().includes(hash)) {
    return { verdict: 'malicious', reasons: [`file hash ${hash} matches a known-malicious hash on file`], hash, ext };
  }
  if (hasDoubleExtension(filename)) {
    reasons.push(`double extension detected (e.g. "invoice.pdf.exe") -- classic disguise trick to hide the real, dangerous file type`);
  }
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    reasons.push(`".${ext}" is an executable/script file type -- rarely a legitimate email attachment`);
  }
  if (MACRO_EXTENSIONS.includes(ext)) {
    reasons.push(`".${ext}" is a macro-enabled Office document -- one of the most common real-world malware delivery vectors`);
  }
  if (ARCHIVE_EXTENSIONS.includes(ext)) {
    reasons.push(`".${ext}" is an archive -- this simulation cannot inspect inside it, which is itself a reason real gateways treat unscanned archives with suspicion`);
  }

  let verdict = 'benign';
  if (reasons.some((r) => r.includes('executable/script') || r.includes('double extension'))) verdict = 'malicious';
  else if (reasons.length > 0) verdict = 'suspicious';

  return { verdict, reasons, hash, ext };
}

module.exports = { analyze, hashOf, blocklist, addBlockedHash };
