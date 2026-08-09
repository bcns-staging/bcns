// Compliance rule packs: real organizations rarely build DLP policies from
// scratch per-regulation -- vendors ship starter templates for common
// frameworks that a compliance team tunes from there. Each pack here
// creates a real keyword list plus a real policy referencing it, so
// "activating" a pack produces the same artifacts you'd get building one
// by hand on the Policy Builder page.
const crypto = require('crypto');
const keywordListsStore = require('./store');
const policy = require('./policy');

const PACKS = [
  {
    id: 'gdpr',
    name: 'GDPR',
    description: 'EU personal data protection -- flags identity documents and explicit data-subject-rights language.',
    keywords: ['national id number', 'passport number', 'biometric data', 'right to erasure', 'data subject access request', 'personal data breach'],
    detectors: [{ type: 'pattern', weight: 0.6 }, { type: 'keyword', weight: 0.8 }],
    threshold: 0.35,
    action: 'quarantine',
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    description: 'US healthcare privacy -- flags protected health information (PHI) language and identifiers.',
    keywords: ['patient', 'diagnosis', 'medical record number', 'treatment plan', 'protected health information', 'prescription'],
    detectors: [{ type: 'pattern', weight: 0.6 }, { type: 'keyword', weight: 0.9 }],
    threshold: 0.4,
    action: 'block',
  },
  {
    id: 'pci-dss',
    name: 'PCI-DSS',
    description: 'Payment card data -- leans almost entirely on checksum-validated card number detection.',
    keywords: ['cardholder data', 'cvv', 'card verification value', 'primary account number'],
    detectors: [{ type: 'pattern', weight: 1 }, { type: 'keyword', weight: 0.4 }],
    threshold: 0.3,
    action: 'block',
  },
  {
    id: 'ccpa',
    name: 'CCPA',
    description: 'California consumer privacy -- similar shape to GDPR, tuned for CCPA-specific language.',
    keywords: ['california resident', 'do not sell my personal information', 'consumer request', 'right to know', 'right to delete'],
    detectors: [{ type: 'pattern', weight: 0.6 }, { type: 'keyword', weight: 0.8 }],
    threshold: 0.35,
    action: 'quarantine',
  },
];

function list() {
  return PACKS.map(({ id, name, description }) => ({ id, name, description }));
}

function activate(packId, channels) {
  const pack = PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error(`unknown compliance pack: ${packId}`);

  const keywordList = { name: `${pack.name} keywords`, category: pack.name, terms: pack.keywords };
  const listRecord = { id: crypto.randomUUID(), ...keywordList };
  keywordListsStore.update('keyword-lists', (lists) => {
    lists.push(listRecord);
    return lists;
  });

  const savedPolicy = policy.save({
    name: `${pack.name} baseline policy`,
    channels: channels && channels.length ? channels : ['email', 'cloud', 'endpoint', 'file-share'],
    detectors: pack.detectors,
    threshold: pack.threshold,
    action: pack.action,
    mode: 'monitor',
  });

  return { keywordList: listRecord, policy: savedPolicy };
}

module.exports = { list, activate, PACKS };
