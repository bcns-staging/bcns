Lab.registerPage('rule-hygiene', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Rule Hygiene & Cleanup', route: 'rule-hygiene' });
    body.innerHTML = '';

    const rulesetSelect = Lab.el('select', {}, [Lab.el('option', { value: 'traditional' }, 'Traditional'), Lab.el('option', { value: 'ngfw' }, 'NGFW')]);
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Ruleset'), rulesetSelect])]));

    const output = Lab.el('div', {});
    async function analyze() {
      const { shadowed, zeroHit, overlyPermissive } = await Lab.fetchJSON(`/api/rules/${rulesetSelect.value}/hygiene`);
      output.innerHTML = '';

      output.appendChild(Lab.el('h3', {}, `Shadowed rules (${shadowed.length})`));
      output.appendChild(shadowed.length
        ? Lab.el('ul', {}, shadowed.map((s) => Lab.el('li', {}, [Lab.el('span', { class: `badge ${s.severity === 'critical' ? 'critical' : 'neutral'}` }, s.severity), ` ${s.reason}`])))
        : Lab.el('p', { class: 'muted' }, 'None found.'));

      output.appendChild(Lab.el('h3', {}, `Zero-hit rules (${zeroHit.length})`));
      output.appendChild(zeroHit.length
        ? Lab.el('ul', {}, zeroHit.map((r) => Lab.el('li', {}, `"${r.name}" (order ${r.order}) -- never matched any test traffic yet.`)))
        : Lab.el('p', { class: 'muted' }, 'None found -- every rule has matched at least one connection.'));

      output.appendChild(Lab.el('h3', {}, `Overly permissive rules (${overlyPermissive.length})`));
      output.appendChild(overlyPermissive.length
        ? Lab.el('ul', {}, overlyPermissive.map((r) => Lab.el('li', {}, `"${r.name}" (order ${r.order}) -- allows any protocol/port with logging off.`)))
        : Lab.el('p', { class: 'muted' }, 'None found.'));
    }
    body.appendChild(Lab.el('button', { onclick: analyze }, 'Analyze'));
    body.appendChild(output);
    analyze();
  },
});
