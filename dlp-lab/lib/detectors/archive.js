// Archive inspection: walks the contents of a zip and runs every text
// detector against whatever's inside, exactly like a real DLP content
// inspector unpacking an attachment before deciding whether to allow it.
// Recursion depth and total extracted size are capped -- a local/trusted-
// input tool still shouldn't choke on a decompression-bomb-shaped zip.
const AdmZip = require('adm-zip');
const fileType = require('./fileType');
const encryptionDetector = require('./encryptionDetector');
const { runAll } = require('../textScan');

const MAX_ENTRIES = 200;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_DEPTH = 2;

function inspect(buffer, depth = 0, budget = { bytesUsed: 0 }) {
  if (depth > MAX_DEPTH) {
    return { entries: [], truncated: true, truncationReason: 'max nesting depth exceeded' };
  }

  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (err) {
    return { entries: [], error: `not a readable zip archive: ${err.message}` };
  }

  const allEntries = zip.getEntries().filter((e) => !e.isDirectory);
  const truncatedByCount = allEntries.length > MAX_ENTRIES;
  const entries = allEntries.slice(0, MAX_ENTRIES);
  const results = [];
  let truncatedBySize = false;

  for (const entry of entries) {
    if (budget.bytesUsed >= MAX_TOTAL_BYTES) {
      truncatedBySize = true;
      break;
    }
    let data;
    try {
      data = entry.getData();
    } catch (err) {
      results.push({ path: entry.entryName, error: `could not extract: ${err.message}` });
      continue;
    }
    budget.bytesUsed += data.length;

    const detected = fileType.detect(data);
    const encryption = encryptionDetector.classify(data, entry.entryName);

    if (encryption.verdict !== 'inspectable') {
      results.push({ path: entry.entryName, type: detected.type, verdict: 'uninspectable', reason: encryption.reason });
      continue;
    }

    if (detected.type === 'zip-based' && depth < MAX_DEPTH) {
      const nested = inspect(data, depth + 1, budget);
      results.push({ path: entry.entryName, type: 'nested-archive', nested });
      continue;
    }

    if (detected.family === 'text') {
      const scan = runAll(data.toString('utf8'));
      results.push({ path: entry.entryName, type: detected.type, overallConfidence: scan.overallConfidence, results: scan.results });
      continue;
    }

    results.push({ path: entry.entryName, type: detected.type, verdict: 'not-text-scanned' });
  }

  return {
    entries: results,
    totalEntries: allEntries.length,
    truncated: truncatedByCount || truncatedBySize,
    truncationReason: truncatedBySize ? `stopped after ${MAX_TOTAL_BYTES} bytes` : truncatedByCount ? `only first ${MAX_ENTRIES} entries scanned` : null,
  };
}

module.exports = { inspect, MAX_ENTRIES, MAX_TOTAL_BYTES, MAX_DEPTH };
