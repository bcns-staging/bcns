Lab.registerPage('app-id', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'App-ID', route: 'app-id' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'Known signatures'));
    const sigBox = Lab.el('div', {});
    async function refreshSigs() {
      const { 'app-signatures': rows } = await Lab.fetchJSON('/api/app-signatures/app-signatures');
      sigBox.innerHTML = '';
      sigBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Default port'), Lab.el('th', {}, 'Category'), Lab.el('th', {}, 'Risk')]),
        ...rows.map((s) => Lab.el('tr', {}, [Lab.el('td', {}, s.name), Lab.el('td', {}, s.defaultPort ?? 'any'), Lab.el('td', {}, s.category), Lab.el('td', {}, Lab.el('span', { class: `badge ${s.risk === 'high' ? 'high' : s.risk === 'medium' ? 'medium' : 'low'}` }, s.risk))])),
      ]));
    }
    refreshSigs();
    body.appendChild(sigBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    body.appendChild(Lab.el('h3', {}, 'Identify'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Leave "real application" blank to see App-ID fall back to a port-based guess -- exactly as blind as a traditional rule.'));
    const dstPort = Lab.el('input', { type: 'number', value: '443' });
    const declaredApp = Lab.el('input', { type: 'text', placeholder: 'e.g. bittorrent' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Destination port'), dstPort]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Real application (what deep inspection would find)'), declaredApp]),
    ]));
    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const result = await Lab.fetchJSON('/api/app-signatures/identify', { method: 'POST', body: { dstPort: Number(dstPort.value), declaredApp: declaredApp.value.trim() || undefined } });
        output.innerHTML = '';
        output.appendChild(Lab.el('p', {}, [
          Lab.el('span', { class: `badge ${result.method === 'port-default' ? 'warn' : 'good'}` }, result.app),
          ` -- ${Math.round(result.confidence * 100)}% confidence, method: ${result.method}`,
        ]));
      },
    }, 'Identify'));
    body.appendChild(output);
  },
});
