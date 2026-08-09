// UEBA (User & Entity Behavior Analytics): the previous techniques all
// inspect a single event's *content*. This inspects *behavior* over time --
// even content that scores as perfectly clean can be part of an
// exfiltration pattern if the volume moved is wildly out of character for
// that user. A real baseline would be far more sophisticated (time-of-day,
// day-of-week, peer-group comparison); this is the same core idea in its
// simplest real form: a rolling average and a ratio threshold.
const crypto = require('crypto');
const store = require('./store');
const incidents = require('./incidents');

const ANOMALY_RATIO = 3;
const MIN_HISTORY = 3;

function history(user) {
  return store.load('ueba-log').filter((e) => e.user === user);
}

function recordEvent({ user, channel, bytes }) {
  const record = { id: crypto.randomUUID(), user, channel, bytes, timestamp: new Date().toISOString() };
  store.update('ueba-log', (log) => {
    log.push(record);
    return log;
  });
  return record;
}

function checkAndRecord({ user, channel, bytes }) {
  const prior = history(user);
  let baseline = null;
  let ratio = null;
  let anomaly = false;

  if (prior.length >= MIN_HISTORY) {
    baseline = prior.reduce((sum, e) => sum + e.bytes, 0) / prior.length;
    ratio = baseline > 0 ? bytes / baseline : bytes > 0 ? Infinity : 0;
    anomaly = ratio >= ANOMALY_RATIO;
  }

  const event = recordEvent({ user, channel, bytes });

  let incident = null;
  if (anomaly) {
    incident = incidents.add({
      channel: `ueba:${channel}`,
      user,
      destination: null,
      policyId: null,
      policyName: 'UEBA volume anomaly',
      action: 'alert',
      score: Math.min(1, ratio / 10),
      severity: ratio >= 10 ? 'critical' : ratio >= 5 ? 'high' : 'medium',
      contentPreview: `${bytes.toLocaleString()} bytes moved via ${channel} -- ${ratio.toFixed(1)}x this user's rolling average of ${Math.round(baseline).toLocaleString()} bytes`,
    });
  }

  return { event, baseline, ratio, anomaly, historyCount: prior.length, incident };
}

function getHistory(user) {
  return history(user);
}

module.exports = { checkAndRecord, getHistory, ANOMALY_RATIO, MIN_HISTORY };
