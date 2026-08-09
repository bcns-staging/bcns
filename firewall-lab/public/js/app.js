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
        { route: 'network-objects', label: 'Network Objects' },
      ],
    },
    {
      category: 'Traffic Simulator',
      items: [{ route: 'traffic-simulator', label: 'Traffic Simulator' }],
    },
    {
      category: 'Traditional Firewall',
      items: [
        { route: 'five-tuple', label: 'Packet Filtering & the 5-Tuple' },
        { route: 'acl-rule-order', label: 'Rule Base & First-Match-Wins' },
        { route: 'shadowed-rules', label: 'Shadowed & Redundant Rules' },
        { route: 'stateful-inspection', label: 'Stateful Inspection & Sessions' },
        { route: 'zone-policy', label: 'Zone-Based Policy' },
        { route: 'nat-source', label: 'Source NAT: PAT & Static' },
        { route: 'nat-destination', label: 'Destination NAT & Port Forwarding' },
        { route: 'anti-spoofing', label: 'Anti-Spoofing' },
        { route: 'vpn-ipsec', label: 'Site-to-Site VPN (IPSec)' },
      ],
    },
    {
      category: 'NGFW',
      items: [
        { route: 'app-id', label: 'App-ID' },
        { route: 'user-id', label: 'User-ID' },
        { route: 'ssl-decryption', label: 'SSL/TLS Decryption' },
        { route: 'ips', label: 'Intrusion Prevention (IPS)' },
        { route: 'url-filtering', label: 'URL Filtering' },
        { route: 'threat-intel', label: 'Threat Intelligence' },
        { route: 'anti-malware', label: 'Anti-Malware & File Blocking' },
        { route: 'dns-security', label: 'DNS Security' },
        { route: 'single-pass', label: 'Single-Pass Content-ID' },
      ],
    },
    {
      category: 'Policy & Workflow',
      items: [
        { route: 'rule-builder', label: 'Rule Builder' },
        { route: 'rule-hygiene', label: 'Rule Hygiene & Cleanup' },
        { route: 'traffic-logs', label: 'Traffic Logs' },
      ],
    },
    {
      category: 'Advanced',
      items: [
        { route: 'high-availability', label: 'High Availability & Failover' },
        { route: 'zero-trust', label: 'Zero Trust Segmentation' },
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

  // Renders a single evaluateConnection() result as a labeled trace-log
  // block -- the shared building block for every page that shows "what did
  // the pipeline do with this connection."
  function renderTrace(result) {
    const wrap = el('div', {});
    wrap.appendChild(el('p', {}, [
      el('span', { class: `badge ${result.verdict}` }, result.verdict),
      ` -- matched "${result.matchedRule?.name ?? 'none'}"`,
      result.contentOverride ? ` (content-ID override: ${result.contentOverride})` : '',
    ]));
    const pre = el('pre', { class: 'trace-log' });
    for (const stage of result.stages) {
      const cls = stage.status === 'pass' ? 'ok' : (stage.status === 'block' || stage.status === 'fail') ? 'no' : 'info';
      pre.appendChild(el('span', { class: `step ${cls}` }, `[${stage.name}] ${stage.status.toUpperCase()}${stage.detail ? ` -- ${stage.detail}` : ''}`));
    }
    wrap.appendChild(pre);
    return wrap;
  }

  window.Lab = { registerPage, render, el, escapeHtml, fetchJSON, renderLayout, renderTrace, NAV };
  window.addEventListener('hashchange', render);
})();
