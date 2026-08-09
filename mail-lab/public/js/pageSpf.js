Lab.registerPage('spf', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'SPF (Sender Policy Framework)', route: 'spf' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'Build & publish an SPF record'));
    const domainSelect = Lab.el('select', {});
    const mechInputs = {
      ip4: Lab.el('input', { type: 'text', placeholder: 'e.g. 203.0.113.10 or 203.0.113.0/24' }),
      a: Lab.el('input', { type: 'text', placeholder: 'leave blank to mean "this domain"' }),
      mx: Lab.el('input', { type: 'text', placeholder: 'leave blank to mean "this domain"' }),
      include: Lab.el('input', { type: 'text', placeholder: 'e.g. _spf.otherdomain.local' }),
    };
    const allSelect = Lab.el('select', {}, [
      Lab.el('option', { value: '-all' }, '-all (fail: reject anything not listed)'),
      Lab.el('option', { value: '~all' }, '~all (softfail: mark suspicious)'),
      Lab.el('option', { value: '?all' }, '?all (neutral: no opinion)'),
      Lab.el('option', { value: '+all' }, '+all (pass: allow anyone -- dangerous, for demo only)'),
    ]);
    const preview = Lab.el('pre', { class: 'code-block' }, 'v=spf1 -all');
    const saveMsg = Lab.el('span', { class: 'muted' }, '');

    function buildRecord() {
      const terms = ['v=spf1'];
      if (mechInputs.ip4.value.trim()) for (const v of mechInputs.ip4.value.split(',').map((s) => s.trim()).filter(Boolean)) terms.push(`ip4:${v}`);
      if (mechInputs.a.dataset.on === '1') terms.push(mechInputs.a.value.trim() ? `a:${mechInputs.a.value.trim()}` : 'a');
      if (mechInputs.mx.dataset.on === '1') terms.push(mechInputs.mx.value.trim() ? `mx:${mechInputs.mx.value.trim()}` : 'mx');
      if (mechInputs.include.value.trim()) for (const v of mechInputs.include.value.split(',').map((s) => s.trim()).filter(Boolean)) terms.push(`include:${v}`);
      terms.push(allSelect.value);
      preview.textContent = terms.join(' ');
    }
    [mechInputs.ip4, mechInputs.include, allSelect].forEach((el) => el.addEventListener('input', buildRecord));
    allSelect.addEventListener('change', buildRecord);

    const aToggle = Lab.el('label', {}, [Lab.el('input', { type: 'checkbox', onchange: (e) => { mechInputs.a.dataset.on = e.target.checked ? '1' : '0'; buildRecord(); } }), ' include "a" mechanism']);
    const mxToggle = Lab.el('label', {}, [Lab.el('input', { type: 'checkbox', onchange: (e) => { mechInputs.mx.dataset.on = e.target.checked ? '1' : '0'; buildRecord(); } }), ' include "mx" mechanism']);

    async function loadDomains(select) {
      const { domains } = await Lab.fetchJSON('/api/dns/domains');
      select.innerHTML = '';
      select.appendChild(Lab.el('option', { value: '' }, '-- choose a domain --'));
      for (const d of domains) select.appendChild(Lab.el('option', { value: d }, d));
    }
    loadDomains(domainSelect);

    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), domainSelect]),
    ]));
    body.appendChild(Lab.el('div', { class: 'card-grid' }, [
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'ip4 (comma separated)'), mechInputs.ip4]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'a'), aToggle, mechInputs.a]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'mx'), mxToggle, mechInputs.mx]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'include (comma separated)'), mechInputs.include]),
    ]));
    body.appendChild(Lab.el('label', {}, 'Catch-all'));
    body.appendChild(allSelect);
    body.appendChild(Lab.el('h4', {}, 'Record preview'));
    body.appendChild(preview);
    body.appendChild(Lab.el('div', {}, [
      Lab.el('button', {
        onclick: async () => {
          const domain = domainSelect.value;
          if (!domain) { saveMsg.textContent = 'Choose a domain first.'; return; }
          await Lab.fetchJSON(`/api/dns/${encodeURIComponent(domain)}/records`, {
            method: 'POST',
            body: { name: domain, type: 'TXT', value: preview.textContent },
          });
          saveMsg.textContent = `Published to DNS as a TXT record for ${domain}.`;
        },
      }, 'Publish this SPF record'),
      ' ',
      saveMsg,
    ]));
    buildRecord();

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Test SPF evaluation'));
    const testDomain = Lab.el('input', { type: 'text', placeholder: 'domain to check (e.g. mycompany.local)' });
    const testIp = Lab.el('input', { type: 'text', placeholder: 'sending IP (e.g. 203.0.113.10)' });
    const resultBox = Lab.el('div', {});
    body.appendChild(Lab.el('div', { class: 'inline-form' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), testDomain]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Sending IP'), testIp]),
      Lab.el('button', {
        onclick: async () => {
          resultBox.innerHTML = '';
          const res = await Lab.fetchJSON('/api/spf/evaluate', { method: 'POST', body: { domain: testDomain.value.trim(), ip: testIp.value.trim() } });
          resultBox.appendChild(Lab.el('p', {}, [Lab.el('span', { class: `badge ${res.result}` }, res.result), ` -- ${res.reason || ''}`]));
          resultBox.appendChild(Lab.el('pre', { class: 'trace-log' }, res.trace.join('\n')));
        },
      }, 'Check'),
    ]));
    body.appendChild(resultBox);
  },
});
