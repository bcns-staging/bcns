// Orchestrates a full simulated "send": builds the message, runs SPF/DKIM
// verification, DMARC alignment, an optional mailing-list/ARC hop, records
// the result to message-log.json (source for DMARC aggregate reports), and
// returns a full step-by-step trace plus the real headers a mail client
// would show under "Show Original".
//
const crypto = require('crypto');
const dnsZone = require('./dnsZone');
const spf = require('./spf');
const dkim = require('./dkim');
const dmarc = require('./dmarc');
const arc = require('./arc');
const dkimKeystore = require('./dkimKeystore');
const headers = require('./headers');
const store = require('./store');
const quarantine = require('./quarantine');
const impersonation = require('./gateway/impersonation');
const lookalike = require('./gateway/lookalike');
const urlDefense = require('./gateway/urlDefense');
const sandbox = require('./gateway/sandbox');
const bec = require('./gateway/bec');
const spamScore = require('./gateway/spamScore');
const dlp = require('./gateway/dlp');
const reputation = require('./gateway/reputation');

const DISPOSITION_RANK = { none: 0, quarantine: 1, reject: 2 };
function worseDisposition(a, b) {
  return (DISPOSITION_RANK[a] ?? 0) >= (DISPOSITION_RANK[b] ?? 0) ? a : b;
}

const LAB_MTA_HOST = 'mx.lab.local';
const AUTH_SERV_ID = 'lab.local';
const FORWARDER_DOMAIN = 'list.forwarder.lab';
const FORWARDER_IP = '198.51.100.77';
const FORWARDER_SELECTOR = 'arc1';
const LIST_FOOTER = '\r\n\r\n-- \r\nSent via Test-Mailing-List@list.forwarder.lab (simulated intermediary)';

function ensureForwarderKey() {
  const existing = dkimKeystore.getKey(FORWARDER_DOMAIN, FORWARDER_SELECTOR);
  if (existing) return existing;
  return dkimKeystore.createKey(FORWARDER_DOMAIN, FORWARDER_SELECTOR);
}

function buildAuthResultsHeader({ spfRes, envelopeFromDomain, dkimResults, dmarcRes, headerFromDomain }) {
  const parts = [AUTH_SERV_ID];
  parts.push(`spf=${spfRes.result} smtp.mailfrom=${envelopeFromDomain}`);
  if (dkimResults.length === 0) {
    parts.push('dkim=none');
  } else {
    for (const d of dkimResults) parts.push(`dkim=${d.valid ? 'pass' : 'fail'} header.d=${d.domain} header.s=${d.selector}`);
  }
  parts.push(`dmarc=${dmarcRes.result} header.from=${headerFromDomain}`);
  return `Authentication-Results: ${parts.join(';\r\n\t')}`;
}

function evaluateHop({ envelopeFromDomain, senderIp, headerFromDomain, dkimSigValue, msgHeaders, body }) {
  const spfRes = spf.evaluate(envelopeFromDomain, senderIp);
  spfRes.domain = envelopeFromDomain;

  let dkimResults = [];
  if (dkimSigValue) {
    const v = dkim.verify({ dkimValue: dkimSigValue, headers: msgHeaders, body });
    dkimResults = [{ domain: v.domain, selector: v.selector, valid: v.valid, reasons: v.reasons }];
  }

  const dmarcRes = dmarc.evaluate({ headerFromDomain, spf: spfRes, dkimResults });
  return { spfRes, dkimResults, dmarcRes };
}

