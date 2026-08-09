Lab.registerPage('dane', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'DANE / TLSA', route: 'dane' });
    body.innerHTML = '';

    const mxHost = Lab.el('input', { type: 'text', placeholder: 'mail.mycompany.local', value: 'mail.mycompany.local' });
    const port = Lab.el('input', { type: 'number', value: '25' });
    const certOutput = Lab.el('div', {});
    const verifyOutput = Lab.el('div', {});

    body.appendChild(Lab.el('h3', {}, 'MX host & certificate'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'MX host'), mxHost]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Port'), port]),
    ]));
    body.appendChild(Lab.el('div', { class: 'toolbar' }, [
      Lab.el('button', {
        onclick: async () => {
          const { cert } = await Lab.fetchJSON(`/api/dane/${encodeURIComponent(mxHost.value)}/cert`, { method: 'POST' });
          certOutput.innerHTML = '';
          certOutput.appendChild(Lab.el('p', {}, `Issued/rotated certificate for ${mxHost.value}. Fingerprint: `));
          certOutput.appendChild(Lab.el('pre', { class: 'code-block' }, cert.fingerprint));
        },
      }, 'Issue / Rotate Certificate'),
      Lab.el('button', {
        class: 'secondary',
        onclick: async () => {
          const record = await Lab.fetchJSON(`/api/dane/${encodeURIComponent(mxHost.value)}/tlsa`, { method: 'POST', body: { port: Number(port.value) } });
          certOutput.innerHTML = '';
          certOutput.appendChild(Lab.el('p', {}, 'Published TLSA record:'));
          certOutput.appendChild(Lab.el('pre', { class: 'code-block' }, `_${port.value}._tcp.${mxHost.value} TLSA "${record.record.value}"`));
        },
      }, 'Publish TLSA record'),
    ]));
    body.appendChild(certOutput);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Verify the connection'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'After publishing a TLSA record, try rotating the certificate again without re-publishing -- verification should then fail, exactly like a real DANE mismatch.'));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON(`/api/dane/${encodeURIComponent(mxHost.value)}/verify`, { method: 'POST', body: { port: Number(port.value) } });
        verifyOutput.innerHTML = '';
        verifyOutput.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.daneUsed ? (res.valid ? 'pass' : 'fail') : 'neutral'}` }, res.daneUsed ? (res.valid ? 'DANE valid' : 'DANE mismatch') : 'DANE not used')));
        verifyOutput.appendChild(Lab.el('pre', { class: 'trace-log' }, res.trace.join('\n')));
      },
    }, 'Verify'));
    body.appendChild(verifyOutput);
  },
});
