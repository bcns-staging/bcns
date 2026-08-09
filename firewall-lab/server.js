const express = require('express');
const path = require('path');
const store = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 4027;

app.use(express.json({ limit: '5mb' }));
app.use('/api/topology', require('./routes/topology'));
app.use('/api/rules', require('./routes/rules'));
app.use('/api/nat', require('./routes/nat'));
app.use('/api/vpn', require('./routes/vpn'));
app.use('/api/app-signatures', require('./routes/appSignatures'));
app.use('/api/user-id', require('./routes/userId'));
app.use('/api/url-filtering', require('./routes/urlFiltering'));
app.use('/api/threat-intel', require('./routes/threatIntel'));
app.use('/api/ips', require('./routes/ips'));
app.use('/api/anti-malware', require('./routes/antiMalware'));
app.use('/api/dns-security', require('./routes/dnsSecurity'));
app.use('/api/connection', require('./routes/connection'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/traffic-logs', require('./routes/trafficLogs'));
app.use('/api/ha', require('./routes/ha'));

app.use(express.static(path.join(__dirname, 'public')));

// Hydrate the in-memory cache from Firestore before accepting any traffic,
// so the first requests after a cold start see real state instead of
// falling back to defaults. Binds all interfaces (not just loopback) -
// required for Cloud Run's request routing to reach the container.
store
  .hydrate()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Firewall Lab running on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to hydrate store from Firestore:', err);
    process.exit(1);
  });
