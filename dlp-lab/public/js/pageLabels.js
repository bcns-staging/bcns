Lab.registerPage('labels', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Sensitivity Labels', route: 'labels' });
    body.innerHTML = '';

    const listBox = Lab.el('div', {});
    async function refresh() {
      const { labels } = await Lab.fetchJSON('/api/labels');
      listBox.innerHTML = '';
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Label'), Lab.el('th', {}, 'Rank (higher = more sensitive)'), Lab.el('th', {}, '')]),
        ...labels.map((l) => Lab.el('tr', {}, [
          Lab.el('td', {}, Lab.el('span', { class: 'label-tag' }, l.name)),
          Lab.el('td', {}, String(l.rank)),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/labels/${encodeURIComponent(l.name)}`, { method: 'DELETE' }); refresh(); } }, 'Delete')),
        ])),
      ]));
    }

    body.appendChild(Lab.el('p', { class: 'muted' }, 'The default four-tier taxonomy is already set up below. Add your own if you need more granularity -- these are used on the Data-at-Rest File Share page, and can gate a policy in the Policy Builder ("only applies to content labeled...").'));
    body.appendChild(listBox);

    const nameInput = Lab.el('input', { type: 'text', placeholder: 'e.g. Top Secret' });
    const rankInput = Lab.el('input', { type: 'number', placeholder: 'e.g. 4', value: '4' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Label name'), nameInput]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Rank'), rankInput]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!nameInput.value.trim()) return;
        await Lab.fetchJSON('/api/labels', { method: 'POST', body: { name: nameInput.value.trim(), rank: Number(rankInput.value) } });
        nameInput.value = '';
        refresh();
      },
    }, 'Add label'));

    refresh();
  },
});
