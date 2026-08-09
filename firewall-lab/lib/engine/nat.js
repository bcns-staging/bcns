// Source and destination NAT lookup/translation. The security-rule-match
// step downstream needs to know whether to evaluate against the original
// or the NAT-translated destination -- that ambiguity (and the real-world
// confusion it causes) is modeled explicitly via `securityRuleMatchesOn`.
const crypto = require('crypto');
const store = require('../store');

function list() {
  return store.load('nat-rules');
}

function save(rule) {
  let record;
  store.update('nat-rules', (rows) => {
    const idx = rows.findIndex((r) => r.id === rule.id);
    if (idx >= 0) { record = { ...rows[idx], ...rule, id: rows[idx].id }; rows[idx] = record; }
    else { record = { id: crypto.randomUUID(), ...rule }; rows.push(record); }
    return rows;
  });
  return record;
}

function remove(id) {
  store.update('nat-rules', (rows) => rows.filter((r) => r.id !== id));
}

function translate(connection) {
  const rows = list();
  const dnatRule = rows.find((r) => r.type === 'destination' && r.publicIp === connection.dstIp && Number(r.publicPort) === Number(connection.dstPort));
  const snatRule = rows.find((r) => (r.type === 'source-dynamic' || r.type === 'static') && r.srcZone === connection.srcZone && (r.type !== 'static' || r.internalIp === connection.srcIp));

  const destinationNat = dnatRule
    ? { translatedIp: dnatRule.internalIp, translatedPort: dnatRule.internalPort, securityRuleMatchesOn: dnatRule.securityRuleMatchesOn || 'post-nat' }
    : null;
  const sourceNat = snatRule
    ? (snatRule.type === 'source-dynamic'
      ? { type: 'dynamic-pat', translatedIp: snatRule.poolIp, translatedPort: 'dynamic' }
      : { type: 'static', translatedIp: snatRule.publicIp })
    : null;

  const securityMatchAddress = destinationNat ? destinationNat.securityRuleMatchesOn : 'n/a';
  const matchedDstIp = destinationNat && securityMatchAddress === 'post-nat' ? destinationNat.translatedIp : connection.dstIp;
  const matchedDstPort = destinationNat && securityMatchAddress === 'post-nat' ? destinationNat.translatedPort : connection.dstPort;

  return { sourceNat, destinationNat, securityMatchAddress, matchedDstIp, matchedDstPort };
}

module.exports = { list, save, remove, translate };
