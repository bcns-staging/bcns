Lab.registerPage('smime', {
  state: {},
  render(container) {
    const body = Lab.renderLayout(container, { title: 'S/MIME', route: 'smime' });
    body.innerHTML = '';
    const state = this.state;

    const commonName = Lab.el('input', { type: 'text', value: 'Alice Smith' });
    const email = Lab.el('input', { type: 'text', value: 'alice@mycompany.local' });
    const certOutput = Lab.el('div', {});

    body.appendChild(Lab.el('h3', {}, 'Generate a self-signed certificate'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Common Name'), commonName]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Email'), email]),
    ]));
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const cert = await Lab.fetchJSON('/api/smime/generate-cert', { method: 'POST', body: { commonName: commonName.value, email: email.value } });
        state.cert = cert;
        certOutput.innerHTML = '';
        certOutput.appendChild(Lab.el('p', {}, 'Certificate (public, would be shared with recipients):'));
        certOutput.appendChild(Lab.el('pre', { class: 'code-block' }, cert.certPem));
        certOutput.appendChild(Lab.el('p', {}, [Lab.el('b', {}, 'Private key'), ' (kept secret -- shown here only for this local lab):']));
        certOutput.appendChild(Lab.el('pre', { class: 'code-block' }, cert.privateKeyPem));
      },
    }, 'Generate certificate'));
    body.appendChild(certOutput);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Sign a message'));
    const messageInput = Lab.el('textarea', {}, 'Hi Bob, please find the signed report attached. -- Alice');
    const signOutput = Lab.el('div', {});
    body.appendChild(messageInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!state.cert) { alert('Generate a certificate first.'); return; }
        const res = await Lab.fetchJSON('/api/smime/sign', { method: 'POST', body: { message: messageInput.value, certPem: state.cert.certPem, privateKeyPem: state.cert.privateKeyPem } });
        state.signature = res.signature;
        state.signedMessage = messageInput.value;
        signOutput.innerHTML = '';
        signOutput.appendChild(Lab.el('pre', { class: 'code-block' }, res.mimeText));
      },
    }, 'Sign'));
    body.appendChild(signOutput);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Verify'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Uses the message and signature from above by default -- edit the message to see verification fail.'));
    const verifyMessage = Lab.el('textarea', {});
    const verifyOutput = Lab.el('div', {});
    body.appendChild(verifyMessage);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!state.cert || !state.signature) { alert('Sign a message first.'); return; }
        const msg = verifyMessage.value.trim() || state.signedMessage;
        const res = await Lab.fetchJSON('/api/smime/verify', { method: 'POST', body: { message: msg, signature: state.signature, certPem: state.cert.certPem } });
        verifyOutput.innerHTML = '';
        verifyOutput.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.valid ? 'pass' : 'fail'}` }, res.valid ? 'valid' : 'invalid')));
        for (const r of res.reasons) verifyOutput.appendChild(Lab.el('p', {}, r));
        verifyOutput.appendChild(Lab.el('pre', { class: 'code-block' }, JSON.stringify(res.certInfo, null, 2)));
      },
    }, 'Verify (leave blank to use original message)'));
    body.appendChild(verifyOutput);
  },
});
