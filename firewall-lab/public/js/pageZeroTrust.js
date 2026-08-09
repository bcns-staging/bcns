const ZT_SCENARIOS = [
  {
    label: 'Finance user -> Salesforce (should allow)',
    connection: { protocol: 'tcp', srcIp: '10.0.0.50', srcPort: 52000, dstIp: '203.0.113.20', dstPort: 443, declaredApp: 'salesforce', encrypted: true },
    narrative: 'User-ID resolves 10.0.0.50 to jsmith (finance group); App-ID confirms the real app is salesforce -- both required signals are present.',
  },
  {
    label: 'Engineering user -> Salesforce (should deny)',
    connection: { protocol: 'tcp', srcIp: '10.0.0.51', srcPort: 52001, dstIp: '203.0.113.20', dstPort: 443, declaredApp: 'salesforce', encrypted: true },
    narrative: 'App-ID confirms salesforce, but User-ID resolves this IP to agarcia (engineering, not finance) -- User-ID is the deciding factor.',
  },
  {
    label: 'Finance user -> BitTorrent (should deny)',
    connection: { protocol: 'tcp', srcIp: '10.0.0.50', srcPort: 52002, dstIp: '203.0.113.20', dstPort: 443, declaredApp: 'bittorrent', encrypted: true },
    narrative: 'User-ID resolves to the finance group, but App-ID identifies bittorrent, not salesforce -- App-ID is the deciding factor.',
  },
];

Lab.registerPage('zero-trust', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Zero Trust Segmentation', route: 'zero-trust' });
    body.innerHTML = '';

    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const trustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'internal');

    body.appendChild(Lab.el('p', { class: 'muted' }, 'These scenarios run against the seeded NGFW rulebase, which already ends in a deny-all -- nothing is implicitly trusted. Each narrates which signal (App-ID or User-ID) actually decided the outcome.'));

    for (const scenario of ZT_SCENARIOS) {
      const wrap = Lab.el('div', { class: 'card' });
      wrap.appendChild(Lab.el('h4', {}, scenario.label));
      wrap.appendChild(Lab.el('p', { class: 'muted' }, scenario.narrative));
      const out = Lab.el('div', {});
      wrap.appendChild(Lab.el('button', {
        onclick: async () => {
          const connection = { ...scenario.connection, ingressInterfaceId: trustIface.id };
          const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: 'ngfw' } });
          out.innerHTML = '';
          out.appendChild(Lab.renderTrace(result));
        },
      }, 'Run'));
      wrap.appendChild(out);
      body.appendChild(wrap);
    }
  },
});
