const express = require('express');
const path = require('path');
const store = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 4026;

app.use(express.json({ limit: '10mb' }));
app.use('/api/datasets', require('./routes/datasets'));
app.use('/api/scan', require('./routes/scan').router);
app.use('/api/classifier', require('./routes/classifier'));
app.use('/api/file-tools', require('./routes/fileTools'));
app.use('/api/policies', require('./routes/policies'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/labels', require('./routes/labels'));
app.use('/api/channels', require('./routes/channels'));
app.use('/api/ueba', require('./routes/ueba'));
app.use('/api/compliance', require('./routes/compliance'));

app.use(express.static(path.join(__dirname, 'public')));

// Hydrate the in-memory cache from Firestore before accepting any traffic,
// so the first requests after a cold start see real state instead of
// falling back to defaults. Binds all interfaces (not just loopback) -
// required for Cloud Run's request routing to reach the container.
store
  .hydrate()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`DLP Lab running on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to hydrate store from Firestore:', err);
    process.exit(1);
  });
