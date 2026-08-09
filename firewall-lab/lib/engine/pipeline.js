// Orchestrates a full simulated connection through the firewall: zone
// lookup, anti-spoofing, session/state tracking, NAT, security-rule
// matching, and -- for the NGFW ruleset only -- App-ID/User-ID/SSL-decrypt/
// Content-ID, then a policy re-match now that those signals are known.
// Returns a full named-stage trace, the same idea as MAIL/lib/pipeline.js's
// trace log, upgraded to structured {id,name,status,detail} entries so two
// runs (traditional vs ngfw) can be diffed stage-by-stage.
const zones = require('./zones');
const antiSpoofing = require('./antiSpoofing');
const sessionTable = require('./sessionTable');
const rules = require('./rules');
const nat = require('./nat');
const vpn = require('./vpn');
const appId = require('../intel/appId');
const userId = require('../intel/userId');
const urlCategory = require('../intel/urlCategory');
const threatIntel = require('../intel/threatIntel');
const ips = require('../intel/ips');
const antiMalware = require('../intel/antiMalware');
const dnsSecurity = require('../intel/dnsSecurity');
const trafficLog = require('../trafficLog');

const STAGE_DEFS = [
  ['zone-lookup', 'Zone Lookup'],
  ['anti-spoofing', 'Anti-Spoofing'],
  ['session-lookup', 'Session Lookup'],
  ['dnat-lookup', 'Destination NAT Lookup'],
  ['rule-match', 'Security Rule Match'],
  ['app-id', 'App-ID'],
  ['user-id', 'User-ID'],
  ['ssl-decrypt', 'SSL Decryption'],
  ['url-filtering', 'URL Filtering'],
  ['threat-intel', 'Threat Intelligence'],
  ['ips', 'Intrusion Prevention (IPS)'],
  ['anti-malware', 'Anti-Malware'],
  ['dns-security', 'DNS Security'],
  ['ngfw-rule-rematch', 'NGFW Policy Re-Match'],
  ['vpn-routing', 'VPN Routing'],
  ['session-write', 'Session Table Update'],
  ['verdict-log', 'Verdict & Logging'],
];

function initStages() {
  return STAGE_DEFS.map(([id, name]) => ({ id, name, status: 'skip', detail: null }));
}
function setStage(stages, id, status, detail) {
  const s = stages.find((x) => x.id === id);
  if (s) { s.status = status; s.detail = detail; }
}

function finalize({ connection, ruleset, stages, srcZone, dstZone, verdict, matchedRule, spoofed, sessionState, natResult, resolvedApp, resolvedUser, decrypted, urlCat, ti, ipsResult, malwareResult, dnsResult, contentOverride, vpnResult, fastPath, sessionId }) {
  if (matchedRule) rules.incrementHit(ruleset, matchedRule.id);

  if (!spoofed) {
    if (fastPath) {
      setStage(stages, 'session-write', 'pass', "Existing session's last-seen timestamp updated.");
    } else if (verdict === 'allow') {
      const sess = sessionTable.create(connection, ruleset, { state: sessionState || 'new', matchedRuleId: matchedRule.id, matchedRuleName: matchedRule.name });
      sessionId = sess.id;
      setStage(stages, 'session-write', 'pass', "New session created; matched rule's hit counter incremented.");
    } else {
      setStage(stages, 'session-write', 'skip', 'No session created -- connection was denied.');
    }
  }

  const logEntry = trafficLog.add({
    ruleset,
    srcIp: connection.srcIp, srcPort: connection.srcPort, dstIp: connection.dstIp, dstPort: connection.dstPort, protocol: connection.protocol,
    srcZone: zones.zoneName(srcZone), dstZone: zones.zoneName(dstZone),
    app: resolvedApp?.app || null, user: resolvedUser?.user || null,
    matchedRuleId: matchedRule?.id || null, matchedRuleName: matchedRule?.name || null,
    verdict, reason: contentOverride ? `Content-ID override: ${contentOverride}` : `Matched rule "${matchedRule?.name}"`,
  });
  setStage(stages, 'verdict-log', 'pass', `${verdict.toUpperCase()} -- logged as entry ${logEntry.id.slice(0, 8)}.`);

  return {
    input: connection, ruleset, srcZone, dstZone, spoofed: !!spoofed, sessionState: sessionState || 'new',
    nat: natResult || null, resolvedApp: resolvedApp || null, resolvedUser: resolvedUser || null, decrypted: !!decrypted,
    urlCategory: urlCat || null, threatIntel: ti || null, ipsMatch: ipsResult || null, malwareVerdict: malwareResult || null,
    dnsResult: dnsResult || null, matchedRule, contentOverride: contentOverride || null, vpn: vpnResult || null,
    verdict, stages, logEntryId: logEntry.id, sessionId: sessionId || null,
  };
}

