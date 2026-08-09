// SPF evaluation per RFC 7208, against the simulated DNS zone in dnsZone.js.
// Supports v=spf1, qualifiers (+ - ~ ?), mechanisms (all, ip4, ip6, a, mx,
// include, exists), and the redirect= modifier, with real CIDR matching.
const dnsZone = require('./dnsZone');

const MAX_LOOKUPS = 10; // RFC 7208 4.6.4 limit on lookups that hit the network

function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipv4InCidr(ip, cidr, prefix) {
  const ipInt = ipv4ToInt(ip);
  const netInt = ipv4ToInt(cidr);
  if (ipInt === null || netInt === null) return false;
  const bits = prefix === undefined ? 32 : Number(prefix);
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

function expandIpv6(ip) {
  if (!ip.includes(':')) return null;
  let [head, tail] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missing = 8 - headParts.length - tailParts.length;
  if (ip.includes('::')) {
    const zeros = new Array(Math.max(missing, 0)).fill('0');
    return [...headParts, ...zeros, ...tailParts].map((h) => h.padStart(4, '0')).join(':');
  }
  const parts = ip.split(':');
  if (parts.length !== 8) return null;
  return parts.map((h) => h.padStart(4, '0')).join(':');
}

function ipv6ToBigInt(ip) {
  const expanded = expandIpv6(ip);
  if (!expanded) return null;
  return BigInt('0x' + expanded.replace(/:/g, ''));
}

function ipv6InCidr(ip, cidr, prefix) {
  const ipBig = ipv6ToBigInt(ip);
  const netBig = ipv6ToBigInt(cidr);
  if (ipBig === null || netBig === null) return false;
  const bits = prefix === undefined ? 128 : Number(prefix);
  if (bits === 0) return true;
  const shift = BigInt(128 - bits);
  return (ipBig >> shift) === (netBig >> shift);
}

function isIpv6(ip) {
  return ip.includes(':');
}

function matchesIp(ip, target, prefix) {
  if (isIpv6(ip) || isIpv6(target)) return ipv6InCidr(ip, target, prefix);
  return ipv4InCidr(ip, target, prefix);
}

function parseMechanism(term) {
  const m = /^([+\-~?]?)(all|include|a|mx|ptr|ip4|ip6|exists)(?::([^/]+))?(?:\/(\d+)(?:\/\/(\d+))?)?$/i.exec(term);
  if (!m) return null;
  const [, q, type, value, prefix] = m;
  return { qualifier: q || '+', type: type.toLowerCase(), value, prefix };
}

function qualifierResult(q) {
  return { '+': 'pass', '-': 'fail', '~': 'softfail', '?': 'neutral' }[q] || 'pass';
}

function getSpfRecords(domain) {
  return dnsZone.resolveTxt(domain).filter((v) => /^v=spf1(\s|$)/i.test(v.trim()));
}

function resolveMechanismIps(type, value, baseDomain, trace) {
  const domain = value || baseDomain;
  if (type === 'a') {
    trace.push(`  resolving A/AAAA for ${domain}`);
    return [...dnsZone.resolveA(domain), ...dnsZone.resolveAAAA(domain)];
  }
  if (type === 'mx') {
    const mxes = dnsZone.resolveMx(domain);
    trace.push(`  resolving MX for ${domain}: ${mxes.map((m) => m.exchange).join(', ') || '(none)'}`);
    return mxes.flatMap((mx) => [...dnsZone.resolveA(mx.exchange), ...dnsZone.resolveAAAA(mx.exchange)]);
  }
  return [];
}

function evaluate(domain, ip, opts = {}) {
  const trace = opts.trace || [];
  const depth = opts.depth || 0;
  const lookups = opts.lookups || { count: 0 };

  if (depth > 10) return { result: 'permerror', reason: 'too much recursion (include/redirect loop)', trace };

  const records = getSpfRecords(domain);
  trace.push(`SPF lookup for ${domain}: ${records.length ? records.join(' | ') : '(no TXT record found)'}`);

  if (records.length === 0) return { result: 'none', reason: `no SPF record published for ${domain}`, trace };
  if (records.length > 1) return { result: 'permerror', reason: `multiple SPF records published for ${domain}`, trace };

  const terms = records[0].trim().split(/\s+/).slice(1);
  let redirect = null;

  for (const term of terms) {
    if (/^redirect=/i.test(term)) { redirect = term.split('=')[1]; continue; }
    if (/^exp=/i.test(term)) continue; // explanation modifier, not evaluated here
    if (/^v=spf1$/i.test(term)) continue;

    const mech = parseMechanism(term);
    if (!mech) {
      trace.push(`  unknown/unparseable term "${term}" -> permerror`);
      return { result: 'permerror', reason: `unparseable SPF term: ${term}`, trace };
    }

    if (['a', 'mx', 'include', 'exists'].includes(mech.type)) {
      lookups.count += 1;
      if (lookups.count > MAX_LOOKUPS) {
        return { result: 'permerror', reason: 'too many DNS lookups (RFC 7208 limit is 10)', trace };
      }
    }

    if (mech.type === 'all') {
      const result = qualifierResult(mech.qualifier);
      trace.push(`  "all" matched -> ${result}`);
      return { result, reason: `matched "all" mechanism`, mechanism: term, trace };
    }

    if (mech.type === 'ip4' || mech.type === 'ip6') {
      if (matchesIp(ip, mech.value, mech.prefix)) {
        const result = qualifierResult(mech.qualifier);
        trace.push(`  ${term} matched ${ip} -> ${result}`);
        return { result, reason: `sender IP ${ip} matched ${term}`, mechanism: term, trace };
      }
      trace.push(`  ${term} did not match ${ip}`);
      continue;
    }

    if (mech.type === 'a' || mech.type === 'mx') {
      const candidates = resolveMechanismIps(mech.type, mech.value, domain, trace);
      if (candidates.some((c) => matchesIp(ip, c, mech.prefix))) {
        const result = qualifierResult(mech.qualifier);
        trace.push(`  ${term} matched -> ${result}`);
        return { result, reason: `sender IP ${ip} matched ${term}`, mechanism: term, trace };
      }
      trace.push(`  ${term} did not match`);
      continue;
    }

    if (mech.type === 'exists') {
      const d = mech.value || domain;
      const found = dnsZone.resolveA(d).length > 0;
      if (found) {
        const result = qualifierResult(mech.qualifier);
        trace.push(`  exists:${d} resolved -> ${result}`);
        return { result, reason: `exists:${d} resolved`, mechanism: term, trace };
      }
      trace.push(`  exists:${d} did not resolve`);
      continue;
    }

    if (mech.type === 'include') {
      const includeDomain = mech.value;
      trace.push(`  include:${includeDomain} ->`);
      const sub = evaluate(includeDomain, ip, { trace, depth: depth + 1, lookups });
      if (sub.result === 'pass') {
        const result = qualifierResult(mech.qualifier);
        trace.push(`  include:${includeDomain} passed -> ${result}`);
        return { result, reason: `include:${includeDomain} evaluated to pass`, mechanism: term, trace };
      }
      if (sub.result === 'permerror' || sub.result === 'none') {
        return { result: 'permerror', reason: `include:${includeDomain} returned ${sub.result}`, trace };
      }
      if (sub.result === 'temperror') {
        return { result: 'temperror', reason: `include:${includeDomain} returned temperror`, trace };
      }
      trace.push(`  include:${includeDomain} returned ${sub.result}, continuing`);
      continue;
    }

    if (mech.type === 'ptr') {
      trace.push('  "ptr" mechanism is deprecated and not evaluated (always treated as non-match)');
      continue;
    }
  }

  if (redirect) {
    trace.push(`  no mechanism matched; following redirect=${redirect}`);
    const sub = evaluate(redirect, ip, { trace, depth: depth + 1, lookups });
    if (sub.result === 'none') return { result: 'permerror', reason: `redirect target ${redirect} has no SPF record`, trace };
    return sub;
  }

  return { result: 'neutral', reason: 'no mechanism matched and no default "all"', trace };
}

module.exports = { evaluate, getSpfRecords, parseMechanism, matchesIp };
