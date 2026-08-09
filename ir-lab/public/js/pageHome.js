Lab.registerPage('home', {
  async render(container) {
    container.innerHTML = '';
    const wrap = Lab.el('div', { class: 'page' });
    wrap.appendChild(Lab.el('h1', {}, 'Incident Response'));
    wrap.appendChild(Lab.el('p', { class: 'muted' }, "You're the Incident Commander. Pick a scenario, make the calls, and see how it plays out — every choice has a real consequence, and every consequence is grounded in real IR doctrine. Each scenario has multiple endings; a wrong call doesn't end the game, it makes things worse and you keep managing the fallout."));

    const grid = Lab.el('div', { class: 'card-grid' });
    wrap.appendChild(grid);
    container.appendChild(wrap);

    const { scenarios } = await Lab.fetchJSON('/api/scenarios');
    grid.innerHTML = '';
    for (const s of scenarios) {
      grid.appendChild(Lab.el('div', { class: 'card scenario-card' }, [
        Lab.el('h4', {}, s.title),
        Lab.el('div', { class: 'tagline' }, s.tagline),
        Lab.el('div', { class: 'best-grade' }, s.bestGrade
          ? ['Best run: ', Lab.el('span', { class: `badge ${Lab.letterClass(s.bestGrade.letter)}` }, `${s.bestGrade.letter} (${s.bestGrade.composite})`)]
          : 'Not yet played'),
        Lab.el('a', { class: 'btn', href: `#/play?scenario=${s.id}`, style: 'text-decoration:none; text-align:center; display:block;' }, 'Start'),
      ]));
    }
  },
});
