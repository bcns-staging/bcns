Lab.registerPage('zone-policy', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Zone-Based Policy', route: 'zone-policy' });
    body.innerHTML = '';

    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const trustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'internal');

    const dstIp = Lab.el('input', { type: 'text', value: '203.0.113.20' });
    body.appendChild(Lab.el('div', { class: 'toolbar' }, [
      Lab.el('button', { class: 'secondary', onclick: () => { dstIp.value = '203.0.113.20'; } }, 'Destination in Untrust'),
      Lab.el('button', { class: 'secondary', onclick: () => { dstIp.value = '192.168.50.20'; } }, 'Destination in DMZ'),
    ]));
    body.appendChild(Lab.el('label', {}, 'Destination IP (source is always 10.0.0.50 in Trust)'));
    body.appendChild(dstIp);

    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const connection = { protocol: 'tcp', srcIp: '10.0.0.50', srcPort: 51000, dstIp: dstIp.value.trim(), dstPort: 443, ingressInterfaceId: trustIface.id };
        const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: 'traditional' } });
        output.innerHTML = '';
        output.appendChild(Lab.renderTrace(result));
      },
    }, 'Test'));
    body.appendChild(output);
  },
});
