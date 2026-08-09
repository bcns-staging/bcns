const express = require('express');
const policy = require('../lib/policy');

const router = express.Router();

router.get('/', (req, res) => res.json({ policies: policy.list() }));

router.post('/', (req, res) => res.json({ policy: policy.save(req.body) }));

router.put('/:id', (req, res) => res.json({ policy: policy.save({ ...req.body, id: req.params.id }) }));

router.delete('/:id', (req, res) => {
  policy.remove(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/evaluate', (req, res) => {
  const p = policy.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'policy not found' });
  const { content, context } = req.body;
  if (typeof content !== 'string') return res.status(400).json({ error: 'content is required' });
  res.json(policy.evaluate(p, content, context || {}));
});

module.exports = router;
