Lab.registerPage('dkim', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'DKIM (DomainKeys Identified Mail)', route: 'dkim' });
    body.innerHTML = '';

    const { domains } = await Lab.fetchJSON('/api/dns/domains');
    const domainSelect = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, '-- choose a domain --'),
      ...domains.map((d) => Lab.el('option', { value: d }, d)),
    ]);

    const keysBox = Lab.el('div', {});
    const selectorInput = Lab.el('input', { type: 'text', placeholder: 'selector, e.g. sel1', value: 'sel1' });
    const genOutput = Lab.el('div', {});

    async function refreshKeys() {
      keysBox.innerHTML = '';
      if (!domainSelect.value) return;
      const { keys } = await Lab.fetchJSON(`/api/dkim/${encodeURIComponent(domainSelect.value)}/keys`);
      keysBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Selector'), Lab.el('th', {}, 'DNS name'), Lab.el('th', {}, 'Created')]),
        ...(keys.length ? keys.map((k) => Lab.el('tr', {}, [
          Lab.el('td', {}, k.selector),
          Lab.el('td', { class: 'mono' }, `${k.selector}._domainkey.${domainSelect.value}`),
          Lab.el('td', {}, new Date(k.createdAt).toLocaleString()),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '3', class: 'muted' }, 'No keys yet.'))]),
      ]));
      populateTrySelectors(keys.map((k) => k.selector));
    }
    domainSelect.addEventListener('change', refreshKeys);

    body.appendChild(Lab.el('h3', {}, 'Generate a DKIM keypair'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), domainSelect]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Selector'), selectorInput]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainSelect.value || !selectorInput.value.trim()) return;
        const key = await Lab.fetchJSON(`/api/dkim/${encodeURIComponent(domainSelect.value)}/keys`, {
          method: 'POST', body: { selector: selectorInput.value.trim() },
        });
        genOutput.innerHTML = '';
        genOutput.appendChild(Lab.el('p', {}, `Key generated and public key published to DNS at ${key.selector}._domainkey.${key.domain}:`));
        genOutput.appendChild(Lab.el('pre', { class: 'code-block' }, key.dnsValue));
        genOutput.appendChild(Lab.el('p', {}, [Lab.el('b', {}, 'Private key'), ' (kept secret on a real mail server -- shown here only because this is your local lab):']));
        genOutput.appendChild(Lab.el('pre', { class: 'code-block' }, key.privateKeyPem));
        await refreshKeys();
      },
    }, 'Generate Key'));
    body.appendChild(genOutput);

    body.appendChild(Lab.el('h3', {}, 'Existing keys'));
    body.appendChild(keysBox);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Sign & verify a test message'));
    const trySelector = Lab.el('select', {});
    const tryFrom = Lab.el('input', { type: 'text', placeholder: 'from@domain', value: '' });
    const tryTo = Lab.el('input', { type: 'text', placeholder: 'to@example.com', value: 'recipient@example.com' });
    const trySubject = Lab.el('input', { type: 'text', placeholder: 'Subject', value: 'Test message' });
    const tryBody = Lab.el('textarea', { placeholder: 'message body' }, 'Hello, this is a DKIM test.');
    const tryOutput = Lab.el('div', {});

    function populateTrySelectors(selectors) {
      trySelector.innerHTML = '';
      for (const s of selectors) trySelector.appendChild(Lab.el('option', { value: s }, s));
    }

    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Sign with selector'), trySelector]),
      Lab.el('div', {}, [Lab.el('label', {}, 'From'), tryFrom]),
      Lab.el('div', {}, [Lab.el('label', {}, 'To'), tryTo]),
    ]));
    body.appendChild(Lab.el('label', {}, 'Subject'));
    body.appendChild(trySubject);
    body.appendChild(Lab.el('label', {}, 'Body'));
    body.appendChild(tryBody);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainSelect.value) { alert('Choose a domain and generate a key first.'); return; }
        const from = tryFrom.value.trim() || `demo@${domainSelect.value}`;
        const res = await Lab.fetchJSON(`/api/dkim/${encodeURIComponent(domainSelect.value)}/try-sign`, {
          method: 'POST',
          body: { selector: trySelector.value, from, to: tryTo.value, subject: trySubject.value, body: tryBody.value },
        });
        tryOutput.innerHTML = '';
        tryOutput.appendChild(Lab.el('h4', {}, 'Generated DKIM-Signature header'));
        tryOutput.appendChild(Lab.el('pre', { class: 'code-block' }, res.header));
        tryOutput.appendChild(Lab.el('h4', {}, 'Exact bytes that were signed (canonicalized headers)'));
        tryOutput.appendChild(Lab.el('pre', { class: 'code-block' }, res.dataToSign));
        tryOutput.appendChild(Lab.el('h4', {}, 'Verification result'));
        tryOutput.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.verification.valid ? 'pass' : 'fail'}` }, res.verification.valid ? 'valid' : 'invalid')));
        if (res.verification.reasons.length) tryOutput.appendChild(Lab.el('pre', { class: 'trace-log' }, res.verification.reasons.join('\n')));
      },
    }, 'Sign & Verify'));
    body.appendChild(tryOutput);

    if (domainSelect.value) refreshKeys();
  },
});