function evaluateConnection(connection, { ruleset = 'traditional' } = {}) {
  const isNgfw = ruleset === 'ngfw';
  const stages = initStages();

  const srcZone = zones.ingressZone(connection.ingressInterfaceId);
  const dstZone = zones.destinationZone(connection.dstIp);
  setStage(stages, 'zone-lookup', 'pass', `Ingress into ${zones.zoneName(srcZone)}; destination resolves to ${zones.zoneName(dstZone)}.`);

  const spoof = antiSpoofing.check({ srcIp: connection.srcIp, ingressInterfaceId: connection.ingressInterfaceId });
  if (spoof.spoofed) {
    setStage(stages, 'anti-spoofing', 'block', spoof.reason);
    return finalize({ connection, ruleset, stages, srcZone, dstZone, spoofed: true, verdict: 'deny', matchedRule: { id: 'anti-spoof-drop', name: 'Anti-Spoofing Drop', action: 'deny' } });
  }
  setStage(stages, 'anti-spoofing', 'pass', 'Source address is plausible for this interface.');

  let session = sessionTable.lookup(connection, ruleset);
  let isRelated = false;
  if (!session && connection.ftpRelatedTo) {
    session = sessionTable.relatedSession(connection.ftpRelatedTo, ruleset);
    isRelated = !!session;
  }
  if (session) {
    sessionTable.touch(session.id);
    setStage(stages, 'session-lookup', 'pass', isRelated
      ? `RELATED to control session ${session.id.slice(0, 8)} -- allowed without a fresh rule lookup (e.g. the FTP data channel a control session opens).`
      : 'Matches an existing session -- this is return/continuation traffic, auto-permitted without walking the rulebase again.');
    return finalize({
      connection, ruleset, stages, srcZone, dstZone, fastPath: true, sessionId: session.id,
      verdict: 'allow', sessionState: isRelated ? 'related' : 'established',
      matchedRule: { id: session.matchedRuleId || 'session-match', name: session.matchedRuleName || 'Existing Session', action: 'allow' },
    });
  }
  setStage(stages, 'session-lookup', 'info', 'No existing session found -- this is a NEW connection; falling through to policy evaluation.');

  const natResult = nat.translate({ ...connection, srcZone });
  if (natResult.destinationNat) {
    setStage(stages, 'dnat-lookup', 'pass', `${connection.dstIp}:${connection.dstPort} -> ${natResult.destinationNat.translatedIp}:${natResult.destinationNat.translatedPort} (security policy matches on ${natResult.securityMatchAddress === 'pre-nat' ? 'the original public address' : 'the translated internal address'}).`);
  } else {
    setStage(stages, 'dnat-lookup', 'info', 'No destination NAT rule applies.');
  }
  const matchDstIp = natResult.matchedDstIp;
  const matchDstPort = natResult.matchedDstPort;
  const matchDstZone = natResult.destinationNat && natResult.securityMatchAddress === 'post-nat' ? zones.destinationZone(matchDstIp) : dstZone;
  const baseConn = { ...connection, dstIp: matchDstIp, dstPort: matchDstPort };

  const prelim = rules.match(ruleset, baseConn, { srcZone, dstZone: matchDstZone, matchContentFields: false });
  setStage(stages, 'rule-match', prelim.implicitDeny ? 'fail' : 'pass',
    prelim.implicitDeny
      ? 'No rule matched on zones/IP/service -- falling through to the implicit deny at the bottom of the rulebase.'
      : `Matched rule "${prelim.rule.name}" (action: ${prelim.rule.action})${isNgfw ? ' -- preliminary match on zones/IP/service only; app/user/URL-category are checked in the re-match stage below.' : '.'}`);

  let finalRule = prelim.rule;
  let resolvedApp = null; let resolvedUser = null; let decrypted = false;
  let urlCat = null; let ti = null; let ipsResult = null; let malwareResult = null; let dnsResult = null;
  let contentOverride = null;

  if (isNgfw) {
    resolvedApp = appId.identify({ dstPort: matchDstPort, declaredApp: connection.declaredApp });
    setStage(stages, 'app-id', 'pass', `Identified as "${resolvedApp.app}" (${resolvedApp.method === 'signature' ? 'matched by signature/behavior' : resolvedApp.method === 'port-default' ? 'guessed from port only, no payload signal' : 'no signature matched'}, confidence ${Math.round(resolvedApp.confidence * 100)}%).`);

    resolvedUser = userId.resolve(connection.srcIp);
    setStage(stages, 'user-id', resolvedUser ? 'pass' : 'info', resolvedUser ? `${connection.srcIp} -> ${resolvedUser.user} (${resolvedUser.groups.join(', ')}).` : `No User-ID mapping for ${connection.srcIp} -- treated as an unknown user.`);

    const profile = finalRule.profile || {};
    if (connection.encrypted) {
      decrypted = !!profile.decrypt;
      setStage(stages, 'ssl-decrypt', decrypted ? 'pass' : 'skip', decrypted
        ? 'The preliminarily-matched rule has a decrypt profile enabled -- traffic is decrypted for inspection, then re-encrypted on the way out.'
        : 'Traffic is encrypted and the preliminarily-matched rule has no decrypt profile -- every Content-ID stage below is blind to it.');
    } else {
      decrypted = true;
      setStage(stages, 'ssl-decrypt', 'info', 'Traffic is not encrypted -- nothing to decrypt.');
    }
    const canInspect = !connection.encrypted || decrypted;

    if (profile.urlFiltering && canInspect && (connection.url || connection.domain)) {
      urlCat = urlCategory.categorize(connection.url || connection.domain);
      setStage(stages, 'url-filtering', 'pass', `${urlCat.domain} categorized as "${urlCat.category}".`);
    } else {
      setStage(stages, 'url-filtering', 'skip', !canInspect ? 'Skipped -- content is still encrypted.' : (profile.urlFiltering ? 'No URL in this connection to categorize.' : 'No URL-filtering profile on the matched rule.'));
    }

    if (profile.threatIntel && canInspect) {
      ti = threatIntel.lookup(connection.domain || connection.dstIp);
      setStage(stages, 'threat-intel', ti.listed ? 'block' : 'pass', ti.listed ? `${connection.domain || connection.dstIp} is listed as ${ti.verdict} (source: ${ti.source}).` : 'No match on the threat-intelligence feed.');
    } else {
      setStage(stages, 'threat-intel', 'skip', !canInspect ? 'Skipped -- content is still encrypted.' : 'No threat-intel profile on the matched rule.');
    }

    if (profile.ips && canInspect) {
      ipsResult = ips.match(connection.payloadSignature);
      setStage(stages, 'ips', ipsResult.matched ? 'block' : 'pass', ipsResult.matched ? `Matched signature "${ipsResult.signature.name}" (${ipsResult.signature.cveId}, severity ${ipsResult.signature.severity}) -- action: ${ipsResult.signature.action}.` : 'No known exploit signature matched the payload.');
    } else {
      setStage(stages, 'ips', 'skip', !canInspect ? 'Skipped -- content is still encrypted.' : 'No IPS profile on the matched rule.');
    }

    if (profile.antiMalware && canInspect && (connection.fileName || connection.fileHash)) {
      malwareResult = antiMalware.verdict({ fileName: connection.fileName, fileHash: connection.fileHash });
      setStage(stages, 'anti-malware', malwareResult.verdict === 'malicious' ? 'block' : malwareResult.verdict === 'suspicious' ? 'fail' : 'pass', `${connection.fileName || connection.fileHash}: ${malwareResult.verdict} (${malwareResult.reason})`);
    } else {
      setStage(stages, 'anti-malware', 'skip', !canInspect ? 'Skipped -- content is still encrypted.' : (profile.antiMalware ? 'No file in this connection to inspect.' : 'No anti-malware profile on the matched rule.'));
    }

    if (connection.domain) {
      dnsResult = dnsSecurity.resolve(connection.domain);
      setStage(stages, 'dns-security', dnsResult.sinkholed ? 'block' : 'pass', dnsResult.sinkholed ? `${connection.domain} is on the DNS blocklist (${dnsResult.category}) -- resolved to sinkhole ${dnsResult.ip} instead.` : `${connection.domain} resolved normally to ${dnsResult.ip}.`);
    } else {
      setStage(stages, 'dns-security', 'skip', 'No domain to resolve for this connection.');
    }

    const full = rules.match(ruleset, baseConn, { srcZone, dstZone: matchDstZone, matchContentFields: true, resolvedApp: resolvedApp.app, resolvedUser, resolvedUrlCategory: urlCat?.category });
    finalRule = full.rule;
    setStage(stages, 'ngfw-rule-rematch', full.implicitDeny ? 'fail' : 'pass', full.implicitDeny
      ? 'No rule matches once app/user/URL-category are known -- implicit deny.'
      : `Final match: "${full.rule.name}" (action: ${full.rule.action}).`);

    const contentReasons = [];
    if (ti?.listed) contentReasons.push(`threat-intel listed the destination as ${ti.verdict}`);
    if (ipsResult?.matched) contentReasons.push(`IPS matched ${ipsResult.signature.cveId} (${ipsResult.signature.name})`);
    if (malwareResult?.verdict === 'malicious') contentReasons.push(`anti-malware verdict was malicious (${malwareResult.reason})`);
    if (dnsResult?.sinkholed) contentReasons.push('DNS resolution was sinkholed');
    if (urlCat && ['malware', 'gambling'].includes(urlCat.category)) contentReasons.push(`URL category "${urlCat.category}" is treated as always-block`);
    if (contentReasons.length && finalRule.action === 'allow') contentOverride = contentReasons.join('; ');
  }

  const verdict = isNgfw ? (contentOverride ? 'deny' : finalRule.action) : finalRule.action;

  const vpnResult = vpn.route({ ...connection, dstIp: matchDstIp });
  setStage(stages, 'vpn-routing', vpnResult.routed ? 'pass' : 'info', vpnResult.routed
    ? `${matchDstIp} falls within tunnel "${vpnResult.tunnel.name}"'s remote domain (${vpnResult.tunnel.remoteDomain}) -- routed through IPSec (${vpnResult.tunnel.ipsec.encryption}).`
    : 'No VPN tunnel covers this destination -- routed via the default path.');

  return finalize({
    connection, ruleset, stages, srcZone, dstZone: matchDstZone, verdict, matchedRule: finalRule,
    natResult, resolvedApp, resolvedUser, decrypted, urlCat, ti, ipsResult, malwareResult, dnsResult, contentOverride, vpnResult,
  });
}

