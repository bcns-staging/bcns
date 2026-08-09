Lab.registerPage('user-id', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'User-ID', route: 'user-id' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'IP -> identity mappings'));
    const listBox = Lab.el('div', {});
    async function refresh() {
      const { users: rows } = await Lab.fetchJSON('/api/user-id/users');
      listBox.innerHTML = '';
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'IP'), Lab.el('th', {}, 'Username'), Lab.el('th', {}, 'Groups'), Lab.el('th', {}, '')]),
        ...(rows.length ? rows.map((u) => Lab.el('tr', {}, [
          Lab.el('td', { class: 'mono' }, u.ip), Lab.el('td', {}, u.username), Lab.el('td', {}, (u.groups || []).join(', ')),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/user-id/users/${u.id}`, { method: 'DELETE' }); refresh(); } }, 'Delete')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '4', class: 'muted' }, 'No mappings yet.'))]),
      ]));
    }
    refresh();

    const ip = Lab.el('input', { type: 'text', placeholder: 'e.g. 10.0.0.52' });
    const username = Lab.el('input', { type: 'text', placeholder: 'e.g. bwong' });
    const groups = Lab.el('input', { type: 'text', placeholder: 'comma-separated, e.g. engineering,all-employees' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'IP'), ip]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Username'), username]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Groups'), groups]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!ip.value.trim() || !username.value.trim()) return;
        await Lab.fetchJSON('/api/user-id/users', { method: 'POST', body: { ip: ip.value.trim(), username: username.value.trim(), groups: groups.value.split(',').map((s) => s.trim()).filter(Boolean) } });
        ip.value = ''; username.value = ''; groups.value = '';
        refresh();
      },
    }, 'Add mapping'));
    body.appendChild(listBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    body.appendChild(Lab.el('h3', {}, 'Resolve an IP'));
    const testIp = Lab.el('input', { type: 'text', value: '10.0.0.50' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'IP'), testIp])]));
    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const result = await Lab.fetchJSON(`/api/user-id/resolve/${encodeURIComponent(testIp.value.trim())}`);
        output.innerHTML = '';
        output.appendChild(Lab.el('p', {}, result.user ? `${testIp.value} -> ${result.user} (${result.groups.join(', ')})` : `No mapping for ${testIp.value} -- treated as an unknown user.`));
      },
    }, 'Resolve'));
    body.appendChild(output);
  },
});
