const express = require('express');
const path = require('path');
const store = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 4025;

app.use(express.json({ limit: '5mb' }));
app.use('/api/dns', require('./routes/dns'));
app.use('/api/spf', require('./routes/spf'));
app.use('/api/dkim', require('./routes/dkim'));
app.use('/api/dmarc', require('./routes/dmarc'));
app.use('/api/compose', require('./routes/compose'));
app.use('/api/transport', require('./routes/transport'));
app.use('/api/mta-sts', require('./routes/mtaSts'));
app.use('/api/tls-rpt', require('./routes/tlsRpt'));
app.use('/api/dane', require('./routes/dane'));
app.use('/api/bimi', require('./routes/bimi'));
app.use('/api/impersonation', require('./routes/impersonation'));
app.use('/api/lookalike', require('./routes/lookalike'));
app.use('/api/url-defense', require('./routes/urlDefense'));
app.use('/api/sandbox', require('./routes/sandbox'));
app.use('/api/bec', require('./routes/bec'));
app.use('/api/spam-score', require('./routes/spamScore'));
app.use('/api/dlp', require('./routes/dlp'));
app.use('/api/reputation', require('./routes/reputation'));
app.use('/api/quarantine', require('./routes/quarantine'));
app.use('/api/smime', require('./routes/smime'));
app.use('/api/pgp', require('./routes/pgp'));
app.use('/api/headers', require('./routes/headers'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/attack', require('./routes/attack'));

app.use(express.static(path.join(__dirname, 'public')));

// Hydrate the in-memory cache from Firestore before accepting any traffic,
// so the first requests after a cold start see real state instead of
// falling back to defaults. Binds all interfaces (not just loopback) -
// required for Cloud Run's request routing to reach the container.
store
  .hydrate()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Email Security Lab running on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to hydrate store from Firestore:', err);
    process.exit(1);
  });
