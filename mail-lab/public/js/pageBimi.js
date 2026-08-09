Lab.registerPage('bimi', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'BIMI', route: 'bimi' });
    body.innerHTML = '';

    const { domains } = await Lab.fetchJSON('/api/dns/domains');
    const domainSelect = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, '-- choose a domain --'),
      ...domains.map((d) => Lab.el('option', { value: d }, d)),
    ]);
    const logoUrl = Lab.el('input', { type: 'text', placeholder: 'https://mycompany.local/logo.svg', value: 'https://mycompany.local/logo.svg' });
    const vmcUrl = Lab.el('input', { type: 'text', placeholder: '(optional) VMC certificate URL' });
    const publishOutput = Lab.el('div', {});
    const evalOutput = Lab.el('div', {});

    body.appendChild(Lab.el('h3', {}, 'Publish a BIMI record'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), domainSelect])]));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Logo URL (SVG)'), logoUrl]),
      Lab.el('div', {}, [Lab.el('label', {}, 'VMC URL'), vmcUrl]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainSelect.value) return;
        const res = await Lab.fetchJSON(`/api/bimi/${encodeURIComponent(domainSelect.value)}/record`, {
          method: 'POST', body: { logoUrl: logoUrl.value.trim(), vmcUrl: vmcUrl.value.trim() || undefined },
        });
        publishOutput.innerHTML = '';
        publishOutput.appendChild(Lab.el('pre', { class: 'code-block' }, `default._bimi.${domainSelect.value} TXT "${res.value}"`));
      },
    }, 'Publish'));
    body.appendChild(publishOutput);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Will the logo actually display?'));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainSelect.value) return;
        const res = await Lab.fetchJSON(`/api/bimi/${encodeURIComponent(domainSelect.value)}/evaluate`);
        evalOutput.innerHTML = '';
        evalOutput.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.display ? 'pass' : 'fail'}` }, res.display ? 'logo will display' : 'logo will NOT display')));
        evalOutput.appendChild(Lab.el('div', { class: 'email-preview' }, [
          Lab.el('div', { class: 'hdr-row' }, [
            Lab.el('span', { class: 'bimi-logo' }, res.display ? '✓' : (domainSelect.value[0] || '?').toUpperCase()),
            Lab.el('b', {}, `Alice <alice@${domainSelect.value}>`),
          ]),
          Lab.el('div', { class: 'subject' }, 'Example message'),
        ]));
        evalOutput.appendChild(Lab.el('pre', { class: 'trace-log' }, res.trace.join('\n')));
      },
    }, 'Check'));
    body.appendChild(evalOutput);
  },
});
