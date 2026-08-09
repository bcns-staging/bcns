// Data-at-rest: a virtual file share the learner populates, plus a
// "discovery scan" that walks every file the way a real DLP discovery job
// periodically re-scans network shares and cloud storage looking for
// sensitive content that was never caught in motion.
const crypto = require('crypto');
const store = require('../store');
const labels = require('../labels');
const policy = require('../policy');

function list() {
  return store.load('file-share');
}

function addFile({ filename, content, label }) {
  const record = { id: crypto.randomUUID(), filename, content, label: label || 'Internal' };
  store.update('file-share', (files) => {
    files.push(record);
    return files;
  });
  return record;
}

function removeFile(id) {
  store.update('file-share', (files) => files.filter((f) => f.id !== id));
}

function runScan() {
  const allLabels = labels.list();
  const files = list();
  return files.map((file) => {
    const labelInfo = allLabels.find((l) => l.name === file.label);
    const evaluation = policy.evaluateChannel('file-share', file.content, {
      destination: file.filename,
      labelRank: labelInfo ? labelInfo.rank : undefined,
      metadata: { label: file.label },
    });
    return { file: { id: file.id, filename: file.filename, label: file.label }, evaluation };
  });
}

module.exports = { list, addFile, removeFile, runScan };
