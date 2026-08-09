const DETECTOR_LABELS = {
  pattern: 'Pattern Matching', keyword: 'Keyword/Dictionary', proximity: 'Proximity/Context',
  edm: 'Exact Data Match', fingerprint: 'Document Fingerprinting', classifier: 'Statistical Classifier',
};
const CHANNELS = ['email', 'cloud', 'endpoint', 'file-share'];
const ACTIONS = ['alert', 'redact', 'encrypt', 'quarantine', 'block', 'allow'];

Lab.registerPage('policy-builder', {
  editingId: null,

  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Policy Builder', route: 'policy-builder' });
    body.innerHTML = '';
    const page = this;

    const listBox = Lab.el('div', {});
    async function refreshList() {
      const { policies } = await Lab.fetchJSON('/api/policies');
      listBox.innerHTML = '';
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Channels'), Lab.el('th', {}, 'Action'), Lab.el('th', {}, 'Mode'), Lab.el('th', {}, '')]),
        ...(policies.length ? policies.map((p) => Lab.el('tr', {}, [
          Lab.el('td', {}, p.name),
          Lab.el('td', {}, p.channels.join(', ') || '-'),
          Lab.el('td', {}, Lab.el('span', { class: `badge ${p.action}` }, p.action)),
          Lab.el('td', {}, Lab.el('span', { class: `badge ${p.mode}` }, p.mode)),
          Lab.el('td', {}, [
            Lab.el('button', { class: 'secondary', onclick: () => page.loadForEdit(p, form) }, 'Edit'),
            ' ',
            Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/policies/${p.id}`, { method: 'DELETE' }); refreshList(); refreshPolicySelect(); } }, 'Delete'),
          ]),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '5', class: 'muted' }, 'No policies yet.'))]),
      ]));
    }

    body.appendChild(Lab.el('h3', {}, 'Policies'));
    body.appendChild(listBox);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Build / edit a policy'));
    const { labels } = await Lab.fetchJSON('/api/labels');
    const form = {
      name: Lab.el('input', { type: 'text', placeholder: 'e.g. Block SSNs on email' }),
      threshold: Lab.el('input', { type: 'number', min: '0', max: '1', step: '0.05', value: '0.5' }),
      action: Lab.el('select', {}, ACTIONS.map((a) => Lab.el('option', { value: a }, a))),
      mode: Lab.el('select', {}, ['enforce', 'monitor'].map((m) => Lab.el('option', { value: m }, m))),
      requireJustification: Lab.el('input', { type: 'checkbox' }),
      recipients: Lab.el('input', { type: 'text', placeholder: 'comma-separated allowlisted recipients' }),
      users: Lab.el('input', { type: 'text', placeholder: 'comma-separated allowlisted users' }),
      minLabelRank: Lab.el('select', {}, [
        Lab.el('option', { value: '' }, '(no minimum -- applies regardless of label)'),
        ...labels.map((l) => Lab.el('option', { value: String(l.rank) }, `${l.name} or higher`)),
      ]),
    };
    const channelChecks = Object.fromEntries(CHANNELS.map((c) => [c, Lab.el('input', { type: 'checkbox' })]));
    const detectorChecks = Object.fromEntries(Object.keys(DETECTOR_LABELS).map((d) => [d, Lab.el('input', { type: 'checkbox', checked: d === 'pattern' ? '' : null })]));
    const detectorWeights = Object.fromEntries(Object.keys(DETECTOR_LABELS).map((d) => [d, Lab.el('input', { type: 'number', min: '0', max: '1', step: '0.1', value: '1' })]));

    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Policy name'), form.name]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Threshold (0-1)'), form.threshold]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Action'), form.action]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Mode'), form.mode]),
    ]));
    body.appendChild(Lab.el('label', {}, [form.requireJustification, ' Require end-user justification (policy tip) instead of silently applying the action']));
    body.appendChild(Lab.el('label', {}, 'Only applies to content labeled'));
    body.appendChild(form.minLabelRank);

    body.appendChild(Lab.el('h4', {}, 'Applies to channels'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, CHANNELS.map((c) => Lab.el('label', {}, [channelChecks[c], ` ${c}`]))));

    body.appendChild(Lab.el('h4', {}, 'Detectors & weights'));
    body.appendChild(Lab.el('div', { class: 'card-grid' }, Object.entries(DETECTOR_LABELS).map(([d, label]) => Lab.el('div', { class: 'card' }, [
      Lab.el('label', {}, [detectorChecks[d], ` ${label}`]),
      Lab.el('label', {}, 'Weight'),
      detectorWeights[d],
    ]))));

    body.appendChild(Lab.el('h4', {}, 'Exceptions'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Allowlisted recipients'), form.recipients]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Allowlisted users'), form.users]),
    ]));

    const saveMsg = Lab.el('span', { class: 'muted' }, '');
    body.appendChild(Lab.el('div', { class: 'toolbar' }, [
      Lab.el('button', {
        onclick: async () => {
          const detectors = Object.keys(DETECTOR_LABELS).filter((d) => detectorChecks[d].checked).map((d) => ({ type: d, weight: Number(detectorWeights[d].value) }));
          const body2 = {
            name: form.name.value.trim(),
            channels: CHANNELS.filter((c) => channelChecks[c].checked),
            detectors,
            threshold: Number(form.threshold.value),
            action: form.action.value,
            mode: form.mode.value,
            requireJustification: form.requireJustification.checked,
            exceptions: {
              recipients: form.recipients.value.split(',').map((s) => s.trim()).filter(Boolean),
              users: form.users.value.split(',').map((s) => s.trim()).filter(Boolean),
            },
            minLabelRank: form.minLabelRank.value === '' ? null : Number(form.minLabelRank.value),
          };
          if (!body2.name || !detectors.length) { saveMsg.textContent = 'Name and at least one detector are required.'; return; }
          if (page.editingId) {
            await Lab.fetchJSON(`/api/policies/${page.editingId}`, { method: 'PUT', body: body2 });
          } else {
            await Lab.fetchJSON('/api/policies', { method: 'POST', body: body2 });
          }
          saveMsg.textContent = 'Saved.';
          page.editingId = null;
          refreshList();
          refreshPolicySelect();
        },
      }, 'Save policy'),
      Lab.el('button', { class: 'secondary', onclick: () => { page.editingId = null; page.resetForm(form, channelChecks, detectorChecks, detectorWeights); saveMsg.textContent = ''; } }, 'New (clear form)'),
      saveMsg,
    ]));

    this.loadForEdit = (p, f) => {
      page.editingId = p.id;
      f.name.value = p.name;
      f.threshold.value = p.threshold;
      f.action.value = p.action;
      f.mode.value = p.mode;
      f.requireJustification.checked = p.requireJustification;
      f.recipients.value = (p.exceptions?.recipients || []).join(', ');
      f.users.value = (p.exceptions?.users || []).join(', ');
      f.minLabelRank.value = p.minLabelRank == null ? '' : String(p.minLabelRank);
      for (const c of CHANNELS) channelChecks[c].checked = p.channels.includes(c);
      for (const d of Object.keys(DETECTOR_LABELS)) {
        const det = p.detectors.find((x) => x.type === d);
        detectorChecks[d].checked = !!det;
        detectorWeights[d].value = det ? det.weight : 1;
      }
      saveMsg.textContent = `Editing "${p.name}"`;
      window.scrollTo(0, 0);
    };
    this.resetForm = (f, cc, dc, dw) => {
      f.name.value = ''; f.threshold.value = '0.5'; f.action.value = 'alert'; f.mode.value = 'enforce';
      f.requireJustification.checked = false; f.recipients.value = ''; f.users.value = ''; f.minLabelRank.value = '';
      for (const c of CHANNELS) cc[c].checked = false;
      for (const d of Object.keys(DETECTOR_LABELS)) { dc[d].checked = false; dw[d].value = 1; }
    };

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Test a policy'));
    const policySelect = Lab.el('select', {});
    async function refreshPolicySelect() {
      const { policies } = await Lab.fetchJSON('/api/policies');
      policySelect.innerHTML = '';
      policySelect.appendChild(Lab.el('option', { value: '' }, '-- choose a policy --'));
      for (const p of policies) policySelect.appendChild(Lab.el('option', { value: p.id }, p.name));
    }
    const testContent = Lab.el('textarea', {}, 'My SSN is 123-45-6789.');
    const testRecipient = Lab.el('input', { type: 'text', placeholder: '(optional) recipient' });
    const testUser = Lab.el('input', { type: 'text', placeholder: '(optional) user' });
    const testJustification = Lab.el('input', { type: 'text', placeholder: '(optional) justification' });
    const testLabelRank = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, '(no label)'),
      ...labels.map((l) => Lab.el('option', { value: String(l.rank) }, l.name)),
    ]);
    const testOutput = Lab.el('div', {});
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Policy'), policySelect])]));
    body.appendChild(Lab.el('label', {}, 'Content'));
    body.appendChild(testContent);
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Recipient'), testRecipient]),
      Lab.el('div', {}, [Lab.el('label', {}, 'User'), testUser]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Justification'), testJustification]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Content label'), testLabelRank]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!policySelect.value) return;
        const res = await Lab.fetchJSON(`/api/policies/${policySelect.value}/evaluate`, {
          method: 'POST',
          body: { content: testContent.value, context: { recipient: testRecipient.value || undefined, user: testUser.value || undefined, justification: testJustification.value || undefined, labelRank: testLabelRank.value === '' ? undefined : Number(testLabelRank.value) } },
        });
        testOutput.innerHTML = '';
        testOutput.appendChild(Lab.el('p', {}, [
          Lab.el('span', { class: `badge ${res.action}` }, res.action),
          ` score ${res.score.toFixed(2)} (threshold ${res.threshold})`,
        ]));
        if (res.note) testOutput.appendChild(Lab.el('p', { class: 'muted' }, res.note));
        if (res.redactedContent) { testOutput.appendChild(Lab.el('h4', {}, 'Redacted content')); testOutput.appendChild(Lab.el('pre', { class: 'code-block' }, res.redactedContent)); }
        if (res.encryptedEnvelope) { testOutput.appendChild(Lab.el('h4', {}, 'Encrypted envelope')); testOutput.appendChild(Lab.el('pre', { class: 'code-block' }, JSON.stringify(res.encryptedEnvelope, null, 2))); }
      },
    }, 'Evaluate'));
    body.appendChild(testOutput);

    refreshList();
    refreshPolicySelect();
  },
});
