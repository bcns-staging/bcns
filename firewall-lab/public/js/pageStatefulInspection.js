Lab.registerPage('stateful-inspection', {
  controlSessionId: null,

  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Stateful Inspection & Sessions', route: 'stateful-inspection' });
    body.innerHTML = '';
    const page = this;
    page.controlSessionId = null;

    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const trustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'internal');
    const untrustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'external');

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Client 10.0.0.50 <-> server 203.0.113.20. Run step 1, then step 2.'));

    const step1Output = Lab.el('div', {});
    const step2Btn = Lab.el('button', { disabled: 'disabled' }, '2. Server opens the data channel back (port 20 -> ephemeral)');

    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const connection = { protocol: 'tcp', srcIp: '10.0.0.50', srcPort: 50500, dstIp: '203.0.113.20', dstPort: 21, ingressInterfaceId: trustIface.id };
        const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: 'traditional' } });
        step1Output.innerHTML = '';
        step1Output.appendChild(Lab.renderTrace(result));
        if (result.verdict === 'allow' && result.sessionId) {
          page.controlSessionId = result.sessionId;
          step2Btn.removeAttribute('disabled');
        }
      },
    }, '1. Open FTP control channel (client -> server, port 21)'));
    body.appendChild(step1Output);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    const step2Output = Lab.el('div', {});
    step2Btn.addEventListener('click', async () => {
      const connection = {
        protocol: 'tcp', srcIp: '203.0.113.20', srcPort: 20, dstIp: '10.0.0.50', dstPort: 50501,
        ingressInterfaceId: untrustIface.id, ftpRelatedTo: page.controlSessionId,
      };
      const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: 'traditional' } });
      step2Output.innerHTML = '';
      step2Output.appendChild(Lab.renderTrace(result));
      step2Output.appendChild(Lab.el('p', { class: 'muted' }, 'Notice: rule-match, dnat-lookup, and vpn-routing are all skipped -- this connection was never evaluated against the rulebase at all.'));
    });
    body.appendChild(step2Btn);
    body.appendChild(step2Output);
  },
});
