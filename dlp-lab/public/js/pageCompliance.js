Lab.registerPage('compliance', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Compliance Rule Packs', route: 'compliance' });
    body.innerHTML = '';

    const { packs } = await Lab.fetchJSON('/api/compliance/packs');
    const output = Lab.el('div', {});

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Activating a pack creates a real keyword list and a real policy on the Policy Builder page, in monitor mode by default -- the same "start in monitor, tune, then enforce" pattern a real rollout would follow.'));

    for (const pack of packs) {
      body.appendChild(Lab.el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
        Lab.el('h4', {}, pack.name),
        Lab.el('p', {}, pack.description),
        Lab.el('button', {
          onclick: async () => {
            const res = await Lab.fetchJSON(`/api/compliance/packs/${pack.id}/activate`, { method: 'POST', body: { channels: ['email', 'cloud', 'endpoint', 'file-share'] } });
            output.innerHTML = '';
            output.appendChild(Lab.el('p', {}, `Created keyword list "${res.keywordList.name}" with terms: ${res.keywordList.terms.join(', ')}`));
            output.appendChild(Lab.el('p', {}, [
              `Created policy "${res.policy.name}" -- action `,
              Lab.el('span', { class: `badge ${res.policy.action}` }, res.policy.action),
              ', mode ',
              Lab.el('span', { class: `badge ${res.policy.mode}` }, res.policy.mode),
              `, threshold ${res.policy.threshold}. `,
              Lab.el('a', { href: '#/policy-builder' }, 'View/edit it on the Policy Builder page.'),
            ]));
          },
        }, `Activate ${pack.name}`),
      ]));
    }
    body.appendChild(output);
  },
});
