import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as dbModule from '../db.js';
import { resolveSession } from '../auth-session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'dunvex.db');

async function isAuthorized(req) {
  const token = req.query.token || req.headers['x-backup-token'] || '';
  const CRON_SECRET = process.env.CRON_SECRET || '5e2b86a8fdc7e19d7d4c2b9f3a5e1d7d8e6c4b2a9f1d8c7a';
  
  if (token === CRON_SECRET) {
    return true;
  }

  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const session = resolveSession(token);
    return session?.user.email === 'dunvex.green@gmail.com' && session.user.role === 'admin';
  }
  return false;
}

export async function downloadDb(req, res) {
  try {
    if (!await isAuthorized(req)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    // Force checkpoint (flush WAL to main file)
    dbModule.forceFlush();

    // Set download headers
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', 'attachment; filename="dunvex.db"');
    
    res.download(DB_PATH, 'dunvex.db');
  } catch (err) {
    console.error('[DB-Backup] Download failed:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function uploadDb(req, res) {
  try {
    if (!await isAuthorized(req)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Accumulate chunks of binary db file
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 1024) {
          return res.status(400).json({ error: 'Invalid database file size' });
        }

        console.log(`[DB-Backup] Restoring database from upload, size: ${(buffer.length / 1024).toFixed(1)} KB`);

        // 1. Close active sqlite connection
        dbModule.close();

        // 2. Backup existing database file just in case
        if (fs.existsSync(DB_PATH)) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          fs.renameSync(DB_PATH, `${DB_PATH}.bak-${timestamp}`);
        }

        // 3. Write uploaded buffer to dunvex.db
        fs.writeFileSync(DB_PATH, buffer);

        // 4. Delete shm and wal journal files to prevent mismatch corruption
        const shmPath = `${DB_PATH}-shm`;
        const walPath = `${DB_PATH}-wal`;
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);

        // 5. Re-open connection
        dbModule.load();

        res.status(200).json({ success: true, message: 'Database restored successfully' });
      } catch (err) {
        console.error('[DB-Backup] Write failed:', err);
        // Attempt to reload connection even if restore failed
        try { dbModule.load(); } catch(e){}
        res.status(500).json({ error: err.message });
      }
    });
  } catch (err) {
    console.error('[DB-Backup] Upload failed:', err);
    res.status(500).json({ error: err.message });
  }
}
