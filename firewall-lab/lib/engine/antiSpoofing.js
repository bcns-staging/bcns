// Ingress/egress filtering: reject traffic whose source address is
// implausible for the interface it actually arrived on -- e.g. an RFC1918
// "internal" address arriving on the Untrust interface almost certainly
// means someone is spoofing an internal host to slip past IP-based rules.
const store = require('../store');
const { ipInCidr } = require('./zones');

const RFC1918_RANGES = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
const BOGON_RANGES = ['0.0.0.0/8', '127.0.0.0/8', '169.254.0.0/16', '224.0.0.0/4'];

function isPrivate(ip) {
  return RFC1918_RANGES.some((cidr) => ipInCidr(ip, cidr));
}
function isBogon(ip) {
  return BOGON_RANGES.some((cidr) => ipInCidr(ip, cidr));
}

function check({ srcIp, ingressInterfaceId }) {
  const iface = store.load('interfaces').find((i) => i.id === ingressInterfaceId);
  if (!iface) return { spoofed: false, reason: null };
  const zone = store.load('zones').find((z) => z.id === iface.zoneId);
  const isExternalInterface = zone?.trustLevel === 'external';

  if (isBogon(srcIp)) {
    return { spoofed: true, reason: `${srcIp} is a bogon/reserved address -- never a legitimate source.` };
  }
  if (isExternalInterface && isPrivate(srcIp)) {
    return { spoofed: true, reason: `${srcIp} is an RFC1918 private address arriving on the external "${zone.name}" interface (${iface.name}) -- this is almost certainly spoofed.` };
  }
  return { spoofed: false, reason: null };
}

module.exports = { check, isPrivate, isBogon };
