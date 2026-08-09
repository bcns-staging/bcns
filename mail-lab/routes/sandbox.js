const express = require('express');
const multer = require('multer');
const sandbox = require('../lib/gateway/sandbox');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/analyze', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required (multipart field "file")' });
  const result = sandbox.analyze({ filename: req.file.originalname, contentBuffer: req.file.buffer });
  res.json({ ...result, filename: req.file.originalname, sizeBytes: req.file.size });
});

router.get('/blocklist', (req, res) => res.json({ hashes: sandbox.blocklist() }));
router.post('/blocklist', (req, res) => {
  const { hash } = req.body;
  if (!hash) return res.status(400).json({ error: 'hash is required' });
  res.json({ hashes: sandbox.addBlockedHash(hash) });
});

module.exports = router;
