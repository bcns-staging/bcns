// DNS sinkholing: substitute a controlled "sinkhole" address for domains
// known to be malicious, so an infected host's C2 lookups resolve
// somewhere harmless (and loudly logged) instead of the real attacker
// infrastructure.
const store = require('../store');

const NORMAL_IP_POOL = ['93.184.216.34', '151.101.1.140', '172.217.0.46'];

function pseudoIpFor(domain) {
  let hash = 0;
  for (const ch of domain) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return NORMAL_IP_POOL[hash % NORMAL_IP_POOL.length];
}

function resolve(domain) {
  if (!domain) return { sinkholed: false, ip: null, category: null };
  const entry = store.load('dns-blocklist').find((e) => e.domain === domain);
  if (entry) return { sinkholed: true, ip: entry.sinkholeIp, category: entry.category };
  return { sinkholed: false, ip: pseudoIpFor(domain), category: null };
}

module.exports = { resolve };
