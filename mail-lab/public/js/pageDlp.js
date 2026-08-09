Lab.registerPage('dlp', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Data Loss Prevention', route: 'dlp' });
    body.innerHTML = '';

    const textInput = Lab.el('textarea', {}, 'My SSN is 123-45-6789 and my card number is 4111 1111 1111 1111. Also here is a key: sk-abcdefghijklmnopqrstuvwx');
    const output = Lab.el('div', {});

    body.appendChild(Lab.el('label', {}, 'Outbound message content'));
    body.appendChild(textInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/dlp/scan', { method: 'POST', body: { text: textInput.value } });
        output.innerHTML = '';
        output.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.flagged ? 'fail' : 'pass'}` }, res.flagged ? 'would be blocked' : 'clean')));
        output.appendChild(Lab.el('table', { class: 'data-table' }, [
          Lab.el('tr', {}, [Lab.el('th', {}, 'Type'), Lab.el('th', {}, 'Description'), Lab.el('th', {}, 'Redacted match')]),
          ...res.findings.map((f) => Lab.el('tr', {}, [Lab.el('td', {}, f.type), Lab.el('td', {}, f.description), Lab.el('td', { class: 'mono' }, f.match)])),
        ]));
      },
    }, 'Scan'));
    body.appendChild(output);
  },
});
