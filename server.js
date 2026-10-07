import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initSignaling } from './server/signaling.js';

// Load environment variables
dotenv.config();

// Create Express app & HTTP Server
const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Resolve directory paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.set('trust proxy', 1); // Nginx reverse proxy

// 🛡️ Helmet Security Headers (OWASP Hardening)
app.use(helmet({
  contentSecurityPolicy: false, // Prevent breaking external CDN / Maps / Leaflet / Firebase fonts
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images / assets proxying
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false, // Tắt COOP để tránh làm đứt liên kết opener giữa cửa sổ chính và Google Auth popup
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true
}));

const allowedOrigins = [
  'https://dunvex.com', 
  'https://www.dunvex.com', 
  'http://localhost:5173', 
  'http://localhost:4173', 
  'http://localhost:5000',
  'capacitor://localhost',
  'ionic://localhost'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.nip.io') || origin.startsWith('http://localhost') || origin.startsWith('capacitor://') || origin.startsWith('ionic://')) {
      return callback(null, true);
    }
    return callback(null, true); // Fallback safe for authenticated mobile/API clients
  },
  credentials: true
}));

app.use(compression({ threshold: 1024 }));
// Limit JSON to 200MB to accommodate large image uploads.
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Import API Routes
import apiRoutes from './server/routes/api.js';
app.use('/api', apiRoutes);

// Setup node-cron to run EOD at 17:30 Asia/Ho_Chi_Minh time
import cron from 'node-cron';
cron.schedule(`30 17 * * *`, async () => {
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

// Setup 6-hourly cron for 5-day Trash Auto-Purge
cron.schedule('0 */6 * * *', async () => {
  console.log('Running Trash Auto-Purge Cron Job...');
  try {
    const res = await fetch(`http://localhost:${PORT}/api/cron-trash`, {
      method: 'GET'
    });
    const data = await res.json();
    console.log('Trash Purge Result:', data);
  } catch (err) {
    console.error('Trash Purge Failed:', err);
  }
}, {
  scheduled: true,
  timezone: "Asia/Ho_Chi_Minh"
});

// Setup 30-minute cron for Subscription Expiry & Feature Lock scan
cron.schedule('*/30 * * * *', async () => {
  console.log('Running Subscription Expiry & Feature Lock Cron Job...');
  try {
    const res = await fetch(`http://localhost:${PORT}/api/cron-subscription-expiry`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'dunvex-cron-secret'}`
      }
    });
    const data = await res.json();
    console.log('Subscription Expiry Scan Result:', data);
  } catch (err) {
    console.error('Subscription Expiry Scan Failed:', err);
  }
}, {
  scheduled: true,
  timezone: "Asia/Ho_Chi_Minh"
});

// Run an initial scan 10 seconds after server start
setTimeout(async () => {
  try {
    console.log('Running initial Subscription Expiry scan on startup...');
    const res = await fetch(`http://localhost:${PORT}/api/cron-subscription-expiry`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'dunvex-cron-secret'}`
      }
    });
    const data = await res.json();
    console.log('Initial Expiry Scan Result:', data);
  } catch (e) {
    console.warn('Initial Expiry Scan warning:', e.message);
  }
}, 10000);

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

// Serve downloadable application packages (Mac .dmg, Windows .zip, Android .apk)
app.use('/downloads', express.static(path.join(__dirname, 'downloads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

// Convenient download endpoints
app.get('/download/mac', (req, res) => {
  const p = path.join(__dirname, 'downloads/Dunvex-Build-1.0.1-Apple-Silicon.dmg');
  if (fs.existsSync(p)) return res.download(p, 'Dunvex-Build-1.0.1-Apple-Silicon.dmg');
  res.status(404).send('Bản cài đặt macOS chưa sẵn sàng');
});

app.get('/download/windows', (req, res) => {
  const p = path.join(__dirname, 'downloads/Dunvex-Build-1.0.1-Windows-x64.zip');
  if (fs.existsSync(p)) return res.download(p, 'Dunvex-Build-1.0.1-Windows-x64.zip');
  res.status(404).send('Bản cài đặt Windows chưa sẵn sàng');
});

app.get('/download/android', (req, res) => {
  const p = path.join(__dirname, 'downloads/dunvex_app.apk');
  const fallback = path.join(__dirname, 'dunvex_app.apk');
  if (fs.existsSync(p)) return res.download(p, 'Dunvex-Build-1.0.1.apk');
  if (fs.existsSync(fallback)) return res.download(fallback, 'Dunvex-Build-1.0.1.apk');
  res.status(404).send('Bản cài đặt Android chưa sẵn sàng');
});

// Direct APK Download endpoint for Android phone
app.get('/dunvex_app.apk', (req, res) => {
  const apkPath = path.join(__dirname, 'dunvex_app.apk');
  const dPath = path.join(__dirname, 'downloads/dunvex_app.apk');
  if (fs.existsSync(apkPath)) {
    return res.download(apkPath, 'dunvex_app.apk');
  } else if (fs.existsSync(dPath)) {
    return res.download(dPath, 'dunvex_app.apk');
  } else {
    res.status(404).send('APK not found');
  }
});

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
  if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/downloads')) {
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

// Initialize Socket.io P2P Signaling Server
initSignaling(httpServer);

// Start server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoints are available at http://localhost:${PORT}/api`);
  console.log(`P2P WebRTC Signaling Server is active on port ${PORT}`);
});
