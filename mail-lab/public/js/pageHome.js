Lab.registerPage('home', {
  render(container) {
    container.innerHTML = '';
    const wrap = Lab.el('div', { class: 'page' });
    wrap.appendChild(Lab.el('h1', {}, 'Welcome to the Email Security Lab'));
    wrap.appendChild(Lab.el('div', { class: 'tutorial-pane' }, [
      Lab.el('p', {}, [
        'This is a ',
        Lab.el('b', {}, 'fully local'),
        ' playground for learning how email authentication and secure-email-gateway defenses actually work: SPF, DKIM, DMARC, ARC, MTA-STS, BIMI, URL rewriting, attachment sandboxing, DLP, S/MIME, PGP, and more.',
      ]),
      Lab.el('p', {}, [
        'Nothing here touches the real internet. DNS records you create live in a simulated zone on this machine, "sending" an email runs it through a real authentication pipeline (real RSA signatures, real RFC-based SPF/DMARC evaluation) without any real SMTP connection ever being made. That means you can safely try spoofing attacks against your own configuration and see exactly why they succeed or fail.',
      ]),
      Lab.el('h2', {}, 'Suggested path'),
      Lab.el('ol', { style: 'line-height:1.8' }, [
        Lab.el('li', {}, [Lab.el('a', { href: '#/dns' }, 'DNS Zone Manager'), ' — create a domain and see how SPF/DKIM/DMARC records actually look.']),
        Lab.el('li', {}, [Lab.el('a', { href: '#/spf' }, 'SPF'), ', ', Lab.el('a', { href: '#/dkim' }, 'DKIM'), ', ', Lab.el('a', { href: '#/dmarc' }, 'DMARC'), ' — configure each and understand what it actually checks.']),
        Lab.el('li', {}, [Lab.el('a', { href: '#/compose' }, 'Compose & Send Playground'), ' — send a message through the full pipeline and watch every check run.']),
        Lab.el('li', {}, [Lab.el('a', { href: '#/attack-sim' }, 'Attack Simulator'), ' — launch pre-built spoofing/phishing attempts against your own configuration.']),
        Lab.el('li', {}, 'Explore the Secure Email Gateway, Encryption, and Reporting sections at your own pace.'),
      ]),
    ]));
    container.appendChild(wrap);
  },
});
