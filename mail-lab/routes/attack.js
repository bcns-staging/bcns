const express = require('express');
const pipeline = require('../lib/pipeline');
const spf = require('../lib/spf');
const dkimKeystore = require('../lib/dkimKeystore');
const impersonation = require('../lib/gateway/impersonation');

const router = express.Router();

const SCENARIOS = [
  {
    id: 'domain-spoof',
    name: 'Domain Spoofing (no authentication)',
    description: 'Sends "from" your domain using an IP your SPF record doesn\'t authorize, and no DKIM signature. A properly configured SPF + DMARC policy should reject or quarantine this.',
    expectedDefense: 'SPF + DMARC',
  },
  {
    id: 'cousin-domain-bec',
    name: 'Cousin-Domain BEC',
    description: 'Registers a lookalike of your domain and sends an urgent wire-transfer request, optionally impersonating a known contact. Tests lookalike-domain detection, impersonation detection, and BEC scoring -- SPF/DKIM/DMARC won\'t help here since the attacker\'s own (lookalike) domain can authenticate itself perfectly.',
    expectedDefense: 'Lookalike domain + Impersonation + BEC',
  },
  {
    id: 'malicious-attachment',
    name: 'Malicious Attachment from a "Trusted" Sender',
    description: 'Uses your properly authenticated domain/DKIM key (simulating a compromised account or careless insider) but attaches a disguised executable. Tests whether the attachment sandbox catches it even when SPF/DKIM/DMARC all pass.',
    expectedDefense: 'Attachment Sandbox',
  },
  {
    id: 'legitimate-forward',
    name: 'Legitimate Mailing List Forward (not an attack)',
    description: 'A real, benign message forwarded through a mailing list, which breaks SPF and DKIM the way real forwarding does. This is a control case: a good defense should NOT treat this the same as an attack, because ARC preserves the original trust decision.',
    expectedDefense: 'ARC (should NOT be blocked)',
  },
];

function makeLookalike(domain) {
  if (domain.includes('m')) return domain.replace('m', 'rn');
  if (domain.includes('o')) return domain.replace('o', '0');
  return domain.replace('.', '-secure.');
}

router.get('/scenarios', (req, res) => res.json({ scenarios: SCENARIOS }));

router.post('/run/:id', (req, res) => {
  const { targetDomain } = req.body;
  if (!targetDomain) return res.status(400).json({ error: 'targetDomain is required' });

  let input;
  switch (req.params.id) {
    case 'domain-spoof':
      input = {
        envelopeFrom: `ceo@${targetDomain}`,
        senderIp: '198.51.100.222',
        headerFrom: `CEO <ceo@${targetDomain}>`,
        to: 'employee@example.com',
        subject: 'Quick favor',
        body: 'Are you at your desk? I need you to handle something for me right away, its urgent.',
        dkim: { enabled: false },
      };
      break;

    case 'cousin-domain-bec': {
      const lookalike = makeLookalike(targetDomain);
      const contacts = impersonation.listKnownContacts();
      const persona = contacts[0]?.name || 'Finance Director';
      input = {
        envelopeFrom: `cfo@${lookalike}`,
        senderIp: '198.51.100.223',
        headerFrom: `${persona} <cfo@${lookalike}>`,
        replyTo: `reply@${lookalike}`,
        to: 'employee@example.com',
        subject: 'URGENT: Wire Transfer Request - Confidential',
        body: 'I need you to process a wire transfer today. This is confidential, please don\'t discuss with anyone else. Send me the bank details once done. ASAP.',
        dkim: { enabled: false },
      };
      break;
    }

    case 'malicious-attachment': {
      const [record] = spf.getSpfRecords(targetDomain);
      const ipMatch = record && /ip4:([0-9.]+)/.exec(record);
      const senderIp = ipMatch ? ipMatch[1] : '203.0.113.10';
      const [selectorInfo] = dkimKeystore.listSelectors(targetDomain);
      input = {
        envelopeFrom: `alice@${targetDomain}`,
        senderIp,
        headerFrom: `Alice <alice@${targetDomain}>`,
        to: 'employee@example.com',
        subject: 'Invoice attached',
        body: 'Hi, please see the attached invoice for last month.',
        dkim: selectorInfo ? { enabled: true, domain: targetDomain, selector: selectorInfo.selector } : { enabled: false },
        attachment: { filename: 'invoice.pdf.exe' },
      };
      break;
    }

    case 'legitimate-forward': {
      const [selectorInfo] = dkimKeystore.listSelectors(targetDomain);
      input = {
        envelopeFrom: `alice@${targetDomain}`,
        senderIp: '203.0.113.10',
        headerFrom: `Alice <alice@${targetDomain}>`,
        to: 'employee@example.com',
        subject: 'Weekly newsletter discussion',
        body: 'Hi all, sharing this week\'s update with the list.',
        dkim: selectorInfo ? { enabled: true, domain: targetDomain, selector: selectorInfo.selector } : { enabled: false },
        simulateForward: true,
      };
      break;
    }

    default:
      return res.status(404).json({ error: 'unknown scenario' });
  }

  const scenario = SCENARIOS.find((s) => s.id === req.params.id);
  const result = pipeline.send(input);
  res.json({ scenario, input, result });
});

module.exports = router;
