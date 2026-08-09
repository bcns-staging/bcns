// The policy engine: combines weighted detectors into one score, resolves
// an action against monitor/enforce mode and exceptions, and mechanically
// applies that action (real redaction, real AES-256-GCM encryption). This
// is the DLP-lab equivalent of the email lab's pipeline.js.
const crypto = require('crypto');
const store = require('../lib/store');
const { runAll } = require('./textScan');
const incidents = require('./incidents');

const DETECTOR_TYPES = ['pattern', 'keyword', 'proximity', 'edm', 'fingerprint', 'classifier'];

function list() {
  return store.load('policies');
}

function get(id) {
  return list().find((p) => p.id === id) || null;
}

function save(policy) {
  const record = {
    id: policy.id || crypto.randomUUID(),
    name: policy.name,
    channels: policy.channels || [],
    detectors: policy.detectors || [],
    threshold: policy.threshold ?? 0.5,
    action: policy.action || 'alert',
    mode: policy.mode || 'enforce',
    requireJustification: !!policy.requireJustification,
    exceptions: policy.exceptions || { recipients: [], users: [] },
    minLabelRank: policy.minLabelRank === '' || policy.minLabelRank == null ? null : Number(policy.minLabelRank),
  };
  store.update('policies', (policies) => {
    const idx = policies.findIndex((p) => p.id === record.id);
    if (idx >= 0) policies[idx] = record;
    else policies.push(record);
    return policies;
  });
  return record;
}

function remove(id) {
  store.update('policies', (policies) => policies.filter((p) => p.id !== id));
}

function computeScore(scanResults, detectors) {
  const totalWeight = detectors.reduce((sum, d) => sum + (d.weight || 0), 0);
  if (totalWeight === 0) return 0;
  const weighted = detectors.reduce((sum, d) => sum + (scanResults[d.type]?.confidence || 0) * d.weight, 0);
  return weighted / totalWeight;
}

function buildRedacted(content, scanResults) {
  const spans = [];
  for (const f of scanResults.pattern.findings) spans.push({ index: f.index, length: f.match.length, replacement: f.match });
  for (const f of scanResults.keyword.findings) spans.push({ index: f.index, length: f.term.length, replacement: '█'.repeat(f.term.length) });
  spans.sort((a, b) => b.index - a.index);
  let result = content;
  for (const s of spans) {
    result = result.slice(0, s.index) + s.replacement + result.slice(s.index + s.length);
  }
  return result;
}

function encryptContent(content) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);
  return {
    algorithm: 'aes-256-gcm',
    keyBase64: key.toString('base64'),
    ivBase64: iv.toString('base64'),
    ciphertextBase64: ciphertext.toString('base64'),
    authTagBase64: cipher.getAuthTag().toString('base64'),
    note: 'The key is shown here only for this local lab -- a real system would deliver it through a separate secure channel, never alongside the ciphertext.',
  };
}

// context: { recipient, user, justification, labelRank }
function evaluate(policy, content, context = {}) {
  const scan = runAll(content);
  const score = computeScore(scan.results, policy.detectors);
  // A minimum sensitivity label acts as a gate: below it, this policy
  // doesn't apply at all, regardless of what content scanning finds --
  // e.g. a "block on external send" policy that only cares about content
  // labeled Confidential or higher.
  const labelGatePassed = policy.minLabelRank == null || context.labelRank == null || context.labelRank >= policy.minLabelRank;
  const matched = labelGatePassed && score >= policy.threshold;

  const exceptionHit = matched && (
    (context.recipient && policy.exceptions?.recipients?.includes(context.recipient)) ||
    (context.user && policy.exceptions?.users?.includes(context.user))
  );

  let action = 'allow';
  let note = null;

  if (matched && exceptionHit) {
    note = 'Allowed: recipient/user is on this policy\'s exception list.';
  } else if (matched && policy.mode === 'monitor') {
    note = `Monitor mode: would have applied "${policy.action}" in enforce mode.`;
  } else if (matched && policy.requireJustification && !context.justification) {
    action = 'require-justification';
  } else if (matched && policy.requireJustification && context.justification) {
    // The justification IS the override: a policy tip's whole purpose is to
    // let the end user self-certify and proceed instead of being silently
    // blocked -- the justification is what gets logged for later audit.
    action = 'allow';
    note = `Allowed after end-user justification (would otherwise have been "${policy.action}"): "${context.justification}".`;
  } else if (matched) {
    action = policy.action;
  }

  const result = { policyId: policy.id, policyName: policy.name, score, threshold: policy.threshold, matched, exceptionHit: !!exceptionHit, mode: policy.mode, action, note, scan };
  if (action === 'redact') result.redactedContent = buildRedacted(content, scan.results);
  if (action === 'encrypt') result.encryptedEnvelope = encryptContent(content);
  return result;
}

// Evaluates content against every policy that applies to a given channel,
// returning the single worst outcome (block > quarantine > encrypt/redact >
// require-justification > alert > allow) -- what channel simulators call.
const ACTION_SEVERITY = { block: 6, quarantine: 5, 'require-justification': 4, redact: 3, encrypt: 3, alert: 2, allow: 0 };

function evaluateChannel(channel, content, context = {}) {
  const applicable = list().filter((p) => p.channels.includes(channel));
  const results = applicable.map((p) => evaluate(p, content, context));
  const worst = results.reduce((best, r) => (!best || ACTION_SEVERITY[r.action] > ACTION_SEVERITY[best.action] ? r : best), null);

  let incident = null;
  if (worst && worst.action !== 'allow') {
    incident = incidents.add({
      channel,
      user: context.user || null,
      recipient: context.recipient || null,
      destination: context.destination || null,
      policyId: worst.policyId,
      policyName: worst.policyName,
      action: worst.action,
      score: worst.score,
      severity: incidents.severityFor(worst.score),
      contentPreview: buildRedacted(content, worst.scan.results).slice(0, 400),
      metadata: context.metadata || null,
    });
  }

  return { results, worst, incident };
}

module.exports = { list, get, save, remove, evaluate, evaluateChannel, buildRedacted, encryptContent, DETECTOR_TYPES, ACTION_SEVERITY };
