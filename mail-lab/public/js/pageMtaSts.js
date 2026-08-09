Lab.registerPage('mta-sts', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'MTA-STS', route: 'mta-sts' });
    body.innerHTML = '';

    const { domains } = await Lab.fetchJSON('/api/dns/domains');
    const domainSelect = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, '-- choose a domain --'),
      ...domains.map((d) => Lab.el('option', { value: d }, d)),
    ]);
    const modeSelect = Lab.el('select', {}, ['enforce', 'testing', 'none'].map((v) => Lab.el('option', { value: v }, v)));
    const mxInput = Lab.el('input', { type: 'text', placeholder: 'mail.mycompany.local (comma separated, supports *.domain)' });
    const maxAgeInput = Lab.el('input', { type: 'number', value: '604800' });
    const policyOutput = Lab.el('div', {});

    body.appendChild(Lab.el('h3', {}, 'Publish an MTA-STS policy'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), domainSelect])]));
    body.appendChild(Lab.el('div', { class: 'card-grid' }, [
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'mode'), modeSelect]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'mx hosts'), mxInput]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'max_age (seconds)'), maxAgeInput]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainSelect.value) return;
        const policy = await Lab.fetchJSON(`/api/mta-sts/${encodeURIComponent(domainSelect.value)}/policy`, {
          method: 'POST',
          body: { mode: modeSelect.value, mx: mxInput.value, maxAge: maxAgeInput.value },
        });
        const fileText = await fetch(`/api/mta-sts/${encodeURIComponent(domainSelect.value)}/policy-file`).then((r) => r.text());
        policyOutput.innerHTML = '';
        policyOutput.appendChild(Lab.el('p', {}, `Published _mta-sts.${domainSelect.value} TXT record (id=${policy.policy.id}) and the policy file it points to:`));
        policyOutput.appendChild(Lab.el('pre', { class: 'code-block' }, fileText));
      },
    }, 'Publish policy'));
    body.appendChild(policyOutput);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Test a delivery attempt'));
    const testMxHost = Lab.el('input', { type: 'text', placeholder: 'MX host actually connected to' });
    const testTls = Lab.el('input', { type: 'checkbox', checked: '' });
    const testOutput = Lab.el('div', {});
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Connecting MX host'), testMxHost]),
      Lab.el('div', {}, [Lab.el('label', {}, [testTls, ' TLS available on this connection'])]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainSelect.value) return;
        const res = await Lab.fetchJSON(`/api/mta-sts/${encodeURIComponent(domainSelect.value)}/evaluate`, {
          method: 'POST',
          body: { mxHost: testMxHost.value, tlsAvailable: testTls.checked },
        });
        testOutput.innerHTML = '';
        testOutput.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.allowed ? 'pass' : 'fail'}` }, res.allowed ? 'delivery allowed' : 'delivery blocked')));
        testOutput.appendChild(Lab.el('pre', { class: 'trace-log' }, res.trace.join('\n')));
      },
    }, 'Evaluate'));
    body.appendChild(testOutput);
  },
});
