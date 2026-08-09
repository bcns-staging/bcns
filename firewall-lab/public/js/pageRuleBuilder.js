Lab.registerPage('rule-builder', {
  editingId: null,

  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Rule Builder', route: 'rule-builder' });
    body.innerHTML = '';
    const page = this;
    page.editingId = null;

    const { zones } = await Lab.fetchJSON('/api/topology/zones');
    const zoneOptions = () => [Lab.el('option', { value: 'any' }, 'any'), ...zones.map((z) => Lab.el('option', { value: z.id }, z.name))];
    const zoneLabel = (id) => (id === 'any' ? 'any' : (zones.find((z) => z.id === id)?.name || id));

    const rulesetSelect = Lab.el('select', {}, [Lab.el('option', { value: 'traditional' }, 'Traditional'), Lab.el('option', { value: 'ngfw' }, 'NGFW')]);

    const form = {
      name: Lab.el('input', { type: 'text', placeholder: 'e.g. Allow Finance SaaS' }),
      srcZone: Lab.el('select', {}, zoneOptions()),
      dstZone: Lab.el('select', {}, zoneOptions()),
      srcIp: Lab.el('input', { type: 'text', value: 'any' }),
      dstIp: Lab.el('input', { type: 'text', value: 'any' }),
      protocol: Lab.el('select', {}, ['any', 'tcp', 'udp', 'icmp'].map((p) => Lab.el('option', { value: p }, p))),
      port: Lab.el('input', { type: 'text', value: 'any' }),
      action: Lab.el('select', {}, ['allow', 'deny'].map((a) => Lab.el('option', { value: a }, a))),
      log: Lab.el('input', { type: 'checkbox', checked: 'checked' }),
      app: Lab.el('input', { type: 'text', value: 'any' }),
      user: Lab.el('input', { type: 'text', value: 'any', placeholder: 'any, a username, or group:name' }),
      urlCategory: Lab.el('input', { type: 'text', value: 'any' }),
    };
    const profileChecks = {
      ips: Lab.el('input', { type: 'checkbox' }), antiMalware: Lab.el('input', { type: 'checkbox' }),
      urlFiltering: Lab.el('input', { type: 'checkbox' }), threatIntel: Lab.el('input', { type: 'checkbox' }), decrypt: Lab.el('input', { type: 'checkbox' }),
    };
    const ngfwFieldsWrap = Lab.el('div', {}, [
      Lab.el('h4', {}, 'NGFW match fields'),
      Lab.el('div', { class: 'field-row' }, [
        Lab.el('div', {}, [Lab.el('label', {}, 'App'), form.app]),
        Lab.el('div', {}, [Lab.el('label', {}, 'User / group:name'), form.user]),
        Lab.el('div', {}, [Lab.el('label', {}, 'URL category'), form.urlCategory]),
      ]),
      Lab.el('h4', {}, 'Inspection profile'),
      Lab.el('div', { class: 'card-grid' }, Object.entries(profileChecks).map(([k, el]) => Lab.el('label', {}, [el, ` ${k}`]))),
    ]);

    const listBox = Lab.el('div', {});
    const saveMsg = Lab.el('span', { class: 'muted' }, '');

    function updateModeVisibility() {
      ngfwFieldsWrap.style.display = rulesetSelect.value === 'ngfw' ? '' : 'none';
    }

    async function reorder(rows, from, to) {
      const ids = rows.map((r) => r.id);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      await Lab.fetchJSON(`/api/rules/${rulesetSelect.value}/reorder`, { method: 'POST', body: { order: ids } });
      refreshList();
    }

    function resetForm() {
      page.editingId = null;
      form.name.value = ''; form.srcZone.value = 'any'; form.dstZone.value = 'any'; form.srcIp.value = 'any'; form.dstIp.value = 'any';
      form.protocol.value = 'any'; form.port.value = 'any'; form.action.value = 'allow'; form.log.checked = true;
      form.app.value = 'any'; form.user.value = 'any'; form.urlCategory.value = 'any';
      for (const c of Object.values(profileChecks)) c.checked = false;
      saveMsg.textContent = '';
    }

    function loadForEdit(r) {
      page.editingId = r.id;
      form.name.value = r.name; form.srcZone.value = r.srcZone; form.dstZone.value = r.dstZone; form.srcIp.value = r.srcIp; form.dstIp.value = r.dstIp;
      form.protocol.value = r.protocol || 'any'; form.port.value = r.port == null ? 'any' : String(r.port); form.action.value = r.action; form.log.checked = !!r.log;
      if (rulesetSelect.value === 'ngfw') {
        form.app.value = r.app || 'any'; form.user.value = r.user || 'any'; form.urlCategory.value = r.urlCategory || 'any';
        for (const [k, el] of Object.entries(profileChecks)) el.checked = !!(r.profile && r.profile[k]);
      }
      saveMsg.textContent = `Editing "${r.name}"`;
      window.scrollTo(0, 0);
    }

    async function refreshList() {
      const { rules } = await Lab.fetchJSON(`/api/rules/${rulesetSelect.value}`);
      const isNgfw = rulesetSelect.value === 'ngfw';
      listBox.innerHTML = '';
      const header = [Lab.el('th', {}, '#'), Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Zones'), Lab.el('th', {}, 'IP'), Lab.el('th', {}, 'Service')];
      if (isNgfw) header.push(Lab.el('th', {}, 'App'), Lab.el('th', {}, 'User'));
      header.push(Lab.el('th', {}, 'Action'), Lab.el('th', {}, 'Hits'), Lab.el('th', {}, ''));
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, header),
        ...rules.map((r, idx) => {
          const cells = [
            Lab.el('td', {}, String(r.order)), Lab.el('td', {}, r.name), Lab.el('td', {}, `${zoneLabel(r.srcZone)} -> ${zoneLabel(r.dstZone)}`),
            Lab.el('td', { class: 'mono' }, `${r.srcIp} -> ${r.dstIp}`), Lab.el('td', { class: 'mono' }, `${r.protocol || 'any'}/${r.port ?? 'any'}`),
          ];
          if (isNgfw) cells.push(Lab.el('td', {}, r.app || 'any'), Lab.el('td', {}, r.user || 'any'));
          cells.push(
            Lab.el('td', {}, Lab.el('span', { class: `badge ${r.action}` }, r.action)),
            Lab.el('td', {}, String(r.hitCount || 0)),
            Lab.el('td', {}, [
              Lab.el('button', { class: 'secondary', disabled: idx === 0 ? 'disabled' : null, onclick: () => reorder(rules, idx, idx - 1) }, '↑'),
              ' ',
              Lab.el('button', { class: 'secondary', disabled: idx === rules.length - 1 ? 'disabled' : null, onclick: () => reorder(rules, idx, idx + 1) }, '↓'),
              ' ',
              Lab.el('button', { class: 'secondary', onclick: () => loadForEdit(r) }, 'Edit'),
              ' ',
              Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/rules/${rulesetSelect.value}/${r.id}`, { method: 'DELETE' }); refreshList(); } }, 'Delete'),
            ]),
          );
          return Lab.el('tr', {}, cells);
        }),
      ]));
    }
    rulesetSelect.addEventListener('change', () => { updateModeVisibility(); resetForm(); refreshList(); });

    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Ruleset'), rulesetSelect])]));
    body.appendChild(Lab.el('h3', {}, 'Rules (top to bottom, first match wins)'));
    body.appendChild(listBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    body.appendChild(Lab.el('h3', {}, 'Add / edit a rule'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Name'), form.name])]));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Source zone'), form.srcZone]), Lab.el('div', {}, [Lab.el('label', {}, 'Dest zone'), form.dstZone]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Source IP'), form.srcIp]), Lab.el('div', {}, [Lab.el('label', {}, 'Dest IP'), form.dstIp]),
    ]));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Protocol'), form.protocol]), Lab.el('div', {}, [Lab.el('label', {}, 'Port'), form.port]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Action'), form.action]),
    ]));
    body.appendChild(Lab.el('label', {}, [form.log, ' Log matches']));
    body.appendChild(ngfwFieldsWrap);

    body.appendChild(Lab.el('div', { class: 'toolbar' }, [
      Lab.el('button', {
        onclick: async () => {
          const isNgfw = rulesetSelect.value === 'ngfw';
          const payload = {
            name: form.name.value.trim(), srcZone: form.srcZone.value, dstZone: form.dstZone.value,
            srcIp: form.srcIp.value.trim() || 'any', dstIp: form.dstIp.value.trim() || 'any',
            protocol: form.protocol.value, port: form.port.value === 'any' ? 'any' : Number(form.port.value),
            action: form.action.value, log: form.log.checked,
          };
          if (isNgfw) {
            payload.app = form.app.value.trim() || 'any';
            payload.user = form.user.value.trim() || 'any';
            payload.urlCategory = form.urlCategory.value.trim() || 'any';
            payload.profile = Object.fromEntries(Object.entries(profileChecks).map(([k, el]) => [k, el.checked]));
          }
          if (!payload.name) { saveMsg.textContent = 'Name is required.'; return; }
          if (page.editingId) await Lab.fetchJSON(`/api/rules/${rulesetSelect.value}/${page.editingId}`, { method: 'PUT', body: payload });
          else await Lab.fetchJSON(`/api/rules/${rulesetSelect.value}`, { method: 'POST', body: payload });
          saveMsg.textContent = 'Saved.';
          resetForm(); refreshList();
        },
      }, 'Save rule'),
      Lab.el('button', { class: 'secondary', onclick: resetForm }, 'New (clear form)'),
      saveMsg,
    ]));

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Test traffic'));
    const { interfaces } = await Lab.fetchJSON('/api/topology/interfaces');
    const ifaceSelect = Lab.el('select', {}, interfaces.map((i) => Lab.el('option', { value: i.id }, i.name)));
    const testSrcIp = Lab.el('input', { type: 'text', value: '10.0.0.50' });
    const testDstIp = Lab.el('input', { type: 'text', value: '203.0.113.20' });
    const testDstPort = Lab.el('input', { type: 'number', value: '443' });
    const testProtocol = Lab.el('select', {}, ['tcp', 'udp', 'icmp'].map((p) => Lab.el('option', { value: p }, p)));
    const testApp = Lab.el('input', { type: 'text', placeholder: '(ngfw only) real app' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Ingress interface'), ifaceSelect]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Protocol'), testProtocol]),
    ]));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Source IP'), testSrcIp]), Lab.el('div', {}, [Lab.el('label', {}, 'Dest IP'), testDstIp]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Dest port'), testDstPort]), Lab.el('div', {}, [Lab.el('label', {}, 'Real app (NGFW)'), testApp]),
    ]));
    const testOutput = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const connection = { protocol: testProtocol.value, srcIp: testSrcIp.value.trim(), srcPort: 51000, dstIp: testDstIp.value.trim(), dstPort: Number(testDstPort.value), ingressInterfaceId: ifaceSelect.value, declaredApp: testApp.value.trim() || undefined, encrypted: true };
        const result = await Lab.fetchJSON('/api/connection/evaluate', { method: 'POST', body: { connection, ruleset: rulesetSelect.value } });
        testOutput.innerHTML = '';
        testOutput.appendChild(Lab.renderTrace(result));
        refreshList();
      },
    }, 'Test'));
    body.appendChild(testOutput);

    updateModeVisibility();
    refreshList();
  },
});