function send(input) {
  const trace = [];
  const log = (msg) => trace.push(msg);

  const envelope = headers.parseAddress(input.envelopeFrom);
  const from = headers.parseAddress(input.headerFrom);
  const to = headers.parseAddress(input.to);
  const senderIp = input.senderIp || '203.0.113.10';

  log(`Composing message: envelope-from=${envelope.email} (IP ${senderIp}), header-From=${input.headerFrom}, To=${to.email}`);

  const messageId = `<${crypto.randomUUID()}@${envelope.domain}>`;
  const dateHeader = headers.formatRfc2822Date();
  let msgHeaders = [
    ['From', input.headerFrom],
    ['To', input.to],
    ['Subject', input.subject || '(no subject)'],
    ['Date', dateHeader],
    ['Message-ID', messageId],
  ];
  if (input.replyTo) msgHeaders.push(['Reply-To', input.replyTo]);
  let body = input.body || '';

  // --- Outbound DLP: your own organization's gateway scanning what YOU are
  // about to send, before it ever leaves the network. ---
  const dlpResult = dlp.scan(`${input.subject || ''}\n${body}`);
  const dlpBlocked = dlpResult.flagged && input.dlp?.enabled !== false;
  if (dlpResult.flagged) {
    log(`[DLP] ${dlpBlocked ? 'BLOCKED' : 'flagged (not blocking)'}: found ${dlpResult.findings.map((f) => f.description).join(', ')}.`);
  }
  if (dlpBlocked) {
    return {
      trace,
      messageId,
      dlp: dlpResult,
      disposition: 'blocked-by-dlp',
      blockedBeforeSend: true,
    };
  }

  // --- DKIM signing (as the originating server would do before sending) ---
  let dkimSigValue = null;
  let dkimHeaderLine = null;
  if (input.dkim?.enabled) {
    const key = dkimKeystore.getKey(input.dkim.domain, input.dkim.selector);
    if (!key) {
      log(`DKIM signing requested with ${input.dkim.selector}._domainkey.${input.dkim.domain}, but no such key exists -- message sent unsigned.`);
    } else {
      const sig = dkim.sign({
        domain: input.dkim.domain,
        selector: input.dkim.selector,
        privateKeyPem: key.privateKeyPem,
        headers: msgHeaders,
        body,
        headerFieldsToSign: ['from', 'to', 'subject', 'date'],
      });
      dkimSigValue = sig.value;
      dkimHeaderLine = sig.header;
      log(`Signed with DKIM d=${input.dkim.domain} s=${input.dkim.selector} (RSA-SHA256, relaxed/relaxed).`);
    }
  } else {
    log('Message sent without a DKIM signature.');
  }

  // --- Hop 1: evaluate as the first receiving server would see it ---
  const hop1 = evaluateHop({
    envelopeFromDomain: envelope.domain,
    senderIp,
    headerFromDomain: from.domain,
    dkimSigValue,
    msgHeaders,
    body,
  });
  log(...hop1.spfRes.trace.map((l) => `[SPF] ${l}`));
  if (dkimSigValue) log(`[DKIM] verification: ${hop1.dkimResults[0].valid ? 'PASS' : `FAIL (${hop1.dkimResults[0].reasons.join('; ')})`}`);
  log(...hop1.dmarcRes.trace.map((l) => `[DMARC] ${l}`));

  let finalHop = hop1;
  let arcHeaders = null;
  let arcVerification = null;
  let receivedHops = [
    { fromHost: envelope.domain, fromIp: senderIp, byHost: LAB_MTA_HOST, forAddress: to.email, date: new Date() },
  ];
  let arcOverrideApplied = false;
  let effectiveSenderIp = senderIp;
  let effectiveEnvelopeDomain = envelope.domain;

  if (input.simulateForward) {
    log('--- Simulated mailing-list / forwarder hop ---');
    const forwarderKey = ensureForwarderKey();

    // The forwarder does what real mailing lists do: appends a footer to the
    // body (breaking the original DKIM signature) and re-sends from its own
    // envelope/IP. Its ARC-Message-Signature covers this *outgoing* body,
    // since that's the actual content the next hop will receive -- while its
    // ARC-Authentication-Results attests to the *original* (pre-footer)
    // authentication results captured at the moment of ingestion.
    const newBody = body + LIST_FOOTER;
    const newEnvelopeDomain = FORWARDER_DOMAIN;

    const sealed = arc.seal({
      authServId: AUTH_SERV_ID,
      spf: hop1.spfRes,
      dkimRes: hop1.dkimResults[0] || null,
      dmarcRes: hop1.dmarcRes,
      headerFromDomain: from.domain,
      domain: FORWARDER_DOMAIN,
      selector: FORWARDER_SELECTOR,
      privateKeyPem: forwarderKey.privateKeyPem,
      headers: msgHeaders,
      body: newBody,
    });
    arcHeaders = sealed.headers;
    log(`Forwarder ${FORWARDER_DOMAIN} recorded original results into an ARC set (i=1, cv=none) before modifying the message.`);
    receivedHops.push({ fromHost: FORWARDER_DOMAIN, fromIp: FORWARDER_IP, byHost: LAB_MTA_HOST, forAddress: to.email, date: new Date() });

    const hop2 = evaluateHop({
      envelopeFromDomain: newEnvelopeDomain,
      senderIp: FORWARDER_IP,
      headerFromDomain: from.domain,
      dkimSigValue,
      msgHeaders,
      body: newBody,
    });
    log(...hop2.spfRes.trace.map((l) => `[SPF @ final hop] ${l}`));
    log(`[DKIM @ final hop] original signature now verifies as: ${hop2.dkimResults[0] ? (hop2.dkimResults[0].valid ? 'PASS' : `FAIL (${hop2.dkimResults[0].reasons.join('; ')})`) : 'none'} (body was modified by the forwarder, so the body hash no longer matches).`);
    log(...hop2.dmarcRes.trace.map((l) => `[DMARC @ final hop] ${l}`));

    arcVerification = arc.verify({ arcHeaders, headers: msgHeaders, body: newBody });
    log(`[ARC] chain verification: cv=${arcVerification.cv}${arcVerification.reasons.length ? ` (${arcVerification.reasons.join('; ')})` : ''}.`);

    body = newBody;
    finalHop = hop2;
    effectiveSenderIp = FORWARDER_IP;
    effectiveEnvelopeDomain = newEnvelopeDomain;

    if (hop2.dmarcRes.result !== 'pass' && arcVerification.valid && hop1.dmarcRes.result === 'pass') {
      arcOverrideApplied = true;
      log('[ARC] Native DMARC failed at the final hop, but the ARC chain is intact and attests the message passed DMARC at the trusted intermediary -- an ARC-aware receiver overrides the disposition to deliver it.');
    }
  }

  // --- Secure email gateway checks (receiving side) ---
  log('--- Secure email gateway checks ---');
  const { rewritten: bodyWithLinksRewritten, originalUrls } = urlDefense.rewriteLinksInBody(body);
  const urlScans = originalUrls.map((u) => ({ url: u, ...urlDefense.scanUrl(u) }));
  for (const s of urlScans) log(`[URL Defense] ${s.url} -> ${s.verdict} (${s.reason})`);

  const attachmentResult = input.attachment?.filename
    ? sandbox.analyze({ filename: input.attachment.filename, contentBuffer: null })
    : null;
  if (attachmentResult) log(`[Attachment Sandbox] ${input.attachment.filename} -> ${attachmentResult.verdict}${attachmentResult.reasons.length ? `: ${attachmentResult.reasons.join('; ')}` : ''}`);

  const impersonationResult = impersonation.check(from.displayName, from.email);
  if (impersonationResult.flagged) log(`[Impersonation] ${impersonationResult.findings[0].reason}`);

  const lookalikeResult = from.domain ? lookalike.check(from.domain) : { flagged: false, findings: [] };
  if (lookalikeResult.flagged) log(`[Lookalike Domain] "${from.domain}" resembles protected domain "${lookalikeResult.findings[0].protectedDomain}" (edit distance ${lookalikeResult.findings[0].rawDistance}).`);

  const becResult = bec.score({ displayName: from.displayName, fromEmail: from.email, replyTo: input.replyTo, subject: input.subject, body });
  log(`[BEC] risk score ${becResult.points} -> ${becResult.verdict}${becResult.signals.length ? ` (${becResult.signals.map((s) => s.signal).join(', ')})` : ''}`);

  const spamResult = spamScore.score({ subject: input.subject, body });
  log(`[Spam Filter] score ${spamResult.points} -> ${spamResult.verdict}`);

  const ipRep = reputation.checkIp(effectiveSenderIp);
  const domainRep = reputation.checkDomain(effectiveEnvelopeDomain);
  if (ipRep.listed) log(`[Reputation] sending IP ${effectiveSenderIp} is on the local blocklist.`);
  if (domainRep.listed) log(`[Reputation] envelope domain ${effectiveEnvelopeDomain} is on the local blocklist.`);

  let gatewayDisposition = 'none';
  const gatewayReasons = [];
  if (attachmentResult?.verdict === 'malicious') { gatewayDisposition = worseDisposition(gatewayDisposition, 'reject'); gatewayReasons.push('malicious attachment'); }
  if (ipRep.listed || domainRep.listed) { gatewayDisposition = worseDisposition(gatewayDisposition, 'reject'); gatewayReasons.push('sender on reputation blocklist'); }
  if (urlScans.some((s) => s.verdict === 'malicious')) { gatewayDisposition = worseDisposition(gatewayDisposition, 'quarantine'); gatewayReasons.push('malicious link'); }
  if (attachmentResult?.verdict === 'suspicious') { gatewayDisposition = worseDisposition(gatewayDisposition, 'quarantine'); gatewayReasons.push('suspicious attachment'); }
  if (becResult.verdict === 'high-risk') { gatewayDisposition = worseDisposition(gatewayDisposition, 'quarantine'); gatewayReasons.push('high BEC risk score'); }
  if (spamResult.verdict === 'spam') { gatewayDisposition = worseDisposition(gatewayDisposition, 'quarantine'); gatewayReasons.push('spam score threshold exceeded'); }
  if (gatewayDisposition !== 'none') log(`[Gateway] combined verdict: ${gatewayDisposition} (${gatewayReasons.join(', ')})`);

  const dmarcDisposition = arcOverrideApplied ? 'none' : finalHop.dmarcRes.disposition;
  const disposition = worseDisposition(dmarcDisposition, gatewayDisposition);
  const dispositionLabel = arcOverrideApplied && disposition === 'none' ? 'none (delivered via ARC override)' : disposition;

  const authResultsHeader = buildAuthResultsHeader({
    spfRes: finalHop.spfRes,
    envelopeFromDomain: finalHop.spfRes.domain,
    dkimResults: finalHop.dkimResults,
    dmarcRes: finalHop.dmarcRes,
    headerFromDomain: from.domain,
  });

  const receivedChain = headers.buildReceivedChain(receivedHops);

  const fullHeaderBlock = [
    ...receivedChain.map((r) => `Received: ${r}`),
    ...(arcHeaders ? arcHeaders.map(([n, v]) => `${n}: ${v}`) : []),
    authResultsHeader,
    ...(dkimHeaderLine ? [dkimHeaderLine] : []),
    ...msgHeaders.map(([n, v]) => `${n}: ${v}`),
  ].join('\r\n');

  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    envelopeFrom: envelope.email,
    headerFrom: from.email,
    headerFromDomain: from.domain,
    to: to.email,
    senderIp,
    spf: finalHop.spfRes.result,
    dkim: finalHop.dkimResults.map((d) => (d.valid ? 'pass' : 'fail')).join(',') || 'none',
    dmarc: finalHop.dmarcRes.result,
    disposition,
    simulateForward: !!input.simulateForward,
    arcOverrideApplied,
  };
  store.update('message-log', (list) => {
    list.push(entry);
    return list;
  });

  let quarantineEntry = null;
  if (disposition !== 'none') {
    quarantineEntry = quarantine.add({
      messageId,
      from: `${from.displayName ? `${from.displayName} ` : ''}<${from.email}>`,
      to: to.email,
      subject: input.subject || '(no subject)',
      disposition,
      reasons: [
        ...(finalHop.dmarcRes.result !== 'pass' ? [`DMARC ${finalHop.dmarcRes.result}`] : []),
        ...gatewayReasons,
      ],
      fullHeaderBlock,
      body,
    });
    log(`[Quarantine] message held for review (id ${quarantineEntry.id}).`);
  }

  return {
    trace,
    messageId,
    authResultsHeader,
    receivedChain,
    arcHeaders,
    arcVerification,
    dkimHeaderLine,
    fullHeaderBlock,
    body,
    bodyWithLinksRewritten,
    spf: finalHop.spfRes,
    dkim: finalHop.dkimResults,
    dmarc: finalHop.dmarcRes,
    gateway: {
      urlScans,
      attachment: attachmentResult,
      impersonation: impersonationResult,
      lookalike: lookalikeResult,
      bec: becResult,
      spam: spamResult,
      reputation: { ip: ipRep, domain: domainRep },
      disposition: gatewayDisposition,
      reasons: gatewayReasons,
    },
    dlp: dlpResult,
    disposition: dispositionLabel,
    arcOverrideApplied,
    quarantineEntry,
    logEntry: entry,
  };
}

module.exports = { send, FORWARDER_DOMAIN, FORWARDER_IP, FORWARDER_SELECTOR };
