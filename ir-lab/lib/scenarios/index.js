// Static scenario registry. Scenario content is authored, developer-owned
// content (never player-edited), so it lives here as code rather than in
// data/*.json -- the same category as DLP's lib/compliancePacks.js, just
// one file per scenario since each is far larger than a compliance pack.
const ransomware = require('./ransomware');
const phishingBec = require('./phishingBec');
const dataBreach = require('./dataBreach');
const insiderThreat = require('./insiderThreat');

const SCENARIOS = {
  [ransomware.id]: ransomware,
  [phishingBec.id]: phishingBec,
  [dataBreach.id]: dataBreach,
  [insiderThreat.id]: insiderThreat,
};

function list() {
  return Object.values(SCENARIOS).map((s) => ({
    id: s.id, title: s.title, tagline: s.tagline, domainsInvolved: s.domainsInvolved,
  }));
}

function get(id) {
  return SCENARIOS[id] || null;
}

function briefing(id) {
  const s = get(id);
  if (!s) return null;
  return { id: s.id, title: s.title, tagline: s.tagline, briefing: s.briefing, domainsInvolved: s.domainsInvolved };
}

module.exports = { list, get, briefing };
