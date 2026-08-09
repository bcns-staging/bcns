Lab.registerPage('headers', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Received Chain & Spoofing Tricks', route: 'headers' });
    body.innerHTML = '';

    body.appendChild(Lab.el('h3', {}, 'Build a Received header chain'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Each row is one hop, oldest (the original sender) first. This is exactly how a message picks up one Received header per server it passes through -- read them bottom-to-top to trace a message\'s real path.'));

    const rows = [
      { fromHost: 'laptop.alice.local', fromIp: '203.0.113.10', byHost: 'mx1.sender.local' },
      { fromHost: 'mx1.sender.local', fromIp: '203.0.113.20', byHost: 'mx.lab.local' },
    ];
    const rowsContainer = Lab.el('div', {});
    function renderRows() {
      rowsContainer.innerHTML = '';
      rows.forEach((row, i) => {
        const fromHost = Lab.el('input', { type: 'text', value: row.fromHost, oninput: (e) => { row.fromHost = e.target.value; } });
        const fromIp = Lab.el('input', { type: 'text', value: row.fromIp, oninput: (e) => { row.fromIp = e.target.value; } });
        const byHost = Lab.el('input', { type: 'text', value: row.byHost, oninput: (e) => { row.byHost = e.target.value; } });
        rowsContainer.appendChild(Lab.el('div', { class: 'field-row' }, [
          Lab.el('div', {}, [Lab.el('label', {}, `Hop ${i + 1}: from host`), fromHost]),
          Lab.el('div', {}, [Lab.el('label', {}, 'from IP'), fromIp]),
          Lab.el('div', {}, [Lab.el('label', {}, 'by (receiving) host'), byHost]),
        ]));
      });
    }
    renderRows();
    body.appendChild(rowsContainer);
    body.appendChild(Lab.el('button', { class: 'secondary', onclick: () => { rows.push({ fromHost: '', fromIp: '', byHost: '' }); renderRows(); } }, '+ Add hop'));

    const chainOutput = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/headers/received-chain', { method: 'POST', body: { hops: rows.map((r) => ({ ...r, forAddress: 'bob@example.com' })) } });
        chainOutput.innerHTML = '';
        chainOutput.appendChild(Lab.el('p', {}, 'Newest hop first (how a mail client displays it):'));
        chainOutput.appendChild(Lab.el('pre', { class: 'code-block' }, res.chain.map((c) => `Received: ${c}`).join('\n\n')));
      },
    }, 'Build chain'));
    body.appendChild(chainOutput);

    body.appendChild(Lab.el('hr', { class: 'sep' }));
    body.appendChild(Lab.el('h3', {}, 'From vs. Reply-To vs. Return-Path'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'These three addresses can all legitimately differ -- but attackers exploit that fact. Try setting a trustworthy From with a Reply-To pointing somewhere else entirely.'));
    const fromAddr = Lab.el('input', { type: 'text', value: 'Alice Smith <alice@mycompany.local>' });
    const replyToAddr = Lab.el('input', { type: 'text', placeholder: 'e.g. payments@attacker.com' });
    const returnPathAddr = Lab.el('input', { type: 'text', placeholder: 'e.g. bounces@sender-infra.com' });
    const summary = Lab.el('p', {});
    function updateSummary() {
      const replyDest = replyToAddr.value.trim() || fromAddr.value;
      summary.textContent = `If a recipient hits "Reply" without checking, their response goes to ${replyDest} -- and neither SPF, DKIM, nor DMARC say anything about Reply-To at all, since it plays no role in authentication.`;
    }
    [fromAddr, replyToAddr, returnPathAddr].forEach((el) => el.addEventListener('input', updateSummary));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'From (what the recipient sees)'), fromAddr]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Reply-To (where "Reply" actually goes)'), replyToAddr]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Return-Path (where bounces go)'), returnPathAddr]),
    ]));
    body.appendChild(Lab.el('div', { class: 'email-preview' }, [
      Lab.el('div', { class: 'hdr-row' }, [Lab.el('b', {}, 'From: '), fromAddr.value]),
    ]));
    updateSummary();
    body.appendChild(summary);
  },
});
