Lab.registerPage('scoreboard', {
  async render(container) {
    container.innerHTML = '';
    const wrap = Lab.el('div', { class: 'page' });
    wrap.appendChild(Lab.el('h1', {}, 'Scoreboard'));
    wrap.appendChild(Lab.el('p', { class: 'muted' }, 'Every completed run, across every scenario.'));

    const { scenarios } = await Lab.fetchJSON('/api/scenarios');
    const scenarioTitle = Object.fromEntries(scenarios.map((s) => [s.id, s.title]));

    const filter = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, 'All scenarios'),
      ...scenarios.map((s) => Lab.el('option', { value: s.id }, s.title)),
    ]);
    wrap.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Filter'), filter])]));

    const listBox = Lab.el('div', {});
    wrap.appendChild(listBox);
    container.appendChild(wrap);

    async function refresh() {
      const params = new URLSearchParams();
      if (filter.value) params.set('scenarioId', filter.value);
      const { runs } = await Lab.fetchJSON(`/api/runs?${params}`);
      listBox.innerHTML = '';
      if (!runs.length) {
        listBox.appendChild(Lab.el('p', { class: 'muted' }, 'No completed runs yet — play a scenario to see it here.'));
        return;
      }
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'When'), Lab.el('th', {}, 'Scenario'), Lab.el('th', {}, 'Ending'), Lab.el('th', {}, 'Grade')]),
        ...runs.map((r) => Lab.el('tr', {}, [
          Lab.el('td', {}, new Date(r.completedAt).toLocaleString()),
          Lab.el('td', {}, scenarioTitle[r.scenarioId] || r.scenarioId),
          Lab.el('td', {}, r.result?.endingId || '-'),
          Lab.el('td', {}, r.result ? Lab.el('span', { class: `badge ${Lab.letterClass(r.result.grade.letter)}` }, `${r.result.grade.letter} (${r.result.grade.composite})`) : '-'),
        ])),
      ]));
    }
    filter.addEventListener('change', refresh);
    refresh();
  },
});
