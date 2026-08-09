const READING_PATH = {
  traditional: [
    ['five-tuple', 'Packet Filtering & the 5-Tuple'],
    ['acl-rule-order', 'Rule Base & First-Match-Wins'],
    ['shadowed-rules', 'Shadowed & Redundant Rules'],
    ['stateful-inspection', 'Stateful Inspection & Sessions'],
    ['zone-policy', 'Zone-Based Policy'],
    ['nat-source', 'Source NAT: PAT & Static'],
    ['nat-destination', 'Destination NAT & Port Forwarding'],
    ['anti-spoofing', 'Anti-Spoofing'],
    ['vpn-ipsec', 'Site-to-Site VPN (IPSec)'],
  ],
  ngfw: [
    ['app-id', 'App-ID'],
    ['user-id', 'User-ID'],
    ['ssl-decryption', 'SSL/TLS Decryption'],
    ['ips', 'Intrusion Prevention (IPS)'],
    ['url-filtering', 'URL Filtering'],
    ['threat-intel', 'Threat Intelligence'],
    ['anti-malware', 'Anti-Malware & File Blocking'],
    ['dns-security', 'DNS Security'],
    ['single-pass', 'Single-Pass Content-ID'],
  ],
};

Lab.registerPage('home', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Firewall Learning Lab', route: 'home' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', {}, [
      'Start with ', Lab.el('a', { href: '#/network-objects' }, 'Network Objects'),
      ' to see the seeded topology (zones, interfaces, hosts), then jump straight to the ',
      Lab.el('a', { href: '#/traffic-simulator' }, 'Traffic Simulator'),
      ' -- the flagship page where one connection runs through both rulebases side by side.',
    ]));

    body.appendChild(Lab.el('h3', {}, 'Suggested reading path'));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Part 1 -- Traditional Firewall'));
    body.appendChild(Lab.el('ol', {}, READING_PATH.traditional.map(([route, label]) => Lab.el('li', {}, Lab.el('a', { href: `#/${route}` }, label)))));
    body.appendChild(Lab.el('p', { class: 'muted' }, 'Part 2 -- NGFW'));
    body.appendChild(Lab.el('ol', {}, READING_PATH.ngfw.map(([route, label]) => Lab.el('li', {}, Lab.el('a', { href: `#/${route}` }, label)))));
    body.appendChild(Lab.el('p', { class: 'muted' }, [
      'Then ', Lab.el('a', { href: '#/rule-builder' }, 'Rule Builder'), ', ',
      Lab.el('a', { href: '#/rule-hygiene' }, 'Rule Hygiene'), ', and ',
      Lab.el('a', { href: '#/traffic-logs' }, 'Traffic Logs'),
      ' round out the day-to-day workflow, and ', Lab.el('a', { href: '#/high-availability' }, 'High Availability'),
      ' / ', Lab.el('a', { href: '#/zero-trust' }, 'Zero Trust'), ' close it out.',
    ]));
  },
});
