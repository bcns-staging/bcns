// Received-header chain building (so composed messages look like they
// actually hopped through mail servers) and a sandboxed CRLF header
// injection demo. Nothing here ever opens a real network connection.
const crypto = require('crypto');

function formatRfc2822Date(date = new Date()) {
  return date.toUTCString().replace('GMT', '+0000');
}

function randomId(len = 8) {
  return crypto.randomBytes(len).toString('hex');
}

// Parses "Display Name <user@domain>" or a bare "user@domain" address.
function parseAddress(input) {
  const str = String(input || '').trim();
  const m = /^(.*?)<([^<>]+)>\s*$/.exec(str);
  const email = (m ? m[2] : str).trim();
  const displayName = (m ? m[1] : '').trim().replace(/^"|"$/g, '');
  const domain = email.split('@')[1] || '';
  return { displayName, email, domain: domain.toLowerCase() };
}

// Hops are listed oldest-first (originating server first); the returned
// array is newest-first, matching how real mail clients display them
// (each server prepends its own Received header).
function buildReceivedChain(hops) {
  return hops
    .map(({ fromHost, fromIp, byHost, withProtocol = 'ESMTPS', forAddress, date }) => {
      const id = randomId();
      return (
        `from ${fromHost} (${fromHost} [${fromIp}])\r\n` +
        `\tby ${byHost} with ${withProtocol} id ${id}${forAddress ? `\r\n\tfor <${forAddress}>` : ''};\r\n` +
        `\t${formatRfc2822Date(date)}`
      );
    })
    .reverse();
}

// --- CRLF header injection demo (RFC 5322 / classic mail-header injection) ---
// A header VALUE must never contain a bare CR or LF: real mail parsers treat
// "\r\n" followed by something that isn't whitespace as the start of a brand
// new header. If an application builds headers by naive string
// concatenation from user input, an attacker can smuggle extra headers
// (e.g. an extra Bcc:) into the message.

function buildHeaderBlockUnsafe(fields) {
  // Deliberately vulnerable: does not validate/strip CR/LF in values.
  return fields.map(([name, value]) => `${name}: ${value}`).join('\r\n');
}

function sanitizeHeaderValue(value) {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

function buildHeaderBlockSafe(fields) {
  return fields.map(([name, value]) => `${name}: ${sanitizeHeaderValue(value)}`).join('\r\n');
}

function demoHeaderInjection(subjectInput) {
  const fields = [
    ['From', 'sender@example.com'],
    ['To', 'recipient@example.com'],
    ['Subject', subjectInput],
  ];
  const vulnerableOutput = buildHeaderBlockUnsafe(fields);
  const safeOutput = buildHeaderBlockSafe(fields);
  const injected = /[\r\n]/.test(subjectInput);
  // Count header lines a real (lenient) parser would see: most real-world
  // parsers split on a bare LF too, not just CRLF -- which is exactly what
  // makes this exploitable even when an attacker can only smuggle in "\n".
  const parsedLineCount = vulnerableOutput.split(/\r\n|\r|\n/).length;
  return { vulnerableOutput, safeOutput, injected, parsedLineCount, originalFieldCount: fields.length };
}

module.exports = {
  formatRfc2822Date,
  parseAddress,
  buildReceivedChain,
  buildHeaderBlockUnsafe,
  buildHeaderBlockSafe,
  sanitizeHeaderValue,
  demoHeaderInjection,
};
