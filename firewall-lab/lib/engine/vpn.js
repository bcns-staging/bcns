// Site-to-site IPSec tunnel lookup: if a (post-NAT) destination falls
// within a tunnel's configured remote domain, traffic routes into the
// tunnel instead of out the default path.
const crypto = require('crypto');
const store = require('../store');
const { ipInCidr } = require('./zones');

function list() {
  return store.load('vpn-tunnels');
}

function save(tunnel) {
  let record;
  store.update('vpn-tunnels', (rows) => {
    const idx = rows.findIndex((r) => r.id === tunnel.id);
    if (idx >= 0) { record = { ...rows[idx], ...tunnel, id: rows[idx].id }; rows[idx] = record; }
    else { record = { id: crypto.randomUUID(), ...tunnel }; rows.push(record); }
    return rows;
  });
  return record;
}

function remove(id) {
  store.update('vpn-tunnels', (rows) => rows.filter((r) => r.id !== id));
}

function route(connection) {
  const tunnel = list().find((t) => t.remoteDomain && ipInCidr(connection.dstIp, t.remoteDomain));
  return { tunnel: tunnel || null, routed: !!tunnel };
}

module.exports = { list, save, remove, route };
