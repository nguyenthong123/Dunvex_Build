import express from 'express';
import * as db from '../db.js';
import { requireAuth } from './data-api.js';
import { dispatchNewOrderNotification } from '../telegram-helper.js';
import { ioInstance } from '../signaling.js';

const router = express.Router();

const SYNC_TABLES = [
  'customers',
  'products',
  'orders',
  'order_items',
  'payments',
  'debts',
  'suppliers',
  'supplier_debts',
  'purchase_orders',
  'inventory_logs',
  'checkins',
  'attendance_logs',
  'price_lists',
  'coupons',
  'settings',
  'system_config',
  'users',
  'rebate_tiers',
  'customer_rebates',
  'notifications',
  'categories',
  'units',
  'specifications',
  'packagings',
  'densities'
];

/**
 * Helper to get numeric timestamp ms from doc updated_at / updatedAt
 */
function getTimestampMs(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

function isFinalizedOrder(order) {
  return String(order?.status || '').trim() === 'Đơn chốt';
}

function boundedLogValue(value, maxLength = 128) {
  return value == null ? null : String(value).slice(0, maxLength);
}

/**
 * Dispatch a newly finalized order through the shared n8n Alert Hub.
 */
async function dispatchOrderNotification(orderDoc, ownerId) {
  await dispatchNewOrderNotification(ownerId, orderDoc, 'sync');
}

/**
 * POST /api/sync/push
 * Batch push updates from Local Client SQLite to VPS Server.
 * Applies Last-Write-Wins (LWW) conflict resolution based on updated_at.
 */
router.post('/push', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user?.ownerId || req.user?.uid || req.headers['x-owner-id'];
    if (!ownerId) {
      return res.status(400).json({ error: 'Missing ownerId' });
    }

    const { deviceId, changes } = req.body;
    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({ error: 'Invalid changes payload' });
    }

    const syncedIds = {};
    for (const table of SYNC_TABLES) {
      syncedIds[table] = [];
    }
    const rejectedIds = [];
    const serverTime = Date.now();
    let newOrdersCount = 0;
    const ordersToNotify = [];

    db.withTransaction(() => {
      for (const table of SYNC_TABLES) {
        const items = changes[table];
        if (!Array.isArray(items) || items.length === 0) continue;

        for (const item of items) {
          if (!item || !item.id) continue;

          // Ensure ownerId is attached
          const record = {
            ...item,
            ownerId,
            updated_at: getTimestampMs(item.updated_at || item.updatedAt || serverTime),
            sync_status: 1
          };

          // Handle soft-deleted or deleted records pushed from client
          if (record.is_deleted || record.deleted) {
            db.remove(table, item.id);
            db.recordDeletion(table, item.id, ownerId);
            syncedIds[table].push(item.id);
            continue;
          }

          // Query existing record on server
          const existing = db.getById(table, item.id);

          if (existing) {
            const existingUpdatedAt = getTimestampMs(existing.updated_at || existing.updatedAt);
            const transitionedToFinalized = table === 'orders'
              && !isFinalizedOrder(existing)
              && isFinalizedOrder(record);
            // Last-Write-Wins (LWW) Check
            if (record.updated_at < existingUpdatedAt) {
              // Server has a newer update, reject client's older push
              rejectedIds.push({
                table,
                id: item.id,
                reason: 'server_newer',
                client_updated_at: record.updated_at,
                server_updated_at: existingUpdatedAt,
              });
              continue;
            }
            // Client has newer or equal update -> Update server
            const updated = db.update(table, item.id, record);
            if (transitionedToFinalized && !updated.is_deleted && !updated.deleted) {
              ordersToNotify.push(updated);
            }
          } else {
            // Insert new record
            const created = db.create(table, record, item.id);
            if (table === 'orders') {
              newOrdersCount++;
              if (isFinalizedOrder(created) && !created.is_deleted && !created.deleted) {
                ordersToNotify.push(created);
              }
            }
          }

          syncedIds[table].push(item.id);
        }
      }
    });

    for (const order of ordersToNotify) {
      dispatchOrderNotification(order, ownerId).catch((err) => {
        console.warn('[Sync Push] Order notification failed:', err.message);
      });
    }

    if (rejectedIds.length > 0) {
      const conflictsByTable = {};
      for (const conflict of rejectedIds) {
        conflictsByTable[conflict.table] = (conflictsByTable[conflict.table] || 0) + 1;
      }
      console.warn('[Sync Conflict Audit]', JSON.stringify({
        event: 'sync_conflict',
        ownerId: boundedLogValue(ownerId),
        deviceId: boundedLogValue(deviceId),
        occurredAt: new Date(serverTime).toISOString(),
        conflictCount: rejectedIds.length,
        conflictsByTable,
        conflicts: rejectedIds.map((conflict) => ({
          table: conflict.table,
          recordId: boundedLogValue(conflict.id),
          reason: conflict.reason,
          clientUpdatedAt: conflict.client_updated_at,
          serverUpdatedAt: conflict.server_updated_at,
        })),
      }));
    }

    // Notify other connected devices of this owner via Socket.io
    if (ioInstance) {
      const ownerRoom = ioInstance.to(`owner:${ownerId}`);
      const recipients = deviceId ? ownerRoom.except(`device:${deviceId}`) : ownerRoom;
      recipients.emit('sync:remote_data_pushed', {
        senderDeviceId: deviceId,
        serverTime,
        affectedTables: Object.keys(syncedIds).filter(t => syncedIds[t].length > 0)
      });
    }

    return res.json({
      success: true,
      server_time: serverTime,
      synced_ids: syncedIds,
      rejected_ids: rejectedIds,
      conflict_count: rejectedIds.length,
      new_orders_created: newOrdersCount
    });
  } catch (err) {
    console.error('[Sync Push] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error during sync push' });
  }
});

