Lab.registerPage('nat-destination', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Destination NAT & Port Forwarding', route: 'nat-destination' });
    body.innerHTML = '';

    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const untrustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'external');

    body.appendChild(Lab.el('h3', {}, 'Destination NAT rule'));
    const ruleBox = Lab.el('div', {});
    let currentRule = null;
    async function refresh() {
      const { 'nat-rules': rows } = await Lab.fetchJSON('/api/nat/nat-rules');
      currentRule = rows.find((r) => r.type === 'destination');
      ruleBox.innerHTML = '';
      if (!currentRule) {
        ruleBox.appendChild(Lab.el('p', { class: 'muted' }, 'No destination NAT rule -- add one on the Network Objects / NAT setup.'));
        return;
      }
      ruleBox.appendChild(Lab.el('p', {}, [
        `${currentRule.publicIp}:${currentRule.publicPort} -> ${currentRule.internalIp}:${currentRule.internalPort} -- security rule matches on `,
        Lab.el('span', { class: 'badge encrypt' }, currentRule.securityRuleMatchesOn),
      ]));
    }
    await refresh();

    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!currentRule) return;
        const next = currentRule.securityRuleMatchesOn === 'pre-nat' ? 'post-nat' : 'pre-nat';
        await Lab.fetchJSON(`/api/nat/nat-rules/${currentRule.id}`, { method: 'PUT', body: { securityRuleMatchesOn: next } });
        await refresh();
      },
    }, 'Toggle pre-nat / post-nat'));
    body.appendChild(ruleBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    body.appendChild(Lab.el('h3', {}, 'Test: a client on the internet reaches the published IP'));
    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!currentRule) return;
        const connection = { protocol: 'tcp', srcIp: '203.0.113.20', srcPort: 44000, dstIp: currentRule.publicIp, dstPort: currentRule.publicPort, ingressInterfaceId: untrustIface.id };
        const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: 'traditional' } });
        output.innerHTML = '';
        output.appendChild(Lab.el('p', {}, `Rule-match used destination ${result.nat.destinationNat ? (currentRule.securityRuleMatchesOn === 'pre-nat' ? currentRule.publicIp : currentRule.internalIp) : connection.dstIp}.`));
        output.appendChild(Lab.renderTrace(result));
      },
    }, 'Test'));
    body.appendChild(output);
  },
});
