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
        { route: 'datasets', label: 'Sensitive Data Sets' },
      ],
    },
    {
      category: 'Scan Playground',
      items: [{ route: 'scan', label: 'Scan Playground' }],
    },
    {
      category: 'Detection Techniques',
      items: [
        { route: 'pattern-matching', label: 'Pattern Matching' },
        { route: 'keyword-proximity', label: 'Keyword & Proximity' },
        { route: 'edm', label: 'Exact Data Match' },
        { route: 'fingerprint', label: 'Document Fingerprinting' },
        { route: 'classifier', label: 'Statistical Classifier' },
        { route: 'file-type', label: 'File Type Sniffing' },
        { route: 'archive', label: 'Archive Inspection' },
        { route: 'encryption-detect', label: 'Encrypted File Detection' },
        { route: 'ocr', label: 'OCR on Images' },
      ],
    },
    {
      category: 'Policy & Workflow',
      items: [
        { route: 'policy-builder', label: 'Policy Builder' },
        { route: 'incidents', label: 'Incident Console' },
        { route: 'labels', label: 'Sensitivity Labels' },
      ],
    },
    {
      category: 'Channels',
      items: [
        { route: 'email-channel', label: 'Email Egress' },
        { route: 'cloud-channel', label: 'Cloud / CASB Upload' },
        { route: 'endpoint-channel', label: 'Endpoint (Clipboard/USB/Print)' },
        { route: 'file-share', label: 'Data-at-Rest File Share' },
      ],
    },
    {
      category: 'Advanced',
      items: [
        { route: 'ueba', label: 'UEBA Anomaly Detection' },
        { route: 'compliance', label: 'Compliance Rule Packs' },
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

  // Shared renderer for a policy.evaluateChannel() result -- used by every
  // channel simulator page so the "which policy fired and why" view looks
  // and behaves the same everywhere.
  function renderChannelResult(evaluation) {
    const wrap = el('div', {});
    if (!evaluation.results.length) {
      wrap.appendChild(el('p', { class: 'muted' }, 'No policies apply to this channel yet -- create one on the Policy Builder page and tag it with this channel.'));
      return wrap;
    }
    const worst = evaluation.worst;
    wrap.appendChild(el('p', {}, [
      el('span', { class: `badge ${worst.action}` }, worst.action),
      ` "${worst.policyName}" -- score ${worst.score.toFixed(2)} (threshold ${worst.threshold})`,
    ]));
    if (worst.note) wrap.appendChild(el('p', { class: 'muted' }, worst.note));
    if (worst.redactedContent) { wrap.appendChild(el('h4', {}, 'Redacted content')); wrap.appendChild(el('pre', { class: 'code-block' }, worst.redactedContent)); }
    if (worst.encryptedEnvelope) { wrap.appendChild(el('h4', {}, 'Encrypted envelope')); wrap.appendChild(el('pre', { class: 'code-block' }, JSON.stringify(worst.encryptedEnvelope, null, 2))); }
    if (evaluation.incident) wrap.appendChild(el('p', {}, [el('span', { class: 'badge quarantine' }, 'logged'), ` -- see the Incident Console (id ${evaluation.incident.id.slice(0, 8)}...)`]));
    if (evaluation.results.length > 1) {
      wrap.appendChild(el('h4', {}, 'All applicable policies'));
      wrap.appendChild(el('ul', {}, evaluation.results.map((r) => el('li', {}, `${r.policyName}: ${r.action} (score ${r.score.toFixed(2)})`))));
    }
    return wrap;
  }

  window.Lab = { registerPage, render, el, escapeHtml, fetchJSON, renderLayout, renderChannelResult, NAV };
  window.addEventListener('hashchange', render);
})();
