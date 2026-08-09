Lab.registerPage('network-objects', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Network Objects', route: 'network-objects' });
    body.innerHTML = '';

    const ifaceZoneSelect = Lab.el('select', {});
    const hostZoneSelect = Lab.el('select', {});

    async function refreshZoneSelects() {
      const { zones: rows } = await Lab.fetchJSON('/api/topology/zones');
      for (const sel of [ifaceZoneSelect, hostZoneSelect]) {
        const current = sel.value;
        sel.innerHTML = '';
        for (const z of rows) sel.appendChild(Lab.el('option', { value: z.id }, z.name));
        if (rows.some((z) => z.id === current)) sel.value = current;
      }
    }

    // --- Zones ---
    body.appendChild(Lab.el('h3', {}, 'Zones'));
    const zoneBox = Lab.el('div', {});
    async function refreshZones() {
      const { zones: rows } = await Lab.fetchJSON('/api/topology/zones');
      zoneBox.innerHTML = '';
      zoneBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Trust level'), Lab.el('th', {}, '')]),
        ...rows.map((z) => Lab.el('tr', {}, [
          Lab.el('td', {}, z.name),
          Lab.el('td', {}, z.trustLevel),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/topology/zones/${z.id}`, { method: 'DELETE' }); refreshZones(); refreshZoneSelects(); } }, 'Delete')),
        ])),
      ]));
    }
    const zoneNameInput = Lab.el('input', { type: 'text', placeholder: 'e.g. Guest Wi-Fi' });
    const zoneTrust = Lab.el('select', {}, ['internal', 'external', 'semi-trusted'].map((t) => Lab.el('option', { value: t }, t)));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Zone name'), zoneNameInput]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Trust level'), zoneTrust]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!zoneNameInput.value.trim()) return;
        await Lab.fetchJSON('/api/topology/zones', { method: 'POST', body: { name: zoneNameInput.value.trim(), trustLevel: zoneTrust.value } });
        zoneNameInput.value = '';
        refreshZones(); refreshZoneSelects();
      },
    }, 'Add zone'));
    body.appendChild(zoneBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    // --- Interfaces ---
    body.appendChild(Lab.el('h3', {}, 'Interfaces'));
    const ifaceBox = Lab.el('div', {});
    async function refreshInterfaces() {
      const { interfaces: rows } = await Lab.fetchJSON('/api/topology/interfaces');
      const { zones: zoneRows } = await Lab.fetchJSON('/api/topology/zones');
      const zoneNameOf = (id) => zoneRows.find((z) => z.id === id)?.name || id;
      ifaceBox.innerHTML = '';
      ifaceBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Zone'), Lab.el('th', {}, 'CIDR'), Lab.el('th', {}, 'Type'), Lab.el('th', {}, '')]),
        ...rows.map((i) => Lab.el('tr', {}, [
          Lab.el('td', {}, i.name), Lab.el('td', {}, zoneNameOf(i.zoneId)), Lab.el('td', { class: 'mono' }, i.ipCidr), Lab.el('td', {}, i.type),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/topology/interfaces/${i.id}`, { method: 'DELETE' }); refreshInterfaces(); } }, 'Delete')),
        ])),
      ]));
    }
    const ifaceName = Lab.el('input', { type: 'text', placeholder: 'e.g. eth3' });
    const ifaceCidr = Lab.el('input', { type: 'text', placeholder: 'e.g. 10.1.0.1/24' });
    const ifaceType = Lab.el('select', {}, ['physical', 'tunnel'].map((t) => Lab.el('option', { value: t }, t)));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Interface name'), ifaceName]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Zone'), ifaceZoneSelect]),
      Lab.el('div', {}, [Lab.el('label', {}, 'IP/CIDR'), ifaceCidr]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Type'), ifaceType]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!ifaceName.value.trim() || !ifaceCidr.value.trim()) return;
        await Lab.fetchJSON('/api/topology/interfaces', { method: 'POST', body: { name: ifaceName.value.trim(), zoneId: ifaceZoneSelect.value, ipCidr: ifaceCidr.value.trim(), type: ifaceType.value } });
        ifaceName.value = ''; ifaceCidr.value = '';
        refreshInterfaces();
      },
    }, 'Add interface'));
    body.appendChild(ifaceBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    // --- Hosts ---
    body.appendChild(Lab.el('h3', {}, 'Hosts'));
    const hostBox = Lab.el('div', {});
    async function refreshHosts() {
      const { hosts: rows } = await Lab.fetchJSON('/api/topology/hosts');
      const { zones: zoneRows } = await Lab.fetchJSON('/api/topology/zones');
      const zoneNameOf = (id) => zoneRows.find((z) => z.id === id)?.name || id;
      hostBox.innerHTML = '';
      hostBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'IP'), Lab.el('th', {}, 'Zone'), Lab.el('th', {}, '')]),
        ...rows.map((h) => Lab.el('tr', {}, [
          Lab.el('td', {}, h.name), Lab.el('td', { class: 'mono' }, h.ip), Lab.el('td', {}, zoneNameOf(h.zoneId)),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/topology/hosts/${h.id}`, { method: 'DELETE' }); refreshHosts(); } }, 'Delete')),
        ])),
      ]));
    }
    const hostName = Lab.el('input', { type: 'text', placeholder: 'e.g. file-server' });
    const hostIp = Lab.el('input', { type: 'text', placeholder: 'e.g. 10.0.0.60' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Host name'), hostName]),
      Lab.el('div', {}, [Lab.el('label', {}, 'IP'), hostIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Zone'), hostZoneSelect]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!hostName.value.trim() || !hostIp.value.trim()) return;
        await Lab.fetchJSON('/api/topology/hosts', { method: 'POST', body: { name: hostName.value.trim(), ip: hostIp.value.trim(), zoneId: hostZoneSelect.value } });
        hostName.value = ''; hostIp.value = '';
        refreshHosts();
      },
    }, 'Add host'));
    body.appendChild(hostBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    // --- Services ---
    body.appendChild(Lab.el('h3', {}, 'Services'));
    body.appendChild(Lab.el('p', { class: 'muted' }, "A reference catalog of protocol/port combinations for your own notes -- the Rule Builder's own protocol/port fields are what the engine actually matches on."));
    const svcBox = Lab.el('div', {});
    async function refreshServices() {
      const { services: rows } = await Lab.fetchJSON('/api/topology/services');
      svcBox.innerHTML = '';
      svcBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Protocol'), Lab.el('th', {}, 'Port'), Lab.el('th', {}, '')]),
        ...rows.map((s) => Lab.el('tr', {}, [
          Lab.el('td', {}, s.name), Lab.el('td', {}, s.protocol), Lab.el('td', {}, String(s.port)),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/topology/services/${s.id}`, { method: 'DELETE' }); refreshServices(); } }, 'Delete')),
        ])),
      ]));
    }
    const svcName = Lab.el('input', { type: 'text', placeholder: 'e.g. Custom App' });
    const svcProtocol = Lab.el('select', {}, ['tcp', 'udp'].map((p) => Lab.el('option', { value: p }, p)));
    const svcPort = Lab.el('input', { type: 'number', placeholder: 'e.g. 8443' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Service name'), svcName]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Protocol'), svcProtocol]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Port'), svcPort]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!svcName.value.trim() || !svcPort.value) return;
        await Lab.fetchJSON('/api/topology/services', { method: 'POST', body: { name: svcName.value.trim(), protocol: svcProtocol.value, port: Number(svcPort.value) } });
        svcName.value = ''; svcPort.value = '';
        refreshServices();
      },
    }, 'Add service'));
    body.appendChild(svcBox);

    await refreshZoneSelects();
    refreshZones(); refreshInterfaces(); refreshHosts(); refreshServices();
  },
});
