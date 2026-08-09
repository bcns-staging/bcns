Lab.registerPage('nat-source', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Source NAT: PAT & Static', route: 'nat-source' });
    body.innerHTML = '';

    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const zoneSelect = Lab.el('select', {}, zones.map((z) => Lab.el('option', { value: z.id }, z.name)));

    body.appendChild(Lab.el('h3', {}, 'Source NAT rules'));
    const listBox = Lab.el('div', {});
    async function refresh() {
      const { 'nat-rules': rows } = await Lab.fetchJSON('/api/nat/nat-rules');
      const src = rows.filter((r) => r.type === 'source-dynamic' || r.type === 'static');
      listBox.innerHTML = '';
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Type'), Lab.el('th', {}, 'Description'), Lab.el('th', {}, '')]),
        ...(src.length ? src.map((r) => Lab.el('tr', {}, [
          Lab.el('td', {}, r.type), Lab.el('td', {}, r.description || '-'),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/nat/nat-rules/${r.id}`, { method: 'DELETE' }); refresh(); } }, 'Delete')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '3', class: 'muted' }, 'No source NAT rules yet.'))]),
      ]));
    }
    refresh();

    const type = Lab.el('select', {}, [Lab.el('option', { value: 'source-dynamic' }, 'Dynamic PAT'), Lab.el('option', { value: 'static' }, 'Static 1:1')]);
    const poolIp = Lab.el('input', { type: 'text', placeholder: 'e.g. 203.0.113.1' });
    const internalIp = Lab.el('input', { type: 'text', placeholder: '(static only) internal host IP' });
    const publicIp = Lab.el('input', { type: 'text', placeholder: '(static only) dedicated public IP' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Type'), type]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Source zone'), zoneSelect]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Pool IP (dynamic)'), poolIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Internal IP (static)'), internalIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Public IP (static)'), publicIp]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const body2 = { type: type.value, srcZone: zoneSelect.value, description: `${type.value === 'static' ? 'Static NAT' : 'Dynamic PAT'} for ${zones.find((z) => z.id === zoneSelect.value)?.name}` };
        if (type.value === 'source-dynamic') body2.poolIp = poolIp.value.trim();
        else { body2.internalIp = internalIp.value.trim(); body2.publicIp = publicIp.value.trim(); }
        await Lab.fetchJSON('/api/nat/nat-rules', { method: 'POST', body: body2 });
        refresh();
      },
    }, 'Add rule'));
    body.appendChild(listBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    body.appendChild(Lab.el('h3', {}, 'Test traffic'));
    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const trustIface = interfaces.find((i) => zones.find((z) => z.id === i.zoneId)?.trustLevel === 'internal');
    const srcIp = Lab.el('input', { type: 'text', value: '10.0.0.50' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Source IP'), srcIp])]));
    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const connection = { protocol: 'tcp', srcIp: srcIp.value.trim(), srcPort: 51000, dstIp: '203.0.113.20', dstPort: 443, ingressInterfaceId: trustIface.id };
        const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: 'traditional' } });
        output.innerHTML = '';
        if (result.nat.sourceNat) {
          output.appendChild(Lab.el('p', {}, [
            Lab.el('span', { class: 'badge encrypt' }, result.nat.sourceNat.type),
            ` pre-NAT ${connection.srcIp}:${connection.srcPort} -> post-NAT ${result.nat.sourceNat.translatedIp}:${result.nat.sourceNat.translatedPort}`,
          ]));
        } else {
          output.appendChild(Lab.el('p', { class: 'muted' }, 'No source NAT rule applies to this traffic -- it would leave with its original (private) source address, which is not routable on the real internet.'));
        }
        output.appendChild(Lab.renderTrace(result));
      },
    }, 'Test'));
    body.appendChild(output);
  },
});
