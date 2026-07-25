import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
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
// Limit JSON to 2MB to prevent DoS. Upload API handles base64 image strings which can be larger, 
// so we set limit to 10MB to accommodate images, but not absurdly large payloads.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import API Routes
import apiRoutes from './server/routes/api.js';
app.use('/api', apiRoutes);

// Setup node-cron to run EOD job at a random minute between 17:00 and 17:59 to avoid API overload
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

// Serve uploaded files (images, logos, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static frontend from 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for React Router (SPA) — skip /api and /uploads
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    next();
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoints are available at http://localhost:${PORT}/api`);
});
