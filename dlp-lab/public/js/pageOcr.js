Lab.registerPage('ocr', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'OCR on Images', route: 'ocr' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Upload a screenshot or photo containing text (e.g. a screenshot of a spreadsheet with an SSN in it). The first run downloads OCR language data over the network and may take a moment; after that it\'s cached locally.'));
    const fileInput = Lab.el('input', { type: 'file', accept: 'image/*' });
    const output = Lab.el('div', {});
    body.appendChild(fileInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!fileInput.files[0]) return;
        const form = new FormData();
        form.append('file', fileInput.files[0]);
        output.innerHTML = '<p class="muted">Running OCR... the very first run on this machine downloads language data and can take a couple of minutes; every run after that is fast.</p>';
        const res = await fetch('/api/file-tools/ocr', { method: 'POST', body: form }).then((r) => r.json());
        output.innerHTML = '';
        if (!res.ok) { output.appendChild(Lab.el('p', { class: 'error-block' }, res.error)); return; }
        output.appendChild(Lab.el('h4', {}, 'Extracted text'));
        output.appendChild(Lab.el('pre', { class: 'code-block' }, res.extractedText || '(no text detected)'));
        output.appendChild(Lab.el('h4', {}, `Detection results -- ${Math.round(res.overallConfidence * 100)}% confidence sensitive`));
        for (const [key, result] of Object.entries(res.results)) {
          if (!result.findings.length) continue;
          output.appendChild(Lab.el('p', {}, `${key}: ${result.findings.length} finding(s)`));
        }
      },
    }, 'Run OCR'));
    body.appendChild(output);
  },
});
