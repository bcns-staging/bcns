// Signature-based intrusion detection: does this payload contain a known
// exploit pattern? Real IPS engines do far more (protocol decoders,
// normalization, evasion handling) -- this is the same core idea in
// miniature, the same way DLP's pattern detector is a miniature DLP engine.
const store = require('../store');

function match(payloadSignature) {
  if (!payloadSignature) return { matched: false, signature: null };
  const signatures = store.load('ips-signatures');
  const hit = signatures.find((s) => payloadSignature.includes(s.pattern));
  return hit ? { matched: true, signature: hit } : { matched: false, signature: null };
}

module.exports = { match };
