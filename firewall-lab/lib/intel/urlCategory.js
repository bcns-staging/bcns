// Category-based URL/web filtering -- independent of App-ID (the same
// "generic-tls" app can lead to a business tool or a gambling site; only
// the destination's category tells them apart).
const store = require('../store');

function extractDomain(input) {
  if (!input) return null;
  return input.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
}

function categorize(url) {
  const domain = extractDomain(url);
  if (!domain) return { category: 'uncategorized', matched: null, domain: null };
  const entry = store.load('url-categories').find((c) => c.domain === domain);
  return entry ? { category: entry.category, matched: entry, domain } : { category: 'uncategorized', matched: null, domain };
}

module.exports = { categorize, extractDomain };
