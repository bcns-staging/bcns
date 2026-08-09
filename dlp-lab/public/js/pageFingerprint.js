Lab.registerPage('fingerprint', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Document Fingerprinting', route: 'fingerprint' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', { class: 'muted' }, [
      'Uses the reference documents you defined on ',
      Lab.el('a', { href: '#/datasets' }, 'Sensitive Data Sets'),
      '. Paste a snippet that includes a chunk copied from one of them (surrounded by unrelated text) to see partial-match detection in action.',
    ]));
    const textInput = Lab.el('textarea', { style: 'min-height:140px;' }, 'Paste some content here, including a paragraph or two copied from one of your reference documents...');
    const output = Lab.el('div', {});
    body.appendChild(textInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/scan', { method: 'POST', body: { text: textInput.value } });
        output.innerHTML = '';
        const { findings, confidence } = res.results.fingerprint;
        output.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${confidence >= 0.5 ? 'high' : confidence > 0 ? 'medium' : 'low'}` }, `${Math.round(confidence * 100)}% confidence`)));
        output.appendChild(findings.length
          ? Lab.el('table', { class: 'data-table' }, [
            Lab.el('tr', {}, [Lab.el('th', {}, 'Reference document'), Lab.el('th', {}, 'Overlap'), Lab.el('th', {}, 'Matched chunks')]),
            ...findings.map((f) => Lab.el('tr', {}, [Lab.el('td', {}, f.docName), Lab.el('td', {}, `${f.overlapPct}%`), Lab.el('td', {}, `${f.matchedChunks} / ${f.totalChunks}`)])),
          ])
          : Lab.el('p', { class: 'muted' }, 'No overlap with any reference document.'));
      },
    }, 'Scan'));
    body.appendChild(output);
  },
});
