// The durable record of every evaluated connection's outcome -- mirrors a
// real firewall's traffic log, and what the Traffic Logs page displays.
const crypto = require('crypto');
const store = require('./store');

function list(filters = {}) {
  let rows = store.load('traffic-log');
  if (filters.srcIp) rows = rows.filter((r) => r.srcIp === filters.srcIp);
  if (filters.dstIp) rows = rows.filter((r) => r.dstIp === filters.dstIp);
  if (filters.zone) rows = rows.filter((r) => r.srcZone === filters.zone || r.dstZone === filters.zone);
  if (filters.action) rows = rows.filter((r) => r.verdict === filters.action);
  if (filters.app) rows = rows.filter((r) => r.app === filters.app);
  if (filters.user) rows = rows.filter((r) => r.user === filters.user);
  if (filters.ruleset) rows = rows.filter((r) => r.ruleset === filters.ruleset);
  return rows;
}

function add(entry) {
  const record = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...entry };
  store.update('traffic-log', (rows) => {
    rows.push(record);
    return rows;
  });
  return record;
}

function get(id) {
  return store.load('traffic-log').find((r) => r.id === id) || null;
}

module.exports = { list, add, get };
