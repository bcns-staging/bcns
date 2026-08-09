// Document / Indexed Document Matching (IDM): fingerprints a reference
// document as a set of overlapping word-shingle hashes, then checks how
// much of that fingerprint reappears in scanned content -- catching a
// paragraph lifted from a confidential document even when surrounded by
// completely different text, without ever doing a slow direct-text diff.
const crypto = require('crypto');
const store = require('../store');

const SHINGLE_SIZE = 8; // words per chunk

function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function shingleHashes(text) {
  const words = normalizeWords(text);
  const hashes = new Set();
  for (let i = 0; i + SHINGLE_SIZE <= words.length; i++) {
    const chunk = words.slice(i, i + SHINGLE_SIZE).join(' ');
    hashes.add(crypto.createHash('sha256').update(chunk).digest('hex').slice(0, 16));
  }
  // Short documents/snippets: fall back to a single shingle of everything available.
  if (hashes.size === 0 && words.length > 0) {
    hashes.add(crypto.createHash('sha256').update(words.join(' ')).digest('hex').slice(0, 16));
  }
  return hashes;
}

function scan(text, docs = null) {
  const referenceDocs = docs || store.load('fingerprint-docs');
  const candidateHashes = shingleHashes(text);
  const findings = [];

  for (const doc of referenceDocs) {
    const refHashes = doc.hashes ? new Set(doc.hashes) : shingleHashes(doc.text);
    if (refHashes.size === 0) continue;
    let matched = 0;
    for (const h of refHashes) if (candidateHashes.has(h)) matched += 1;
    const overlapRatio = matched / refHashes.size;
    if (overlapRatio > 0.05) {
      findings.push({
        docId: doc.id,
        docName: doc.name,
        overlapPct: Math.round(overlapRatio * 100),
        matchedChunks: matched,
        totalChunks: refHashes.size,
      });
    }
  }

  findings.sort((a, b) => b.overlapPct - a.overlapPct);
  const confidence = findings.length ? Math.min(1, findings[0].overlapPct / 100 + 0.2) : 0;
  return { confidence, findings };
}

module.exports = { scan, shingleHashes, SHINGLE_SIZE };
