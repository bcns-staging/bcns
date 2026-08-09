Lab.registerPage('bec', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'BEC Detection', route: 'bec' });
    body.innerHTML = '';

    const displayName = Lab.el('input', { type: 'text', placeholder: 'Jane CEO' });
    const fromEmail = Lab.el('input', { type: 'text', placeholder: 'jane.ceo@attacker.com' });
    const replyTo = Lab.el('input', { type: 'text', placeholder: '(optional) reply-to address' });
    const subject = Lab.el('input', { type: 'text', placeholder: 'URGENT: wire transfer needed', value: 'URGENT: wire transfer needed today' });
    const bodyText = Lab.el('textarea', {}, 'Hi, I need you to process a wire transfer ASAP. This is confidential, please don\'t discuss with anyone else. Send the bank details once done.');
    const output = Lab.el('div', {});

    body.appendChild(Lab.el('p', { class: 'muted' }, 'This combines the Display-Name Spoofing and Lookalike Domain checks with Reply-To mismatch and fraud-language detection into one composite risk score -- add a known contact on the Display-Name Spoofing page first to see impersonation scoring kick in.'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Display name'), displayName]),
      Lab.el('div', {}, [Lab.el('label', {}, 'From email'), fromEmail]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Reply-To'), replyTo]),
    ]));
    body.appendChild(Lab.el('label', {}, 'Subject'));
    body.appendChild(subject);
    body.appendChild(Lab.el('label', {}, 'Body'));
    body.appendChild(bodyText);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/bec/score', {
          method: 'POST',
          body: { displayName: displayName.value, fromEmail: fromEmail.value, replyTo: replyTo.value, subject: subject.value, body: bodyText.value },
        });
        output.innerHTML = '';
        output.appendChild(Lab.el('p', {}, [Lab.el('span', { class: `badge ${res.verdict === 'high-risk' ? 'fail' : res.verdict === 'medium-risk' ? 'warn' : 'pass'}` }, `${res.verdict} (score ${res.points})`)]));
        for (const s of res.signals) output.appendChild(Lab.el('p', {}, `[+${s.points}] ${s.detail}`));
      },
    }, 'Score message'));
    body.appendChild(output);
  },
});
