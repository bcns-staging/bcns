// The rule-matching engine shared by both rulebases: walk an ordered rule
// list top-to-bottom, first match wins, and fall back to an implicit deny
// if nothing matched -- exactly how every real firewall's security policy
// works. NGFW rules use the same matcher for their base (zone/IP/service)
// fields; app/user/url-category matching only happens when the caller
// passes matchContentFields (see engine/pipeline.js's two-pass NGFW match).
const crypto = require('crypto');
const store = require('../store');
const { ipInCidr } = require('./zones');

const COLLECTION = { traditional: 'traditional-rules', ngfw: 'ngfw-rules' };

function list(ruleset) {
  return store.load(COLLECTION[ruleset]).slice().sort((a, b) => a.order - b.order);
}

function save(ruleset, rule) {
  const name = COLLECTION[ruleset];
  let record;
  store.update(name, (rows) => {
    const idx = rows.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      record = { ...rows[idx], ...rule, id: rows[idx].id };
      rows[idx] = record;
    } else {
      record = { id: crypto.randomUUID(), order: rows.length, hitCount: 0, ...rule };
      rows.push(record);
    }
    return rows;
  });
  return record;
}

function remove(ruleset, id) {
  store.update(COLLECTION[ruleset], (rows) => rows.filter((r) => r.id !== id));
}

function reorder(ruleset, orderedIds) {
  store.update(COLLECTION[ruleset], (rows) => rows.map((r) => {
    const idx = orderedIds.indexOf(r.id);
    return idx >= 0 ? { ...r, order: idx } : r;
  }));
  return list(ruleset);
}

function fieldMatches(ruleValue, actual) {
  return ruleValue === 'any' || ruleValue == null || ruleValue === actual;
}

function ipFieldMatches(ruleValue, actual) {
  if (ruleValue === 'any' || ruleValue == null) return true;
  if (ruleValue.includes('/')) return ipInCidr(actual, ruleValue);
  return ruleValue === actual;
}

function userFieldMatches(ruleValue, resolvedUser) {
  if (ruleValue === 'any' || ruleValue == null) return true;
  if (!resolvedUser) return false;
  if (ruleValue.startsWith('group:')) return resolvedUser.groups.includes(ruleValue.slice(6));
  return ruleValue === resolvedUser.user;
}

function matchesRule(rule, connection, ctx) {
  if (!fieldMatches(rule.srcZone, ctx.srcZone)) return false;
  if (!fieldMatches(rule.dstZone, ctx.dstZone)) return false;
  if (!ipFieldMatches(rule.srcIp, connection.srcIp)) return false;
  if (!ipFieldMatches(rule.dstIp, connection.dstIp)) return false;
  if (rule.protocol && rule.protocol !== 'any' && rule.protocol !== connection.protocol) return false;
  if (rule.port != null && rule.port !== 'any' && Number(rule.port) !== Number(connection.dstPort)) return false;
  if (ctx.matchContentFields) {
    if (!fieldMatches(rule.app, ctx.resolvedApp)) return false;
    if (!userFieldMatches(rule.user, ctx.resolvedUser)) return false;
    if (!fieldMatches(rule.urlCategory, ctx.resolvedUrlCategory)) return false;
  }
  return true;
}

function match(ruleset, connection, ctx) {
  const rows = list(ruleset);
  const hit = rows.find((r) => matchesRule(r, connection, ctx));
  if (hit) return { rule: hit, implicitDeny: false };
  return { rule: { id: 'implicit-deny', name: 'Implicit Deny', action: 'deny', log: true }, implicitDeny: true };
}

function incrementHit(ruleset, ruleId) {
  if (!ruleId || ruleId === 'implicit-deny' || ruleId === 'anti-spoof-drop') return;
  store.update(COLLECTION[ruleset], (rows) => rows.map((r) => (r.id === ruleId ? { ...r, hitCount: (r.hitCount || 0) + 1 } : r)));
}

module.exports = { list, save, remove, reorder, match, incrementHit, COLLECTION };
