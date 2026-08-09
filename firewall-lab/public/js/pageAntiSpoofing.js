Lab.registerPage('anti-spoofing', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Anti-Spoofing', route: 'anti-spoofing' });
    body.innerHTML = '';

    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const ifaceSelect = Lab.el('select', {}, interfaces.map((i) => Lab.el('option', { value: i.id }, i.name)));
    const srcIp = Lab.el('input', { type: 'text', value: '203.0.113.20' });

    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const untrustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'external');

    body.appendChild(Lab.el('div', { class: 'toolbar' }, [
      Lab.el('button', { class: 'secondary', onclick: () => { srcIp.value = '203.0.113.20'; ifaceSelect.value = untrustIface.id; } }, 'Legitimate example'),
      Lab.el('button', { class: 'secondary', onclick: () => { srcIp.value = '10.0.0.99'; ifaceSelect.value = untrustIface.id; } }, 'Load spoofed example'),
    ]));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Source IP'), srcIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Ingress interface'), ifaceSelect]),
    ]));

    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const connection = { protocol: 'tcp', srcIp: srcIp.value.trim(), srcPort: 51000, dstIp: '203.0.113.20', dstPort: 443, ingressInterfaceId: ifaceSelect.value };
        const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: 'traditional' } });
        output.innerHTML = '';
        output.appendChild(Lab.renderTrace(result));
      },
    }, 'Test'));
    body.appendChild(output);
  },
});
