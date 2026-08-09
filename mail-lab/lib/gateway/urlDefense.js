// URL Defense: rewrites links in outbound/inbound mail to route through a
// local "safe link" service that re-checks reputation at click time (not
// just at delivery time) -- the real value of link rewriting is that a
// domain can look clean when a message is delivered and turn malicious
// hours later.
const crypto = require('crypto');
const store = require('../store');

const URL_RE = /(https?:\/\/[^\s<>"]+)/g;

function getSecret() {
  const settings = store.load('url-defense-secret');
  if (settings.secret) return settings.secret;
  const secret = crypto.randomBytes(32).toString('hex');
  store.save('url-defense-secret', { secret });
  return secret;
}

function sign(url) {
  return crypto.createHmac('sha256', getSecret()).update(url).digest('hex').slice(0, 16);
}

function wrap(url) {
  const encoded = Buffer.from(url, 'utf8').toString('base64url');
  return `/url-defense?u=${encoded}&sig=${sign(url)}`;
}

function rewriteLinksInBody(body) {
  const originalUrls = [];
  const rewritten = body.replace(URL_RE, (match) => {
    originalUrls.push(match);
    return wrap(match);
  });
  return { rewritten, originalUrls };
}

function blocklist() {
  return store.load('blocklists').urls || [];
}

function addBlockedUrl(pattern) {
  store.update('blocklists', (b) => {
    b.urls = b.urls || [];
    if (!b.urls.includes(pattern)) b.urls.push(pattern);
    return b;
  });
  return blocklist();
}

function removeBlockedUrl(pattern) {
  store.update('blocklists', (b) => {
    b.urls = (b.urls || []).filter((u) => u !== pattern);
    return b;
  });
  return blocklist();
}

function scanUrl(url) {
  const list = blocklist();
  const hit = list.find((pattern) => url.includes(pattern));
  if (hit) return { verdict: 'malicious', reason: `matches blocklisted pattern "${hit}"` };
  if (/[0-9]{1,3}(\.[0-9]{1,3}){3}/.test(url)) return { verdict: 'suspicious', reason: 'link uses a raw IP address instead of a domain name' };
  if ((url.match(/-/g) || []).length > 4) return { verdict: 'suspicious', reason: 'unusually many hyphens in the domain, common in phishing kits' };
  return { verdict: 'benign', reason: 'no known indicators' };
}

// What happens when the wrapped link is actually clicked.
function resolveClick(u, sig) {
  let url;
  try {
    url = Buffer.from(u, 'base64url').toString('utf8');
  } catch {
    return { valid: false, reason: 'malformed link token' };
  }
  if (sign(url) !== sig) return { valid: false, reason: 'signature mismatch -- link was tampered with' };
  const scan = scanUrl(url);
  return { valid: true, url, scan };
}

module.exports = { rewriteLinksInBody, wrap, scanUrl, resolveClick, blocklist, addBlockedUrl, removeBlockedUrl };
