Lab.registerPage('reputation', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Reputation / RBL', route: 'reputation' });
    body.innerHTML = '';

    const listsBox = Lab.el('div', {});
    async function refresh() {
      const lists = await Lab.fetchJSON('/api/reputation/blocklists');
      listsBox.innerHTML = '';
      listsBox.appendChild(Lab.el('div', { class: 'card-grid' }, [
        Lab.el('div', { class: 'card' }, [
          Lab.el('h4', {}, 'Blocked IPs'),
          ...(lists.ips.length ? lists.ips.map((ip) => Lab.el('p', {}, [ip, ' ', Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/reputation/ips/${encodeURIComponent(ip)}`, { method: 'DELETE' }); refresh(); } }, 'x')])) : [Lab.el('p', { class: 'muted' }, 'none')]),
        ]),
        Lab.el('div', { class: 'card' }, [
          Lab.el('h4', {}, 'Blocked domains'),
          ...(lists.domains.length ? lists.domains.map((d) => Lab.el('p', {}, [d, ' ', Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/reputation/domains/${encodeURIComponent(d)}`, { method: 'DELETE' }); refresh(); } }, 'x')])) : [Lab.el('p', { class: 'muted' }, 'none')]),
        ]),
      ]));
    }

    body.appendChild(Lab.el('h3', {}, 'Local blocklists'));
    const ipInput = Lab.el('input', { type: 'text', placeholder: '198.51.100.66' });
    const domainInput = Lab.el('input', { type: 'text', placeholder: 'spammy-domain.example' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Add blocked IP'), ipInput, Lab.el('button', { onclick: async () => { if (!ipInput.value.trim()) return; await Lab.fetchJSON('/api/reputation/ips', { method: 'POST', body: { ip: ipInput.value.trim() } }); ipInput.value = ''; refresh(); } }, 'Add')]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Add blocked domain'), domainInput, Lab.el('button', { onclick: async () => { if (!domainInput.value.trim()) return; await Lab.fetchJSON('/api/reputation/domains', { method: 'POST', body: { domain: domainInput.value.trim() } }); domainInput.value = ''; refresh(); } }, 'Add')]),
    ]));
    body.appendChild(listsBox);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Check an IP (simulated DNSBL query)'));
    const checkIp = Lab.el('input', { type: 'text', placeholder: '198.51.100.66' });
    const checkOutput = Lab.el('div', {});
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'IP'), checkIp])]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/reputation/check-ip', { method: 'POST', body: { ip: checkIp.value.trim() } });
        checkOutput.innerHTML = '';
        checkOutput.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.listed ? 'fail' : 'pass'}` }, res.listed ? 'listed' : 'clean')));
        checkOutput.appendChild(Lab.el('pre', { class: 'code-block' }, `DNSBL-style query: ${res.query}\n${res.reason}`));
      },
    }, 'Check'));
    body.appendChild(checkOutput);

    refresh();
  },
});
