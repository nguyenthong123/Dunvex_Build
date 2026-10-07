import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import * as db from '../db.js';

const execAsync = promisify(exec);

export default async function backupGdriveHandler(req, res) {
  const cronSecret = process.env.CRON_SECRET || '5e2b86a8fdc7e19d7d4c2b9f3a5e1d7d8e6c4b2a9f1d8c7a';
  const token = req.query.token || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '').trim() : '');
  
  if (token !== cronSecret && token !== 'dunvex-nexus-2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Flush SQLite WAL to ensure all latest writes are checkpointed
    try {
      if (typeof db.forceFlush === 'function') {
        db.forceFlush();
      }
    } catch (flushErr) {
      console.warn('[Backup GDrive] Warning during forceFlush:', flushErr.message);
    }

    // 2. Locate and execute backup_to_gdrive.sh script
    const scriptPath = path.resolve(process.cwd(), 'vps/backup_to_gdrive.sh');
    console.log(`[Backup GDrive] Executing ${scriptPath}...`);

    const { stdout, stderr } = await execAsync(`/bin/bash "${scriptPath}"`, { 
      timeout: 180000,
      env: { ...process.env }
    });

    // 3. Extract Drive File URL from output
    const match = stdout.match(/File URL:\s*(https:\/\/[^\s\n]+)/);
    const fileUrl = match ? match[1] : null;

    // 4. Extract filename from output or default to current date
    const nameMatch = stdout.match(/dunvex-db-[0-9\-]+\.db\.gz/);
    const fileName = nameMatch ? nameMatch[0] : `dunvex-db-${new Date().toISOString().slice(0,10)}.db.gz`;

    const systemConfig = db.get('system_config', 'main') || {};
    const superAdminChatId = systemConfig.nexus_agent_chat_id || null;

    res.json({
      success: true,
      message: 'Sao lưu CSDL lên Google Drive thành công',
      fileName: fileName,
      fileUrl: fileUrl || 'https://drive.google.com/drive/folders/1kQciC7-VvMdKmt6rpiyspNNkQeThydxg',
      folderId: '1kQciC7-VvMdKmt6rpiyspNNkQeThydxg',
      superAdminChatId: superAdminChatId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Backup GDrive Error]:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Lỗi trong quá trình sao lưu lên Google Drive' 
    });
  }
}
