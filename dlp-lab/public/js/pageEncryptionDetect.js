Lab.registerPage('encryption-detect', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Encrypted File Detection', route: 'encryption-detect' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Upload a password-protected zip/PDF, or any file with high-entropy (already-compressed or encrypted) content claiming to be a plain document, to see it flagged as uninspectable.'));
    const fileInput = Lab.el('input', { type: 'file' });
    const output = Lab.el('div', {});
    body.appendChild(fileInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!fileInput.files[0]) return;
        const form = new FormData();
        form.append('file', fileInput.files[0]);
        const res = await fetch('/api/file-tools/encryption', { method: 'POST', body: form }).then((r) => r.json());
        output.innerHTML = '';
        const badgeClass = res.verdict === 'encrypted' ? 'high' : res.verdict === 'likely-encrypted-or-opaque' ? 'medium' : 'low';
        output.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${badgeClass}` }, res.verdict)));
        if (res.reason) output.appendChild(Lab.el('p', {}, res.reason));
        output.appendChild(Lab.el('p', { class: 'muted' }, `Shannon entropy: ${res.entropy.toFixed(2)} bits/byte (random/encrypted data approaches 8.0; plain English text is typically 4-5)`));
      },
    }, 'Check'));
    body.appendChild(output);
  },
});
