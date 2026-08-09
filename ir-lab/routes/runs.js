const express = require('express');
const runEngine = require('../lib/engine/runEngine');
const runs = require('../lib/runs');

const router = express.Router();

function handle(res, fn) {
  try {
    res.json(fn());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

router.post('/', (req, res) => {
  const { scenarioId } = req.body;
  if (!scenarioId) return res.status(400).json({ error: 'scenarioId is required' });
  handle(res, () => runEngine.startRun(scenarioId));
});

router.get('/', (req, res) => {
  const { scenarioId, limit } = req.query;
  res.json({ runs: runs.history({ scenarioId, limit }) });
});

router.get('/:runId', (req, res) => {
  handle(res, () => runEngine.getRunState(req.params.runId));
});

router.post('/:runId/choice', (req, res) => {
  const { nodeId, choiceId } = req.body;
  if (!nodeId || !choiceId) return res.status(400).json({ error: 'nodeId and choiceId are required' });
  handle(res, () => runEngine.applyChoice(req.params.runId, nodeId, choiceId));
});

router.post('/:runId/abandon', (req, res) => {
  handle(res, () => runEngine.abandon(req.params.runId));
});

module.exports = router;
