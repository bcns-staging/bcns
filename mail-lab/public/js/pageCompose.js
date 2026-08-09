Lab.registerPage('compose', {
  async render(container) {
    const body = Lab.renderLayout(container, { title: 'Compose & Send Playground', route: 'compose' });
    body.innerHTML = '';

    const { domains } = await Lab.fetchJSON('/api/dns/domains');

    const envelopeFrom = Lab.el('input', { type: 'text', placeholder: 'alice@mycompany.local' });
    const senderIp = Lab.el('input', { type: 'text', placeholder: '203.0.113.10', value: '203.0.113.10' });
    const displayName = Lab.el('input', { type: 'text', placeholder: 'Alice Smith' });
    const headerFromEmail = Lab.el('input', { type: 'text', placeholder: 'alice@mycompany.local' });
    const replyTo = Lab.el('input', { type: 'text', placeholder: '(optional)' });
    const to = Lab.el('input', { type: 'text', placeholder: 'bob@example.com', value: 'bob@example.com' });
    const subject = Lab.el('input', { type: 'text', placeholder: 'Subject', value: 'Hello from the Email Security Lab' });
    const bodyText = Lab.el('textarea', {}, 'Hi Bob,\n\nThis is a test message sent from the local email security lab.\n\nThanks,\nAlice');

    const dkimEnabled = Lab.el('input', { type: 'checkbox' });
    const dkimDomain = Lab.el('select', {}, [
      Lab.el('option', { value: '' }, '-- domain --'),
      ...domains.map((d) => Lab.el('option', { value: d }, d)),
    ]);
    const dkimSelector = Lab.el('select', {});
    const forwardCheck = Lab.el('input', { type: 'checkbox' });

    async function refreshSelectors() {
      dkimSelector.innerHTML = '';
      if (!dkimDomain.value) return;
      const { keys } = await Lab.fetchJSON(`/api/dkim/${encodeURIComponent(dkimDomain.value)}/keys`);
      for (const k of keys) dkimSelector.appendChild(Lab.el('option', { value: k.selector }, k.selector));
      if (keys.length === 0) dkimSelector.appendChild(Lab.el('option', { value: '' }, '(no keys -- see DKIM page)'));
    }
    dkimDomain.addEventListener('change', refreshSelectors);

    body.appendChild(Lab.el('h3', {}, 'Compose'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Envelope From (MAIL FROM / Return-Path)'), envelopeFrom]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Sending IP'), senderIp]),
    ]));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'Header From -- display name'), displayName]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Header From -- email'), headerFromEmail]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Reply-To'), replyTo]),
    ]));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Notice these are two different fields: SPF checks the envelope sender\'s domain; DMARC alignment checks it against the header-From domain. Real spoofing attacks often mismatch these on purpose.'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'To'), to])]));
    body.appendChild(Lab.el('label', {}, 'Subject'));
    body.appendChild(subject);
    body.appendChild(Lab.el('label', {}, 'Body'));
    body.appendChild(bodyText);

    body.appendChild(Lab.el('h3', {}, 'Sending server options'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, [dkimEnabled, ' Sign with DKIM'])]),
      Lab.el('div', {}, [Lab.el('label', {}, 'DKIM domain'), dkimDomain]),
      Lab.el('div', {}, [Lab.el('label', {}, 'DKIM selector'), dkimSelector]),
    ]));
    body.appendChild(Lab.el('label', {}, [forwardCheck, ' Simulate this message passing through a mailing list / forwarder afterward (tests ARC)']));

    const attachmentName = Lab.el('input', { type: 'text', placeholder: '(optional) attachment filename, e.g. invoice.pdf.exe' });
    body.appendChild(Lab.el('div', { class: 'field-row' }, [Lab.el('div', {}, [Lab.el('label', {}, 'Attachment filename (metadata only, no real file)'), attachmentName])]));

    const output = Lab.el('div', {});
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        if (!envelopeFrom.value.trim() || !headerFromEmail.value.trim()) {
          alert('Envelope From and Header From email are required.');
          return;
        }
        output.innerHTML = '<p class="muted">Sending...</p>';
        const headerFrom = displayName.value.trim() ? `${displayName.value.trim()} <${headerFromEmail.value.trim()}>` : headerFromEmail.value.trim();
        try {
          const res = await Lab.fetchJSON('/api/compose/send', {
            method: 'POST',
            body: {
              envelopeFrom: envelopeFrom.value.trim(),
              senderIp: senderIp.value.trim(),
              headerFrom,
              replyTo: replyTo.value.trim() || undefined,
              to: to.value.trim(),
              subject: subject.value,
              body: bodyText.value,
              dkim: dkimEnabled.checked ? { enabled: true, domain: dkimDomain.value, selector: dkimSelector.value } : { enabled: false },
              simulateForward: forwardCheck.checked,
              attachment: attachmentName.value.trim() ? { filename: attachmentName.value.trim() } : undefined,
            },
          });
          renderResult(res);
        } catch (err) {
          output.innerHTML = `<pre class="error-block">${Lab.escapeHtml(err.message)}</pre>`;
        }
      },
    }, 'Send'));
    body.appendChild(output);

    function dispositionBadgeClass(disposition) {
      if (disposition.startsWith('none')) return 'pass';
      if (disposition === 'quarantine') return 'quarantine';
      return 'fail';
    }

    function renderResult(res) {
      output.innerHTML = '';
      output.appendChild(Lab.el('hr', { class: 'sep' }));
      output.appendChild(Lab.el('h3', {}, 'Result'));

      if (res.blockedBeforeSend) {
        output.appendChild(Lab.el('p', {}, Lab.el('span', { class: 'badge fail' }, 'blocked by your own outbound DLP -- never left the network')));
        output.appendChild(Lab.el('table', { class: 'data-table' }, [
          Lab.el('tr', {}, [Lab.el('th', {}, 'Type'), Lab.el('th', {}, 'Description'), Lab.el('th', {}, 'Match')]),
          ...res.dlp.findings.map((f) => Lab.el('tr', {}, [Lab.el('td', {}, f.type), Lab.el('td', {}, f.description), Lab.el('td', { class: 'mono' }, f.match)])),
        ]));
        output.appendChild(Lab.el('h4', {}, 'Trace'));
        output.appendChild(Lab.el('pre', { class: 'trace-log' }, res.trace.join('\n')));
        return;
      }

      output.appendChild(Lab.el('ul', { class: 'trace-steps' }, [
        Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'SPF'), Lab.el('span', { class: `badge ${res.spf.result}` }, res.spf.result)]),
        Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'DKIM'), Lab.el('span', { class: `badge ${res.dkim.length ? (res.dkim[0].valid ? 'pass' : 'fail') : 'none'}` }, res.dkim.length ? (res.dkim[0].valid ? 'pass' : 'fail') : 'none')]),
        Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'DMARC'), Lab.el('span', { class: `badge ${res.dmarc.result}` }, res.dmarc.result)]),
        Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'Gateway'), Lab.el('span', { class: `badge ${res.gateway.disposition === 'none' ? 'pass' : res.gateway.disposition}` }, res.gateway.reasons.length ? res.gateway.reasons.join(', ') : 'clean')]),
        Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'Disposition'), Lab.el('span', { class: `badge ${dispositionBadgeClass(res.disposition)}` }, res.disposition)]),
      ]));

      output.appendChild(Lab.el('h4', {}, 'Inbox preview'));
      const nameFromHeader = displayName.value.trim();
      const emailFromHeader = headerFromEmail.value.trim();
      output.appendChild(Lab.el('div', { class: 'email-preview' }, [
        Lab.el('div', { class: 'hdr-row' }, [Lab.el('b', {}, 'From: '), `${nameFromHeader ? nameFromHeader + ' ' : ''}<${emailFromHeader}>`]),
        Lab.el('div', { class: 'hdr-row' }, [Lab.el('b', {}, 'To: '), to.value]),
        Lab.el('div', { class: 'subject' }, subject.value),
        Lab.el('div', { class: 'body' }, res.body),
      ]));

      output.appendChild(Lab.el('h4', {}, 'Gateway checks'));
      output.appendChild(Lab.el('ul', { class: 'trace-steps' }, [
        Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'BEC score'), Lab.el('span', { class: `badge ${res.gateway.bec.verdict === 'high-risk' ? 'fail' : res.gateway.bec.verdict === 'medium-risk' ? 'warn' : 'pass'}` }, `${res.gateway.bec.verdict} (${res.gateway.bec.points})`)]),
        Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'Spam score'), Lab.el('span', { class: `badge ${res.gateway.spam.verdict === 'spam' ? 'fail' : res.gateway.spam.verdict === 'suspicious' ? 'warn' : 'pass'}` }, `${res.gateway.spam.verdict} (${res.gateway.spam.points})`)]),
        Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'Impersonation'), Lab.el('span', { class: `badge ${res.gateway.impersonation.flagged ? 'fail' : 'pass'}` }, res.gateway.impersonation.flagged ? 'flagged' : 'clean')]),
        Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'Lookalike domain'), Lab.el('span', { class: `badge ${res.gateway.lookalike.flagged ? 'fail' : 'pass'}` }, res.gateway.lookalike.flagged ? 'flagged' : 'clean')]),
        Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'Reputation'), Lab.el('span', { class: `badge ${(res.gateway.reputation.ip.listed || res.gateway.reputation.domain.listed) ? 'fail' : 'pass'}` }, (res.gateway.reputation.ip.listed || res.gateway.reputation.domain.listed) ? 'listed' : 'clean')]),
        ...(res.gateway.attachment ? [Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'Attachment'), Lab.el('span', { class: `badge ${res.gateway.attachment.verdict}` }, res.gateway.attachment.verdict)])] : []),
        ...(res.gateway.urlScans.length ? [Lab.el('li', {}, [Lab.el('span', { class: 'step-name' }, 'Links'), Lab.el('span', { class: `badge ${res.gateway.urlScans.some((s) => s.verdict === 'malicious') ? 'fail' : 'pass'}` }, `${res.gateway.urlScans.length} link(s) scanned`)])] : []),
      ]));
      if (res.dlp.flagged) {
        output.appendChild(Lab.el('p', {}, [Lab.el('span', { class: 'badge warn' }, 'DLP'), ' flagged (not blocking, per current settings): ', res.dlp.findings.map((f) => f.description).join(', ')]));
      }

      output.appendChild(Lab.el('h4', {}, 'Full headers ("Show Original")'));
      output.appendChild(Lab.el('pre', { class: 'code-block' }, res.fullHeaderBlock));

      if (res.arcVerification) {
        output.appendChild(Lab.el('h4', {}, 'ARC chain verification'));
        output.appendChild(Lab.el('p', {}, Lab.el('span', { class: `badge ${res.arcVerification.valid ? 'pass' : 'fail'}` }, `cv=${res.arcVerification.cv}`)));
      }

      if (res.quarantineEntry) {
        output.appendChild(Lab.el('p', {}, [Lab.el('span', { class: 'badge quarantine' }, 'held'), ` -- see the Quarantine Console (id ${res.quarantineEntry.id.slice(0, 8)}...)`]));
      }

      output.appendChild(Lab.el('h4', {}, 'Step-by-step trace'));
      output.appendChild(Lab.el('pre', { class: 'trace-log' }, res.trace.join('\n')));
    }
  },
});
