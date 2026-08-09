Lab.registerPage('transport', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'STARTTLS', route: 'transport' });
    body.innerHTML = '';

    const fromHost = Lab.el('input', { type: 'text', value: 'sender.local' });
    const toHost = Lab.el('input', { type: 'text', value: 'mx.lab.local' });
    const useTls = Lab.el('input', { type: 'checkbox', checked: '' });
    const output = Lab.el('div', {});

    body.appendChild(Lab.el('h3', {}, 'Simulate an SMTP session'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Sending host'), fromHost]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Receiving host'), toHost]),
      Lab.el('div', {}, [Lab.el('label', {}, [useTls, ' Offer STARTTLS'])]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/transport/simulate', {
          method: 'POST',
          body: { fromHost: fromHost.value, toHost: toHost.value, useTls: useTls.checked },
        });
        output.innerHTML = '';
        output.appendChild(Lab.el('pre', { class: 'trace-log' }, res.transcript.join('\n')));
        if (res.warning) output.appendChild(Lab.el('p', { class: 'error-block', style: 'padding:10px;border-radius:6px;' }, res.warning));
      },
    }, 'Run session'));
    body.appendChild(output);
  },
});
