// The recurring rule-base audit a security engineer actually does: find
// rules a broader, earlier rule makes unreachable (shadowed), rules that
// have never matched anything (candidates for removal), and rules that are
// dangerously broad (any/any/allow with no logging).
const rules = require('./engine/rules');

function broaderOrEqual(a, b) {
  return a === 'any' || a == null || a === b;
}

function subsumes(a, b) {
  // Does earlier rule `a` match a superset of everything later rule `b`
  // would match? Only true when every one of a's match fields is at least
  // as broad as b's corresponding field.
  return (
    broaderOrEqual(a.srcZone, b.srcZone) &&
    broaderOrEqual(a.dstZone, b.dstZone) &&
    broaderOrEqual(a.srcIp, b.srcIp) &&
    broaderOrEqual(a.dstIp, b.dstIp) &&
    broaderOrEqual(a.protocol, b.protocol) &&
    broaderOrEqual(a.port, b.port) &&
    broaderOrEqual(a.app, b.app) &&
    broaderOrEqual(a.user, b.user) &&
    broaderOrEqual(a.urlCategory, b.urlCategory)
  );
}

function analyze(ruleset) {
  const list = rules.list(ruleset);
  const shadowed = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (subsumes(list[i], list[j])) {
        shadowed.push({
          shadowedRule: list[j],
          shadowingRule: list[i],
          severity: list[i].action !== list[j].action ? 'critical' : 'info',
          reason: list[i].action !== list[j].action
            ? `"${list[i].name}" (order ${list[i].order}) matches everything "${list[j].name}" (order ${list[j].order}) would, but with action "${list[i].action}" instead of "${list[j].action}" -- a real security gap, not just a redundant rule.`
            : `"${list[i].name}" (order ${list[i].order}) already matches everything "${list[j].name}" (order ${list[j].order}) would, with the same action -- "${list[j].name}" is dead weight.`,
        });
        break; // only report against the nearest shadowing rule
      }
    }
  }
  const zeroHit = list.filter((r) => (r.hitCount || 0) === 0);
  // "Overly permissive" here means unrestricted service (any protocol, any
  // port) on an allow rule with no logging -- the classic finding in a real
  // rule-base audit, independent of how narrow its zone/IP scope is.
  const overlyPermissive = list.filter((r) => r.action === 'allow' && !r.log
    && (r.protocol === 'any' || r.protocol == null) && (r.port === 'any' || r.port == null));
  return { shadowed, zeroHit, overlyPermissive };
}

module.exports = { analyze };
