// A deliberately lightweight model of active/passive HA: a heartbeat
// state, a manual failover trigger, and a session-sync toggle showing why
// synchronizing session state between nodes matters -- without it, a
// failover silently drops every in-flight connection.
const store = require('./store');

function getState() {
  return store.load('ha-state');
}

function failover() {
  return store.update('ha-state', (state) => ({
    ...state,
    primaryUp: !state.primaryUp,
    failoverCount: state.failoverCount + 1,
    lastFailoverAt: new Date().toISOString(),
  }));
}

function toggleSessionSync(enabled) {
  return store.update('ha-state', (state) => ({ ...state, sessionSyncEnabled: !!enabled }));
}

module.exports = { getState, failover, toggleSessionSync };
