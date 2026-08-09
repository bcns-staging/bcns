// Core shell: navigation config, hash router, and small shared helpers used
// by every page module. Each page module calls Lab.registerPage(route, def)
// when its <script> loads; boot.js performs the first render once all page
// scripts have registered.
(function () {
  const NAV = [
    {
      category: 'Getting Started',
      items: [
        { route: 'home', label: 'Home' },
        { route: 'dns', label: 'DNS Zone Manager' },
      ],
    },
    {
      category: 'Compose & Send',
      items: [{ route: 'compose', label: 'Compose & Send Playground' }],
    },
    {
      category: 'Core Authentication',
      items: [
        { route: 'spf', label: 'SPF' },
        { route: 'dkim', label: 'DKIM' },
        { route: 'dmarc', label: 'DMARC' },
        { route: 'arc', label: 'ARC' },
      ],
    },
    {
      category: 'Transport Security',
      items: [
        { route: 'transport', label: 'STARTTLS' },
        { route: 'mta-sts', label: 'MTA-STS' },
        { route: 'tls-rpt', label: 'TLS-RPT' },
        { route: 'dane', label: 'DANE / TLSA' },
      ],
    },
    {
      category: 'Anti-Phishing & Brand',
      items: [
        { route: 'bimi', label: 'BIMI' },
        { route: 'impersonation', label: 'Display-Name Spoofing' },
        { route: 'lookalike', label: 'Lookalike Domains' },
      ],
    },
    {
      category: 'Secure Email Gateway',
      items: [
        { route: 'url-defense', label: 'URL Defense' },
        { route: 'sandbox', label: 'Attachment Sandbox' },
        { route: 'bec', label: 'BEC Detection' },
        { route: 'spam-score', label: 'Spam Scoring' },
        { route: 'dlp', label: 'Data Loss Prevention' },
        { route: 'quarantine', label: 'Quarantine Console' },
        { route: 'reputation', label: 'Reputation / RBL' },
      ],
    },
    {
      category: 'Encryption',
      items: [
        { route: 'smime', label: 'S/MIME' },
        { route: 'pgp', label: 'PGP' },
      ],
    },
    {
      category: 'Protocol Fundamentals',
      items: [
        { route: 'headers', label: 'Received Chain & Spoofing Tricks' },
        { route: 'header-injection', label: 'Header Injection' },
      ],
    },
    {
      category: 'Reporting & Attacks',
      items: [
        { route: 'reports', label: 'DMARC Reports' },
        { route: 'attack-sim', label: 'Attack Simulator' },
      ],
    },
  ];

  const pages = new Map();

  function registerPage(route, def) {
    pages.set(route, def);
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child === null || child === undefined) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function fetchJSON(url, options) {
    const res = await fetch(url, options && {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status, data });
    return data;
  }

  async function loadTutorial(route) {
    try {
      const res = await fetch(`content/${route}.html`);
      if (!res.ok) return '<p class="muted">Tutorial content coming soon.</p>';
      return await res.text();
    } catch {
      return '<p class="muted">Tutorial content coming soon.</p>';
    }
  }

  // Standard two-pane layout: tutorial explanation above/left, interactive
  // lab widget below/right. Pages call this then fill in the returned
  // `.lab-body` element with their own controls.
  function renderLayout(container, { title, route }) {
    container.innerHTML = '';
    const wrap = el('div', { class: 'page' });
    wrap.appendChild(el('h1', {}, title));
    const tutorial = el('section', { class: 'tutorial-pane' }, el('div', { class: 'tutorial-body' }));
    const lab = el('section', { class: 'lab-pane' }, el('div', { class: 'lab-body' }));
    wrap.appendChild(tutorial);
    wrap.appendChild(lab);
    container.appendChild(wrap);
    loadTutorial(route).then((html) => {
      tutorial.querySelector('.tutorial-body').innerHTML = html;
    });
    return lab.querySelector('.lab-body');
  }

  function renderSidebar(activeRoute) {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '';
    for (const group of NAV) {
      const groupEl = el('div', { class: 'nav-group' });
      groupEl.appendChild(el('div', { class: 'nav-group-title' }, group.category));
      for (const item of group.items) {
        const link = el(
          'a',
          {
            href: `#/${item.route}`,
            class: `nav-item${item.route === activeRoute ? ' active' : ''}`,
          },
          item.label,
        );
        groupEl.appendChild(link);
      }
      sidebar.appendChild(groupEl);
    }
  }

  function currentRoute() {
    return (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
  }

  async function render() {
    const route = currentRoute();
    renderSidebar(route);
    const content = document.getElementById('content');
    const page = pages.get(route);
    if (!page) {
      content.innerHTML = `<div class="page"><h1>Not found</h1><p>No page registered for <code>${escapeHtml(route)}</code>.</p></div>`;
      return;
    }
    try {
      await page.render(content, { route });
    } catch (err) {
      content.innerHTML = `<div class="page"><h1>Error</h1><pre class="error-block">${escapeHtml(err.message || String(err))}</pre></div>`;
      console.error(err);
    }
  }

  window.Lab = { registerPage, render, el, escapeHtml, fetchJSON, renderLayout, NAV };
  window.addEventListener('hashchange', render);
})();
