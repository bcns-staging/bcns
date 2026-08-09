Lab.registerPage('quarantine', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Quarantine Console', route: 'quarantine' });
    body.innerHTML = '';

    const listBox = Lab.el('div', {});
    async function refresh() {
      const { items } = await Lab.fetchJSON('/api/quarantine');
      listBox.innerHTML = '';
      if (!items.length) {
        listBox.appendChild(Lab.el('p', { class: 'muted' }, 'Nothing quarantined yet. Send a message that fails DMARC or trips a gateway check from the Compose page or Attack Simulator.'));
        return;
      }
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'From'), Lab.el('th', {}, 'Subject'), Lab.el('th', {}, 'Disposition'), Lab.el('th', {}, 'Reasons'), Lab.el('th', {}, 'Status'), Lab.el('th', {}, 'Actions')]),
        ...items.slice().reverse().map((item) => Lab.el('tr', {}, [
          Lab.el('td', {}, item.from),
          Lab.el('td', {}, item.subject),
          Lab.el('td', {}, Lab.el('span', { class: `badge ${item.disposition}` }, item.disposition)),
          Lab.el('td', {}, item.reasons.join(', ') || '-'),
          Lab.el('td', {}, item.status),
          Lab.el('td', {}, item.status === 'pending' ? [
            Lab.el('button', { onclick: async () => { await Lab.fetchJSON(`/api/quarantine/${item.id}/release`, { method: 'POST' }); refresh(); } }, 'Release'),
            ' ',
            Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/quarantine/${item.id}/deny`, { method: 'POST' }); refresh(); } }, 'Deny'),
          ] : '-'),
        ])),
      ]));
    }
    await refresh();
    body.appendChild(listBox);
  },
});
