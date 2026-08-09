// Shared CRUD route factory -- generates GET/POST/PUT/DELETE for a
// store.js-backed collection. Same behavior as DLP's inline `crud()`
// route helper, factored out here since this app has many more flat CRUD
// collections (network objects, NAT, VPN, every NGFW intel table) than
// DLP did.
const crypto = require('crypto');
const store = require('./store');

function crud(router, name, singular, { onSave } = {}) {
  router.get(`/${name}`, (req, res) => res.json({ [name]: store.load(name) }));

  router.post(`/${name}`, (req, res) => {
    let record = { id: crypto.randomUUID(), ...req.body };
    if (onSave) record = onSave(record);
    store.update(name, (list) => { list.push(record); return list; });
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

module.exports = crud;
