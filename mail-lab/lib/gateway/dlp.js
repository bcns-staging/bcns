// Data Loss Prevention: scans outbound content for patterns that look like
// sensitive data (SSNs, credit card numbers, API keys) so an organization
// can block or redact before it leaves. Real DLP systems use far more
// pattern types and often context-aware ML; this covers the classic,
// still-most-common cases.
function luhnValid(digits) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const PATTERNS = [
  {
    type: 'ssn',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    describe: () => 'US Social Security Number format',
  },
  {
    type: 'credit-card',
    regex: /\b(?:\d[ -]?){13,19}\b/g,
    validate: (match) => luhnValid(match.replace(/[ -]/g, '')),
    describe: () => 'credit card number (passed Luhn checksum)',
  },
  {
    type: 'aws-access-key',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    describe: () => 'AWS access key ID',
  },
  {
    type: 'generic-api-key',
    regex: /\b(?:sk|pk|api)[-_][A-Za-z0-9]{16,}\b/gi,
    describe: () => 'generic API key pattern',
  },
];

function redact(value) {
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`;
}

function scan(text) {
  const findings = [];
  for (const pattern of PATTERNS) {
    const matches = [...text.matchAll(pattern.regex)];
    for (const m of matches) {
      const raw = m[0];
      if (pattern.validate && !pattern.validate(raw)) continue;
      findings.push({ type: pattern.type, description: pattern.describe(), match: redact(raw) });
    }
  }
  return { flagged: findings.length > 0, findings };
}

module.exports = { scan, luhnValid, redact };
