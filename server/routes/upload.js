import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { requireAuth } from './data-api.js';

const router = express.Router();

// Helper to ensure target directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// POST /api/upload
// Accepts JSON: { imageBase64, fileName, folder }
router.post('/', requireAuth, async (req, res) => {
  try {
    const { imageBase64, fileName: customName, folder = 'images' } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 payload' });
    }
    
    // Bổ sung kiểm tra độ dài để chống spam (30MB limit payload base64 ~ 40MB max)
    if (imageBase64.length > 40_000_000) {
      return res.status(413).json({ error: 'Payload too large (Max ~30MB)' });
    }

    // Extract base64 mime type and raw data
    const matches = imageBase64.match(/^data:(image\/[a-zA-Z0-9+\-+.]+);base64,(.+)$/);
    let ext = 'webp';
    let base64Data = imageBase64;

    if (matches && matches.length === 3) {
      const mime = matches[1];
      base64Data = matches[2];
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else if (mime.includes('gif')) ext = 'gif';
      else if (mime.includes('svg')) ext = 'svg';
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Root uploads directory: project_root/uploads/images/2026/07
    const uploadsBase = path.join(__dirname, '..', '..', 'uploads', folder, String(year), month);
    ensureDir(uploadsBase);

    const timeStamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const sanitizedCustomName = customName ? customName.replace(/[^a-zA-Z0-9_-]/g, '') : 'img';
    const finalFileName = `${sanitizedCustomName}_${timeStamp}_${randomStr}.${ext}`;
    const filePath = path.join(uploadsBase, finalFileName);

    // Save image buffer to VPS disk
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(filePath, buffer);

    const relativeUrl = `/uploads/${folder}/${year}/${month}/${finalFileName}`;
    const fullUrl = `https://dunvex.com${relativeUrl}`;

    return res.json({
      success: true,
      url: fullUrl,
      relativeUrl,
      fileName: finalFileName,
      size: buffer.length
    });
  } catch (error) {
    console.error('❌ Upload image error:', error);
    return res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

export default router;
