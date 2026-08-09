// BIMI (Brand Indicators for Message Identification): a domain publishes a
// logo, but mailbox providers only show it if the domain has *already*
// earned trust via a strongly-enforced DMARC policy -- BIMI is a reward for
// good DMARC hygiene, not a standalone authentication mechanism.
const dnsZone = require('./dnsZone');
const dmarc = require('./dmarc');

function setRecord(domain, selector, { logoUrl, vmcUrl }) {
  const tags = [`v=BIMI1`, `l=${logoUrl || ''}`];
  if (vmcUrl) tags.push(`a=${vmcUrl}`);
  const value = tags.join('; ');
  dnsZone.setBimiRecord(domain, selector, value);
  return value;
}

function getRecord(domain, selector = 'default') {
  const name = `${selector}._bimi.${dnsZone.normalize(domain)}`;
  const txt = dnsZone.resolveTxt(name)[0];
  if (!txt) return null;
  const tags = Object.fromEntries(
    txt.split(';').map((s) => s.trim()).filter(Boolean).map((p) => {
      const idx = p.indexOf('=');
      return [p.slice(0, idx).trim(), p.slice(idx + 1).trim()];
    }),
  );
  return { raw: txt, logoUrl: tags.l, vmcUrl: tags.a };
}

// A receiver only displays the logo if DMARC is enforced (p=quarantine or
// p=reject) at pct=100 -- otherwise a domain could get brand recognition
// without actually blocking spoofed mail.
function evaluateDisplay(domain, selector = 'default') {
  const trace = [];
  const bimiRecord = getRecord(domain, selector);
  if (!bimiRecord) {
    trace.push(`No BIMI record found at ${selector}._bimi.${domain}.`);
    return { display: false, trace };
  }
  trace.push(`BIMI record found: ${bimiRecord.raw}`);

  const dmarcRecord = dmarc.getRecord(domain);
  if (!dmarcRecord) {
    trace.push('No DMARC record for this domain -- BIMI requires DMARC enforcement, so the logo will NOT display.');
    return { display: false, trace, bimiRecord };
  }
  trace.push(`DMARC record: ${dmarcRecord.raw}`);

  const enforced = dmarcRecord.p === 'quarantine' || dmarcRecord.p === 'reject';
  const fullyEnforced = enforced && dmarcRecord.pct === 100;
  trace.push(`DMARC policy p=${dmarcRecord.p}, pct=${dmarcRecord.pct} -> ${fullyEnforced ? 'fully enforced' : 'not fully enforced'}.`);

  if (!fullyEnforced) {
    trace.push('BIMI requires p=quarantine or p=reject at pct=100. Logo will NOT display.');
    return { display: false, trace, bimiRecord, dmarcRecord };
  }

  trace.push('DMARC is fully enforced -- the logo WILL display in a BIMI-supporting inbox.');
  return { display: true, trace, bimiRecord, dmarcRecord, logoUrl: bimiRecord.logoUrl };
}

module.exports = { setRecord, getRecord, evaluateDisplay };
