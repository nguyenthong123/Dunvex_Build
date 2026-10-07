import express from 'express';
import * as db from '../db.js';
import { dispatchNotification } from '../telegram-helper.js';

const router = express.Router();
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

function getItemDisplayName(collection, doc) {
  if (!doc) return 'Dữ liệu';
  if (collection === 'orders') return doc.orderCode || doc.customerName || `Đơn hàng #${(doc.id || '').slice(-6)}`;
  if (collection === 'products') return doc.name || doc.productName || `Sản phẩm #${(doc.id || '').slice(-6)}`;
  if (collection === 'customers') return doc.name || doc.customerName || doc.phone || `Khách hàng #${(doc.id || '').slice(-6)}`;
  if (collection === 'suppliers') return doc.name || doc.supplierName || `Nhà cung cấp #${(doc.id || '').slice(-6)}`;
  return doc.name || doc.title || doc.id || 'Bản ghi';
}

function getCollectionLabel(collection) {
  if (collection === 'orders') return 'Đơn hàng';
  if (collection === 'products') return 'Sản phẩm';
  if (collection === 'customers') return 'Khách hàng';
  if (collection === 'suppliers') return 'Nhà cung cấp';
  return collection;
}

export function purgeExpiredTrash() {
  console.log('[CRON] Running 5-day Trash Auto-Purge job...');
  try {
    const trashItems = db.getAll('trash') || [];
    const now = Date.now();
    const purgedByOwner = new Map();

    for (const item of trashItems) {
      if (!item.deletedAt) continue;
      const deletedTime = new Date(item.deletedAt).getTime();
      if (isNaN(deletedTime)) continue;

      if (now - deletedTime > FIVE_DAYS_MS) {
        db.remove('trash', item.id);
        const ownerId = item.ownerId || 'global';
        if (!purgedByOwner.has(ownerId)) purgedByOwner.set(ownerId, []);
        purgedByOwner.get(ownerId).push(item);
      }
    }

    let totalPurged = 0;
    for (const [ownerId, items] of purgedByOwner.entries()) {
      totalPurged += items.length;
      if (items.length === 0) continue;
      const itemListText = items.slice(0, 10).map(it => {
        const label = getCollectionLabel(it.originalCollection);
        const title = getItemDisplayName(it.originalCollection, it.doc);
        return `  • [${label}] ${title}`;
      }).join('\n');
      const moreText = items.length > 10 ? `\n  ... và ${items.length - 10} bản ghi khác` : '';

      const msg = `🔥 <b>[DUNVEX BUILD] Hệ thống tự động xoá vĩnh viễn Thùng rác</b>\n• Lý do: Đã lưu trữ quá <b>5 ngày</b>\n• Số lượng: <b>${items.length} bản ghi</b>\n• Danh sách chi tiết đã xoá:\n${itemListText}${moreText}`;

      dispatchNotification(ownerId, 'trash_auto_purge', msg, {
        purgedCount: items.length,
        items: items.map(i => ({ collection: i.originalCollection, id: i.originalId, title: getItemDisplayName(i.originalCollection, i.doc) }))
      });
    }

    console.log(`[CRON] Trash Auto-Purge completed. Removed ${totalPurged} expired items.`);
    return totalPurged;
  } catch (err) {
    console.error('[CRON] Trash Auto-Purge error:', err);
    return 0;
  }
}

router.get('/', (req, res) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  const validKey = 'dunvex_b0b177d643677fb0a676bd3001881112';

  if (apiKey !== validKey && apiKey !== `Bearer ${validKey}`) {
    return res.status(403).json({ success: false, error: 'Forbidden: Truy cập bị từ chối!' });
  }

  const count = purgeExpiredTrash();
  res.json({ success: true, purgedCount: count });
});


export default router;
