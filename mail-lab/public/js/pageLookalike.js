Lab.registerPage('lookalike', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Lookalike Domains', route: 'lookalike' });
    body.innerHTML = '';

    const domainsBox = Lab.el('div', {});
    async function refreshDomains() {
      const { domains } = await Lab.fetchJSON('/api/lookalike/domains');
      domainsBox.innerHTML = '';
      domainsBox.appendChild(Lab.el('table', { class: 'data-table' }, [
        Lab.el('tr', {}, [Lab.el('th', {}, 'Protected domain'), Lab.el('th', {}, '')]),
        ...(domains.length ? domains.map((d) => Lab.el('tr', {}, [
          Lab.el('td', { class: 'mono' }, d),
          Lab.el('td', {}, Lab.el('button', { class: 'danger', onclick: async () => { await Lab.fetchJSON(`/api/lookalike/domains/${encodeURIComponent(d)}`, { method: 'DELETE' }); refreshDomains(); } }, 'Remove')),
        ])) : [Lab.el('tr', {}, Lab.el('td', { colspan: '2', class: 'muted' }, 'No protected domains yet.'))]),
      ]));
    }

    body.appendChild(Lab.el('h3', {}, 'Protected brand domains'));
    const domainInput = Lab.el('input', { type: 'text', placeholder: 'mycompany.local' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), domainInput])]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainInput.value.trim()) return;
        await Lab.fetchJSON('/api/lookalike/domains', { method: 'POST', body: { domain: domainInput.value.trim() } });
        domainInput.value = '';
        refreshDomains();
      },
    }, 'Add'));
    body.appendChild(domainsBox);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Test a sender domain'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Try variations like a missing letter, an extra hyphen, "rn" instead of "m", or a "0" instead of "o".'));
    const testDomain = Lab.el('input', { type: 'text', placeholder: 'rnycompany.local' });
    const testOutput = Lab.el('div', {});
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Sender domain'), testDomain])]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/lookalike/check', { method: 'POST', body: { senderDomain: testDomain.value.trim() } });
        testOutput.innerHTML = '';
        testOutput.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.flagged ? 'fail' : 'pass'}` }, res.flagged ? 'lookalike detected' : 'no match')));
        for (const f of res.findings) {
          testOutput.appendChild(Lab.el('p', {}, `vs. ${f.protectedDomain}: edit distance ${f.rawDistance}${f.homoglyphTrick ? ' (homoglyph substitution detected)' : ''}${f.subdomainTrick ? ' (brand name embedded as a subdomain trick)' : ''}`));
        }
      },
    }, 'Check'));
    body.appendChild(testOutput);

    refreshDomains();
  },
});
