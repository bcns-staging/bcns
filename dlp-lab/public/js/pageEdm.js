Lab.registerPage('edm', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Exact Data Match (EDM)', route: 'edm' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'See the hashing in action'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Type a value below and watch it get normalized and salted-hashed exactly the way EDM indexes and matches values -- the raw value is never what gets compared.'));
    const hashValue = Lab.el('input', { type: 'text', placeholder: 'e.g. 123-45-6789', value: '123-45-6789' });
    const hashIsNumeric = Lab.el('input', { type: 'checkbox', checked: '' });
    const hashOutput = Lab.el('pre', { class: 'code-block' }, '');
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Value'), hashValue]),
      Lab.el('div', {}, [Lab.el('label', {}, [hashIsNumeric, ' Numeric field (strip non-digits before hashing)'])]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/scan/edm-hash-preview', { method: 'POST', body: { value: hashValue.value, isNumeric: hashIsNumeric.checked } });
        hashOutput.textContent = `normalized: "${res.normalized}"\nHMAC-SHA256: ${res.hash}`;
      },
    }, 'Hash it'));
    body.appendChild(hashOutput);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Try matching against your datasets'));
    body.appendChild(Lab.el('p', { class: 'muted' }, [
      'Uses the record sets you defined on ',
      Lab.el('a', { href: '#/datasets' }, 'Sensitive Data Sets'),
      '. Try a name+SSN pair that IS in your dataset (composite match), then just the name with a wrong SSN (single-field match only).',
    ]));
    const textInput = Lab.el('textarea', {}, 'Please process John Smith, SSN 123-45-6789, for onboarding.');
    const output = Lab.el('div', {});
    body.appendChild(textInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/scan', { method: 'POST', body: { text: textInput.value } });
        output.innerHTML = '';
        const { findings, confidence } = res.results.edm;
        output.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${confidence >= 0.9 ? 'high' : confidence > 0 ? 'medium' : 'low'}` }, `${Math.round(confidence * 100)}% confidence`)));
        output.appendChild(findings.length
          ? Lab.el('ul', {}, findings.map((f) => Lab.el('li', {}, `${f.type === 'composite' ? 'Composite match (high confidence)' : 'Single-field match (lower confidence)'} in "${f.datasetName}": ${f.fields.join(' + ')}`)))
          : Lab.el('p', { class: 'muted' }, 'No matches against your configured datasets.'));
      },
    }, 'Scan'));
    body.appendChild(output);
  },
});
