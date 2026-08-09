Lab.registerPage('datasets', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Sensitive Data Sets', route: 'datasets' });
    body.innerHTML = '';

    // --- Keyword lists ---
    body.appendChild(Lab.el('h3', {}, 'Keyword / Dictionary Lists'));
    const kwBox = Lab.el('div', {});
    async function refreshKeywordLists() {
      const { 'keyword-lists': lists } = await Lab.fetchJSON('/api/datasets/keyword-lists');
      kwBox.innerHTML = '';
      kwBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Category'), Lab.el('th', {}, 'Terms'), Lab.el('th', {}, '')]),
        ...(lists.length ? lists.map((l) => Lab.el('tr', {}, [
          Lab.el('td', {}, l.name),
          Lab.el('td', {}, l.category || '-'),
          Lab.el('td', { class: 'mono' }, (l.terms || []).join(', ')),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/datasets/keyword-lists/${l.id}`, { method: 'DELETE' }); refreshKeywordLists(); } }, 'Delete')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '4', class: 'muted' }, 'No keyword lists yet.'))]),
      ]));
    }
    const kwName = Lab.el('input', { type: 'text', placeholder: 'e.g. Legal Terms' });
    const kwCategory = Lab.el('input', { type: 'text', placeholder: 'e.g. Confidential' });
    const kwTerms = Lab.el('textarea', { placeholder: 'one term per line, e.g.\nprivileged and confidential\ndo not distribute\nattorney-client' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'List name'), kwName]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Category'), kwCategory]),
    ]));
    body.appendChild(Lab.el('label', {}, 'Terms (one per line)'));
    body.appendChild(kwTerms);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const terms = kwTerms.value.split('\n').map((s) => s.trim()).filter(Boolean);
        if (!kwName.value.trim() || !terms.length) return;
        await Lab.fetchJSON('/api/datasets/keyword-lists', { method: 'POST', body: { name: kwName.value.trim(), category: kwCategory.value.trim(), terms } });
        kwName.value = ''; kwCategory.value = ''; kwTerms.value = '';
        refreshKeywordLists();
      },
    }, 'Add keyword list'));
    body.appendChild(kwBox);

    body.appendChild(Lab.el('hr', { class: 'sep' }));

    // --- EDM datasets ---
    body.appendChild(Lab.el('h3', {}, 'Exact Data Match -- Sensitive Record Sets'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Records are hashed (never stored in plaintext for matching) the moment you use them on the Exact Data Match page -- here you\'re just defining the source data.'));
    const edmBox = Lab.el('div', {});
    async function refreshEdm() {
      const { 'edm-datasets': sets } = await Lab.fetchJSON('/api/datasets/edm-datasets');
      edmBox.innerHTML = '';
      edmBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Fields'), Lab.el('th', {}, 'Records'), Lab.el('th', {}, '')]),
        ...(sets.length ? sets.map((s) => Lab.el('tr', {}, [
          Lab.el('td', {}, s.name),
          Lab.el('td', { class: 'mono' }, (s.fields || []).join(', ')),
          Lab.el('td', {}, String((s.records || []).length)),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/datasets/edm-datasets/${s.id}`, { method: 'DELETE' }); refreshEdm(); } }, 'Delete')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '4', class: 'muted' }, 'No datasets yet.'))]),
      ]));
    }
    const edmName = Lab.el('input', { type: 'text', placeholder: 'e.g. Customer PII Export' });
    const edmFields = Lab.el('input', { type: 'text', placeholder: 'e.g. name,ssn', value: 'name,ssn' });
    const edmRecords = Lab.el('textarea', { placeholder: 'one record per line, matching the fields above, e.g.\nJohn Smith,123-45-6789\nJane Doe,987-65-4321' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Dataset name'), edmName]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Fields (comma-separated column names)'), edmFields]),
    ]));
    body.appendChild(Lab.el('label', {}, 'Records (one per line, comma-separated values)'));
    body.appendChild(edmRecords);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const fields = edmFields.value.split(',').map((s) => s.trim()).filter(Boolean);
        const records = edmRecords.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(',').map((v) => v.trim()));
        if (!edmName.value.trim() || !fields.length || !records.length) return;
        await Lab.fetchJSON('/api/datasets/edm-datasets', { method: 'POST', body: { name: edmName.value.trim(), fields, records } });
        edmName.value = ''; edmRecords.value = '';
        refreshEdm();
      },
    }, 'Add dataset'));
    body.appendChild(edmBox);

    body.appendChild(Lab.el('hr', { class: 'sep' }));

    // --- Fingerprint reference documents ---
    body.appendChild(Lab.el('h3', {}, 'Document Fingerprinting -- Reference Documents'));
    const fpBox = Lab.el('div', {});
    async function refreshFingerprints() {
      const { 'fingerprint-docs': docs } = await Lab.fetchJSON('/api/datasets/fingerprint-docs');
      fpBox.innerHTML = '';
      fpBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Length'), Lab.el('th', {}, '')]),
        ...(docs.length ? docs.map((d) => Lab.el('tr', {}, [
          Lab.el('td', {}, d.name),
          Lab.el('td', {}, `${d.text.length} chars`),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/datasets/fingerprint-docs/${d.id}`, { method: 'DELETE' }); refreshFingerprints(); } }, 'Delete')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '3', class: 'muted' }, 'No reference documents yet.'))]),
      ]));
    }
    const fpName = Lab.el('input', { type: 'text', placeholder: 'e.g. Q3 Board Deck' });
    const fpText = Lab.el('textarea', { placeholder: 'Paste the reference document text here...' });
    body.appendChild(Lab.el('label', {}, 'Document name'));
    body.appendChild(fpName);
    body.appendChild(Lab.el('label', {}, 'Document text'));
    body.appendChild(fpText);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!fpName.value.trim() || !fpText.value.trim()) return;
        await Lab.fetchJSON('/api/datasets/fingerprint-docs', { method: 'POST', body: { name: fpName.value.trim(), text: fpText.value } });
        fpName.value = ''; fpText.value = '';
        refreshFingerprints();
      },
    }, 'Add reference document'));
    body.appendChild(fpBox);

    refreshKeywordLists();
    refreshEdm();
    refreshFingerprints();
  },
});
