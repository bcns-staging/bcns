Lab.registerPage('cloud-channel', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Cloud / CASB Upload', route: 'cloud-channel' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'Sanctioned apps'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Apps not on this list are treated as unsanctioned -- any policy match escalates straight to a block, regardless of the policy\'s own configured action.'));
    const appsBox = Lab.el('div', {});
    async function refreshApps() {
      const { apps } = await Lab.fetchJSON('/api/channels/cloud/sanctioned-apps');
      appsBox.innerHTML = '';
      appsBox.appendChild(Lab.el('p', {}, apps.length ? apps.map((a) => `${a} `).join(', ') : 'none configured'));
    }
    const appNameInput = Lab.el('input', { type: 'text', placeholder: 'e.g. Corporate Drive' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'App name'), appNameInput])]));
    body.appendChild(Lab.el('button', { onclick: async () => { if (!appNameInput.value.trim()) return; await Lab.fetchJSON('/api/channels/cloud/sanctioned-apps', { method: 'POST', body: { name: appNameInput.value.trim() } }); appNameInput.value = ''; refreshApps(); } }, 'Mark sanctioned'));
    body.appendChild(appsBox);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Upload a file'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Create a policy tagged with the "cloud" channel on the Policy Builder page first. Try the same content going to a sanctioned app vs. an unsanctioned one.'));
    const user = Lab.el('input', { type: 'text', value: 'alice' });
    const filename = Lab.el('input', { type: 'text', value: 'customers.csv' });
    const destinationApp = Lab.el('input', { type: 'text', placeholder: 'e.g. Corporate Drive or Random App' });
    const content = Lab.el('textarea', {}, 'name,ssn\nJohn Smith,123-45-6789');
    const output = Lab.el('div', {});
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'User'), user]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Filename'), filename]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Destination app'), destinationApp]),
    ]));
    body.appendChild(Lab.el('label', {}, 'File content'));
    body.appendChild(content);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/channels/cloud/upload', { method: 'POST', body: { filename: filename.value, content: content.value, destinationApp: destinationApp.value, user: user.value } });
        output.innerHTML = '';
        output.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.sanctioned ? 'pass' : 'warn'}` }, res.sanctioned ? 'sanctioned destination' : 'UNSANCTIONED destination')));
        if (res.casbOverride) output.appendChild(Lab.el('p', {}, Lab.el('span', { class: 'badge high' }, 'CASB override applied -- escalated to block')));
        output.appendChild(Lab.el('p', {}, `Final action: `));
        output.appendChild(Lab.el('span', { class: `badge ${res.finalAction}` }, res.finalAction));
        output.appendChild(Lab.renderChannelResult(res.evaluation));
      },
    }, 'Upload'));
    body.appendChild(output);

    refreshApps();
  },
});
