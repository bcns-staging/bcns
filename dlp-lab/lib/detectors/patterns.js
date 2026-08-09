// Real regex + checksum-validated pattern detection -- the same first line
// of defense every commercial DLP product ships with. Checksums (Luhn,
// IBAN mod-97) matter because a bare regex for "16 digits" or "34
// alphanumeric characters" would false-positive constantly; validating the
// checksum is what makes the detection trustworthy enough to act on.

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

function ibanValid(raw) {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const converted = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  // mod-97 on a potentially huge number, done in chunks to avoid BigInt-free overflow.
  let remainder = 0;
  for (let i = 0; i < converted.length; i += 7) {
    remainder = Number(`${remainder}${converted.slice(i, i + 7)}`) % 97;
  }
  return remainder === 1;
}

function ssnPlausible(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 9) return false;
  const area = digits.slice(0, 3);
  const group = digits.slice(3, 5);
  const serial = digits.slice(5, 9);
  if (area === '000' || area === '666' || Number(area) >= 900) return false;
  if (group === '00') return false;
  if (serial === '0000') return false;
  return true;
}

function redact(value) {
  const v = String(value);
  if (v.length <= 4) return '*'.repeat(v.length);
  return `${v.slice(0, 2)}${'*'.repeat(Math.max(v.length - 4, 1))}${v.slice(-2)}`;
}

const PATTERNS = [
  {
    id: 'ssn',
    name: 'US Social Security Number',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    validate: ssnPlausible,
    weight: 0.9,
  },
  {
    id: 'credit-card',
    regex: /\b(?:\d[ -]?){13,19}\b/g,
    name: 'Credit Card Number',
    validate: (m) => luhnValid(m.replace(/[ -]/g, '')),
    weight: 0.9,
  },
  {
    id: 'iban',
    name: 'IBAN',
    // IBANs are conventionally written in space-separated groups of 4,
    // with the final group often shorter -- length/checksum validation
    // below is what actually confirms a real IBAN, not this loose shape.
    regex: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{1,4}){2,8}\b/g,
    validate: (m) => ibanValid(m.replace(/\s+/g, '')),
    weight: 0.85,
  },
  {
    id: 'aws-access-key',
    name: 'AWS Access Key ID',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    weight: 0.9,
  },
  {
    id: 'generic-api-key',
    name: 'Generic API Key',
    regex: /\b(?:sk|pk|api)[-_][A-Za-z0-9]{16,}\b/gi,
    weight: 0.75,
  },
  {
    id: 'us-passport',
    name: 'US Passport Number',
    regex: /\b[A-Z]\d{8}\b/g,
    weight: 0.55,
  },
  {
    id: 'phone',
    name: 'Phone Number',
    regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,
    weight: 0.3,
  },
  {
    id: 'email-address',
    name: 'Email Address',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    weight: 0.2,
  },
];

function scan(text) {
  const findings = [];
  const matchedTypes = new Set();

  for (const pattern of PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    for (const m of text.matchAll(regex)) {
      const raw = m[0];
      if (pattern.validate && !pattern.validate(raw)) continue;
      findings.push({
        patternId: pattern.id,
        name: pattern.name,
        match: redact(raw),
        index: m.index,
        weight: pattern.weight,
      });
      matchedTypes.add(pattern.id);
    }
  }

  const maxWeight = findings.reduce((m, f) => Math.max(m, f.weight), 0);
  const diversityBonus = Math.min((matchedTypes.size - (maxWeight > 0 ? 1 : 0)) * 0.05, 0.15);
  const confidence = findings.length ? Math.min(1, maxWeight + diversityBonus) : 0;

  return { confidence, findings };
}

module.exports = { scan, PATTERNS, luhnValid, ibanValid, ssnPlausible, redact };
