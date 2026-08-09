Lab.registerPage('single-pass', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Single-Pass Content-ID', route: 'single-pass' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Run a connection with every NGFW signal populated at once and watch App-ID, User-ID, SSL decrypt, URL filtering, threat intel, IPS, anti-malware, and DNS security all report from the same single evaluation.'));

    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const trustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'internal');

    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const connection = {
          protocol: 'tcp', srcIp: '10.0.0.50', srcPort: 51900, dstIp: '203.0.113.20', dstPort: 443, ingressInterfaceId: trustIface.id,
          declaredApp: 'generic-tls', encrypted: true, domain: 'newsblog.example', payloadSignature: 'perfectly ordinary request',
        };
        const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: 'ngfw' } });
        output.innerHTML = '';
        output.appendChild(Lab.renderTrace(result));
        output.appendChild(Lab.el('p', { class: 'muted' }, 'app-id, user-id, ssl-decrypt, url-filtering, threat-intel, ips, anti-malware, and dns-security all ran as part of this one evaluation -- one round trip, one parsed connection.'));
      },
    }, 'Run a fully-populated connection'));
    body.appendChild(output);
  },
});
