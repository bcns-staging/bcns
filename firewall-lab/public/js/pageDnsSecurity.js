Lab.registerPage('dns-security', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'DNS Security', route: 'dns-security' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'Blocklist'));
    const listBox = Lab.el('div', {});
    async function refresh() {
      const { 'dns-blocklist': rows } = await Lab.fetchJSON('/api/dns-security/dns-blocklist');
      listBox.innerHTML = '';
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Domain'), Lab.el('th', {}, 'Category'), Lab.el('th', {}, 'Sinkhole IP'), Lab.el('th', {}, '')]),
        ...(rows.length ? rows.map((e) => Lab.el('tr', {}, [
          Lab.el('td', { class: 'mono' }, e.domain), Lab.el('td', {}, e.category), Lab.el('td', { class: 'mono' }, e.sinkholeIp),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/dns-security/dns-blocklist/${e.id}`, { method: 'DELETE' }); refresh(); } }, 'Delete')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '4', class: 'muted' }, 'No entries yet.'))]),
      ]));
    }
    refresh();

    const domain = Lab.el('input', { type: 'text', placeholder: 'e.g. bad-domain.example' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), domain])]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domain.value.trim()) return;
        await Lab.fetchJSON('/api/dns-security/dns-blocklist', { method: 'POST', body: { domain: domain.value.trim(), category: 'command-and-control', sinkholeIp: '10.255.255.1' } });
        domain.value = '';
        refresh();
      },
    }, 'Add to blocklist'));
    body.appendChild(listBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    body.appendChild(Lab.el('h3', {}, 'Resolve'));
    const testDomain = Lab.el('input', { type: 'text', value: 'c2-server.example' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), testDomain])]));
    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const result = await Lab.fetchJSON('/api/dns-security/resolve', { method: 'POST', body: { domain: testDomain.value.trim() } });
        output.innerHTML = '';
        output.appendChild(result.sinkholed
          ? Lab.el('p', {}, [Lab.el('span', { class: 'badge bad' }, 'sinkholed'), ` -> ${result.ip} (${result.category})`])
          : Lab.el('p', {}, [Lab.el('span', { class: 'badge good' }, 'normal'), ` -> ${result.ip}`]));
      },
    }, 'Resolve'));
    body.appendChild(output);
  },
});