/**
 * GET /api/sync/pull?since={timestamp}
 * Pull all changes on VPS Server since given timestamp for this owner.
 */
router.get('/pull', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user?.ownerId || req.user?.uid || req.headers['x-owner-id'];
    if (!ownerId) {
      return res.status(400).json({ error: 'Missing ownerId' });
    }

    const sinceParam = req.query.since;
    const sinceTimestamp = sinceParam && Number(sinceParam) !== 0 ? getTimestampMs(sinceParam) : 0;
    const serverTime = req.query.until ? getTimestampMs(req.query.until) : Date.now();
    const isPaged = req.query.limit !== undefined;
    const requestedLimit = Number(req.query.limit);
    const pageSize = isPaged
      ? Number.isSafeInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 250) : 150
      : Number.MAX_SAFE_INTEGER;
    const cursorMatch = typeof req.query.cursor === 'string'
      ? /^(\d+):(\d+)$/.exec(req.query.cursor)
      : null;
    if (isPaged && req.query.cursor && !cursorMatch) {
      return res.status(400).json({ error: 'Invalid sync cursor' });
    }
    let tableIndex = cursorMatch ? Number(cursorMatch[1]) : 0;
    let rowOffset = cursorMatch ? Number(cursorMatch[2]) : 0;
    if (!Number.isSafeInteger(tableIndex) || tableIndex >= SYNC_TABLES.length ||
        !Number.isSafeInteger(rowOffset) || rowOffset < 0) {
      if (isPaged && req.query.cursor) {
        return res.status(400).json({ error: 'Invalid sync cursor' });
      }
      tableIndex = 0;
      rowOffset = 0;
    }

    const changes = {};
    for (const table of SYNC_TABLES) {
      changes[table] = [];
    }

    let remaining = pageSize;
    let nextCursor = null;
    for (let index = tableIndex; index < SYNC_TABLES.length && remaining > 0; index++) {
      const table = SYNC_TABLES[index];
      let allRows = [];
      try {
        if (['settings', 'system_config'].includes(table)) {
          allRows = db.getAll(table) || [];
        } else {
          allRows = db.getAll(table, {
            where: [`ownerId:==:${ownerId}`]
          }) || [];
        }
      } catch (tableErr) {
        console.warn(`[Sync Pull] Warning querying table ${table}:`, tableErr.message);
      }

      // Filter rows modified after `sinceTimestamp` (when since=0, return all)
      const modified = allRows.filter(row => {
        const itemUpdatedAt = getTimestampMs(row.updated_at || row.updatedAt || row.createdAt);
        if (sinceTimestamp !== 0 && itemUpdatedAt <= sinceTimestamp) return false;
        return !isPaged || itemUpdatedAt <= serverTime;
      }).sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));

      const offset = index === tableIndex ? rowOffset : 0;
      const pageRows = modified.slice(offset, offset + remaining);
      changes[table] = pageRows;
      remaining -= pageRows.length;

      if (offset + pageRows.length < modified.length) {
        nextCursor = `${index}:${offset + pageRows.length}`;
        break;
      }
      nextCursor = index + 1 < SYNC_TABLES.length ? `${index + 1}:0` : null;
    }

    // 1. Get deletions from _deletions table
    const deletions = !isPaged || !req.query.cursor
      ? db.getDeletions(ownerId, sinceTimestamp)
      : {};

    // 2. Also check trash table for soft-deleted documents
    try {
      const trashRows = !isPaged || !req.query.cursor
        ? db.getAll('trash', { where: [`ownerId:==:${ownerId}`] }) || []
        : [];
      for (const t of trashRows) {
        if (!t.originalCollection || !t.originalId) continue;
        const deletedAtMs = getTimestampMs(t.deletedAt || t.deleted_at);
        if (sinceTimestamp === 0 || deletedAtMs > sinceTimestamp) {
          if (!deletions[t.originalCollection]) {
            deletions[t.originalCollection] = [];
          }
          if (!deletions[t.originalCollection].includes(t.originalId)) {
            deletions[t.originalCollection].push(t.originalId);
          }
        }
      }
    } catch (trashErr) {
      console.warn('[Sync Pull] Trash check error:', trashErr.message);
    }

    return res.json({
      success: true,
      server_time: serverTime,
      since: sinceTimestamp,
      changes,
      deletions,
      ...(isPaged ? { next_cursor: nextCursor, page_size: pageSize } : {})
    });
  } catch (err) {
    console.error('[Sync Pull] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error during sync pull' });
  }
});

export default router;
