// DMARC aggregate (RUA) and forensic (RUF) reports, generated from the
// message-log history the Compose pipeline writes on every send -- the same
// data a real receiver would summarize into the daily XML reports domain
// owners rely on to see who is (and isn't) passing authentication.
const crypto = require('crypto');
const store = require('./store');
const dnsZone = require('./dnsZone');
const dmarc = require('./dmarc');

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function generateAggregateReport(domain) {
  const d = dnsZone.normalize(domain);
  const entries = store.load('message-log').filter((e) => e.headerFromDomain === d);
  const policy = dmarc.getRecord(d);

  const groups = new Map();
  for (const e of entries) {
    const key = `${e.senderIp}|${e.spf}|${e.dkim}|${e.disposition}`;
    if (!groups.has(key)) groups.set(key, { ...e, count: 0 });
    groups.get(key).count += 1;
  }

  const now = Math.floor(Date.now() / 1000);
  const reportId = crypto.randomUUID();
  const records = [...groups.values()].map((g) => `
  <record>
    <row>
      <source_ip>${escapeXml(g.senderIp)}</source_ip>
      <count>${g.count}</count>
      <policy_evaluated>
        <disposition>${escapeXml(g.disposition.split(' ')[0])}</disposition>
        <dkim>${g.dkim.includes('pass') ? 'pass' : 'fail'}</dkim>
        <spf>${g.spf === 'pass' ? 'pass' : 'fail'}</spf>
      </policy_evaluated>
    </row>
    <identifiers>
      <header_from>${escapeXml(g.headerFromDomain)}</header_from>
    </identifiers>
    <auth_results>
      <spf><domain>${escapeXml(g.envelopeFrom.split('@')[1] || '')}</domain><result>${escapeXml(g.spf)}</result></spf>
      <dkim><domain>${escapeXml(g.headerFromDomain)}</domain><result>${g.dkim.includes('pass') ? 'pass' : 'fail'}</result></dkim>
    </auth_results>
  </record>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<feedback>
  <report_metadata>
    <org_name>Email Security Lab (simulated reporter)</org_name>
    <email>dmarc-reports@lab.local</email>
    <report_id>${reportId}</report_id>
    <date_range>
      <begin>${now - 86400}</begin>
      <end>${now}</end>
    </date_range>
  </report_metadata>
  <policy_published>
    <domain>${escapeXml(d)}</domain>
    <p>${policy?.p || 'none'}</p>
    <sp>${policy?.sp || policy?.p || 'none'}</sp>
    <pct>${policy?.pct ?? 100}</pct>
    <adkim>${policy?.adkim || 'r'}</adkim>
    <aspf>${policy?.aspf || 'r'}</aspf>
  </policy_published>${records || '\n  <!-- no messages recorded yet for this domain -->'}
</feedback>`;

  return { xml, recordCount: groups.size, messageCount: entries.length };
}

function generateForensicReport(messageId) {
  const record = store.load('message-log').find((e) => e.id === messageId);
  if (!record) return null;

  return `Feedback-Type: auth-failure
Version: 1
User-Agent: EmailSecurityLab/1.0
Original-Mail-From: ${record.envelopeFrom}
Original-Rcpt-To: ${record.to}
Arrival-Date: ${record.timestamp}
Source-IP: ${record.senderIp}
Authentication-Results: lab.local; spf=${record.spf}; dkim=${record.dkim}; dmarc=${record.dmarc}
Original-Envelope-Id: ${record.id}
Reported-Domain: ${record.headerFromDomain}
Delivery-Result: ${record.disposition}`;
}

function listMessages(domain) {
  const d = dnsZone.normalize(domain);
  return store.load('message-log').filter((e) => e.headerFromDomain === d);
}

module.exports = { generateAggregateReport, generateForensicReport, listMessages };
