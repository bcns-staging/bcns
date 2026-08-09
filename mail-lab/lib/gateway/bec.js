// Business Email Compromise detection: BEC attacks rarely carry malware or
// bad links at all -- they're pure social engineering, so SPF/DKIM/DMARC and
// even attachment/URL scanning miss them entirely. Detection instead
// combines several soft signals: does the display name impersonate someone
// trusted, does the sending domain look like a trusted brand, does Reply-To
// quietly redirect responses elsewhere, and does the language match known
// fraud patterns (urgency + money/credentials)?
const impersonation = require('./impersonation');
const lookalike = require('./lookalike');

const URGENCY_PHRASES = [
  'wire transfer', 'gift card', 'urgent', 'confidential', 'asap',
  'payment', 'invoice attached', 'bank details', 'verify your account',
  'password', 'act immediately', 'don\'t tell anyone', 'change of account',
];

function domainOf(email) {
  return (email || '').split('@')[1]?.toLowerCase() || '';
}

function score({ displayName, fromEmail, replyTo, subject = '', body = '' }) {
  const signals = [];
  let points = 0;

  const imp = impersonation.check(displayName, fromEmail);
  if (imp.flagged) {
    points += 4;
    signals.push({ signal: 'display-name-impersonation', detail: imp.findings[0].reason, points: 4 });
  }

  const fromDomain = domainOf(fromEmail);
  if (fromDomain) {
    const la = lookalike.check(fromDomain);
    if (la.flagged) {
      points += 3;
      signals.push({ signal: 'lookalike-domain', detail: `sending domain "${fromDomain}" resembles a protected brand domain (${la.findings[0].protectedDomain})`, points: 3 });
    }
  }

  if (replyTo) {
    const replyDomain = domainOf(replyTo);
    if (replyDomain && replyDomain !== fromDomain) {
      points += 2;
      signals.push({ signal: 'reply-to-mismatch', detail: `Reply-To (${replyDomain}) differs from the From address domain (${fromDomain}) -- replies go somewhere else entirely`, points: 2 });
    }
  }

  const text = `${subject}\n${body}`.toLowerCase();
  const matchedPhrases = URGENCY_PHRASES.filter((p) => text.includes(p));
  if (matchedPhrases.length) {
    const pts = Math.min(matchedPhrases.length, 3);
    points += pts;
    signals.push({ signal: 'urgency-language', detail: `contains fraud-pattern phrases: ${matchedPhrases.join(', ')}`, points: pts });
  }

  const verdict = points >= 6 ? 'high-risk' : points >= 3 ? 'medium-risk' : 'low-risk';
  return { points, verdict, signals };
}

module.exports = { score, URGENCY_PHRASES };
