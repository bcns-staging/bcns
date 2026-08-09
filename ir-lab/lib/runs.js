// The durable log of play sessions -- mirrors DLP's lib/incidents.js and
// FIREWALL's lib/trafficLog.js. A run tracks one player's progress through
// one scenario: current position, accumulated meters, full choice history,
// and (once finished) the ending reached and computed grade.
const crypto = require('crypto');
const store = require('./store');
const { startingMeters } = require('./engine/scoring');

function create(scenarioId, startNodeId) {
  const record = {
    id: crypto.randomUUID(),
    scenarioId,
    status: 'in-progress',
    currentNodeId: startNodeId,
    meters: startingMeters(),
    history: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    result: null,
  };
  store.update('runs', (list) => { list.push(record); return list; });
  return record;
}

function get(runId) {
  return store.load('runs').find((r) => r.id === runId) || null;
}

function update(runId, mutator) {
  let updated = null;
  store.update('runs', (list) => list.map((r) => {
    if (r.id !== runId) return r;
    updated = mutator({ ...r });
    return updated;
  }));
  return updated;
}

function history({ scenarioId, limit } = {}) {
  let rows = store.load('runs').filter((r) => r.status === 'complete');
  if (scenarioId) rows = rows.filter((r) => r.scenarioId === scenarioId);
  rows = rows.slice().sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  return limit ? rows.slice(0, Number(limit)) : rows;
}

function bestGrade(scenarioId) {
  const rows = store.load('runs').filter((r) => r.scenarioId === scenarioId && r.status === 'complete' && r.result);
  if (!rows.length) return null;
  return rows.reduce((best, r) => (r.result.grade.composite > best.composite ? r.result.grade : best), rows[0].result.grade);
}

module.exports = { create, get, update, history, bestGrade };
