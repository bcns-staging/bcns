// Email egress: the most familiar DLP channel -- content leaving the
// organization through outbound mail. A thin wrapper that builds context
// and hands off to the shared policy engine.
const policy = require('../policy');

function send({ subject, body, to, user }) {
  const content = `${subject || ''}\n${body || ''}`;
  const evaluation = policy.evaluateChannel('email', content, { user, recipient: to });
  return { content, evaluation };
}

module.exports = { send };
