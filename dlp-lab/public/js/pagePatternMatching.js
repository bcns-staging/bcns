Lab.registerPage('pattern-matching', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Pattern Matching', route: 'pattern-matching' });
    body.innerHTML = '';

    const { patterns } = await Lab.fetchJSON('/api/scan/pattern-types');
    body.appendChild(Lab.el('h3', {}, 'Supported pattern types'));
    body.appendChild(Lab.el('table', { class: 'data-table' }, [
      Lab.el('tr', {}, [Lab.el('th', {}, 'Type'), Lab.el('th', {}, 'Weight'), Lab.el('th', {}, 'Checksum-validated?')]),
      ...patterns.map((p) => Lab.el('tr', {}, [Lab.el('td', {}, p.name), Lab.el('td', {}, String(p.weight)), Lab.el('td', {}, p.hasChecksum ? 'Yes' : 'No')])),
    ]));

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Try it'));
    const textInput = Lab.el('textarea', {}, 'Valid card: 4111 1111 1111 1111\nInvalid (fails Luhn): 4111 1111 1111 1112\nValid IBAN: GB29 NWBK 6016 1331 9268 19\nSSN: 123-45-6789 (invalid area: 900-12-3456)');
    const output = Lab.el('div', {});
    body.appendChild(textInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/scan', { method: 'POST', body: { text: textInput.value } });
        output.innerHTML = '';
        const { findings, confidence } = res.results.pattern;
        output.appendChild(Lab.el('p', {}, `Confidence: ${Math.round(confidence * 100)}%`));
        output.appendChild(Lab.el('table', { class: 'data-table' }, [
          Lab.el('tr', {}, [Lab.el('th', {}, 'Type'), Lab.el('th', {}, 'Redacted match'), Lab.el('th', {}, 'Weight')]),
          ...(findings.length ? findings.map((f) => Lab.el('tr', {}, [Lab.el('td', {}, f.name), Lab.el('td', { class: 'mono' }, f.match), Lab.el('td', {}, String(f.weight))])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '3', class: 'muted' }, 'No valid matches (note: the invalid card and invalid SSN above are correctly rejected).'))]),
        ]));
      },
    }, 'Scan'));
    body.appendChild(output);
  },
});
