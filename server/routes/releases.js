import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELEASES_DIR = path.join(__dirname, '../releases');
const PLATFORMS = new Set(['web', 'android', 'mac', 'windows']);

export function getReleaseManifest(platform) {
  if (!PLATFORMS.has(platform)) {
    throw new Error(`Unsupported release platform: ${platform}`);
  }
  const manifestPath = path.join(RELEASES_DIR, `${platform}.json`);
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

router.get('/:platform/version', (req, res) => {
  try {
    const manifest = getReleaseManifest(req.params.platform);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.json({ success: true, ...manifest });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Release manifest not found' });
    }
    if (error.message.startsWith('Unsupported release platform:')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('[Releases] Failed to read platform manifest:', error);
    return res.status(500).json({ error: 'Failed to read release manifest' });
  }
});

router.get('/:platform/bundle.zip', (req, res) => {
  const { platform } = req.params;
  if (!['mac', 'windows'].includes(platform)) {
    return res.status(404).json({ error: 'OTA bundle is not available for this platform' });
  }

  const bundlePath = path.join(RELEASES_DIR, platform, 'bundle.zip');
  if (!fs.existsSync(bundlePath)) {
    return res.status(404).json({ error: `${platform} OTA bundle is not available` });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="dunvex-${platform}-bundle.zip"`);
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.sendFile(bundlePath);
});

export default router;
