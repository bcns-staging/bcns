Lab.registerPage('reports', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'DMARC Reports', route: 'reports' });
    body.innerHTML = '';

    const { domains } = await Lab.fetchJSON('/api/dns/domains');
    const domainSelect = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, '-- choose a domain --'),
      ...domains.map((d) => Lab.el('option', { value: d }, d)),
    ]);

    const messagesBox = Lab.el('div', {});
    const forensicOutput = Lab.el('pre', { class: 'code-block' }, '');

    async function refreshMessages() {
      messagesBox.innerHTML = '';
      if (!domainSelect.value) return;
      const { messages } = await Lab.fetchJSON(`/api/reports/${encodeURIComponent(domainSelect.value)}/messages`);
      messagesBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Time'), Lab.el('th', {}, 'Envelope From'), Lab.el('th', {}, 'Sender IP'), Lab.el('th', {}, 'SPF'), Lab.el('th', {}, 'DKIM'), Lab.el('th', {}, 'DMARC'), Lab.el('th', {}, 'Disposition'), Lab.el('th', {}, '')]),
        ...(messages.length ? messages.slice().reverse().map((m) => Lab.el('tr', {}, [
          Lab.el('td', {}, new Date(m.timestamp).toLocaleTimeString()),
          Lab.el('td', { class: 'mono' }, m.envelopeFrom),
          Lab.el('td', { class: 'mono' }, m.senderIp),
          Lab.el('td', {}, Lab.el('span', { class: `badge ${m.spf}` }, m.spf)),
          Lab.el('td', {}, m.dkim),
          Lab.el('td', {}, Lab.el('span', { class: `badge ${m.dmarc}` }, m.dmarc)),
          Lab.el('td', {}, Lab.el('span', { class: `badge ${m.disposition}` }, m.disposition)),
          Lab.el('td', {}, Lab.el('button', {
            class: 'secondary',
            onclick: async () => {
              const text = await fetch(`/api/reports/forensic/${m.id}`).then((r) => r.text());
              forensicOutput.textContent = text;
            },
          }, 'Forensic report')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '8', class: 'muted' }, 'No messages sent for this domain yet -- use Compose or the Attack Simulator.'))]),
      ]));
    }
    domainSelect.addEventListener('change', refreshMessages);

    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), domainSelect])]));

    body.appendChild(Lab.el('h3', {}, 'Message history'));
    body.appendChild(messagesBox);

    body.appendChild(Lab.el('h4', {}, 'Forensic report (RUF-style)'));
    body.appendChild(forensicOutput);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Aggregate report (RUA-style XML)'));
    const aggregateOutput = Lab.el('pre', { class: 'code-block' }, '');
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainSelect.value) return;
        const res = await Lab.fetchJSON(`/api/reports/${encodeURIComponent(domainSelect.value)}/aggregate`);
        aggregateOutput.textContent = res.xml;
      },
    }, 'Generate aggregate report'));
    body.appendChild(aggregateOutput);
  },
});
