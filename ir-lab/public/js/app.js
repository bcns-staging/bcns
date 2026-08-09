// Core shell: navigation config, hash router, and small shared helpers used
// by every page module. Copied from the DLP/FIREWALL "Lab" framework, with
// one change: the router now also parses the query segment of the hash
// (`#/play?scenario=ransomware`) so a single `play` page can handle every
// scenario instead of needing one page file per scenario id.
(function () {
  const NAV = [
    {
      category: 'Play',
      items: [
        { route: 'home', label: 'Scenario Select' },
        { route: 'scoreboard', label: 'Scoreboard' },
      ],
    },
    {
      category: 'Reference',
      items: [
        { route: 'lifecycle', label: 'NIST IR Lifecycle' },
      ],
    },
  ];

  const DOMAIN_META = {
    security: { emoji: '🛰', label: 'Security' },
    it: { emoji: '💻', label: 'IT' },
    legal: { emoji: '⚖', label: 'Legal' },
    pr: { emoji: '📣', label: 'PR' },
    hr: { emoji: '🧑‍🤝‍🧑', label: 'HR' },
    exec: { emoji: '🏛', label: 'Exec' },
  };

  const METER_META = {
    containment: 'Containment', compliance: 'Compliance', reputation: 'Reputation', financial: 'Financial',
  };

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

  // Standard two-pane layout, reused as-is for the one page in this app
  // that's a normal tutorial: the NIST lifecycle reference.
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
          { href: `#/${item.route}`, class: `nav-item${item.route === activeRoute ? ' active' : ''}` },
          item.label,
        );
        groupEl.appendChild(link);
      }
      sidebar.appendChild(groupEl);
    }
  }

  function parseHash() {
    const raw = (location.hash.replace(/^#\/?/, '') || 'home');
    const [route, queryString] = raw.split('?');
    return { route: route || 'home', query: new URLSearchParams(queryString || '') };
  }

  async function render() {
    const { route, query } = parseHash();
    renderSidebar(route);
    const content = document.getElementById('content');
    const page = pages.get(route);
    if (!page) {
      content.innerHTML = `<div class="page"><h1>Not found</h1><p>No page registered for <code>${escapeHtml(route)}</code>.</p></div>`;
      return;
    }
    try {
      await page.render(content, { route, query });
    } catch (err) {
      content.innerHTML = `<div class="page"><h1>Error</h1><pre class="error-block">${escapeHtml(err.message || String(err))}</pre></div>`;
      console.error(err);
    }
  }

  function domainChips(domains) {
    return (domains || []).map((d) => el('span', { class: 'label-tag' }, `${DOMAIN_META[d]?.emoji || ''} ${DOMAIN_META[d]?.label || d}`));
  }

  function meterFillClass(value) {
    if (value >= 70) return 'good';
    if (value >= 40) return 'warn';
    return 'bad';
  }

  function renderMeters(meters) {
    return el('div', { class: 'meters-header bar-chart' }, Object.entries(METER_META).map(([key, label]) => el('div', { class: 'bar-row' }, [
      el('div', { class: 'bar-label' }, label),
      el('div', { class: 'bar-track' }, el('div', { class: `bar-fill ${meterFillClass(meters[key])}`, style: `width:${Math.max(0, Math.min(100, meters[key]))}%` })),
      el('div', { class: 'bar-value' }, String(meters[key])),
    ])));
  }

  // Renders each choice as a clickable card; disables every card the
  // instant one is picked, so a slow network response can't be double-submitted.
  function renderChoices(choices, onPick) {
    const wrap = el('div', { class: 'choice-list' });
    const cards = [];
    for (const choice of choices) {
      const card = el('div', { class: 'choice-card' }, [
        el('div', { class: 'choice-domains' }, domainChips(choice.domains)),
        el('div', { class: 'choice-label' }, choice.label),
      ]);
      card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) return;
        cards.forEach((c) => c.classList.add('disabled'));
        onPick(choice.id);
      });
      cards.push(card);
      wrap.appendChild(card);
    }
    return wrap;
  }

  function toneClass(tone) {
    if (tone === 'good') return 'good';
    if (tone === 'mixed') return 'warn';
    return 'bad';
  }

  function letterClass(letter) {
    if (letter === 'A' || letter === 'B') return 'good';
    if (letter === 'F') return 'bad';
    return 'warn';
  }

  window.Lab = {
    registerPage, render, el, escapeHtml, fetchJSON, renderLayout, renderSidebar,
    renderMeters, renderChoices, domainChips, meterFillClass, toneClass, letterClass,
    DOMAIN_META, METER_META, NAV,
  };
  window.addEventListener('hashchange', render);
})();
