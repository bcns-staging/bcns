Lab.registerPage('endpoint-channel', {
  render(container) {
    const body = Lab.renderLayout(container, { title: 'Endpoint (Clipboard/USB/Print)', route: 'endpoint-channel' });
    body.innerHTML = '';

    body.appendChild(Lab.el('p', { class: 'muted' }, 'Create a policy tagged with the "endpoint" channel on the Policy Builder page first. Removable-media control is modeled here as the "usb" action type.'));
    const user = Lab.el('input', { type: 'text', value: 'alice' });
    const actionType = Lab.el('select', {}, ['clipboard', 'usb', 'print'].map((a) => Lab.el('option', { value: a }, a)));
    const device = Lab.el('input', { type: 'text', placeholder: 'e.g. Kingston USB Drive / HP LaserJet' });
    const content = Lab.el('textarea', {}, 'Customer record: SSN 123-45-6789');
    const output = Lab.el('div', {});
    body.appendChild(Lab.el('div', { class: 'field-row' }, [
      Lab.el('div', {}, [Lab.el('label', {}, 'User'), user]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Action type'), actionType]),
      Lab.el('div', {}, [Lab.el('label', {}, 'Device (optional)'), device]),
    ]));
    body.appendChild(Lab.el('label', {}, 'Content'));
    body.appendChild(content);
    body.appendChild(Lab.el('button', {
      onclick: async () => {
        const res = await Lab.fetchJSON('/api/channels/endpoint/action', { method: 'POST', body: { actionType: actionType.value, content: content.value, user: user.value, device: device.value || undefined } });
        output.innerHTML = '';
        output.appendChild(Lab.renderChannelResult(res.evaluation));
      },
    }, 'Perform action'));
    body.appendChild(output);
  },
});
