Lab.registerPage('shadowed-rules', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Shadowed & Redundant Rules', route: 'shadowed-rules' });
    body.innerHTML = '';

    const rulesetSelect = Lab.el('select', {}, [
      Lab.el('option', { value: 'traditional' }, 'Traditional rulebase'),
      Lab.el('option', { value: 'ngfw' }, 'NGFW rulebase'),
    ]);
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Ruleset'), rulesetSelect])]));

    const output = Lab.el('div', {});
    async function analyze() {
      const { shadowed } = await Lab.fetchJSON(`/api/rules/${rulesetSelect.value}/hygiene`);
      output.innerHTML = '';
      if (!shadowed.length) {
        output.appendChild(Lab.el('p', { class: 'muted' }, 'No shadowed rules found in this rulebase.'));
        return;
      }
      output.appendChild(Lab.el('ul', {}, shadowed.map((s) => Lab.el('li', {}, [
        Lab.el('span', { class: `badge ${s.severity === 'critical' ? 'critical' : 'neutral'}` }, s.severity),
        ' ', s.reason,
      ]))));
    }
    body.appendChild(Lab.el('button', { onclick: analyze }, 'Analyze'));
    body.appendChild(output);
    analyze();
  },
});
