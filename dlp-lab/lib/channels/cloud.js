// Cloud/CASB (Cloud Access Security Broker): the same content can be fine
// going to a sanctioned, IT-approved app and a policy violation going to an
// unsanctioned one. This models that distinctly from ordinary content
// policy: an unsanctioned destination escalates any detected sensitivity
// straight to a block, regardless of what the matched policy's own
// configured action was.
const store = require('../store');
const policy = require('../policy');
const incidents = require('../incidents');

function listSanctionedApps() {
  return store.load('sanctioned-apps');
}

function addSanctionedApp(name) {
  store.update('sanctioned-apps', (apps) => (apps.some((a) => a.toLowerCase() === name.toLowerCase()) ? apps : [...apps, name]));
  return listSanctionedApps();
}

function removeSanctionedApp(name) {
  store.update('sanctioned-apps', (apps) => apps.filter((a) => a.toLowerCase() !== name.toLowerCase()));
  return listSanctionedApps();
}

function isSanctioned(appName) {
  return listSanctionedApps().some((a) => a.toLowerCase() === appName.toLowerCase());
}

function upload({ filename, content, destinationApp, user }) {
  const sanctioned = isSanctioned(destinationApp);
  const evaluation = policy.evaluateChannel('cloud', content, { user, destination: destinationApp, metadata: { filename, sanctioned } });

  let finalAction = evaluation.worst ? evaluation.worst.action : 'allow';
  let casbOverride = false;

  if (!sanctioned && evaluation.worst && evaluation.worst.matched && finalAction !== 'block') {
    finalAction = 'block';
    casbOverride = true;
    incidents.add({
      channel: 'cloud',
      user,
      destination: destinationApp,
      policyId: evaluation.worst.policyId,
      policyName: `${evaluation.worst.policyName} (CASB override: unsanctioned destination)`,
      action: 'block',
      score: evaluation.worst.score,
      severity: incidents.severityFor(evaluation.worst.score),
      contentPreview: policy.buildRedacted(content, evaluation.worst.scan.results).slice(0, 400),
      metadata: { filename },
    });
  }

  return { sanctioned, evaluation, finalAction, casbOverride };
}

module.exports = { listSanctionedApps, addSanctionedApp, removeSanctionedApp, isSanctioned, upload };
