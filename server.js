import express from 'express';
import cors from 'cors';
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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Serve static frontend from 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for React Router (SPA)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
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
