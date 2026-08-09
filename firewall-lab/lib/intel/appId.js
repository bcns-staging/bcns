// Identifies the real application from its actual signature/behavior
// rather than trusting the port it's running on -- the core idea behind
// App-ID. `declaredApp` here stands in for what deep packet inspection
// would have actually determined; a traditional, port-based rule never
// gets to see this at all, which is exactly the point.
const store = require('../store');

function identify({ dstPort, declaredApp }) {
  const signatures = store.load('app-signatures');
  if (declaredApp) {
    const sig = signatures.find((s) => s.name === declaredApp);
    if (sig) return { app: sig.name, confidence: 0.95, method: 'signature', risk: sig.risk, category: sig.category };
    return { app: declaredApp, confidence: 0.6, method: 'signature-unknown-app', risk: 'unknown', category: 'unknown' };
  }
  const byPort = signatures.find((s) => s.defaultPort === dstPort);
  if (byPort) return { app: byPort.name, confidence: 0.5, method: 'port-default', risk: byPort.risk, category: byPort.category };
  return { app: 'unknown', confidence: 0.2, method: 'unknown', risk: 'unknown', category: 'unknown' };
}

module.exports = { identify };
