// Orchestrates one play session: starts a run, applies a choice, and keeps
// the branching tree server-authoritative so a curious player can't spoil
// future branches by inspecting network responses. This is the same shape
// as FIREWALL's lib/engine/pipeline.js -- a pure orchestrator sitting
// between routes and a durable side-log (runs.js here, trafficLog.js there).
const scenarios = require('../scenarios');
const runs = require('../runs');
const scoring = require('./scoring');

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

// Strips every spoiler field from a node before it reaches the client:
// `next`, `effects`, `feedback`, and `doctrineNote` on unrevealed choices
// only ever appear in the response to the POST that picks that specific
// choice (see applyChoice below), never in a GET of the node itself.
function publicNode(node) {
  if (node.ending) {
    return {
      id: node.id, ending: true, phase: node.phase, situation: node.situation,
      endingId: node.endingId, endingSummary: node.endingSummary, endingTone: node.endingTone,
    };
  }
  return {
    id: node.id, phase: node.phase, situation: node.situation,
    choices: node.choices.map((c) => ({ id: c.id, label: c.label, domains: c.domains })),
  };
}

function startRun(scenarioId) {
  const scenario = scenarios.get(scenarioId);
  if (!scenario) throw httpError('unknown scenario', 404);
  const run = runs.create(scenarioId, scenario.startNodeId);
  const node = scenario.nodes[scenario.startNodeId];
  return { runId: run.id, meters: run.meters, node: publicNode(node) };
}

function getRunState(runId) {
  const run = runs.get(runId);
  if (!run) throw httpError('run not found', 404);
  const scenario = scenarios.get(run.scenarioId);
  const node = scenario.nodes[run.currentNodeId];
  return {
    runId: run.id, scenarioId: run.scenarioId, meters: run.meters, status: run.status,
    node: publicNode(node), ended: run.status === 'complete', result: run.result || undefined,
  };
}

function applyChoice(runId, nodeId, choiceId) {
  const run = runs.get(runId);
  if (!run) throw httpError('run not found', 404);
  if (run.status !== 'in-progress') throw httpError('run is not in progress', 409);
  if (run.currentNodeId !== nodeId) throw httpError('stale node -- this run has already moved on', 409);

  const scenario = scenarios.get(run.scenarioId);
  const currentNode = scenario.nodes[run.currentNodeId];
  if (!currentNode || currentNode.ending) throw httpError('no choices available on this node', 400);

  const choice = currentNode.choices.find((c) => c.id === choiceId);
  if (!choice) throw httpError('unknown choice for the current node', 400);

  const meters = scoring.applyEffects(run.meters, choice.effects);
  const nextNode = scenario.nodes[choice.next];
  const historyEntry = {
    nodeId: currentNode.id, choiceId: choice.id, label: choice.label, domains: choice.domains,
    effects: choice.effects, feedback: choice.feedback, doctrineNote: choice.doctrineNote,
    at: new Date().toISOString(),
  };

  let result;
  if (nextNode.ending) {
    result = {
      endingId: nextNode.endingId, endingSummary: nextNode.endingSummary, endingTone: nextNode.endingTone,
      grade: scoring.computeGrade(meters, nextNode.endingTone),
    };
  }

  const updated = runs.update(runId, (r) => ({
    ...r,
    currentNodeId: nextNode.id,
    meters,
    history: [...r.history, historyEntry],
    status: nextNode.ending ? 'complete' : 'in-progress',
    completedAt: nextNode.ending ? new Date().toISOString() : r.completedAt,
    result: result || r.result,
  }));

  return {
    node: publicNode(nextNode), feedback: choice.feedback, doctrineNote: choice.doctrineNote,
    meters: updated.meters, ended: !!nextNode.ending, result,
  };
}

function abandon(runId) {
  const run = runs.get(runId);
  if (!run) throw httpError('run not found', 404);
  return runs.update(runId, (r) => ({ ...r, status: 'abandoned', completedAt: new Date().toISOString() }));
}

module.exports = { startRun, getRunState, applyChoice, abandon, publicNode };
