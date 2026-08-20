import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Resolve directory paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Rate Limiting (write-only) ─────────────────────────

// Rate limiting is applied per-route in data-api.js (writes only).
// Reads are unlimited — authenticated via x-owner-id + 30s cache.

// Middleware
app.set('trust proxy', 1); // Nginx reverse proxy
const allowedOrigins = [
  'https://dunvex.com', 
  'https://www.dunvex.com', 
  'http://localhost:5173', 
  'http://localhost:4173', 
  'http://localhost:5000',
  'capacitor://localhost',
  'ionic://localhost'
];
// Allow all origins since this is a headless API. Security is enforced via x-api-key and Authorization headers.
app.use(cors());
app.use(compression({ threshold: 1024 }));
// Limit JSON to 200MB to accommodate large image uploads.
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Import API Routes
import apiRoutes from './server/routes/api.js';
app.use('/api', apiRoutes);

// Setup node-cron to run EOD at a random minute between 17:00-17:59 Asia/Ho_Chi_Minh time to avoid API overload
import cron from 'node-cron';
const randomMinute = Math.floor(Math.random() * 60);
cron.schedule(`${randomMinute} 17 * * *`, async () => {
  console.log('Running End-of-Day Cron Job...');
  try {
    const res = await fetch(`http://localhost:${PORT}/api/cron-eod`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
      }
    });
    const data = await res.json();
    console.log('Cron Job Result:', data);
  } catch (err) {
    console.error('Cron Job Failed:', err);
  }
}, {
  scheduled: true,
  timezone: "Asia/Ho_Chi_Minh"
});

// Setup hourly cron to synchronize customer debts
cron.schedule('0 * * * *', async () => {
  console.log('Running Hourly Debt Sync Cron Job...');
  try {
    const res = await fetch(`http://localhost:${PORT}/api/cron-debt-sync`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
      }
    });
    const data = await res.json();
    console.log('Hourly Debt Sync Result:', data);
  } catch (err) {
    console.error('Hourly Debt Sync Failed:', err);
  }
}, {
  scheduled: true,
  timezone: "Asia/Ho_Chi_Minh"
});

// Image proxy to bypass CORS issues on native app (Capacitor/Ionic) for external images
app.get('/api/image-proxy', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch image: status ${response.status}` });
    }
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Image base64 endpoint: converts local files or remote URLs to base64 Data URLs on server side
app.get('/api/image-base64', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  try {
    // 1. If it's a local /uploads/ file
    if (imageUrl.includes('/uploads/')) {
      const idx = imageUrl.indexOf('/uploads/');
      const relativePath = imageUrl.substring(idx);
      const filePath = path.join(__dirname, relativePath);
      if (fs.existsSync(filePath)) {
        const fileBuffer = await fs.promises.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        if (ext === '.svg') mimeType = 'image/svg+xml';
        if (ext === '.webp') mimeType = 'image/webp';
        const b64 = fileBuffer.toString('base64');
        return res.json({ dataUrl: `data:${mimeType};base64,${b64}` });
      }
    }

    // 2. Otherwise fetch external or full URL
    let targetUrl = imageUrl;
    if (targetUrl.includes('/api/image-proxy?url=')) {
      const parts = targetUrl.split('/api/image-proxy?url=');
      targetUrl = decodeURIComponent(parts[1]);
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch image: status ${response.status}` });
    }
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    const b64 = buffer.toString('base64');
    return res.json({ dataUrl: `data:${contentType};base64,${b64}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Serve uploaded files (images, logos, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static frontend from 'dist' directory with custom cache control policies
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    const baseName = path.basename(filePath);
    if (baseName === 'index.html' || baseName === 'sw.js' || baseName === 'registerSW.js') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Fallback for React Router (SPA) — skip /api and /uploads
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    next();
  }
});

// Error logging middleware: log stack traces for uncaught errors and return JSON
app.use((err, req, res, next) => {
  try {
    console.error('Unhandled error:', err && err.stack ? err.stack : err);
  } catch (e) {
    console.error('Error while logging error:', e);
  }
  if (res.headersSent) return next(err);
  res.status(err && err.status ? err.status : 500).json({ error: err && err.message ? err.message : 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoints are available at http://localhost:${PORT}/api`);
});
