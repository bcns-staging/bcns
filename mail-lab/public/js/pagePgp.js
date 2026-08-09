Lab.registerPage('pgp', {
  state: {},
  render(container) {
    const body = Lab.renderLayout(container, { title: 'PGP', route: 'pgp' });
    body.innerHTML = '';
    const state = this.state;

    function keyCard(person) {
      const nameInput = Lab.el('input', { type: 'text', value: person === 'alice' ? 'Alice' : 'Bob' });
      const emailInput = Lab.el('input', { type: 'text', value: `${person}@mycompany.local` });
      const passInput = Lab.el('input', { type: 'text', placeholder: '(optional) passphrase', value: `${person}pass` });
      const out = Lab.el('div', {});
      const card = Lab.el('div', { class: 'card' }, [
        Lab.el('h4', {}, person === 'alice' ? 'Alice' : 'Bob'),
        Lab.el('label', {}, 'Name'), nameInput,
        Lab.el('label', {}, 'Email'), emailInput,
        Lab.el('label', {}, 'Passphrase'), passInput,
        Lab.el('button', {
          onclick: async () => {
            const keys = await Lab.fetchJSON('/api/pgp/generate-keys', { method: 'POST', body: { name: nameInput.value, email: emailInput.value, passphrase: passInput.value || undefined } });
            state[person] = { ...keys, passphrase: passInput.value || undefined };
            out.innerHTML = '';
            out.appendChild(Lab.el('p', { class: 'muted' }, 'Public key (share freely):'));
            out.appendChild(Lab.el('pre', { class: 'code-block' }, keys.publicKey));
          },
        }, `Generate ${person === 'alice' ? "Alice's" : "Bob's"} keypair`),
        out,
      ]);
      return card;
    }

    body.appendChild(Lab.el('h3', {}, 'Generate keypairs'));
    body.appendChild(Lab.el('div', { class: 'card-grid' }, [keyCard('alice'), keyCard('bob')]));

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Alice encrypts (and signs) a message for Bob'));
    const plaintext = Lab.el('textarea', {}, 'Hi Bob, the launch codes are 1-2-3-4. -- Alice');
    const encryptOutput = Lab.el('div', {});
    body.appendChild(plaintext);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!state.alice || !state.bob) { alert("Generate both Alice's and Bob's keypairs first."); return; }
        const res = await Lab.fetchJSON('/api/pgp/encrypt', {
          method: 'POST',
          body: { text: plaintext.value, publicKeyArmored: state.bob.publicKey, signingPrivateKeyArmored: state.alice.privateKey, passphrase: state.alice.passphrase },
        });
        state.encrypted = res.armoredMessage;
        encryptOutput.innerHTML = '';
        encryptOutput.appendChild(Lab.el('pre', { class: 'code-block' }, res.armoredMessage));
      },
    }, "Encrypt for Bob (signed as Alice)"));
    body.appendChild(encryptOutput);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, "Bob decrypts and verifies Alice's signature"));
    const decryptOutput = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!state.encrypted) { alert('Encrypt a message first.'); return; }
        const res = await Lab.fetchJSON('/api/pgp/decrypt', {
          method: 'POST',
          body: { armoredMessage: state.encrypted, privateKeyArmored: state.bob.privateKey, passphrase: state.bob.passphrase, publicKeyArmoredForVerify: state.alice.publicKey },
        });
        decryptOutput.innerHTML = '';
        decryptOutput.appendChild(Lab.el('p', {}, `Decrypted: "${res.data}"`));
        decryptOutput.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.signatureValid ? 'pass' : 'fail'}` }, res.signatureValid ? "Alice's signature valid" : 'signature invalid or missing')));
      },
    }, 'Decrypt as Bob'));
    body.appendChild(decryptOutput);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'Standalone cleartext signing'));
    const signText = Lab.el('textarea', {}, 'I, Alice, approve this transaction.');
    const signOutput = Lab.el('div', {});
    body.appendChild(signText);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!state.alice) { alert("Generate Alice's keypair first."); return; }
        const res = await Lab.fetchJSON('/api/pgp/sign', { method: 'POST', body: { text: signText.value, privateKeyArmored: state.alice.privateKey, passphrase: state.alice.passphrase } });
        state.signedMessage = res.armoredSignedMessage;
        signOutput.innerHTML = '';
        signOutput.appendChild(Lab.el('pre', { class: 'code-block' }, res.armoredSignedMessage));
      },
    }, 'Sign as Alice'));
    body.appendChild(signOutput);
    const verifyOutput = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      class: 'secondary',
      onclick: async () => {
        if (!state.signedMessage) { alert('Sign a message first.'); return; }
        const res = await Lab.fetchJSON('/api/pgp/verify', { method: 'POST', body: { armoredSignedMessage: state.signedMessage, publicKeyArmored: state.alice.publicKey } });
        verifyOutput.innerHTML = '';
        verifyOutput.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.valid ? 'pass' : 'fail'}` }, res.valid ? 'valid' : 'invalid')));
      },
    }, 'Verify signature'));
    body.appendChild(verifyOutput);
  },
});
