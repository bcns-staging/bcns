const express = require('express');
const rules = require('../lib/engine/rules');
const ruleHygiene = require('../lib/ruleHygiene');

const router = express.Router();

router.get('/:ruleset', (req, res) => {
  if (!rules.COLLECTION[req.params.ruleset]) return res.status(400).json({ error: 'unknown ruleset' });
  res.json({ rules: rules.list(req.params.ruleset) });
});

router.post('/:ruleset', (req, res) => {
  if (!rules.COLLECTION[req.params.ruleset]) return res.status(400).json({ error: 'unknown ruleset' });
  res.json({ rule: rules.save(req.params.ruleset, req.body) });
});

router.put('/:ruleset/:id', (req, res) => {
  res.json({ rule: rules.save(req.params.ruleset, { ...req.body, id: req.params.id }) });
});

router.delete('/:ruleset/:id', (req, res) => {
  rules.remove(req.params.ruleset, req.params.id);
  res.json({ ok: true });
});

router.post('/:ruleset/reorder', (req, res) => {
  res.json({ rules: rules.reorder(req.params.ruleset, req.body.order || []) });
});

router.get('/:ruleset/hygiene', (req, res) => {
  res.json(ruleHygiene.analyze(req.params.ruleset));
});

module.exports = router;
