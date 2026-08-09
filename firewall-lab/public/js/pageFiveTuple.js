Lab.registerPage('five-tuple', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Packet Filtering & the 5-Tuple', route: 'five-tuple' });
    body.innerHTML = '';

    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const trustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'internal');

    body.appendChild(Lab.el('p', { class: 'muted' }, `Ingress fixed to the Trust interface (${trustIface.name}) so this page stays focused on just the 5 fields below.`));

    const form = {
      protocol: Lab.el('select', {}, ['tcp', 'udp', 'icmp'].map((p) => Lab.el('option', { value: p }, p))),
      srcIp: Lab.el('input', { type: 'text', value: '10.0.0.50' }),
      srcPort: Lab.el('input', { type: 'number', value: '51000' }),
      dstIp: Lab.el('input', { type: 'text', value: '203.0.113.20' }),
      dstPort: Lab.el('input', { type: 'number', value: '443' }),
    };
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Protocol'), form.protocol]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Source IP'), form.srcIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Source port'), form.srcPort]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Destination IP'), form.dstIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Destination port'), form.dstPort]),
    ]));

    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const connection = {
          protocol: form.protocol.value, srcIp: form.srcIp.value.trim(), srcPort: Number(form.srcPort.value),
          dstIp: form.dstIp.value.trim(), dstPort: Number(form.dstPort.value), ingressInterfaceId: trustIface.id,
        };
        const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: 'traditional' } });
        output.innerHTML = '';
        output.appendChild(Lab.renderTrace(result));
      },
    }, 'Classify'));
    body.appendChild(output);
  },
});
