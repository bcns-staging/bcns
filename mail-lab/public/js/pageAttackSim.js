Lab.registerPage('attack-sim', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Attack Simulator', route: 'attack-sim' });
    body.innerHTML = '';

    const { domains } = await Lab.fetchJSON('/api/dns/domains');
    const { scenarios } = await Lab.fetchJSON('/api/attack/scenarios');
    const domainSelect = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, '-- choose your configured domain to attack --'),
      ...domains.map((d) => Lab.el('option', { value: d }, d)),
    ]);

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Pick a domain you\'ve already configured (DNS, SPF, DKIM, DMARC) and run a scenario against it. The outcome depends entirely on how well you\'ve configured your defenses -- try the same scenario before and after tightening your DMARC policy or adding known contacts / protected domains.'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Target domain'), domainSelect])]));

    for (const scenario of scenarios) {
      const resultBox = Lab.el('div', {});
      body.appendChild(Lab.el('div', { class: 'card', style: 'margin-bottom:16px;' }, [
        Lab.el('h4', {}, scenario.name),
        Lab.el('p', {}, scenario.description),
        Lab.el('p', { class: 'muted' }, `Expected defense: ${scenario.expectedDefense}`),
        Lab.el('button', {
          onclick: async () => {
            if (!domainSelect.value) { alert('Choose a target domain first.'); return; }
            resultBox.innerHTML = '<p class="muted">Running...</p>';
            const res = await Lab.fetchJSON(`/api/attack/run/${scenario.id}`, { method: 'POST', body: { targetDomain: domainSelect.value } });
            resultBox.innerHTML = '';
            const isControlCase = scenario.id === 'legitimate-forward';
            const blocked = res.result.disposition !== 'none' && !res.result.disposition.startsWith('none');
            const goodOutcome = isControlCase ? !blocked : blocked;
            resultBox.appendChild(Lab.el('p', {}, [
              Lab.el('span', { class: `badge ${goodOutcome ? 'pass' : 'fail'}` }, goodOutcome ? (isControlCase ? 'correctly allowed' : 'caught') : (isControlCase ? 'false positive!' : 'NOT caught')),
              ` -- disposition: ${res.result.disposition}`,
            ]));
            resultBox.appendChild(Lab.el('pre', { class: 'trace-log' }, res.result.trace.join('\n')));
          },
        }, `Run: ${scenario.name}`),
        resultBox,
      ]));
    }
  },
});
