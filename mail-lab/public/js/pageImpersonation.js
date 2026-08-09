Lab.registerPage('impersonation', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Display-Name Spoofing', route: 'impersonation' });
    body.innerHTML = '';

    const contactsBox = Lab.el('div', {});
    async function refreshContacts() {
      const { contacts } = await Lab.fetchJSON('/api/impersonation/contacts');
      contactsBox.innerHTML = '';
      contactsBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Name'), Lab.el('th', {}, 'Real email'), Lab.el('th', {}, '')]),
        ...(contacts.length ? contacts.map((c) => Lab.el('tr', {}, [
          Lab.el('td', {}, c.name),
          Lab.el('td', { class: 'mono' }, c.email),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/impersonation/contacts/${encodeURIComponent(c.email)}`, { method: 'DELETE' }); refreshContacts(); } }, 'Remove')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '3', class: 'muted' }, 'No known contacts yet.'))]),
      ]));
    }

    body.appendChild(Lab.el('h3', {}, 'Known contacts (who your organization actually trusts)'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'This models a real gateway feature: a directory of trusted names/addresses to compare inbound display names against.'));
    const nameInput = Lab.el('input', { type: 'text', placeholder: 'Jane CEO' });
    const emailInput = Lab.el('input', { type: 'text', placeholder: 'jane@mycompany.local' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Display name'), nameInput]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Real email'), emailInput]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!nameInput.value.trim() || !emailInput.value.trim()) return;
        await Lab.fetchJSON('/api/impersonation/contacts', { method: 'POST', body: { name: nameInput.value.trim(), email: emailInput.value.trim() } });
        nameInput.value = ''; emailInput.value = '';
        refreshContacts();
      },
    }, 'Add contact'));
    body.appendChild(contactsBox);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Test an inbound message'));
    const testName = Lab.el('input', { type: 'text', placeholder: 'display name shown to the recipient' });
    const testEmail = Lab.el('input', { type: 'text', placeholder: 'actual From email address' });
    const testOutput = Lab.el('div', {});
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Display name'), testName]),
      Lab.el('div', {}, [Lab.el('label', {}, 'From email'), testEmail]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/impersonation/check', { method: 'POST', body: { displayName: testName.value, fromEmail: testEmail.value } });
        testOutput.innerHTML = '';
        testOutput.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.flagged ? 'fail' : 'pass'}` }, res.flagged ? 'impersonation suspected' : 'no match found')));
        for (const f of res.findings) testOutput.appendChild(Lab.el('p', {}, f.reason));
      },
    }, 'Check'));
    body.appendChild(testOutput);

    refreshContacts();
  },
});
