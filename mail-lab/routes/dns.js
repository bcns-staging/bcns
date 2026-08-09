const express = require('express');
const dnsZone = require('../lib/dnsZone');

const router = express.Router();

router.get('/domains', (req, res) => {
  res.json({ domains: dnsZone.listDomains() });
});

router.post('/domains', (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain is required' });
  const d = dnsZone.ensureDomain(domain);
  res.json({ domain: d });
});

router.delete('/domains/:domain', (req, res) => {
  dnsZone.deleteDomain(req.params.domain);
  res.json({ ok: true });
});

router.get('/:domain/records', (req, res) => {
  res.json({ records: dnsZone.listRecords(req.params.domain) });
});

router.post('/:domain/records', (req, res) => {
  const { name, type, value, priority } = req.body;
  if (!name || !type || value === undefined) {
    return res.status(400).json({ error: 'name, type and value are required' });
  }
  const record = dnsZone.addRecord(req.params.domain, { name, type, value, priority });
  res.json({ record });
});

router.put('/:domain/records/:id', (req, res) => {
  const record = dnsZone.updateRecord(req.params.domain, req.params.id, req.body);
  if (!record) return res.status(404).json({ error: 'record not found' });
  res.json({ record });
});

router.delete('/:domain/records/:id', (req, res) => {
  dnsZone.deleteRecord(req.params.domain, req.params.id);
  res.json({ ok: true });
});

// Simulated `dig`-style resolution, used by the DNS Lab UI to show learners
// exactly what a real resolver query/response would look like.
router.get('/resolve', (req, res) => {
  const { name, type = 'TXT' } = req.query;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const records = dnsZone.findRecords(name, type);
  const digText = [
    `; <<>> DiG 9.18.0 <<>> ${name} ${type.toUpperCase()}`,
    ';; QUESTION SECTION:',
    `;${dnsZone.normalize(name)}.\t\tIN\t${type.toUpperCase()}`,
    '',
    ';; ANSWER SECTION:',
    ...(records.length
      ? records.map(
          (r) =>
            `${r.name}.\t300\tIN\t${r.type}\t${r.type === 'MX' ? `${r.priority} ${r.value}` : JSON.stringify(r.value)}`,
        )
      : ['; NXDOMAIN - no records found']),
  ].join('\n');
  res.json({ records, digText });
});

module.exports = router;
