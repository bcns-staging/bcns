// Firestore-backed persistence - drop-in replacement for the original
// fs-based JSON store. Same load/save/update API (synchronous from the
// caller's perspective, served from an in-memory cache hydrated from
// Firestore at startup), so no route/lib code needed to change to move off
// local disk, which doesn't survive Cloud Run container restarts/scaling.
// Firestore writes are fire-and-forget from save()'s perspective (matching
// the original's "good enough for a lab" durability bar) but errors are
// logged, not swallowed.
//
// Seeded with a small realistic starter environment (a 3-zone topology,
// two rulebases, NAT/VPN, and the NGFW intel tables) so every page has
// something real to test against on first run, not just empty tables.
const crypto = require('crypto');
const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore();
const COLLECTION = 'firewall_lab_state';

// Stable ids for the seeded topology so interfaces/hosts/rules/NAT can
// cross-reference the same zones consistently.
const ZONE_TRUST = 'zone-trust';
const ZONE_UNTRUST = 'zone-untrust';
const ZONE_DMZ = 'zone-dmz';
const IF_INSIDE = 'if-eth1';
const IF_OUTSIDE = 'if-eth0';
const IF_DMZ = 'if-eth2';

const DEFAULTS = {
  zones: [
    { id: ZONE_TRUST, name: 'Trust', trustLevel: 'internal' },
    { id: ZONE_UNTRUST, name: 'Untrust', trustLevel: 'external' },
    { id: ZONE_DMZ, name: 'DMZ', trustLevel: 'semi-trusted' },
  ],
  interfaces: [
    { id: IF_INSIDE, name: 'eth1', zoneId: ZONE_TRUST, ipCidr: '10.0.0.1/24', type: 'physical' },
    { id: IF_OUTSIDE, name: 'eth0', zoneId: ZONE_UNTRUST, ipCidr: '203.0.113.1/30', type: 'physical' },
    { id: IF_DMZ, name: 'eth2', zoneId: ZONE_DMZ, ipCidr: '192.168.50.1/24', type: 'physical' },
  ],
  hosts: [
    { id: crypto.randomUUID(), name: 'workstation-jsmith', ip: '10.0.0.50', zoneId: ZONE_TRUST },
    { id: crypto.randomUUID(), name: 'workstation-agarcia', ip: '10.0.0.51', zoneId: ZONE_TRUST },
    { id: crypto.randomUUID(), name: 'dmz-web-server', ip: '192.168.50.20', zoneId: ZONE_DMZ },
    { id: crypto.randomUUID(), name: 'internet-host', ip: '203.0.113.20', zoneId: ZONE_UNTRUST },
  ],
  services: [
    { id: crypto.randomUUID(), name: 'HTTP', protocol: 'tcp', port: 80 },
    { id: crypto.randomUUID(), name: 'HTTPS', protocol: 'tcp', port: 443 },
    { id: crypto.randomUUID(), name: 'DNS', protocol: 'udp', port: 53 },
    { id: crypto.randomUUID(), name: 'SSH', protocol: 'tcp', port: 22 },
    { id: crypto.randomUUID(), name: 'FTP', protocol: 'tcp', port: 21 },
  ],
  // Deliberately includes one overly-broad early rule that shadows the
  // (otherwise correct) DNS rule below it -- gives the shadowed-rules and
  // rule-hygiene pages something real to find on first run.
  'traditional-rules': [
    { id: crypto.randomUUID(), order: 0, name: 'Allow Trust Outbound (broad)', srcZone: ZONE_TRUST, dstZone: ZONE_UNTRUST, srcIp: 'any', dstIp: 'any', protocol: 'any', port: 'any', action: 'allow', log: false, hitCount: 0 },
    { id: crypto.randomUUID(), order: 1, name: 'Allow DNS Outbound', srcZone: ZONE_TRUST, dstZone: ZONE_UNTRUST, srcIp: 'any', dstIp: 'any', protocol: 'udp', port: 53, action: 'allow', log: true, hitCount: 0 },
    { id: crypto.randomUUID(), order: 2, name: 'Publish DMZ Web Server', srcZone: ZONE_UNTRUST, dstZone: ZONE_DMZ, srcIp: 'any', dstIp: '192.168.50.20', protocol: 'tcp', port: 443, action: 'allow', log: true, hitCount: 0 },
    { id: crypto.randomUUID(), order: 3, name: 'Deny All', srcZone: 'any', dstZone: 'any', srcIp: 'any', dstIp: 'any', protocol: 'any', port: 'any', action: 'deny', log: true, hitCount: 0 },
  ],
  'ngfw-rules': [
    { id: crypto.randomUUID(), order: 0, name: 'Block P2P Apps', srcZone: ZONE_TRUST, dstZone: 'any', app: 'bittorrent', user: 'any', urlCategory: 'any', srcIp: 'any', dstIp: 'any', action: 'deny', log: true, hitCount: 0, profile: { ips: true, antiMalware: true, urlFiltering: true, threatIntel: true, decrypt: true } },
    { id: crypto.randomUUID(), order: 1, name: 'Finance Group to Salesforce', srcZone: ZONE_TRUST, dstZone: ZONE_UNTRUST, app: 'salesforce', user: 'group:finance', urlCategory: 'any', srcIp: 'any', dstIp: 'any', action: 'allow', log: true, hitCount: 0, profile: { ips: true, antiMalware: true, urlFiltering: true, threatIntel: true, decrypt: true } },
    { id: crypto.randomUUID(), order: 2, name: 'Allow Inspected Web Browsing', srcZone: ZONE_TRUST, dstZone: ZONE_UNTRUST, app: 'generic-tls', user: 'any', urlCategory: 'any', srcIp: 'any', dstIp: 'any', action: 'allow', log: true, hitCount: 0, profile: { ips: true, antiMalware: true, urlFiltering: true, threatIntel: true, decrypt: true } },
    { id: crypto.randomUUID(), order: 3, name: 'Publish DMZ Web Server', srcZone: ZONE_UNTRUST, dstZone: ZONE_DMZ, app: 'any', user: 'any', urlCategory: 'any', srcIp: 'any', dstIp: '192.168.50.20', protocol: 'tcp', port: 443, action: 'allow', log: true, hitCount: 0, profile: { ips: true, antiMalware: false, urlFiltering: false, threatIntel: false, decrypt: false } },
    { id: crypto.randomUUID(), order: 4, name: 'Deny All', srcZone: 'any', dstZone: 'any', app: 'any', user: 'any', urlCategory: 'any', srcIp: 'any', dstIp: 'any', action: 'deny', log: true, hitCount: 0, profile: {} },
  ],
  'nat-rules': [
    { id: crypto.randomUUID(), type: 'source-dynamic', srcZone: ZONE_TRUST, poolIp: '203.0.113.1', description: "PAT all Trust-zone outbound traffic to the firewall's single public IP" },
    { id: crypto.randomUUID(), type: 'destination', publicIp: '203.0.113.1', publicPort: 443, internalIp: '192.168.50.20', internalPort: 443, securityRuleMatchesOn: 'pre-nat', description: 'Publish the DMZ web server on the public IP' },
  ],
  'vpn-tunnels': [
    {
      id: crypto.randomUUID(),
      name: 'Branch-A',
      localEndpoint: '203.0.113.1',
      remoteEndpoint: '198.51.100.10',
      ike: { version: 'IKEv2', encryption: 'AES-256', dhGroup: 14 },
      ipsec: { encryption: 'AES-256-GCM' },
      remoteDomain: '172.16.0.0/16',
    },
  ],
  'app-signatures': [
    { id: crypto.randomUUID(), name: 'bittorrent', defaultPort: null, category: 'p2p', risk: 'high' },
    { id: crypto.randomUUID(), name: 'salesforce', defaultPort: 443, category: 'business-apps', risk: 'low' },
    { id: crypto.randomUUID(), name: 'generic-tls', defaultPort: 443, category: 'web-browsing', risk: 'low' },
    { id: crypto.randomUUID(), name: 'dns', defaultPort: 53, category: 'networking', risk: 'low' },
    { id: crypto.randomUUID(), name: 'ssh', defaultPort: 22, category: 'networking', risk: 'medium' },
  ],
  users: [
    { id: crypto.randomUUID(), ip: '10.0.0.50', username: 'jsmith', groups: ['finance', 'all-employees'] },
    { id: crypto.randomUUID(), ip: '10.0.0.51', username: 'agarcia', groups: ['engineering', 'all-employees'] },
  ],
  'url-categories': [
    { id: crypto.randomUUID(), domain: 'gambling-site.example', category: 'gambling' },
    { id: crypto.randomUUID(), domain: 'malware-drop.example', category: 'malware' },
    { id: crypto.randomUUID(), domain: 'salesforce.example', category: 'business-apps' },
    { id: crypto.randomUUID(), domain: 'newsblog.example', category: 'news' },
  ],
  'threat-intel-feed': [
    { id: crypto.randomUUID(), indicator: '198.51.100.66', type: 'ip', verdict: 'malicious', source: 'lab-feed' },
    { id: crypto.randomUUID(), indicator: 'malware-drop.example', type: 'domain', verdict: 'malicious', source: 'lab-feed' },
  ],
  'ips-signatures': [
    { id: crypto.randomUUID(), cveId: 'CVE-2021-44228', name: 'Log4Shell JNDI lookup', severity: 'critical', pattern: '${jndi:', action: 'reset' },
    { id: crypto.randomUUID(), cveId: 'CVE-2017-5638', name: 'Apache Struts OGNL injection', severity: 'critical', pattern: "%{(#_='multipart/form-data')", action: 'reset' },
    { id: crypto.randomUUID(), cveId: 'CVE-2014-6271', name: 'Shellshock Bash environment exploit', severity: 'high', pattern: '() { :;};', action: 'reset' },
  ],
  'malware-hashes': [
    // The real, publicly-published SHA-256 of the standard EICAR antivirus test file.
    { id: crypto.randomUUID(), sha256: '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0', name: 'EICAR-Test-File', verdict: 'malicious' },
    { id: crypto.randomUUID(), sha256: 'a5c3f0e1d9b6472a8e1f6c0d4b3a7e29f5d8c1b6e4a2f9d7c3b5a1e8f0d2c4b6', name: 'Emotet.generic (lab sample)', verdict: 'malicious' },
  ],
  'dns-blocklist': [
    { id: crypto.randomUUID(), domain: 'malware-drop.example', category: 'malware', sinkholeIp: '10.255.255.1' },
    { id: crypto.randomUUID(), domain: 'c2-server.example', category: 'command-and-control', sinkholeIp: '10.255.255.1' },
  ],
  'traffic-log': [],
  sessions: [],
  'ha-state': { primaryUp: true, sessionSyncEnabled: true, failoverCount: 0, lastFailoverAt: null },
};

const cache = new Map();

async function hydrate() {
  const snapshot = await firestore.collection(COLLECTION).get();
  for (const doc of snapshot.docs) {
    cache.set(doc.id, doc.data().value);
  }
}

function load(name) {
  if (cache.has(name)) return cache.get(name);
  const value = structuredClone(DEFAULTS[name] ?? {});
  cache.set(name, value);
  firestore
    .collection(COLLECTION)
    .doc(name)
    .set({ value })
    .catch((err) => console.error(`Firestore init write failed for ${name}:`, err));
  return value;
}

function save(name, value) {
  cache.set(name, value);
  firestore
    .collection(COLLECTION)
    .doc(name)
    .set({ value })
    .catch((err) => console.error(`Firestore write failed for ${name}:`, err));
}

function update(name, mutator) {
  const value = load(name);
  const result = mutator(value);
  save(name, result !== undefined ? result : value);
  return cache.get(name);
}

module.exports = { load, save, update, hydrate, ZONE_TRUST, ZONE_UNTRUST, ZONE_DMZ, IF_INSIDE, IF_OUTSIDE, IF_DMZ };
