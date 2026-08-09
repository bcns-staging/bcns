// DMARC evaluation per RFC 7489: policy parsing, SPF/DKIM identifier
// alignment (strict vs relaxed), and disposition (including the pct= rollout
// percentage, which is genuinely probabilistic in real DMARC).
const dnsZone = require('./dnsZone');

function getOrganizationalDomain(domain) {
  // Simplification: real implementations consult the Public Suffix List to
  // find the registrable domain. We approximate with "last two labels",
  // which is correct for ordinary domains (e.g. mail.example.com ->
  // example.com) but not for multi-part public suffixes like example.co.uk.
  const parts = domain.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  return parts.slice(-2).join('.');
}

function isSubdomain(child, parent) {
  const c = child.toLowerCase();
  const p = parent.toLowerCase();
  return c === p || c.endsWith(`.${p}`);
}

function parseRecord(txt) {
  const tags = Object.fromEntries(
    txt
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((pair) => {
        const idx = pair.indexOf('=');
        return [pair.slice(0, idx).trim().toLowerCase(), pair.slice(idx + 1).trim()];
      }),
  );
  return {
    v: tags.v,
    p: tags.p,
    sp: tags.sp || tags.p,
    adkim: tags.adkim === 's' ? 's' : 'r',
    aspf: tags.aspf === 's' ? 's' : 'r',
    pct: tags.pct !== undefined ? Number(tags.pct) : 100,
    rua: tags.rua,
    ruf: tags.ruf,
    fo: tags.fo || '0',
    raw: txt,
  };
}

function getRecord(domain) {
  const name = `_dmarc.${dnsZone.normalize(domain)}`;
  const txts = dnsZone.resolveTxt(name).filter((v) => /^v=DMARC1/i.test(v.trim()));
  if (txts.length === 0) return null;
  return parseRecord(txts[0]);
}

// Looks up the DMARC record for the domain, walking up to the organizational
// domain if the exact domain has none (per RFC 7489 6.6.3 "Policy Discovery").
function discoverRecord(headerFromDomain) {
  const exact = getRecord(headerFromDomain);
  if (exact) return { record: exact, policyDomain: dnsZone.normalize(headerFromDomain) };
  const org = getOrganizationalDomain(headerFromDomain);
  if (org !== dnsZone.normalize(headerFromDomain)) {
    const orgRecord = getRecord(org);
    if (orgRecord) return { record: orgRecord, policyDomain: org };
  }
  return { record: null, policyDomain: null };
}

function aligned(mode, authDomain, headerFromDomain) {
  if (!authDomain) return false;
  if (mode === 's') return authDomain.toLowerCase() === headerFromDomain.toLowerCase();
  return getOrganizationalDomain(authDomain) === getOrganizationalDomain(headerFromDomain);
}

/**
 * spf: { result: 'pass'|..., domain: envelopeFromDomain }
 * dkimResults: [{ domain, selector, valid }]
 */
function evaluate({ headerFromDomain, spf, dkimResults = [] }) {
  const trace = [];
  const { record, policyDomain } = discoverRecord(headerFromDomain);

  if (!record) {
    trace.push(`No DMARC record found for ${headerFromDomain} or its organizational domain.`);
    return { result: 'none', disposition: 'none', record: null, trace };
  }
  trace.push(`Found DMARC record at ${policyDomain === headerFromDomain ? `_dmarc.${headerFromDomain}` : `_dmarc.${policyDomain} (organizational)`}: ${record.raw}`);

  const spfAligned = spf?.result === 'pass' && aligned(record.aspf, spf.domain, headerFromDomain);
  trace.push(
    `SPF: ${spf?.result ?? 'not evaluated'}${spf?.domain ? ` (domain ${spf.domain})` : ''} -> alignment (${record.aspf === 's' ? 'strict' : 'relaxed'}) with header-From ${headerFromDomain}: ${spfAligned ? 'aligned' : 'not aligned'}`,
  );

  const validDkim = dkimResults.filter((d) => d.valid);
  const dkimAligned = validDkim.some((d) => aligned(record.adkim, d.domain, headerFromDomain));
  const dkimAlignedSignature = validDkim.find((d) => aligned(record.adkim, d.domain, headerFromDomain));
  trace.push(
    `DKIM: ${dkimResults.length ? dkimResults.map((d) => `d=${d.domain} ${d.valid ? 'valid' : 'invalid'}`).join(', ') : 'no signatures'} -> alignment (${record.adkim === 's' ? 'strict' : 'relaxed'}) with header-From ${headerFromDomain}: ${dkimAligned ? 'aligned' : 'not aligned'}`,
  );

  const passes = spfAligned || dkimAligned;
  const result = passes ? 'pass' : 'fail';
  trace.push(`DMARC result: ${result} (passes if SPF-aligned OR DKIM-aligned)`);

  let disposition = 'none';
  if (!passes) {
    const isSub = isSubdomain(headerFromDomain, policyDomain) && headerFromDomain.toLowerCase() !== policyDomain.toLowerCase();
    const policy = isSub ? record.sp : record.p;
    const roll = Math.random() * 100;
    const applies = roll < record.pct;
    trace.push(
      `Policy in effect: p=${record.p}${isSub ? `, sp=${record.sp} (subdomain policy applies)` : ''}, pct=${record.pct}. Random rollout roll=${roll.toFixed(1)} < pct=${record.pct}? ${applies ? 'yes, policy applies' : 'no, treated as if p=none this time'}`,
    );
    disposition = applies ? policy : 'none';
  } else {
    trace.push('Message aligned -- delivered per policy "none" disposition (no action needed).');
  }

  return {
    result,
    disposition,
    record,
    policyDomain,
    spfAligned,
    dkimAligned,
    dkimAlignedSignature,
    trace,
  };
}

module.exports = { parseRecord, getRecord, discoverRecord, getOrganizationalDomain, aligned, evaluate };
