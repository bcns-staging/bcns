// Keyword/dictionary matching: the simplest real DLP technique there is,
// and still one of the most heavily used in practice for things regex can't
// express well -- legal boilerplate, project codenames, "do not distribute"
// style markings.
const store = require('../store');

function listAll() {
  return store.load('keyword-lists');
}

function scan(text, lists = null) {
  const source = lists || listAll();
  const lower = text.toLowerCase();
  const findings = [];

  for (const list of source) {
    for (const term of list.terms || []) {
      const idx = lower.indexOf(term.toLowerCase());
      if (idx !== -1) {
        findings.push({ listId: list.id, listName: list.name, category: list.category, term, index: idx });
      }
    }
  }

  const distinctTerms = new Set(findings.map((f) => f.term.toLowerCase())).size;
  const confidence = findings.length ? Math.min(1, 0.35 + distinctTerms * 0.15) : 0;
  return { confidence, findings };
}

module.exports = { scan, listAll };
