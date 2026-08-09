Lab.registerPage('url-defense', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'URL Defense', route: 'url-defense' });
    body.innerHTML = '';

    const blocklistBox = Lab.el('div', {});
    async function refreshBlocklist() {
      const { patterns } = await Lab.fetchJSON('/api/url-defense/blocklist');
      blocklistBox.innerHTML = '';
      blocklistBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Blocked URL pattern'), Lab.el('th', {}, '')]),
        ...(patterns.length ? patterns.map((p) => Lab.el('tr', {}, [
          Lab.el('td', { class: 'mono' }, p),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/url-defense/blocklist/${encodeURIComponent(p)}`, { method: 'DELETE' }); refreshBlocklist(); } }, 'Remove')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '2', class: 'muted' }, 'No blocked patterns yet.'))]),
      ]));
    }

    body.appendChild(Lab.el('h3', {}, 'Malicious URL patterns (your gateway\'s threat intel)'));
    const patternInput = Lab.el('input', { type: 'text', placeholder: 'e.g. evil-login.example' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'URL pattern'), patternInput])]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!patternInput.value.trim()) return;
        await Lab.fetchJSON('/api/url-defense/blocklist', { method: 'POST', body: { pattern: patternInput.value.trim() } });
        patternInput.value = '';
        refreshBlocklist();
      },
    }, 'Add'));
    body.appendChild(blocklistBox);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Rewrite links in a message body'));
    const bodyInput = Lab.el('textarea', {}, 'Please review this document: http://evil-login.example/reset\n\nOr see our normal site: https://mycompany.local/docs');
    const rewriteOutput = Lab.el('div', {});
    body.appendChild(bodyInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/url-defense/rewrite', { method: 'POST', body: { body: bodyInput.value } });
        rewriteOutput.innerHTML = '';
        rewriteOutput.appendChild(Lab.el('h4', {}, 'Rewritten body (what the recipient actually sees)'));
        rewriteOutput.appendChild(Lab.el('pre', { class: 'code-block' }, res.rewritten));
        rewriteOutput.appendChild(Lab.el('h4', {}, 'Click-time scan of each link'));
        for (const u of res.originalUrls) {
          const scan = await Lab.fetchJSON('/api/url-defense/scan', { method: 'POST', body: { url: u } });
          rewriteOutput.appendChild(Lab.el('p', {}, [Lab.el('span', { class: `badge ${scan.verdict}` }, scan.verdict), ` ${u} -- ${scan.reason}`]));
        }
      },
    }, 'Rewrite & scan'));
    body.appendChild(rewriteOutput);

    refreshBlocklist();
  },
});
