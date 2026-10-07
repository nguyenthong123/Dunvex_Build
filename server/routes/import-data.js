import * as db from '../db.js';

export default async function importData(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { collections, ownerId } = req.body || {};

  if (!collections || typeof collections !== 'object') {
    return res.status(400).json({ error: 'Payload không hợp lệ (cần có object collections)' });
  }

  try {
    let totalImportedCount = 0;
    const summary = {};

    for (const [colName, docs] of Object.entries(collections)) {
      if (!Array.isArray(docs)) continue;

      // Build batch operations: create or update each document
      const operations = [];
      let colImportCount = 0;

      for (const item of docs) {
        if (!item || typeof item !== 'object') continue;
        const docId = item.id || `imp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // Check if document already exists in SQLite
        const existing = db.get(colName, docId);

        const mergedDoc = {
          ...(existing || {}),
          ...item,
          id: docId,
          ownerId: ownerId || item.ownerId || '',
          updatedAt: new Date().toISOString(),
        };

        if (existing) {
          operations.push({ type: 'update', collection: colName, id: docId, data: mergedDoc });
        } else {
          operations.push({ type: 'create', collection: colName, id: docId, data: mergedDoc });
        }
        colImportCount++;

        // Batch every 50 ops to avoid locking too long
        if (operations.length >= 50) {
          db.batchWrite(operations);
          operations.length = 0;
        }
      }

      // Write remaining
      if (operations.length > 0) {
        db.batchWrite(operations);
      }

      summary[colName] = colImportCount;
      totalImportedCount += colImportCount;
    }

    console.log(`[IMPORT] Imported ${totalImportedCount} documents into SQLite`);

    return res.status(200).json({
      success: true,
      totalImported: totalImportedCount,
      summary,
    });
  } catch (error) {
    console.error('Import API error:', error);
    return res.status(500).json({ error: error.message || 'Lỗi server khi đồng bộ dữ liệu' });
  }
}
