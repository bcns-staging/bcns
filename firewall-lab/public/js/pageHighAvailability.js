Lab.registerPage('high-availability', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'High Availability & Failover', route: 'high-availability' });
    body.innerHTML = '';

    const stateBox = Lab.el('div', {});
    async function refresh() {
      const state = await Lab.fetchJSON('/api/ha/state');
      stateBox.innerHTML = '';
      stateBox.appendChild(Lab.el('div', { class: 'diagram-flow' }, [
        Lab.el('div', { class: `diagram-step ${state.primaryUp ? 'good' : 'bad'}` }, [Lab.el('div', { class: 'step-title' }, 'Node A (primary)'), Lab.el('div', { class: 'step-sub' }, state.primaryUp ? 'ACTIVE' : 'DOWN')]),
        Lab.el('div', { class: 'diagram-arrow' }, '↔'),
        Lab.el('div', { class: `diagram-step ${state.primaryUp ? '' : 'good'}` }, [Lab.el('div', { class: 'step-title' }, 'Node B (standby)'), Lab.el('div', { class: 'step-sub' }, state.primaryUp ? 'PASSIVE' : 'ACTIVE (took over)')]),
      ]));
      stateBox.appendChild(Lab.el('p', { class: 'muted' }, `Session sync: ${state.sessionSyncEnabled ? 'ON' : 'OFF'}. Failovers so far: ${state.failoverCount}.${state.lastFailoverAt ? ` Last: ${new Date(state.lastFailoverAt).toLocaleTimeString()}.` : ''}`));
      stateBox.appendChild(Lab.el('p', {}, state.primaryUp
        ? 'Node A is serving traffic.'
        : (state.sessionSyncEnabled
          ? 'Node B took over with a synchronized session table -- in-flight connections survived the failover.'
          : 'Node B took over with an empty session table -- every in-flight connection was dropped and has to reconnect from scratch.')));
    }
    await refresh();
    body.appendChild(stateBox);

    body.appendChild(Lab.el('div', { class: 'toolbar' }, [
      Lab.el('button', { onclick: async () => { await Lab.fetchJSON('/api/ha/failover', { method: 'POST' }); refresh(); } }, 'Fail the primary'),
      Lab.el('button', { class: 'secondary', onclick: async () => { const state = await Lab.fetchJSON('/api/ha/state'); await Lab.fetchJSON('/api/ha/session-sync', { method: 'POST', body: { enabled: !state.sessionSyncEnabled } }); refresh(); } }, 'Toggle session sync'),
    ]));
  },
});