function evaluateBoth(connection) {
  const traditional = evaluateConnection(connection, { ruleset: 'traditional' });
  const ngfw = evaluateConnection(connection, { ruleset: 'ngfw' });

  let divergence;
  if (traditional.verdict !== ngfw.verdict) {
    const firstDivergentStage = traditional.stages.find((s, i) => s.status !== ngfw.stages[i].status);
    divergence = {
      differs: true,
      traditionalVerdict: traditional.verdict,
      ngfwVerdict: ngfw.verdict,
      stageId: firstDivergentStage?.id || 'rule-match',
      summary: buildDivergenceSummary(traditional, ngfw),
    };
  } else {
    divergence = { differs: false };
  }
  return { traditional, ngfw, divergence };
}

function buildDivergenceSummary(traditional, ngfw) {
  const tRule = traditional.matchedRule?.name || 'no rule';
  const nRule = ngfw.matchedRule?.name || 'no rule';
  if (ngfw.contentOverride) {
    return `Traditional ${traditional.verdict.toUpperCase()} (matched "${tRule}", zones/IP/port only) -- NGFW's rule "${nRule}" would also allow on those same fields, but content inspection overrode it: ${ngfw.contentOverride}.`;
  }
  return `Traditional ${traditional.verdict.toUpperCase()} (matched "${tRule}", zones/IP/port only) -- NGFW ${ngfw.verdict.toUpperCase()} (matched "${nRule}"${ngfw.resolvedApp ? `; App-ID identified "${ngfw.resolvedApp.app}"` : ''}${ngfw.resolvedUser ? `; User-ID resolved "${ngfw.resolvedUser.user}"` : ''}).`;
}

module.exports = { evaluateConnection, evaluateBoth, STAGE_DEFS };
