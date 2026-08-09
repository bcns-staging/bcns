const express = require('express');
const crypto = require('crypto');
const store = require('../lib/store');
const fingerprint = require('../lib/detectors/fingerprint');

const router = express.Router();

function crud(name, singular, { onSave } = {}) {
  router.get(`/${name}`, (req, res) => res.json({ [name]: store.load(name) }));

  router.post(`/${name}`, (req, res) => {
    let record = { id: crypto.randomUUID(), ...req.body };
    if (onSave) record = onSave(record);
    store.update(name, (list) => {
      list.push(record);
      return list;
    });
    res.json({ [singular]: record });
  });

  router.put(`/${name}/:id`, (req, res) => {
    let updated = null;
    store.update(name, (list) => list.map((item) => {
      if (item.id === req.params.id) {
        updated = { ...item, ...req.body, id: item.id };
        if (onSave) updated = onSave(updated);
        return updated;
      }
      return item;
    }));
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json({ [singular]: updated });
  });

  router.delete(`/${name}/:id`, (req, res) => {
    store.update(name, (list) => list.filter((item) => item.id !== req.params.id));
    res.json({ ok: true });
  });
}

crud('keyword-lists', 'keywordList');
crud('edm-datasets', 'dataset');
// Real IDM systems index a reference document once at ingestion rather than
// re-hashing it on every scan -- we do the same here.
crud('fingerprint-docs', 'doc', {
  onSave: (record) => ({ ...record, hashes: [...fingerprint.shingleHashes(record.text)] }),
});

module.exports = router;
