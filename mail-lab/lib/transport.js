// Simulates the SMTP transport handshake (STARTTLS) so learners can see the
// literal wire-level conversation and why opportunistic TLS, unlike MTA-STS,
// can be silently downgraded by an on-path attacker.
const crypto = require('crypto');

function simulateSmtpSession({ fromHost, toHost, useTls }) {
  const transcript = [];
  const queueId = crypto.randomBytes(5).toString('hex').toUpperCase();
  transcript.push(`220 ${toHost} ESMTP ready`);
  transcript.push(`EHLO ${fromHost}`);
  transcript.push(`250-${toHost} Hello ${fromHost}`);
  transcript.push('250-STARTTLS');
  transcript.push('250 SIZE 35882577');

  let tlsNegotiated = false;
  if (useTls) {
    transcript.push('STARTTLS');
    transcript.push('220 2.0.0 Ready to start TLS');
    transcript.push('-- TLS handshake: negotiated TLSv1.3, cipher TLS_AES_256_GCM_SHA384 --');
    transcript.push(`EHLO ${fromHost}`);
    transcript.push(`250 ${toHost} Hello ${fromHost}, this session is now encrypted`);
    tlsNegotiated = true;
  } else {
    transcript.push('-- sender did not request STARTTLS; continuing in plaintext --');
  }

  transcript.push('MAIL FROM:<sender>');
  transcript.push('250 OK');
  transcript.push('RCPT TO:<recipient>');
  transcript.push('250 OK');
  transcript.push('DATA');
  transcript.push('354 Start mail input; end with <CRLF>.<CRLF>');
  transcript.push(`250 OK: queued as ${queueId}`);
  transcript.push('QUIT');
  transcript.push('221 Bye');

  const warning = tlsNegotiated
    ? null
    : 'This message traveled in cleartext. STARTTLS is opportunistic: if a sender simply doesn\'t offer it (or an attacker strips it in transit), the connection silently falls back to plaintext and nothing alerts either party. MTA-STS exists specifically to make TLS mandatory instead of optional.';

  return { transcript, tlsNegotiated, warning };
}

module.exports = { simulateSmtpSession };
