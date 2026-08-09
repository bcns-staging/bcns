Lab.registerPage('threat-intel', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Threat Intelligence', route: 'threat-intel' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'Feed'));
    const listBox = Lab.el('div', {});
    async function refresh() {
      const { 'threat-intel-feed': rows } = await Lab.fetchJSON('/api/threat-intel/threat-intel-feed');
      listBox.innerHTML = '';
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Indicator'), Lab.el('th', {}, 'Type'), Lab.el('th', {}, 'Verdict'), Lab.el('th', {}, 'Source'), Lab.el('th', {}, '')]),
        ...(rows.length ? rows.map((e) => Lab.el('tr', {}, [
          Lab.el('td', { class: 'mono' }, e.indicator), Lab.el('td', {}, e.type), Lab.el('td', {}, Lab.el('span', { class: 'badge bad' }, e.verdict)), Lab.el('td', {}, e.source),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/threat-intel/threat-intel-feed/${e.id}`, { method: 'DELETE' }); refresh(); } }, 'Delete')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '5', class: 'muted' }, 'No entries yet.'))]),
      ]));
    }
    refresh();

    const indicator = Lab.el('input', { type: 'text', placeholder: 'e.g. 198.51.100.99' });
    const type = Lab.el('select', {}, ['ip', 'domain'].map((t) => Lab.el('option', { value: t }, t)));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Indicator'), indicator]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Type'), type]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!indicator.value.trim()) return;
        await Lab.fetchJSON('/api/threat-intel/threat-intel-feed', { method: 'POST', body: { indicator: indicator.value.trim(), type: type.value, verdict: 'malicious', source: 'manual-add' } });
        indicator.value = '';
        refresh();
      },
    }, 'Add indicator'));
    body.appendChild(listBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    body.appendChild(Lab.el('h3', {}, 'Lookup'));
    const testIndicator = Lab.el('input', { type: 'text', value: '198.51.100.66' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Indicator'), testIndicator])]));
    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const result = await Lab.fetchJSON('/api/threat-intel/lookup', { method: 'POST', body: { indicator: testIndicator.value.trim() } });
        output.innerHTML = '';
        output.appendChild(result.listed
          ? Lab.el('p', {}, [Lab.el('span', { class: 'badge bad' }, result.verdict), ` (source: ${result.source})`])
          : Lab.el('p', { class: 'muted' }, 'Not listed.'));
      },
    }, 'Lookup'));
    body.appendChild(output);
  },
});
