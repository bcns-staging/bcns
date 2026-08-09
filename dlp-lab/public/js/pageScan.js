Lab.registerPage('scan', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Scan Playground', route: 'scan' });
    body.innerHTML = '';

    const textInput = Lab.el('textarea', { style: 'min-height:160px;' }, 'Hi team,\n\nAttached is the customer export. John Smith\'s SSN is 123-45-6789 and his card on file is 4111 1111 1111 1111.\n\nThis is privileged and confidential -- do not distribute outside the finance team.');
    const output = Lab.el('div', {});

    body.appendChild(Lab.el('label', {}, 'Content to scan'));
    body.appendChild(textInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        output.innerHTML = '<p class="muted">Scanning...</p>';
        const res = await Lab.fetchJSON('/api/scan', { method: 'POST', body: { text: textInput.value } });
        output.innerHTML = '';

        const pct = Math.round(res.overallConfidence * 100);
        const overallClass = res.overallConfidence >= 0.7 ? 'high' : res.overallConfidence >= 0.3 ? 'medium' : 'low';
        output.appendChild(Lab.el('p', {}, [Lab.el('span', { class: `badge ${overallClass}` }, `${pct}% confidence sensitive`)]));

        function section(title, result, renderFinding) {
          output.appendChild(Lab.el('h4', {}, `${title} -- confidence ${Math.round(result.confidence * 100)}%`));
          if (!result.findings.length) {
            output.appendChild(Lab.el('p', { class: 'muted' }, 'No findings.'));
            return;
          }
          output.appendChild(Lab.el('ul', {}, result.findings.map((f) => Lab.el('li', {}, renderFinding(f)))));
        }

        section('Pattern Matching', res.results.pattern, (f) => `${f.name}: ${f.match}`);
        section('Keyword / Dictionary', res.results.keyword, (f) => `"${f.term}" (list: ${f.listName}${f.category ? `, ${f.category}` : ''})`);
        section('Proximity / Context', res.results.proximity, (f) => `${f.name} (context-confirmed)`);
        section('Exact Data Match', res.results.edm, (f) => `${f.type === 'composite' ? 'Composite match' : 'Single-field match'} in "${f.datasetName}" (${f.fields.join(', ')})`);
        section('Document Fingerprinting', res.results.fingerprint, (f) => `${f.overlapPct}% overlap with reference doc "${f.docName}" (${f.matchedChunks}/${f.totalChunks} chunks)`);
        section('Statistical Classifier', res.results.classifier, (f) => `Classified as "${f.label}" (${Object.entries(f.scores).map(([l, s]) => `${l}: ${Math.round(s * 100)}%`).join(', ')})`);
      },
    }, 'Scan'));
    body.appendChild(output);
  },
});
