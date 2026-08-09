Lab.registerPage('tls-rpt', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'TLS-RPT', route: 'tls-rpt' });
    body.innerHTML = '';

    const { domains } = await Lab.fetchJSON('/api/dns/domains');
    const domainSelect = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, '-- choose a domain --'),
      ...domains.map((d) => Lab.el('option', { value: d }, d)),
    ]);
    const ruaInput = Lab.el('input', { type: 'text', placeholder: 'mailto:tls-reports@mycompany.local' });
    const recordOutput = Lab.el('div', {});

    body.appendChild(Lab.el('h3', {}, 'Publish a TLS-RPT record'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), domainSelect]),
      Lab.el('div', {}, [Lab.el('label', {}, 'rua (report destination)'), ruaInput]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainSelect.value || !ruaInput.value.trim()) return;
        const res = await Lab.fetchJSON(`/api/tls-rpt/${encodeURIComponent(domainSelect.value)}/record`, { method: 'POST', body: { rua: ruaInput.value.trim() } });
        recordOutput.innerHTML = '';
        recordOutput.appendChild(Lab.el('pre', { class: 'code-block' }, `_smtp._tls.${domainSelect.value} TXT "${res.record}"`));
      },
    }, 'Publish record'));
    body.appendChild(recordOutput);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Simulate delivery attempts'));
    const mxHost = Lab.el('input', { type: 'text', placeholder: 'mail.mycompany.local' });
    const success = Lab.el('input', { type: 'checkbox', checked: '' });
    const reason = Lab.el('input', { type: 'text', placeholder: 'failure reason (if not successful), e.g. certificate-expired' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'MX host'), mxHost]),
      Lab.el('div', {}, [Lab.el('label', {}, [success, ' Successful'])]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Failure reason'), reason]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainSelect.value || !mxHost.value.trim()) return;
        await Lab.fetchJSON(`/api/tls-rpt/${encodeURIComponent(domainSelect.value)}/simulate-delivery`, {
          method: 'POST',
          body: { mxHost: mxHost.value.trim(), success: success.checked, failureReason: success.checked ? undefined : (reason.value.trim() || 'validation-failure') },
        });
      },
    }, 'Record this attempt'));

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Aggregate report'));
    const reportOutput = Lab.el('pre', { class: 'code-block' }, '');
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainSelect.value) return;
        const report = await Lab.fetchJSON(`/api/tls-rpt/${encodeURIComponent(domainSelect.value)}/report`);
        reportOutput.textContent = JSON.stringify(report, null, 2);
      },
    }, 'Generate report'));
    body.appendChild(reportOutput);
  },
});
