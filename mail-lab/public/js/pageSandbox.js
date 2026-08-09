Lab.registerPage('sandbox', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Attachment Sandbox', route: 'sandbox' });
    body.innerHTML = '';

    const fileInput = Lab.el('input', { type: 'file' });
    const output = Lab.el('div', {});

    body.appendChild(Lab.el('h3', {}, 'Upload a file to analyze'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Nothing is executed -- this only inspects the filename, extension, and hash. Try renaming a text file to "invoice.pdf.exe" or "notes.docm" to see the heuristics trigger.'));
    body.appendChild(fileInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!fileInput.files[0]) return;
        const form = new FormData();
        form.append('file', fileInput.files[0]);
        const res = await fetch('/api/sandbox/analyze', { method: 'POST', body: form }).then((r) => r.json());
        output.innerHTML = '';
        output.appendChild(Lab.el('p', {}, [
          Lab.el('span', { class: `badge ${res.verdict}` }, res.verdict),
          ` ${res.filename} (${res.sizeBytes} bytes)`,
        ]));
        if (res.hash) output.appendChild(Lab.el('p', { class: 'muted mono' }, `sha256: ${res.hash}`));
        for (const r of res.reasons || []) output.appendChild(Lab.el('p', {}, `- ${r}`));
      },
    }, 'Analyze'));
    body.appendChild(output);
  },
});
