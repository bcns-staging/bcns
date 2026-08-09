Lab.registerPage('incidents', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Incident Console', route: 'incidents' });
    body.innerHTML = '';

    const userFilter = Lab.el('input', { type: 'text', placeholder: 'filter by user' });
    const channelFilter = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, 'all channels'),
      ...['email', 'cloud', 'endpoint', 'file-share'].map((c) => Lab.el('option', { value: c }, c)),
    ]);
    const listBox = Lab.el('div', {});

    async function refresh() {
      const params = new URLSearchParams();
      if (userFilter.value.trim()) params.set('user', userFilter.value.trim());
      if (channelFilter.value) params.set('channel', channelFilter.value);
      const { incidents } = await Lab.fetchJSON(`/api/incidents?${params}`);
      listBox.innerHTML = '';
      if (!incidents.length) {
        listBox.appendChild(Lab.el('p', { class: 'muted' }, 'No incidents match this filter. Trip a policy from one of the Channels pages to see one appear here.'));
        return;
      }
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'When'), Lab.el('th', {}, 'Channel'), Lab.el('th', {}, 'User'), Lab.el('th', {}, 'Destination'), Lab.el('th', {}, 'Policy'), Lab.el('th', {}, 'Action'), Lab.el('th', {}, 'Severity'), Lab.el('th', {}, 'Preview'), Lab.el('th', {}, 'Status'), Lab.el('th', {}, '')]),
        ...incidents.slice().reverse().map((i) => Lab.el('tr', {}, [
          Lab.el('td', {}, new Date(i.createdAt).toLocaleString()),
          Lab.el('td', {}, i.channel),
          Lab.el('td', {}, i.user || '-'),
          Lab.el('td', {}, i.recipient || i.destination || '-'),
          Lab.el('td', {}, i.policyName),
          Lab.el('td', {}, Lab.el('span', { class: `badge ${i.action}` }, i.action)),
          Lab.el('td', {}, Lab.el('span', { class: `badge ${i.severity}` }, i.severity)),
          Lab.el('td', { class: 'mono' }, i.contentPreview),
          Lab.el('td', {}, i.status),
          Lab.el('td', {}, i.status === 'open' || i.status === 'in-review' ? [
            Lab.el('button', { class: 'secondary', onclick: async () => { await Lab.fetchJSON(`/api/incidents/${i.id}/in-review`, { method: 'POST' }); refresh(); } }, 'In review'),
            ' ',
            Lab.el('button', { onclick: async () => { await Lab.fetchJSON(`/api/incidents/${i.id}/resolve`, { method: 'POST' }); refresh(); } }, 'Resolve'),
            ' ',
            Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/incidents/${i.id}/false-positive`, { method: 'POST' }); refresh(); } }, 'False positive'),
          ] : '-'),
        ])),
      ]));
    }

    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'User'), userFilter]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Channel'), channelFilter]),
    ]));
    body.appendChild(Lab.el('button', { onclick: refresh }, 'Filter'));
    body.appendChild(listBox);

    refresh();
  },
});
