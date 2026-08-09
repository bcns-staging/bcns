Lab.registerPage('archive', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Archive Inspection', route: 'archive' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Upload a .zip file (try including a text file with an SSN or credit card in it, or even a zip-inside-a-zip) to see it recursively unpacked and scanned.'));
    const fileInput = Lab.el('input', { type: 'file', accept: '.zip' });
    const output = Lab.el('div', {});
    body.appendChild(fileInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!fileInput.files[0]) return;
        const form = new FormData();
        form.append('file', fileInput.files[0]);
        output.innerHTML = '<p class="muted">Scanning...</p>';
        const res = await fetch('/api/file-tools/archive', { method: 'POST', body: form }).then((r) => r.json());
        output.innerHTML = '';
        if (res.error) { output.appendChild(Lab.el('p', { class: 'error-block' }, res.error)); return; }
        output.appendChild(Lab.el('p', {}, `${res.totalEntries} file(s) found${res.truncated ? ` (${res.truncationReason})` : ''}.`));
        output.appendChild(renderEntries(res.entries));
      },
    }, 'Inspect archive'));
    body.appendChild(output);

    function renderEntries(entries) {
      return Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Path'), Lab.el('th', {}, 'Type'), Lab.el('th', {}, 'Result')]),
        ...entries.map((e) => {
          let resultCell;
          if (e.nested) {
            resultCell = Lab.el('div', {}, [
              Lab.el('p', { class: 'muted' }, `nested archive: ${e.nested.totalEntries} file(s)`),
              renderEntries(e.nested.entries),
            ]);
          } else if (e.verdict === 'uninspectable') {
            resultCell = Lab.el('span', { class: 'badge medium' }, `uninspectable -- ${e.reason}`);
          } else if (e.verdict === 'not-text-scanned') {
            resultCell = Lab.el('span', { class: 'badge low' }, 'binary/non-text, not scanned');
          } else if (e.error) {
            resultCell = Lab.el('span', { class: 'badge medium' }, e.error);
          } else {
            const pct = Math.round((e.overallConfidence || 0) * 100);
            resultCell = Lab.el('span', { class: `badge ${pct >= 70 ? 'high' : pct > 0 ? 'medium' : 'low'}` }, `${pct}% confidence sensitive`);
          }
          return Lab.el('tr', {}, [Lab.el('td', { class: 'mono' }, e.path), Lab.el('td', {}, e.type || '-'), Lab.el('td', {}, resultCell)]);
        }),
      ]);
    }
  },
});
