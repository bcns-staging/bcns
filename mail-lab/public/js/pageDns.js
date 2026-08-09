Lab.registerPage('dns', {
  state: { domain: null },

  async render(container) {
    const body = Lab.renderLayout(container, { title: 'DNS Zone Manager', route: 'dns' });
    const page = this;

    const { domains } = await Lab.fetchJSON('/api/dns/domains');
    if (!page.state.domain || !domains.includes(page.state.domain)) {
      page.state.domain = domains[0] || null;
    }

    body.innerHTML = '';
    body.appendChild(Lab.el('h3', {}, 'Zones'));

    const toolbar = Lab.el('div', { class: 'toolbar' });
    const select = Lab.el('select', {
      onchange: (e) => { page.state.domain = e.target.value || null; page.render(container); },
    }, [
      Lab.el('option', { value: '' }, '-- choose a domain --'),
      ...domains.map((d) => Lab.el('option', { value: d, selected: d === page.state.domain ? '' : null }, d)),
    ]);
    if (page.state.domain) select.value = page.state.domain;

    const newDomainInput = Lab.el('input', { type: 'text', placeholder: 'e.g. mycompany.local' });
    const addDomainBtn = Lab.el('button', {
      class: 'secondary',
      onclick: async () => {
        const domain = newDomainInput.value.trim();
        if (!domain) return;
        await Lab.fetchJSON('/api/dns/domains', { method: 'POST', body: { domain } });
        page.state.domain = domain.toLowerCase();
        page.render(container);
      },
    }, '+ New Domain');

    toolbar.appendChild(select);
    toolbar.appendChild(newDomainInput);
    toolbar.appendChild(addDomainBtn);
    if (page.state.domain) {
      toolbar.appendChild(Lab.el('button', {
        class: 'danger',
        onclick: async () => {
          if (!confirm(`Delete zone "${page.state.domain}" and all its records?`)) return;
          await Lab.fetchJSON(`/api/dns/domains/${encodeURIComponent(page.state.domain)}`, { method: 'DELETE' });
          page.state.domain = null;
          page.render(container);
        },
      }, 'Delete Zone'));
    }
    body.appendChild(toolbar);

    if (!page.state.domain) {
      body.appendChild(Lab.el('p', { class: 'muted' }, 'Create a domain above to start adding SPF, DKIM, DMARC and other records.'));
      return;
    }

    const { records } = await Lab.fetchJSON(`/api/dns/${encodeURIComponent(page.state.domain)}/records`);

    body.appendChild(Lab.el('h3', {}, `Records for ${page.state.domain}`));
    const table = Lab.el('table', { class: 'data-table' }, [
      Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Type'), Lab.el('th', {}, 'Value'), Lab.el('th', {}, '')]),
      ...(records.length ? records.map((r) => Lab.el('tr', {}, [
        Lab.el('td', { class: 'mono' }, r.name),
        Lab.el('td', {}, r.type),
        Lab.el('td', { class: 'mono' }, r.type === 'MX' ? `${r.priority} ${r.value}` : r.value),
        Lab.el('td', {}, Lab.el('button', {
          class: 'danger',
          onclick: async () => {
            await Lab.fetchJSON(`/api/dns/${encodeURIComponent(page.state.domain)}/records/${r.id}`, { method: 'DELETE' });
            page.render(container);
          },
        }, 'Delete')),
      ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '4', class: 'muted' }, 'No records yet.'))]),
    ]);
    body.appendChild(table);

    body.appendChild(Lab.el('h3', {}, 'Add a record'));
    const nameInput = Lab.el('input', { type: 'text', placeholder: `e.g. ${page.state.domain} or _dmarc.${page.state.domain}` });
    const typeSelect = Lab.el('select', {}, ['TXT', 'A', 'AAAA', 'MX', 'TLSA'].map((t) => Lab.el('option', { value: t }, t)));
    const valueInput = Lab.el('textarea', { placeholder: 'record value, e.g. v=spf1 ip4:203.0.113.10 -all' });
    const priorityInput = Lab.el('input', { type: 'number', placeholder: 'priority (MX only)', value: '10' });

    const form = Lab.el('div', {}, [
      Lab.el('div', { class: 'field-row' }, [
        Lab.el('div', {}, [Lab.el('label', {}, 'Name'), nameInput]),
        Lab.el('div', {}, [Lab.el('label', {}, 'Type'), typeSelect]),
        Lab.el('div', {}, [Lab.el('label', {}, 'Priority (MX only)'), priorityInput]),
      ]),
      Lab.el('label', {}, 'Value'),
      valueInput,
      Lab.el('button', {
        onclick: async () => {
          const name = nameInput.value.trim();
          const value = valueInput.value.trim();
          if (!name || !value) return;
          await Lab.fetchJSON(`/api/dns/${encodeURIComponent(page.state.domain)}/records`, {
            method: 'POST',
            body: { name, type: typeSelect.value, value, priority: typeSelect.value === 'MX' ? Number(priorityInput.value) : undefined },
          });
          page.render(container);
        },
      }, 'Add Record'),
    ]);
    body.appendChild(form);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Resolver Tester (simulated dig)'));
    const digName = Lab.el('input', { type: 'text', placeholder: 'name to query', value: page.state.domain });
    const digType = Lab.el('select', {}, ['TXT', 'A', 'AAAA', 'MX', 'TLSA'].map((t) => Lab.el('option', { value: t }, t)));
    const digOutput = Lab.el('pre', { class: 'code-block' }, '; run a query to see the response');
    body.appendChild(Lab.el('div', { class: 'inline-form' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Name'), digName]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Type'), digType]),
      Lab.el('button', {
        onclick: async () => {
          const { digText } = await Lab.fetchJSON(`/api/dns/resolve?name=${encodeURIComponent(digName.value)}&type=${digType.value}`);
          digOutput.textContent = digText;
        },
      }, 'Dig'),
    ]));
    body.appendChild(digOutput);
  },
});
