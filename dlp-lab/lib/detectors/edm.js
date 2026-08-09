// Exact Data Match (EDM): matches scanned content against a real set of
// sensitive records (e.g. a customer export) WITHOUT ever storing or
// comparing the sensitive values in plaintext. Every value -- both the
// indexed source records and the candidates pulled out of scanned content
// -- is normalized and run through a salted HMAC before comparison. Only
// hashes are ever kept or logged.
const crypto = require('crypto');
const store = require('../store');

function getSalt() {
  const settings = store.load('edm-salt');
  if (settings.salt) return settings.salt;
  const salt = crypto.randomBytes(32).toString('hex');
  store.save('edm-salt', { salt });
  return salt;
}

function normalize(value, isNumericField) {
  const trimmed = String(value).trim().toLowerCase();
  return isNumericField ? trimmed.replace(/\D/g, '') : trimmed.replace(/\s+/g, ' ');
}

function hash(value) {
  return crypto.createHmac('sha256', getSalt()).update(value).digest('hex');
}

function isNumericFieldName(name) {
  return /ssn|social|card|credit|account|acct|phone|routing|id$/i.test(name);
}

// Builds a hash index for one dataset: per-field hash sets, plus a
// composite (all-fields-joined) hash per record for high-confidence
// multi-field matches.
function buildIndex(dataset) {
  const fieldIsNumeric = dataset.fields.map(isNumericFieldName);
  const perField = dataset.fields.map(() => new Map()); // hash -> recordIndex
  const composite = new Map(); // hash -> recordIndex

  dataset.records.forEach((record, recordIndex) => {
    const normalizedValues = record.map((v, i) => normalize(v, fieldIsNumeric[i]));
    normalizedValues.forEach((v, i) => {
      if (v) perField[i].set(hash(v), recordIndex);
    });
    composite.set(hash(normalizedValues.join('|')), recordIndex);
  });

  return { fieldIsNumeric, perField, composite };
}

function averageWordCount(values) {
  const counts = values.map((v) => String(v).trim().split(/\s+/).length);
  return Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) || 1;
}

// Extracts plausible candidate values for one field from free text: digit
// runs for numeric-looking fields, capitalized word n-grams (sized to the
// field's typical word count) otherwise.
function extractCandidates(text, dataset, fieldIndex) {
  const isNumeric = isNumericFieldName(dataset.fields[fieldIndex]);
  const candidates = [];
  if (isNumeric) {
    const regex = /\b[\d][\d\- ]{6,18}\d\b/g;
    for (const m of text.matchAll(regex)) candidates.push({ value: m[0], index: m.index });
  } else {
    const wordCount = averageWordCount(dataset.records.map((r) => r[fieldIndex]));
    const words = [...text.matchAll(/\b[A-Z][a-zA-Z'-]*\b/g)];
    for (let i = 0; i + wordCount <= words.length; i++) {
      const slice = words.slice(i, i + wordCount);
      const isContiguous = slice.every((w, j) => j === 0 || w.index - (slice[j - 1].index + slice[j - 1][0].length) <= 1);
      if (isContiguous) candidates.push({ value: slice.map((w) => w[0]).join(' '), index: slice[0].index });
    }
  }
  return candidates;
}

function scan(text, datasets = null) {
  const sets = datasets || store.load('edm-datasets');
  const findings = [];

  for (const dataset of sets) {
    const index = buildIndex(dataset);
    const fieldMatches = dataset.fields.map(() => []);

    dataset.fields.forEach((fieldName, i) => {
      const candidates = extractCandidates(text, dataset, i);
      for (const c of candidates) {
        const normalized = normalize(c.value, index.fieldIsNumeric[i]);
        const h = hash(normalized);
        if (index.perField[i].has(h)) {
          fieldMatches[i].push({ ...c, recordIndex: index.perField[i].get(h) });
        }
      }
    });

    // Composite: two+ fields from the same record matched within 300 chars of each other.
    const seen = new Set();
    for (let i = 0; i < dataset.fields.length; i++) {
      for (const m1 of fieldMatches[i]) {
        for (let j = i + 1; j < dataset.fields.length; j++) {
          for (const m2 of fieldMatches[j]) {
            if (m1.recordIndex === m2.recordIndex && Math.abs(m1.index - m2.index) < 300) {
              const key = `${dataset.id}-${m1.recordIndex}`;
              if (seen.has(key)) continue;
              seen.add(key);
              findings.push({
                datasetId: dataset.id,
                datasetName: dataset.name,
                type: 'composite',
                fields: [dataset.fields[i], dataset.fields[j]],
                confidence: 0.95,
              });
            }
          }
        }
      }
    }
    // Single-field matches not already covered by a composite match.
    dataset.fields.forEach((fieldName, i) => {
      for (const m of fieldMatches[i]) {
        const key = `${dataset.id}-${m.recordIndex}`;
        if (seen.has(key)) continue;
        findings.push({ datasetId: dataset.id, datasetName: dataset.name, type: 'single-field', fields: [fieldName], confidence: 0.5 });
      }
    });
  }

  const confidence = findings.length ? Math.max(...findings.map((f) => f.confidence)) : 0;
  return { confidence, findings };
}

module.exports = { scan, buildIndex, hash, normalize, getSalt };
