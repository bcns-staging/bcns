// Encrypted/opaque content detection: a DLP engine that can't decrypt a
// file can't inspect it -- the honest response is to flag it as
// uninspectable (and let policy decide whether that itself is suspicious),
// not silently pass it through as "clean."
const AdmZip = require('adm-zip');
const fileType = require('./fileType');

function shannonEntropy(buffer) {
  if (buffer.length === 0) return 0;
  const freq = new Array(256).fill(0);
  for (const byte of buffer) freq[byte] += 1;
  let entropy = 0;
  for (const count of freq) {
    if (count === 0) continue;
    const p = count / buffer.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function isZipEncrypted(buffer) {
  try {
    const zip = new AdmZip(buffer);
    return zip.getEntries().some((entry) => entry.header.encrypted);
  } catch {
    return false;
  }
}

function isPdfEncrypted(buffer) {
  // The trailer of an encrypted PDF references an /Encrypt dictionary.
  return buffer.includes(Buffer.from('/Encrypt'));
}

function classify(buffer, filename) {
  const detected = fileType.detect(buffer);
  const entropy = shannonEntropy(buffer);

  if (detected.type === 'zip-based' && isZipEncrypted(buffer)) {
    return { verdict: 'encrypted', reason: 'ZIP entry encryption flag is set', entropy };
  }
  if (detected.type === 'pdf' && isPdfEncrypted(buffer)) {
    return { verdict: 'encrypted', reason: 'PDF trailer references an /Encrypt dictionary', entropy };
  }

  // Images and already-compressed archives are naturally high-entropy --
  // only flag high entropy as suspicious for formats that should be
  // human-inspectable (text/documents) or unrecognized formats.
  const naturallyHighEntropy = ['image', 'archive'].includes(detected.family);
  if (!naturallyHighEntropy && entropy > 7.5) {
    return { verdict: 'likely-encrypted-or-opaque', reason: `high entropy (${entropy.toFixed(2)} bits/byte) for a ${detected.type} file -- looks encrypted or otherwise opaque`, entropy };
  }

  return { verdict: 'inspectable', reason: null, entropy };
}

module.exports = { classify, shannonEntropy, isZipEncrypted, isPdfEncrypted };
