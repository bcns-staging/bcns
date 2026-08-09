Lab.registerPage('home', {
  render(container) {
    container.innerHTML = '';
    const wrap = Lab.el('div', { class: 'page' });
    wrap.appendChild(Lab.el('h1', {}, 'Welcome to the DLP Learning Lab'));
    wrap.appendChild(Lab.el('div', { class: 'tutorial-pane' }, [
      Lab.el('p', {}, [
        'This is a ',
        Lab.el('b', {}, 'fully local'),
        ' playground for learning how Data Loss Prevention actually works: how sensitive content gets detected (regex, keyword lists, exact-data matching, document fingerprinting, statistical classification, file forensics, OCR), how a policy turns a detection into an action (block, quarantine, redact, encrypt, alert), and how all of that plays out across the channels a real DLP program watches -- email, cloud uploads, endpoints, and data at rest.',
      ]),
      Lab.el('p', {}, [
        'Nothing here touches real infrastructure. There\'s no real network egress, no real endpoint agent, no real cloud API -- every channel is simulated, but the detection logic underneath is real: genuine Luhn/IBAN checksums, genuine magic-byte file sniffing, a genuine trained Naive Bayes classifier, genuine salted-hash exact-data matching, and genuine AES encryption for the "encrypt on detect" action.',
      ]),
      Lab.el('h2', {}, 'Suggested path'),
      Lab.el('ol', { style: 'line-height:1.8' }, [
        Lab.el('li', {}, [Lab.el('a', { href: '#/datasets' }, 'Sensitive Data Sets'), ' — set up the keyword lists, sample records, and reference documents the detectors below will use.']),
        Lab.el('li', {}, [Lab.el('a', { href: '#/scan' }, 'Scan Playground'), ' — paste content and see every detection technique run against it at once.']),
        Lab.el('li', {}, 'Work through the individual Detection Techniques pages to understand each one in isolation.'),
        Lab.el('li', {}, [Lab.el('a', { href: '#/policy-builder' }, 'Policy Builder'), ' — combine detectors into a real policy with an action, mode, and exceptions.']),
        Lab.el('li', {}, [Lab.el('a', { href: '#/incidents' }, 'Incident Console'), ' — triage what your policies catch.']),
        Lab.el('li', {}, 'Explore the Channels and Advanced sections to see the same policy engine applied everywhere real DLP operates.'),
      ]),
    ]));
    container.appendChild(wrap);
  },
});
