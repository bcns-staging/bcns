const express = require('express');
const multer = require('multer');
const fileType = require('../lib/detectors/fileType');
const archive = require('../lib/detectors/archive');
const encryptionDetector = require('../lib/detectors/encryptionDetector');
const ocr = require('../lib/detectors/ocr');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/file-type', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required (multipart field "file")' });
  res.json({ filename: req.file.originalname, sizeBytes: req.file.size, ...fileType.checkMismatch(req.file.originalname, req.file.buffer) });
});

router.post('/archive', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required (multipart field "file")' });
  res.json({ filename: req.file.originalname, ...archive.inspect(req.file.buffer) });
});

router.post('/encryption', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required (multipart field "file")' });
  res.json({ filename: req.file.originalname, ...encryptionDetector.classify(req.file.buffer, req.file.originalname) });
});

router.post('/ocr', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required (multipart field "file")' });
  const result = await ocr.scanImage(req.file.buffer);
  res.json({ filename: req.file.originalname, ...result });
});

module.exports = router;
