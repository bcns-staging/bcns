Lab.registerPage('email-channel', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Email Egress', route: 'email-channel' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Create a policy tagged with the "email" channel on the Policy Builder page first, then send a test message here.'));
    const user = Lab.el('input', { type: 'text', placeholder: 'alice', value: 'alice' });
    const to = Lab.el('input', { type: 'text', placeholder: 'bob@external.com', value: 'bob@external.com' });
    const subject = Lab.el('input', { type: 'text', value: 'Customer records' });
    const bodyText = Lab.el('textarea', {}, 'Hi Bob,\n\nHere is the customer record you asked for: SSN 123-45-6789.\n\nThanks,\nAlice');
    const output = Lab.el('div', {});

    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'From (user)'), user]),
      Lab.el('div', {}, [Lab.el('label', {}, 'To'), to]),
    ]));
    body.appendChild(Lab.el('label', {}, 'Subject'));
    body.appendChild(subject);
    body.appendChild(Lab.el('label', {}, 'Body'));
    body.appendChild(bodyText);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/channels/email/send', { method: 'POST', body: { subject: subject.value, body: bodyText.value, to: to.value, user: user.value } });
        output.innerHTML = '';
        output.appendChild(Lab.renderChannelResult(res.evaluation));
      },
    }, 'Send'));
    body.appendChild(output);
  },
});
