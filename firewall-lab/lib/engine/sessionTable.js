// The stateful session table: NEW connections get created here; return
// traffic and related flows (e.g. an FTP data channel) match against it
// instead of walking the rulebase again -- this is what "stateful
// inspection" means in practice. Sessions are scoped per ruleset so
// testing the same connection against both rulebases in the Traffic
// Simulator doesn't let one run's session state leak into the other's.
const crypto = require('crypto');
const store = require('../store');

function fiveTupleKey({ protocol, srcIp, srcPort, dstIp, dstPort }) {
  return `${protocol}:${srcIp}:${srcPort ?? '-'}:${dstIp}:${dstPort}`;
}
function reverseKey({ protocol, srcIp, srcPort, dstIp, dstPort }) {
  return fiveTupleKey({ protocol, srcIp: dstIp, srcPort: dstPort, dstIp: srcIp, dstPort: srcPort });
}

function all() {
  return store.load('sessions');
}

function lookup(connection, ruleset) {
  const key = fiveTupleKey(connection);
  const revKey = reverseKey(connection);
  return all().find((s) => s.ruleset === ruleset && (s.key === key || s.key === revKey)) || null;
}

function relatedSession(id, ruleset) {
  if (!id) return null;
  return all().find((s) => s.id === id && s.ruleset === ruleset) || null;
}

function create(connection, ruleset, extra = {}) {
  const record = {
    id: crypto.randomUUID(),
    ruleset,
    key: fiveTupleKey(connection),
    protocol: connection.protocol,
    srcIp: connection.srcIp,
    srcPort: connection.srcPort,
    dstIp: connection.dstIp,
    dstPort: connection.dstPort,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ...extra,
  };
  store.update('sessions', (list) => { list.push(record); return list; });
  return record;
}

function touch(id) {
  store.update('sessions', (list) => list.map((s) => (s.id === id ? { ...s, lastSeenAt: new Date().toISOString() } : s)));
}

function clear() {
  store.save('sessions', []);
}

module.exports = { all, lookup, relatedSession, create, touch, clear, fiveTupleKey };
