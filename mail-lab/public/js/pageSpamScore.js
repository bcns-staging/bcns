Lab.registerPage('spam-score', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Spam Scoring', route: 'spam-score' });
    body.innerHTML = '';

    const subject = Lab.el('input', { type: 'text', value: 'FREE MONEY WINNER!!!' });
    const bodyText = Lab.el('textarea', {}, 'Claim your cash prize now! Click here click here click here click here.');
    const output = Lab.el('div', {});

    body.appendChild(Lab.el('label', {}, 'Subject'));
    body.appendChild(subject);
    body.appendChild(Lab.el('label', {}, 'Body'));
    body.appendChild(bodyText);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/spam-score/score', { method: 'POST', body: { subject: subject.value, body: bodyText.value } });
        output.innerHTML = '';
        output.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.verdict === 'spam' ? 'fail' : res.verdict === 'suspicious' ? 'warn' : 'pass'}` }, `${res.verdict} (score ${res.points})`)));
        for (const r of res.reasons) output.appendChild(Lab.el('p', {}, r));
      },
    }, 'Score'));
    body.appendChild(output);
  },
});
