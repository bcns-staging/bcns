// Pure scoring math, deliberately decoupled from branching (see runEngine.js
// and any lib/scenarios/*.js for why `next` and `effects` are separate
// fields on a choice). Four 0-100 meters track the incident's handling
// quality; a final letter grade folds in the ending's narrative tone so the
// worst story outcomes always read as worse than the meters alone might
// suggest.
const METER_KEYS = ['containment', 'compliance', 'reputation', 'financial'];
const STARTING_METERS = { containment: 50, compliance: 50, reputation: 50, financial: 50 };

const TONE_MODIFIER = { good: 10, mixed: 0, bad: -15 };

function clamp(n) {
  return Math.max(0, Math.min(100, n));
}

function startingMeters() {
  return { ...STARTING_METERS };
}

function applyEffects(meters, effects = {}) {
  const next = { ...meters };
  for (const key of METER_KEYS) {
    if (typeof effects[key] === 'number') next[key] = clamp(next[key] + effects[key]);
  }
  return next;
}

function letterFor(composite) {
  if (composite >= 90) return 'A';
  if (composite >= 75) return 'B';
  if (composite >= 60) return 'C';
  if (composite >= 40) return 'D';
  return 'F';
}

function computeGrade(meters, endingTone) {
  const base = METER_KEYS.reduce((sum, k) => sum + meters[k], 0) / METER_KEYS.length;
  const composite = clamp(base + (TONE_MODIFIER[endingTone] ?? 0));
  return { composite: Math.round(composite), letter: letterFor(composite) };
}

module.exports = { METER_KEYS, startingMeters, applyEffects, computeGrade, clamp };
