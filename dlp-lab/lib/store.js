// Firestore-backed persistence - drop-in replacement for the original
// fs-based JSON store. Same load/save/update API (synchronous from the
// caller's perspective, served from an in-memory cache hydrated from
// Firestore at startup), so no route/lib code needed to change to move off
// local disk, which doesn't survive Cloud Run container restarts/scaling.
// Firestore writes are fire-and-forget from save()'s perspective (matching
// the original's "good enough for a lab" durability bar) but errors are
// logged, not swallowed.
const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore();
const COLLECTION = 'dlp_lab_state';

const DEFAULTS = {
  'keyword-lists': [],
  'edm-datasets': [],
  'fingerprint-docs': [],
  'classifier-model': { vocab: {}, classes: {} },
  policies: [],
  incidents: [],
  labels: [
    { name: 'Public', rank: 0 },
    { name: 'Internal', rank: 1 },
    { name: 'Confidential', rank: 2 },
    { name: 'Restricted', rank: 3 },
  ],
  'file-share': [],
  'sanctioned-apps': [],
  'ueba-log': [],
};

const cache = new Map();

async function hydrate() {
  const snapshot = await firestore.collection(COLLECTION).get();
  for (const doc of snapshot.docs) {
    cache.set(doc.id, doc.data().value);
  }
}

function load(name) {
  if (cache.has(name)) return cache.get(name);
  const value = structuredClone(DEFAULTS[name] ?? {});
  cache.set(name, value);
  firestore
    .collection(COLLECTION)
    .doc(name)
    .set({ value })
    .catch((err) => console.error(`Firestore init write failed for ${name}:`, err));
  return value;
}

function save(name, value) {
  cache.set(name, value);
  firestore
    .collection(COLLECTION)
    .doc(name)
    .set({ value })
    .catch((err) => console.error(`Firestore write failed for ${name}:`, err));
}

function update(name, mutator) {
  const value = load(name);
  const result = mutator(value);
  save(name, result !== undefined ? result : value);
  return cache.get(name);
}

module.exports = { load, save, update, hydrate };
