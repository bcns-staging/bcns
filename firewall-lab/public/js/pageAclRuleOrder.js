Lab.registerPage('acl-rule-order', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Rule Base & First-Match-Wins', route: 'acl-rule-order' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'Traditional rule base (top to bottom)'));
    const ruleBox = Lab.el('div', {});
    async function refreshRules() {
      const { rules } = await Lab.fetchJSON('/api/rules/traditional');
      ruleBox.innerHTML = '';
      ruleBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, '#'), Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Src -> Dst zone'), Lab.el('th', {}, 'Service'), Lab.el('th', {}, 'Action')]),
        ...rules.map((r) => Lab.el('tr', {}, [
          Lab.el('td', {}, String(r.order)), Lab.el('td', {}, r.name), Lab.el('td', {}, `${r.srcZone} -> ${r.dstZone}`),
          Lab.el('td', { class: 'mono' }, `${r.protocol}/${r.port}`), Lab.el('td', {}, Lab.el('span', { class: `badge ${r.action}` }, r.action)),
        ])),
      ]));
    }
    refreshRules();

    body.appendChild(Lab.el('h3', {}, 'Test traffic against it'));
    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const trustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'internal');

    const form = {
      dstIp: Lab.el('input', { type: 'text', value: '203.0.113.20' }),
      dstPort: Lab.el('input', { type: 'number', value: '53' }),
      protocol: Lab.el('select', {}, ['udp', 'tcp', 'icmp'].map((p) => Lab.el('option', { value: p }, p))),
    };
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Protocol'), form.protocol]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Destination IP'), form.dstIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Destination port'), form.dstPort]),
    ]));
    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const connection = { protocol: form.protocol.value, srcIp: '10.0.0.50', srcPort: 51000, dstIp: form.dstIp.value.trim(), dstPort: Number(form.dstPort.value), ingressInterfaceId: trustIface.id };
        const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: 'traditional' } });
        output.innerHTML = '';
        output.appendChild(Lab.renderTrace(result));
        refreshRules();
      },
    }, 'Test'));
    body.appendChild(output);
  },
});
