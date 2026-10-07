import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getReleaseManifest } from './releases.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// GET /api/ota-update/version — forwards to mac release channel for backward compatibility
router.get('/version', (req, res) => {
  try {
    const manifest = getReleaseManifest('mac');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.json({
      success: true,
      ...manifest,
      bundleUrl: '/api/ota-update/bundle.zip'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ota-update/bundle.zip — forwards to mac release bundle
router.get('/bundle.zip', (req, res) => {
  const bundlePath = path.join(__dirname, '../releases/mac/bundle.zip');
  if (fs.existsSync(bundlePath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="dunvex-mac-bundle.zip"');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.sendFile(bundlePath);
  }
  return res.status(404).json({ error: 'Mac OTA bundle is not available on server' });
});

export default router;
