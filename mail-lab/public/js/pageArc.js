Lab.registerPage('arc', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'ARC (Authenticated Received Chain)', route: 'arc' });
    body.innerHTML = '';

    const { domains } = await Lab.fetchJSON('/api/dns/domains');
    const domainSelect = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, '-- choose a domain with a DKIM key --' ),
      ...domains.map((d) => Lab.el('option', { value: d }, d)),
    ]);
    const selectorInput = Lab.el('input', { type: 'text', placeholder: 'DKIM selector to sign with', value: 'sel1' });
    const ipInput = Lab.el('input', { type: 'text', placeholder: 'sender IP', value: '203.0.113.10' });
    const output = Lab.el('div', {});

    body.appendChild(Lab.el('h3', {}, 'Run the ARC demo'));
    body.appendChild(Lab.el('p', {}, [
      'This sends a DKIM-signed message from a domain of your choosing, then simulates it passing through a mailing list ',
      Lab.el('code', {}, 'list.forwarder.lab'),
      ' that appends a footer and re-sends under its own envelope/IP -- breaking the original SPF and DKIM, exactly like a real mailing list would. Watch how ARC lets the final authentication result still be trusted.',
    ]));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Sending domain'), domainSelect]),
      Lab.el('div', {}, [Lab.el('label', {}, 'DKIM selector'), selectorInput]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Sender IP'), ipInput]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!domainSelect.value) { alert('Choose a domain that has SPF + a DKIM key configured (see the SPF and DKIM pages).'); return; }
        output.innerHTML = '<p class="muted">Running...</p>';
        const res = await Lab.fetchJSON('/api/compose/send', {
          method: 'POST',
          body: {
            envelopeFrom: `alice@${domainSelect.value}`,
            senderIp: ipInput.value.trim(),
            headerFrom: `Alice <alice@${domainSelect.value}>`,
            to: 'bob@example.com',
            subject: 'ARC demo message',
            body: 'This message is going to be forwarded through a simulated mailing list.',
            dkim: { enabled: true, domain: domainSelect.value, selector: selectorInput.value.trim() },
            simulateForward: true,
          },
        });
        output.innerHTML = '';
        output.appendChild(Lab.el('h4', {}, 'Result at the final hop (after forwarding)'));
        output.appendChild(Lab.el('ul', { class: 'trace-steps' }, [
          Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'SPF'), Lab.el('span', { class: `badge ${res.spf.result}` }, res.spf.result)]),
          Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'DKIM'), Lab.el('span', { class: `badge ${res.dkim[0]?.valid ? 'pass' : 'fail'}` }, res.dkim[0]?.valid ? 'pass' : 'fail (body changed)')]),
          Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'DMARC (native)'), Lab.el('span', { class: `badge ${res.dmarc.result}` }, res.dmarc.result)]),
          Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'ARC chain'), Lab.el('span', { class: `badge ${res.arcVerification?.cv === 'pass' ? 'pass' : 'fail'}` }, `cv=${res.arcVerification?.cv}`)]),
          Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'Final disposition'), Lab.el('span', { class: `badge ${res.arcOverrideApplied ? 'pass' : res.disposition}` }, res.disposition)]),
        ]));
        output.appendChild(Lab.el('h4', {}, 'ARC headers added by the forwarder'));
        output.appendChild(Lab.el('pre', { class: 'code-block' }, res.arcHeaders.map(([n, v]) => `${n}: ${v}`).join('\n\n')));
        output.appendChild(Lab.el('h4', {}, 'Full trace'));
        output.appendChild(Lab.el('pre', { class: 'trace-log' }, res.trace.join('\n')));
      },
    }, 'Simulate mailing-list forward'));
    body.appendChild(output);
  },
});
