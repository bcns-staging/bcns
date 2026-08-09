// Detects cousin/lookalike domains -- attacker-registered domains crafted to
// look like a trusted brand domain at a glance (typosquats, homoglyphs,
// extra/missing hyphens). A real secure email gateway maintains a list of
// "protected" brand domains and flags inbound mail whose sender domain is
// suspiciously close to one of them without being an exact match.
const store = require('../store');
const { levenshtein, normalizeConfusables } = require('./textDistance');

function listProtectedDomains() {
  return store.load('protected-domains');
}

function addProtectedDomain(domain) {
  const d = domain.toLowerCase().trim();
  store.update('protected-domains', (list) => (list.includes(d) ? list : [...list, d]));
  return listProtectedDomains();
}

function removeProtectedDomain(domain) {
  const d = domain.toLowerCase().trim();
  store.update('protected-domains', (list) => list.filter((x) => x !== d));
  return listProtectedDomains();
}

function check(senderDomain, protectedDomains = null) {
  const domain = senderDomain.toLowerCase().trim();
  const list = protectedDomains || listProtectedDomains();
  const findings = [];

  for (const protectedDomain of list) {
    if (domain === protectedDomain) continue; // exact match is not lookalike, it's the real thing

    const rawDistance = levenshtein(domain, protectedDomain);
    const normDomain = normalizeConfusables(domain);
    const normProtected = normalizeConfusables(protectedDomain);
    const normDistance = levenshtein(normDomain, normProtected);

    const isSubdomainTrick = domain.endsWith(`.${protectedDomain}`) === false && domain.includes(protectedDomain) && domain !== protectedDomain;
    const closeEnough = rawDistance <= 2 || normDistance === 0 || (normDistance <= 1 && normDomain !== domain);

    if (closeEnough || isSubdomainTrick) {
      findings.push({
        protectedDomain,
        rawDistance,
        normalizedDistance: normDistance,
        homoglyphTrick: normDomain !== domain && normDistance < rawDistance,
        subdomainTrick: isSubdomainTrick,
      });
    }
  }

  findings.sort((a, b) => a.rawDistance - b.rawDistance);
  return { flagged: findings.length > 0, findings };
}

module.exports = { listProtectedDomains, addProtectedDomain, removeProtectedDomain, check };
