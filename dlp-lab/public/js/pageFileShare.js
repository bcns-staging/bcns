Lab.registerPage('file-share', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Data-at-Rest File Share', route: 'file-share' });
    body.innerHTML = '';

    const { labels } = await Lab.fetchJSON('/api/labels');
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Populate a virtual file share, then run a discovery scan -- exactly like a periodic DLP job re-scanning network storage. Create a policy tagged with the "file-share" channel on the Policy Builder page first.'));

    const filesBox = Lab.el('div', {});
    async function refreshFiles() {
      const { files } = await Lab.fetchJSON('/api/channels/file-share/files');
      filesBox.innerHTML = '';
      filesBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Filename'), Lab.el('th', {}, 'Label'), Lab.el('th', {}, '')]),
        ...(files.length ? files.map((f) => Lab.el('tr', {}, [
          Lab.el('td', {}, f.filename),
          Lab.el('td', {}, Lab.el('span', { class: 'label-tag' }, f.label)),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/channels/file-share/files/${f.id}`, { method: 'DELETE' }); refreshFiles(); } }, 'Delete')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '3', class: 'muted' }, 'No files yet.'))]),
      ]));
    }

    body.appendChild(Lab.el('h3', {}, 'File share contents'));
    body.appendChild(filesBox);

    const filenameInput = Lab.el('input', { type: 'text', placeholder: 'e.g. customers.csv' });
    const labelSelect = Lab.el('select', {}, labels.map((l) => Lab.el('option', { value: l.name }, l.name)));
    const contentInput = Lab.el('textarea', { placeholder: 'file content' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Filename'), filenameInput]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Label'), labelSelect]),
    ]));
    body.appendChild(Lab.el('label', {}, 'Content'));
    body.appendChild(contentInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!filenameInput.value.trim() || !contentInput.value.trim()) return;
        await Lab.fetchJSON('/api/channels/file-share/files', { method: 'POST', body: { filename: filenameInput.value.trim(), content: contentInput.value, label: labelSelect.value } });
        filenameInput.value = ''; contentInput.value = '';
        refreshFiles();
      },
    }, 'Add file'));

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Discovery scan'));
    const scanOutput = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        scanOutput.innerHTML = '<p class="muted">Scanning...</p>';
        const { results } = await Lab.fetchJSON('/api/channels/file-share/scan', { method: 'POST' });
        scanOutput.innerHTML = '';
        scanOutput.appendChild(Lab.el('table', { class: 'data-table' }, [
          Lab.el('tr', {}, [Lab.el('th', {}, 'File'), Lab.el('th', {}, 'Label'), Lab.el('th', {}, 'Result')]),
          ...results.map((r) => Lab.el('tr', {}, [
            Lab.el('td', {}, r.file.filename),
            Lab.el('td', {}, Lab.el('span', { class: 'label-tag' }, r.file.label)),
            Lab.el('td', {}, r.evaluation.worst ? Lab.el('span', { class: `badge ${r.evaluation.worst.action}` }, `${r.evaluation.worst.action} (${r.evaluation.worst.policyName})`) : Lab.el('span', { class: 'badge low' }, 'clean')),
          ])),
        ]));
      },
    }, 'Run discovery scan'));
    body.appendChild(scanOutput);

    refreshFiles();
  },
});
