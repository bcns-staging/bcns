const express = require('express');
const path = require('path');
const store = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 4028;

app.use(express.json({ limit: '1mb' }));
app.use('/api/scenarios', require('./routes/scenarios'));
app.use('/api/runs', require('./routes/runs'));

app.use(express.static(path.join(__dirname, 'public')));

// Hydrate the in-memory cache from Firestore before accepting any traffic,
// so the first requests after a cold start see real state instead of
// falling back to defaults. Binds all interfaces (not just loopback) -
// required for Cloud Run's request routing to reach the container.
store
  .hydrate()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Incident Response game running on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to hydrate store from Firestore:', err);
    process.exit(1);
  });
