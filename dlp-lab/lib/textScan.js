// Runs every text-based detector against one piece of content -- shared by
// the Scan Playground API, archive inspection (each text file found inside
// a zip gets scanned the same way), and eventually the policy engine.
const patterns = require('./detectors/patterns');
const keywordMatch = require('./detectors/keywordMatch');
const proximityMatch = require('./detectors/proximityMatch');
const edm = require('./detectors/edm');
const fingerprint = require('./detectors/fingerprint');
const classifier = require('./detectors/classifier');

function runAll(text) {
  const classifierResult = classifier.classify(text);
  const results = {
    pattern: patterns.scan(text),
    keyword: keywordMatch.scan(text),
    proximity: proximityMatch.scan(text),
    edm: edm.scan(text),
    fingerprint: fingerprint.scan(text),
    classifier: {
      confidence: classifierResult.label === 'sensitive' ? classifierResult.confidence : 0,
      findings: classifierResult.label ? [{ label: classifierResult.label, scores: classifierResult.scores }] : [],
    },
  };
  const overallConfidence = Math.max(...Object.values(results).map((r) => r.confidence));
  return { results, overallConfidence };
}

module.exports = { runAll };
