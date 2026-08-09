// Reputation / RBL (Realtime Blackhole List): real-world DNSBLs work by
// reversing an IP's octets and querying it as a DNS A-record lookup against
// the list's zone (e.g. 4.3.2.1 -> 1.2.3.4.zen.spamhaus.org); an A-record
// response means "listed". We simulate the same query shape against a
// learner-maintained local list instead of a real internet blocklist.
const store = require('../store');

function blocklists() {
  return store.load('blocklists');
}

function reverseIp(ip) {
  return ip.split('.').reverse().join('.');
}

function checkIp(ip) {
  const query = `${reverseIp(ip)}.bl.lab.local`;
  const listed = (blocklists().ips || []).includes(ip);
  return { query, listed, reason: listed ? `${ip} is on the local reputation blocklist` : `${ip} not found on the blocklist` };
}

function checkDomain(domain) {
  const d = domain.toLowerCase();
  const listed = (blocklists().domains || []).includes(d);
  return { listed, reason: listed ? `${d} is on the local domain reputation blocklist` : `${d} not found on the blocklist` };
}

function addBlockedIp(ip) {
  store.update('blocklists', (b) => { b.ips = b.ips || []; if (!b.ips.includes(ip)) b.ips.push(ip); return b; });
  return blocklists().ips;
}
function removeBlockedIp(ip) {
  store.update('blocklists', (b) => { b.ips = (b.ips || []).filter((x) => x !== ip); return b; });
  return blocklists().ips;
}
function addBlockedDomain(domain) {
  const d = domain.toLowerCase();
  store.update('blocklists', (b) => { b.domains = b.domains || []; if (!b.domains.includes(d)) b.domains.push(d); return b; });
  return blocklists().domains;
}
function removeBlockedDomain(domain) {
  const d = domain.toLowerCase();
  store.update('blocklists', (b) => { b.domains = (b.domains || []).filter((x) => x !== d); return b; });
  return blocklists().domains;
}

module.exports = { checkIp, checkDomain, addBlockedIp, removeBlockedIp, addBlockedDomain, removeBlockedDomain, blocklists };
