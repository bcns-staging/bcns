// Proximity/context-aware matching: catches sensitive-looking data that
// doesn't match a strict formatted pattern (e.g. a 9-digit number with no
// dashes) by requiring a supporting keyword nearby -- and just as
// importantly, suppresses matches that would otherwise be noise. This is
// how real DLP engines cut false-positive rates on loosely-formatted data.
const WINDOW = 40; // characters of context to look back/forward

const LOOSE_PATTERNS = [
  { id: 'loose-ssn', name: 'Unformatted SSN-like number', regex: /\b\d{9}\b/g, contextTerms: ['ssn', 'social security', 'social security number'] },
  { id: 'loose-account', name: 'Unformatted account number', regex: /\b\d{8,17}\b/g, contextTerms: ['account number', 'account no', 'routing number', 'acct'] },
  { id: 'loose-dob', name: 'Date near identity context', regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, contextTerms: ['date of birth', 'dob', 'born'] },
];

function hasContext(text, index, matchLength, contextTerms) {
  const start = Math.max(0, index - WINDOW);
  const end = Math.min(text.length, index + matchLength + WINDOW);
  const window = text.slice(start, end).toLowerCase();
  return contextTerms.some((term) => window.includes(term));
}

function scan(text) {
  const findings = [];
  for (const pattern of LOOSE_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    for (const m of text.matchAll(regex)) {
      if (hasContext(text, m.index, m[0].length, pattern.contextTerms)) {
        findings.push({ patternId: pattern.id, name: pattern.name, index: m.index, contextConfirmed: true });
      }
    }
  }
  const confidence = findings.length ? Math.min(1, 0.5 + findings.length * 0.15) : 0;
  return { confidence, findings };
}

module.exports = { scan, LOOSE_PATTERNS };
