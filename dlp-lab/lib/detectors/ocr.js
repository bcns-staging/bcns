// OCR: extracts text embedded in images (screenshots of sensitive data are
// a real, common exfiltration path that never touches a text-based
// detector otherwise) via Tesseract, then re-runs the same text detectors
// against whatever it finds.
const path = require('path');
const { createWorker } = require('tesseract.js');
const { runAll } = require('../textScan');

// eng.traineddata ships alongside this app (see the repo root of this lab)
// specifically so this doesn't depend on fetching language data from
// Tesseract's CDN at runtime - deployed environments aren't guaranteed to
// have unrestricted outbound access to arbitrary third-party hosts.
const LANG_PATH = path.join(__dirname, '..', '..');

let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, { langPath: LANG_PATH, gzip: false }).catch((err) => {
      workerPromise = null; // allow retry on a later request
      throw err;
    });
  }
  return workerPromise;
}

async function extractText(imageBuffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageBuffer);
  return data.text;
}

async function scanImage(imageBuffer) {
  let text;
  try {
    text = await extractText(imageBuffer);
  } catch (err) {
    return {
      ok: false,
      error: `OCR unavailable: ${err.message}. Everything else in the lab is unaffected.`,
    };
  }
  const scan = runAll(text || '');
  return { ok: true, extractedText: text, ...scan };
}

module.exports = { scanImage, extractText };
