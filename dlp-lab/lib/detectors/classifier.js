// A real (if deliberately small) Naive Bayes bag-of-words classifier --
// statistical classification is a genuinely different technique from
// pattern/keyword matching: instead of looking for specific strings, it
// learns which *words in general* tend to co-occur with "sensitive" vs.
// "not sensitive" documents, then scores new text by probability.
const store = require('../store');

const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'is', 'it', 'for', 'on', 'this', 'that', 'with', 'as', 'at', 'be', 'was', 'are']);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
}

function getModel() {
  return store.load('classifier-model');
}

function train(examples) {
  const model = { vocab: {}, classes: {} };
  for (const { text, label } of examples) {
    if (!model.classes[label]) model.classes[label] = { docCount: 0, totalWords: 0, wordCounts: {} };
    const cls = model.classes[label];
    cls.docCount += 1;
    for (const word of tokenize(text)) {
      model.vocab[word] = true;
      cls.wordCounts[word] = (cls.wordCounts[word] || 0) + 1;
      cls.totalWords += 1;
    }
  }
  store.save('classifier-model', model);
  return stats();
}

function addExamples(examples) {
  const model = getModel();
  if (!model.classes || Object.keys(model.classes).length === 0) return train(examples);
  for (const { text, label } of examples) {
    if (!model.classes[label]) model.classes[label] = { docCount: 0, totalWords: 0, wordCounts: {} };
    const cls = model.classes[label];
    cls.docCount += 1;
    for (const word of tokenize(text)) {
      model.vocab[word] = true;
      cls.wordCounts[word] = (cls.wordCounts[word] || 0) + 1;
      cls.totalWords += 1;
    }
  }
  store.save('classifier-model', model);
  return stats();
}

function stats() {
  const model = getModel();
  const vocabSize = Object.keys(model.vocab || {}).length;
  const classes = Object.entries(model.classes || {}).map(([label, c]) => ({
    label,
    docCount: c.docCount,
    totalWords: c.totalWords,
    topWords: Object.entries(c.wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w, n]) => ({ word: w, count: n })),
  }));
  return { vocabSize, classes };
}

function classify(text) {
  const model = getModel();
  const labels = Object.keys(model.classes || {});
  if (labels.length === 0) return { label: null, confidence: 0, scores: {} };

  const totalDocs = labels.reduce((sum, l) => sum + model.classes[l].docCount, 0);
  const vocabSize = Object.keys(model.vocab).length;
  const words = tokenize(text);

  const logScores = {};
  for (const label of labels) {
    const cls = model.classes[label];
    let logProb = Math.log(cls.docCount / totalDocs);
    for (const word of words) {
      const count = cls.wordCounts[word] || 0;
      logProb += Math.log((count + 1) / (cls.totalWords + vocabSize));
    }
    logScores[label] = logProb;
  }

  // Convert log-probabilities to normalized probabilities (softmax-style, numerically stable).
  const maxLog = Math.max(...Object.values(logScores));
  const expScores = Object.fromEntries(labels.map((l) => [l, Math.exp(logScores[l] - maxLog)]));
  const total = Object.values(expScores).reduce((a, b) => a + b, 0);
  const scores = Object.fromEntries(labels.map((l) => [l, expScores[l] / total]));

  const label = labels.reduce((best, l) => (scores[l] > scores[best] ? l : best), labels[0]);
  return { label, confidence: scores[label], scores };
}

function reset() {
  store.save('classifier-model', { vocab: {}, classes: {} });
}

module.exports = { train, addExamples, classify, stats, tokenize, reset };
