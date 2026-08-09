// Resolves which zone a packet is arriving from (ingress interface -> zone)
// and which zone its destination lives in (a simplified route lookup: an
// exact host match, then an interface subnet match, then falling back to
// the Untrust zone -- exactly what a real default route does).
const store = require('../store');

function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function ipInCidr(ip, cidr) {
  if (!cidr || !cidr.includes('/')) return ip === cidr;
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}

function ingressZone(interfaceId) {
  const iface = store.load('interfaces').find((i) => i.id === interfaceId);
  return iface ? iface.zoneId : null;
}

function destinationZone(dstIp) {
  const host = store.load('hosts').find((h) => h.ip === dstIp);
  if (host) return host.zoneId;
  const iface = store.load('interfaces').find((i) => ipInCidr(dstIp, i.ipCidr));
  if (iface) return iface.zoneId;
  return store.ZONE_UNTRUST;
}

function zoneName(zoneId) {
  if (!zoneId) return 'Unknown';
  const zone = store.load('zones').find((z) => z.id === zoneId);
  return zone ? zone.name : 'Unknown';
}

module.exports = { ipToInt, ipInCidr, ingressZone, destinationZone, zoneName };
