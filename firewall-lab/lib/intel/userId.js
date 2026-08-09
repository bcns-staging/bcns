// IP -> identity mapping, the way a real NGFW's User-ID agent maps
// addresses to Active Directory logins so policy can be written per-user
// or per-group instead of per-IP.
const store = require('../store');

function resolve(srcIp) {
  const entry = store.load('users').find((u) => u.ip === srcIp);
  if (!entry) return null;
  return { user: entry.username, groups: entry.groups || [] };
}

module.exports = { resolve };
