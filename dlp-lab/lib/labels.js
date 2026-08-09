// Sensitivity labels (Public/Internal/Confidential/Restricted-style
// taxonomy). A label is just a name and a rank; higher rank means more
// sensitive. Documents in the file share carry a label, and policies can
// key off it directly, independent of what content scanning finds.
const store = require('./store');

function list() {
  return store.load('labels').slice().sort((a, b) => a.rank - b.rank);
}

function add(name, rank) {
  store.update('labels', (labels) => {
    if (labels.some((l) => l.name.toLowerCase() === name.toLowerCase())) return labels;
    return [...labels, { name, rank: Number(rank) }];
  });
  return list();
}

function remove(name) {
  store.update('labels', (labels) => labels.filter((l) => l.name.toLowerCase() !== name.toLowerCase()));
  return list();
}

module.exports = { list, add, remove };
