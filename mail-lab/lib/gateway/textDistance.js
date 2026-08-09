// Shared fuzzy-matching primitives used by lookalike-domain detection and,
// later, BEC scoring.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Maps visually-confusable characters/sequences to a canonical form so
// "rnicrosoft.com" and "microsoft.com" compare as near-identical, the same
// trick real anti-phishing filters use for homograph detection.
const CONFUSABLE_SEQUENCES = [
  [/rn/g, 'm'],
  [/vv/g, 'w'],
  [/0/g, 'o'],
  [/1/g, 'l'],
  [/3/g, 'e'],
  [/5/g, 's'],
  [/а/g, 'a'], // Cyrillic а
  [/е/g, 'e'], // Cyrillic е
  [/о/g, 'o'], // Cyrillic о
  [/р/g, 'p'], // Cyrillic р
  [/с/g, 'c'], // Cyrillic с
  [/ѕ/g, 's'], // Cyrillic ѕ
];

function normalizeConfusables(str) {
  let s = str.toLowerCase();
  for (const [pattern, replacement] of CONFUSABLE_SEQUENCES) s = s.replace(pattern, replacement);
  return s;
}

module.exports = { levenshtein, normalizeConfusables };
