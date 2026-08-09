const express = require('express');
const email = require('../lib/channels/email');
const cloud = require('../lib/channels/cloud');
const endpoint = require('../lib/channels/endpoint');
const fileShare = require('../lib/channels/fileShare');

const router = express.Router();

router.post('/email/send', (req, res) => {
  const { subject, body, to, user } = req.body;
  res.json(email.send({ subject, body, to, user }));
});

router.get('/cloud/sanctioned-apps', (req, res) => res.json({ apps: cloud.listSanctionedApps() }));
router.post('/cloud/sanctioned-apps', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.json({ apps: cloud.addSanctionedApp(name) });
});
router.delete('/cloud/sanctioned-apps/:name', (req, res) => res.json({ apps: cloud.removeSanctionedApp(req.params.name) }));
router.post('/cloud/upload', (req, res) => {
  const { filename, content, destinationApp, user } = req.body;
  res.json(cloud.upload({ filename, content, destinationApp, user }));
});

router.post('/endpoint/action', (req, res) => {
  const { actionType, content, user, device } = req.body;
  res.json(endpoint.performAction({ actionType, content, user, device }));
});

router.get('/file-share/files', (req, res) => res.json({ files: fileShare.list() }));
router.post('/file-share/files', (req, res) => {
  const { filename, content, label } = req.body;
  if (!filename || !content) return res.status(400).json({ error: 'filename and content are required' });
  res.json({ file: fileShare.addFile({ filename, content, label }) });
});
router.delete('/file-share/files/:id', (req, res) => {
  fileShare.removeFile(req.params.id);
  res.json({ ok: true });
});
router.post('/file-share/scan', (req, res) => res.json({ results: fileShare.runScan() }));

module.exports = router;
