Lab.registerPage('dmarc', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'DMARC', route: 'dmarc' });
    body.innerHTML = '';

    const { domains } = await Lab.fetchJSON('/api/dns/domains');
    const domainSelect = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, '-- choose a domain --'),
      ...domains.map((d) => Lab.el('option', { value: d }, d)),
    ]);

    const pSelect = Lab.el('select', {}, ['none', 'quarantine', 'reject'].map((v) => Lab.el('option', { value: v }, v)));
    const spSelect = Lab.el('select', {}, ['(same as p)', 'none', 'quarantine', 'reject'].map((v) => Lab.el('option', { value: v }, v)));
    const pctInput = Lab.el('input', { type: 'number', value: '100', min: '0', max: '100' });
    const adkimSelect = Lab.el('select', {}, [Lab.el('option', { value: 'r' }, 'relaxed'), Lab.el('option', { value: 's' }, 'strict')]);
    const aspfSelect = Lab.el('select', {}, [Lab.el('option', { value: 'r' }, 'relaxed'), Lab.el('option', { value: 's' }, 'strict')]);
    const ruaInput = Lab.el('input', { type: 'text', placeholder: 'mailto:dmarc-reports@yourdomain (optional)' });
    const preview = Lab.el('pre', { class: 'code-block' }, '');
    const saveMsg = Lab.el('span', { class: 'muted' }, '');

    function buildRecord() {
      const tags = ['v=DMARC1', `p=${pSelect.value}`];
      if (spSelect.value !== '(same as p)') tags.push(`sp=${spSelect.value}`);
      tags.push(`adkim=${adkimSelect.value}`, `aspf=${aspfSelect.value}`, `pct=${pctInput.value}`);
      if (ruaInput.value.trim()) tags.push(`rua=${ruaInput.value.trim()}`);
      preview.textContent = tags.join('; ');
    }
    [pSelect, spSelect, pctInput, adkimSelect, aspfSelect, ruaInput].forEach((el) => el.addEventListener('input', buildRecord));
    buildRecord();

    body.appendChild(Lab.el('h3', {}, 'Build & publish a DMARC record'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Domain'), domainSelect])]));
    body.appendChild(Lab.el('div', { class: 'card-grid' }, [
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'p (policy)'), pSelect]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'sp (subdomain policy)'), spSelect]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'pct (% subject to policy)'), pctInput]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'adkim (DKIM alignment)'), adkimSelect]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'aspf (SPF alignment)'), aspfSelect]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'rua (aggregate reports)'), ruaInput]),
    ]));
    body.appendChild(Lab.el('h4', {}, 'Record preview'));
    body.appendChild(preview);
    body.appendChild(Lab.el('div', {}, [
      Lab.el('button', {
        onclick: async () => {
          if (!domainSelect.value) { saveMsg.textContent = 'Choose a domain first.'; return; }
          await Lab.fetchJSON(`/api/dns/${encodeURIComponent(domainSelect.value)}/records`, {
            method: 'POST',
            body: { name: `_dmarc.${domainSelect.value}`, type: 'TXT', value: preview.textContent },
          });
          saveMsg.textContent = `Published to _dmarc.${domainSelect.value}.`;
        },
      }, 'Publish this DMARC record'),
      ' ',
      saveMsg,
    ]));

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Test DMARC evaluation'));
    const testFromDomain = Lab.el('input', { type: 'text', placeholder: 'header-From domain' });
    const testSpfResult = Lab.el('select', {}, ['pass', 'fail', 'softfail', 'neutral', 'none', 'permerror', 'temperror'].map((v) => Lab.el('option', { value: v }, v)));
    const testSpfDomain = Lab.el('input', { type: 'text', placeholder: 'SPF-authenticated (envelope) domain' });
    const testDkimValid = Lab.el('input', { type: 'checkbox' });
    const testDkimDomain = Lab.el('input', { type: 'text', placeholder: 'DKIM d= domain' });
    const resultBox = Lab.el('div', {});

    body.appendChild(Lab.el('div', { class: 'card-grid' }, [
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'Header-From domain'), testFromDomain]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'SPF result'), testSpfResult]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'SPF-authenticated domain'), testSpfDomain]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'DKIM valid?'), Lab.el('label', {}, [testDkimValid, ' valid'])]),
      Lab.el('div', { class: 'card' }, [Lab.el('h4', {}, 'DKIM d= domain'), testDkimDomain]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        resultBox.innerHTML = '';
        const res = await Lab.fetchJSON('/api/dmarc/evaluate', {
          method: 'POST',
          body: {
            headerFromDomain: testFromDomain.value.trim(),
            spfResult: testSpfResult.value,
            spfDomain: testSpfDomain.value.trim(),
            dkimResults: testDkimDomain.value.trim() ? [{ domain: testDkimDomain.value.trim(), valid: testDkimValid.checked }] : [],
          },
        });
        resultBox.appendChild(Lab.el('p', {}, [
          Lab.el('span', { class: `badge ${res.result}` }, res.result),
          ' -> disposition: ',
          Lab.el('span', { class: `badge ${res.disposition}` }, res.disposition),
        ]));
        resultBox.appendChild(Lab.el('pre', { class: 'trace-log' }, res.trace.join('\n')));
      },
    }, 'Evaluate'));
    body.appendChild(resultBox);
  },
});
