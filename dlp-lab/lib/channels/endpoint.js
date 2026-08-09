// Endpoint (data-in-use): clipboard copy/paste, USB transfer, and print
// jobs are the classic "data in use" vectors -- content never touches the
// network at all, so email/web-based DLP is blind to it. Removable-media
// control (#25) is modeled here as just another endpoint action type.
const policy = require('../policy');

const ACTION_TYPES = ['clipboard', 'usb', 'print'];

function performAction({ actionType, content, user, device }) {
  const evaluation = policy.evaluateChannel('endpoint', content, { user, destination: device || actionType, metadata: { actionType, device } });
  return { actionType, evaluation };
}

module.exports = { performAction, ACTION_TYPES };
