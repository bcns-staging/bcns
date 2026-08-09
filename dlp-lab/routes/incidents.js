const express = require('express');
const incidents = require('../lib/incidents');

const router = express.Router();

router.get('/', (req, res) => {
  const { user, channel } = req.query;
  let items = incidents.list();
  if (user) items = items.filter((i) => i.user === user);
  if (channel) items = items.filter((i) => i.channel === channel);
  res.json({ incidents: items });
});

router.post('/:id/resolve', (req, res) => res.json({ incident: incidents.setStatus(req.params.id, 'resolved') }));
router.post('/:id/false-positive', (req, res) => res.json({ incident: incidents.setStatus(req.params.id, 'false-positive') }));
router.post('/:id/in-review', (req, res) => res.json({ incident: incidents.setStatus(req.params.id, 'in-review') }));
router.post('/:id/notes', (req, res) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'note is required' });
  res.json({ incident: incidents.addNote(req.params.id, note) });
});

module.exports = router;
