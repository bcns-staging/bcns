// A simplified SpamAssassin-style rule-based scorer: each heuristic adds
// points, and a threshold decides the verdict. Real spam filters use
// hundreds of rules plus Bayesian/ML models; this is the same idea at a
// scale small enough to read in one sitting.
const SPAM_WORDS = [
  'viagra', 'lottery', 'winner', 'click here', 'free money', 'act now',
  'limited time', 'cash prize', 'work from home', 'risk free', 'no cost',
  'congratulations you', 'claim your', 'wire transfer', 'nigerian prince',
];

function score({ subject = '', body = '' }) {
  const reasons = [];
  let points = 0;
  const text = `${subject}\n${body}`;
  const lowerText = text.toLowerCase();

  const letters = subject.replace(/[^A-Za-z]/g, '');
  const capsRatio = letters.length ? (letters.replace(/[a-z]/g, '').length / letters.length) : 0;
  if (subject.length > 6 && capsRatio > 0.6) {
    points += 2;
    reasons.push(`subject is mostly uppercase (${Math.round(capsRatio * 100)}% caps) [+2]`);
  }

  const exclaims = (text.match(/!/g) || []).length;
  if (exclaims >= 3) {
    points += 1;
    reasons.push(`excessive exclamation marks (${exclaims}) [+1]`);
  }

  const linkCount = (text.match(/https?:\/\//g) || []).length;
  if (linkCount >= 4) {
    points += 1;
    reasons.push(`unusually many links (${linkCount}) [+1]`);
  }

  for (const word of SPAM_WORDS) {
    if (lowerText.includes(word)) {
      points += 2;
      reasons.push(`contains spam trigger phrase "${word}" [+2]`);
    }
  }

  const verdict = points >= 5 ? 'spam' : points >= 2 ? 'suspicious' : 'ham';
  return { points, verdict, reasons };
}

module.exports = { score, SPAM_WORDS };
