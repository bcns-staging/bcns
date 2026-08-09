Lab.registerPage('keyword-proximity', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Keyword & Proximity Matching', route: 'keyword-proximity' });
    body.innerHTML = '';

    const { patterns: proximityTypes } = await Lab.fetchJSON('/api/scan/proximity-types');
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Keyword matching uses the lists you defined on the Sensitive Data Sets page. Proximity matching looks for these unformatted patterns, but only counts them when a supporting keyword appears nearby:'));
    body.appendChild(Lab.el('table', { class: 'data-table' }, [
      Lab.el('tr', {}, [Lab.el('th', {}, 'Loose pattern'), Lab.el('th', {}, 'Required nearby context')]),
      ...proximityTypes.map((p) => Lab.el('tr', {}, [Lab.el('td', {}, p.name), Lab.el('td', { class: 'mono' }, p.contextTerms.join(', '))])),
    ]));

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Try it'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Compare these two: same 9-digit number, one with SSN context and one without.'));
    const textInput = Lab.el('textarea', {}, 'The SSN on file is 123456789.\nThe tracking number is 123456789.');
    const output = Lab.el('div', {});
    body.appendChild(textInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/scan', { method: 'POST', body: { text: textInput.value } });
        output.innerHTML = '';
        output.appendChild(Lab.el('h4', {}, `Keyword matches (confidence ${Math.round(res.results.keyword.confidence * 100)}%)`));
        output.appendChild(res.results.keyword.findings.length
          ? Lab.el('ul', {}, res.results.keyword.findings.map((f) => Lab.el('li', {}, `"${f.term}" (${f.listName})`)))
          : Lab.el('p', { class: 'muted' }, 'No keyword matches -- add lists on the Sensitive Data Sets page.'));
        output.appendChild(Lab.el('h4', {}, `Proximity matches (confidence ${Math.round(res.results.proximity.confidence * 100)}%)`));
        output.appendChild(res.results.proximity.findings.length
          ? Lab.el('ul', {}, res.results.proximity.findings.map((f) => Lab.el('li', {}, `${f.name} at position ${f.index} -- context confirmed`)))
          : Lab.el('p', { class: 'muted' }, 'No context-confirmed matches.'));
      },
    }, 'Scan'));
    body.appendChild(output);
  },
});
