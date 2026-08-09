Lab.registerPage('url-filtering', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'URL Filtering', route: 'url-filtering' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'Category map'));
    const listBox = Lab.el('div', {});
    async function refresh() {
      const { 'url-categories': rows } = await Lab.fetchJSON('/api/url-filtering/url-categories');
      listBox.innerHTML = '';
      listBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Domain'), Lab.el('th', {}, 'Category'), Lab.el('th', {}, '')]),
        ...(rows.length ? rows.map((c) => Lab.el('tr', {}, [
          Lab.el('td', { class: 'mono' }, c.domain), Lab.el('td', {}, c.category),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/url-filtering/url-categories/${c.id}`, { method: 'DELETE' }); refresh(); } }, 'Delete')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '3', class: 'muted' }, 'No entries yet.'))]),
      ]));
    }
    refresh();

    const domain = Lab.el('input', { type: 'text', placeholder: 'e.g. shopping-site.example' });
    const category = Lab.el('input', { type: 'text', placeholder: 'e.g. shopping' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), domain]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Category'), category]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domain.value.trim() || !category.value.trim()) return;
        await Lab.fetchJSON('/api/url-filtering/url-categories', { method: 'POST', body: { domain: domain.value.trim(), category: category.value.trim() } });
        domain.value = ''; category.value = '';
        refresh();
      },
    }, 'Add entry'));
    body.appendChild(listBox);
    body.appendChild(Lab.el('hr', { class: 'sep' }));

    body.appendChild(Lab.el('h3', {}, 'Categorize a URL'));
    const testUrl = Lab.el('input', { type: 'text', value: 'gambling-site.example' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'URL / domain'), testUrl])]));
    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const result = await Lab.fetchJSON('/api/url-filtering/categorize', { method: 'POST', body: { url: testUrl.value.trim() } });
        output.innerHTML = '';
        output.appendChild(Lab.el('p', {}, [Lab.el('span', { class: `badge ${['malware', 'gambling'].includes(result.category) ? 'bad' : 'neutral'}` }, result.category)]));
      },
    }, 'Categorize'));
    body.appendChild(output);
  },
});
