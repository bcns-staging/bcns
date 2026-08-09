// IP/domain reputation lookups against a threat-intelligence feed.
const store = require('../store');

function lookup(indicator) {
  if (!indicator) return { listed: false, verdict: null, source: null };
  const entry = store.load('threat-intel-feed').find((e) => e.indicator === indicator);
  return entry ? { listed: true, verdict: entry.verdict, source: entry.source } : { listed: false, verdict: null, source: null };
}

module.exports = { lookup };
