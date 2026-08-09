Lab.registerPage('file-type', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'File Type Sniffing', route: 'file-type' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Try renaming any executable or script on your machine to end in ".pdf" or ".docx" and upload it here -- the extension won\'t fool the byte-level check.'));
    const fileInput = Lab.el('input', { type: 'file' });
    const output = Lab.el('div', {});
    body.appendChild(fileInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!fileInput.files[0]) return;
        const form = new FormData();
        form.append('file', fileInput.files[0]);
        const res = await fetch('/api/file-tools/file-type', { method: 'POST', body: form }).then((r) => r.json());
        output.innerHTML = '';
        output.appendChild(Lab.el('p', {}, [
          Lab.el('span', { class: `badge ${res.mismatch ? 'high' : 'low'}` }, res.mismatch ? 'mismatch detected' : 'matches claimed type'),
        ]));
        output.appendChild(Lab.el('table', { class: 'data-table' }, [
          Lab.el('tr', {}, [Lab.el('th', {}, 'Filename'), Lab.el('td', {}, res.filename)]),
          Lab.el('tr', {}, [Lab.el('th', {}, 'Claimed extension'), Lab.el('td', {}, `.${res.claimedExtension || '(none)'}`)]),
          Lab.el('tr', {}, [Lab.el('th', {}, 'Detected type (magic bytes)'), Lab.el('td', {}, `${res.detected.type} (${res.detected.family})`)]),
          Lab.el('tr', {}, [Lab.el('th', {}, 'Size'), Lab.el('td', {}, `${res.sizeBytes} bytes`)]),
        ]));
      },
    }, 'Check file type'));
    body.appendChild(output);
  },
});
