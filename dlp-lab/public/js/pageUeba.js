Lab.registerPage('ueba', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'UEBA Anomaly Detection', route: 'ueba' });
    body.innerHTML = '';

    const user = Lab.el('input', { type: 'text', value: 'alice' });
    const channel = Lab.el('select', {}, ['cloud', 'email', 'endpoint', 'file-share'].map((c) => Lab.el('option', { value: c }, c)));
    const bytes = Lab.el('input', { type: 'number', value: '1200' });
    const output = Lab.el('div', {});

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Record several normal-sized events for a user first to establish a baseline (need at least 3), then record one much larger event and watch it get flagged.'));
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'User'), user]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Channel'), channel]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Bytes moved'), bytes]),
    ]));

    async function recordAndShow(b) {
      const res = await Lab.fetchJSON('/api/ueba/event', { method: 'POST', body: { user: user.value, channel: channel.value, bytes: b } });
      const line = Lab.el('p', {}, [
        `${b.toLocaleString()} bytes -- `,
        res.baseline == null
          ? Lab.el('span', { class: 'badge neutral' }, 'establishing baseline')
          : Lab.el('span', { class: `badge ${res.anomaly ? 'high' : 'low'}` }, res.anomaly ? `ANOMALY (${res.ratio.toFixed(1)}x baseline)` : `normal (${res.ratio.toFixed(1)}x baseline)`),
      ]);
      output.appendChild(line);
      return res;
    }

    body.appendChild(Lab.el('div', { class: 'toolbar' }, [
      Lab.el('button', { onclick: () => recordAndShow(Number(bytes.value)) }, 'Record this event'),
      Lab.el('button', {
        class: 'secondary',
        onclick: async () => {
          output.innerHTML = '';
          for (const b of [1000, 1100, 950, 1200]) await recordAndShow(b);
          await recordAndShow(30000);
        },
      }, 'Simulate: 4 normal events + 1 spike'),
    ]));
    body.appendChild(output);
  },
});
