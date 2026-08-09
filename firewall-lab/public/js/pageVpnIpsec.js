Lab.registerPage('vpn-ipsec', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Site-to-Site VPN (IPSec)', route: 'vpn-ipsec' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'Tunnels'));
    const listBox = Lab.el('div', {});
    async function refresh() {
      const { 'vpn-tunnels': rows } = await Lab.fetchJSON('/api/vpn/vpn-tunnels');
      listBox.innerHTML = '';
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Local'), Lab.el('th', {}, 'Remote'), Lab.el('th', {}, 'IKE'), Lab.el('th', {}, 'IPSec'), Lab.el('th', {}, 'Remote domain'), Lab.el('th', {}, '')]),
        ...(rows.length ? rows.map((t) => Lab.el('tr', {}, [
          Lab.el('td', {}, t.name), Lab.el('td', { class: 'mono' }, t.localEndpoint), Lab.el('td', { class: 'mono' }, t.remoteEndpoint),
          Lab.el('td', {}, `${t.ike.version} / ${t.ike.encryption}`), Lab.el('td', {}, t.ipsec.encryption), Lab.el('td', { class: 'mono' }, t.remoteDomain),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/vpn/vpn-tunnels/${t.id}`, { method: 'DELETE' }); refresh(); } }, 'Delete')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '7', class: 'muted' }, 'No tunnels yet.'))]),
      ]));
    }
    refresh();

    const name = Lab.el('input', { type: 'text', placeholder: 'e.g. Branch-B' });
    const remoteEndpoint = Lab.el('input', { type: 'text', placeholder: 'e.g. 198.51.100.20' });
    const remoteDomain = Lab.el('input', { type: 'text', placeholder: 'e.g. 172.20.0.0/16' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Tunnel name'), name]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Remote endpoint'), remoteEndpoint]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Remote domain (CIDR)'), remoteDomain]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!name.value.trim() || !remoteEndpoint.value.trim() || !remoteDomain.value.trim()) return;
        await Lab.fetchJSON('/api/vpn/vpn-tunnels', {
          method: 'POST',
          body: { name: name.value.trim(), localEndpoint: '203.0.113.1', remoteEndpoint: remoteEndpoint.value.trim(), ike: { version: 'IKEv2', encryption: 'AES-256', dhGroup: 14 }, ipsec: { encryption: 'AES-256-GCM' }, remoteDomain: remoteDomain.value.trim() },
        });
        refresh();
      },
    }, 'Add tunnel'));
    body.appendChild(listBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    body.appendChild(Lab.el('h3', {}, 'Test routing'));
    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const trustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'internal');
    const dstIp = Lab.el('input', { type: 'text', value: '172.16.5.10' });
    body.appendChild(Lab.el('div', { class: 'toolbar' }, [
      Lab.el('button', { class: 'secondary', onclick: () => { dstIp.value = '172.16.5.10'; } }, 'Destination inside tunnel'),
      Lab.el('button', { class: 'secondary', onclick: () => { dstIp.value = '203.0.113.20'; } }, 'Destination outside tunnel'),
    ]));
    body.appendChild(Lab.el('label', {}, 'Destination IP'));
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
