const SCENARIOS = {
  'app-disguised': {
    label: 'App disguised on port 443',
    connection: { protocol: 'tcp', srcIp: '10.0.0.50', srcPort: 51000, dstIp: '203.0.113.20', dstPort: 443, declaredApp: 'bittorrent', encrypted: true },
  },
  'malware-in-tls': {
    label: 'Malware inside an allowed encrypted session',
    connection: { protocol: 'tcp', srcIp: '10.0.0.50', srcPort: 51001, dstIp: '203.0.113.20', dstPort: 443, declaredApp: 'generic-tls', encrypted: true, fileName: 'invoice.exe', fileHash: '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0' },
  },
  'url-category': {
    label: 'URL-category violation on an allowed port',
    connection: { protocol: 'tcp', srcIp: '10.0.0.51', srcPort: 51002, dstIp: '203.0.113.20', dstPort: 443, declaredApp: 'generic-tls', encrypted: true, url: 'gambling-site.example', domain: 'gambling-site.example' },
  },
};

Lab.registerPage('traffic-simulator', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Traffic Simulator', route: 'traffic-simulator' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Build a connection and run it through the firewall. In Side-by-side mode, the exact same connection is evaluated against both rulebases so you can see precisely where -- and why -- they disagree.'));

    const ifaceSelect = Lab.el('select', {});
    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    for (const i of interfaces) ifaceSelect.appendChild(Lab.el('option', { value: i.id }, `${i.name} (${i.ipCidr})`));

    const form = {
      protocol: Lab.el('select', {}, ['tcp', 'udp', 'icmp'].map((p) => Lab.el('option', { value: p }, p))),
      srcIp: Lab.el('input', { type: 'text', value: '10.0.0.50' }),
      srcPort: Lab.el('input', { type: 'number', value: '51000' }),
      dstIp: Lab.el('input', { type: 'text', value: '203.0.113.20' }),
      dstPort: Lab.el('input', { type: 'number', value: '443' }),
      declaredApp: Lab.el('input', { type: 'text', placeholder: 'e.g. bittorrent, salesforce, generic-tls (blank = guess from port)' }),
      urlDomain: Lab.el('input', { type: 'text', placeholder: 'e.g. gambling-site.example (bare domain, no https://)' }),
      fileName: Lab.el('input', { type: 'text', placeholder: 'e.g. invoice.exe' }),
      fileHash: Lab.el('input', { type: 'text', placeholder: 'paste a sha256 -- try 275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0' }),
      payloadSignature: Lab.el('input', { type: 'text', placeholder: 'e.g. ${jndi:ldap://evil/a}' }),
      encrypted: Lab.el('input', { type: 'checkbox', checked: 'checked' }),
    };
    const mode = Lab.el('select', {}, [
      Lab.el('option', { value: 'both' }, 'Side-by-side (Traditional + NGFW)'),
      Lab.el('option', { value: 'traditional' }, 'Traditional only'),
      Lab.el('option', { value: 'ngfw' }, 'NGFW only'),
    ]);

    function applyScenario(key) {
      const s = SCENARIOS[key].connection;
      form.protocol.value = s.protocol || 'tcp';
      form.srcIp.value = s.srcIp || '';
      form.srcPort.value = s.srcPort || '';
      form.dstIp.value = s.dstIp || '';
      form.dstPort.value = s.dstPort || '';
      form.declaredApp.value = s.declaredApp || '';
      form.urlDomain.value = s.domain || s.url || '';
      form.fileName.value = s.fileName || '';
      form.fileHash.value = s.fileHash || '';
      form.payloadSignature.value = s.payloadSignature || '';
      form.encrypted.checked = !!s.encrypted;
      mode.value = 'both';
    }

    body.appendChild(Lab.el('div', { class: 'toolbar' }, [
      Lab.el('span', { class: 'muted' }, 'Load a preset: '),
      ...Object.entries(SCENARIOS).map(([key, s]) => Lab.el('button', { class: 'secondary', onclick: () => applyScenario(key) }, s.label)),
    ]));

    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Protocol'), form.protocol]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Ingress interface'), ifaceSelect]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Mode'), mode]),
    ]));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Source IP'), form.srcIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Source port'), form.srcPort]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Destination IP'), form.dstIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Destination port'), form.dstPort]),
    ]));
    body.appendChild(Lab.el('h4', {}, "What's really inside this flow (NGFW-visible signals)"));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Real application'), form.declaredApp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Domain / URL'), form.urlDomain]),
    ]));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'File name'), form.fileName]),
      Lab.el('div', {}, [Lab.el('label', {}, 'File SHA-256'), form.fileHash]),
    ]));
    body.appendChild(Lab.el('label', {}, 'Payload signature (free text, checked against IPS signatures)'));
    body.appendChild(form.payloadSignature);
    body.appendChild(Lab.el('label', {}, [form.encrypted, ' This session is encrypted (TLS)']));

    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const connection = {
          protocol: form.protocol.value,
          srcIp: form.srcIp.value.trim(),
          srcPort: Number(form.srcPort.value) || undefined,
          dstIp: form.dstIp.value.trim(),
          dstPort: Number(form.dstPort.value),
          ingressInterfaceId: ifaceSelect.value,
          declaredApp: form.declaredApp.value.trim() || undefined,
          url: form.urlDomain.value.trim() || undefined,
          domain: form.urlDomain.value.trim() || undefined,
          fileName: form.fileName.value.trim() || undefined,
          fileHash: form.fileHash.value.trim() || undefined,
          payloadSignature: form.payloadSignature.value.trim() || undefined,
          encrypted: form.encrypted.checked,
        };
        output.innerHTML = '<p class="muted">Evaluating...</p>';
        if (mode.value === 'both') {
          const result = await Lab.fetchJSON('/api/connection/evaluate-both', { method: 'POST', body: { connection } });
          output.innerHTML = '';
          const grid = Lab.el('div', { class: 'compare-grid' }, [
            Lab.el('div', { class: 'compare-col' }, [Lab.el('h4', {}, 'Traditional Firewall'), Lab.renderTrace(result.traditional)]),
            Lab.el('div', { class: 'compare-col' }, [Lab.el('h4', {}, 'NGFW'), Lab.renderTrace(result.ngfw)]),
          ]);
          output.appendChild(grid);
          output.appendChild(Lab.el('div', { class: `divergence-callout ${result.divergence.differs ? '' : 'no-divergence'}` },
            result.divergence.differs ? result.divergence.summary : 'Both rulebases reached the same verdict for this connection -- try a preset scenario above to see them disagree.'));
        } else {
          const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: mode.value } });
          output.innerHTML = '';
          output.appendChild(Lab.renderTrace(result));
        }
      },
    }, 'Run through the firewall'));
    body.appendChild(output);
  },
});
