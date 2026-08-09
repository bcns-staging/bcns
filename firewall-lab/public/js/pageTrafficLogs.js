Lab.registerPage('traffic-logs', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Traffic Logs', route: 'traffic-logs' });
    body.innerHTML = '';

    const filters = {
      srcIp: Lab.el('input', { type: 'text', placeholder: 'source IP' }),
      dstIp: Lab.el('input', { type: 'text', placeholder: 'destination IP' }),
      action: Lab.el('select', {}, [Lab.el('option', { value: '' }, 'any verdict'), Lab.el('option', { value: 'allow' }, 'allow'), Lab.el('option', { value: 'deny' }, 'deny')]),
      ruleset: Lab.el('select', {}, [Lab.el('option', { value: '' }, 'any ruleset'), Lab.el('option', { value: 'traditional' }, 'traditional'), Lab.el('option', { value: 'ngfw' }, 'ngfw')]),
    };
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Source IP'), filters.srcIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Destination IP'), filters.dstIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Verdict'), filters.action]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Ruleset'), filters.ruleset]),
    ]));

    const listBox = Lab.el('div', {});
    async function refresh() {
      const params = new URLSearchParams();
      if (filters.srcIp.value.trim()) params.set('srcIp', filters.srcIp.value.trim());
      if (filters.dstIp.value.trim()) params.set('dstIp', filters.dstIp.value.trim());
      if (filters.action.value) params.set('action', filters.action.value);
      if (filters.ruleset.value) params.set('ruleset', filters.ruleset.value);
      const { logs } = await Lab.fetchJSON(`/api/traffic-logs?${params}`);
      listBox.innerHTML = '';
      if (!logs.length) {
        listBox.appendChild(Lab.el('p', { class: 'muted' }, 'No log entries match this filter. Run some traffic through the Traffic Simulator to see entries appear here.'));
        return;
      }
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'When'), Lab.el('th', {}, 'Ruleset'), Lab.el('th', {}, 'Src'), Lab.el('th', {}, 'Dst'), Lab.el('th', {}, 'App'), Lab.el('th', {}, 'User'), Lab.el('th', {}, 'Rule'), Lab.el('th', {}, 'Verdict')]),
        ...logs.slice().reverse().map((l) => Lab.el('tr', {}, [
          Lab.el('td', {}, new Date(l.timestamp).toLocaleTimeString()),
          Lab.el('td', {}, l.ruleset),
          Lab.el('td', { class: 'mono' }, `${l.srcIp}:${l.srcPort ?? ''}`),
          Lab.el('td', { class: 'mono' }, `${l.dstIp}:${l.dstPort}`),
          Lab.el('td', {}, l.app || '-'),
          Lab.el('td', {}, l.user || '-'),
          Lab.el('td', {}, l.matchedRuleName || '-'),
          Lab.el('td', {}, Lab.el('span', { class: `badge ${l.verdict}` }, l.verdict)),
        ])),
      ]));
    }
    body.appendChild(Lab.el('button', { onclick: refresh }, 'Filter'));
    body.appendChild(listBox);
    refresh();
  },
});
