import express from 'express';
import rateLimit from 'express-rate-limit';
import * as db from '../db.js';
import { resolveSession } from '../auth-session.js';
import { dispatchNotification } from '../telegram-helper.js';
import { ioInstance } from '../signaling.js';

function notifyOwnerDevices(ownerId, collections, senderDeviceId = '') {
  if (!ioInstance || !ownerId) return;
  try {
    const ownerRoom = ioInstance.to(`owner:${ownerId}`);
    const recipients = senderDeviceId ? ownerRoom.except(`device:${senderDeviceId}`) : ownerRoom;
    recipients.emit('sync:remote_data_pushed', {
      senderDeviceId,
      serverTime: Date.now(),
      affectedTables: Array.isArray(collections) ? collections : [collections]
    });
  } catch (err) {
    console.warn('[data-api] Failed to notify owner devices:', err.message);
  }
}

const router = express.Router();

// ─── Shared Constants ─────────────────────────────────────
const SUPER_ADMIN_EMAIL = 'dunvex.green@gmail.com';
const GLOBAL_COLLECTIONS = ['subscription_packages', 'system_config'];
const ADMIN_COLLECTIONS = ['users', 'settings', 'payment_requests', 'audit_logs', 'ai_analytics'];

// ─── Write Rate Limiter ──────────────────────────────────

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Write rate limit exceeded' },
});

// ─── Simple In-Memory Cache + Dedup ────────────────────────

const cache = new Map();
const pendingRequests = new Map(); // request deduplication
const CACHE_TTL = 30_000; // 30 seconds

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  // Evict old entries if > 200
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > CACHE_TTL) cache.delete(k);
    }
  }
  cache.set(key, { data, ts: Date.now() });
}

/**
 * Dedup requests — nếu nhiều request giống hệt nhau gửi cùng lúc,
 * chỉ query DB 1 lần, các request còn lại đợi kết quả.
 */
function dedupRequest(key, fetchFn) {
  // Check cache first
  const cached = getCache(key);
  if (cached) return Promise.resolve(cached);

  // Check if there's already a pending request for this key
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  // Start new request
  const promise = fetchFn().then(data => {
    pendingRequests.delete(key);
    setCache(key, data);
    return data;
  }).catch(err => {
    pendingRequests.delete(key);
    throw err;
  });

  pendingRequests.set(key, promise);
  return promise;
}

// Invalidate cache on write
function invalidateCache(collection, ownerId) {
  const prefix = `${ownerId}:${collection}`;
  for (const key of cache.keys()) {
    if (key === prefix || key.startsWith(prefix + ':')) {
      cache.delete(key);
    }
  }
}

// Global listener for ANY database changes (e.g., from webhooks or other processes)
db.dbEvents.on('change', (data) => {
  for (const key of cache.keys()) {
    if (key.includes(`:${data.collection}:`) || key.endsWith(`:${data.collection}`)) {
      cache.delete(key);
    }
  }
});

// ─── Auth Middleware ───────────────────────────────────────

function getOwnerId(req) {
  return req.headers['x-owner-id'] || req.headers['X-Owner-Id'] || '';
}

function getApiKey(req) {
  return req.headers['x-api-key'] || req.headers['X-Api-Key'] || '';
}

export async function requireAuth(req, res, next) {
  let ownerId = getOwnerId(req);
  const apiKey = getApiKey(req);
  const authHeader = req.headers.authorization;

  try {
    if (apiKey) {
      if (!ownerId) {
        return res.status(401).json({ error: 'Missing x-owner-id header for API key auth' });
      }
      const apiKeys = db.getAll('api_keys');
      const keyDoc = apiKeys.find(k =>
        (k.ownerId === ownerId || k.id === ownerId) && k.key === apiKey
      );
      if (!keyDoc || keyDoc.enabled !== true) {
        return res.status(403).json({ error: 'Invalid or disabled API key' });
      }
      req.verifiedOwnerId = ownerId;

      const ownerUser = db.get('users', ownerId);
      if (ownerUser) {
        req.user = ownerUser;
      }
      return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing Bearer token or API key' });
    }

    const sessionToken = authHeader.split('Bearer ')[1];
    const session = resolveSession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' });
    }

    const user = session.user;
    const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
    const effectiveOwnerId = isSuperAdmin && ownerId ? ownerId : (user.ownerId || user.uid);

    req.verifiedOwnerId = effectiveOwnerId;
    req.user = user;
    next();
  } catch (e) {
    console.error('[AUTH] Error:', e.message);
    return res.status(401).json({ error: 'Auth check failed' });
  }
}

function calculateHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Routes ────────────────────────────────────────────────

// GET /_stats — public overview (no sensitive data)
router.get('/_stats', (req, res) => {
  res.json({ success: true, stats: db.getStats() });
});

// GET /stream — SSE endpoint for real-time updates
router.get('/stream', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write('data: {"type":"ping"}\n\n');
  if (res.flush) res.flush();

  // Send a ping every 30 seconds to prevent Nginx timeout (ERR_INCOMPLETE_CHUNKED_ENCODING)
  const keepAliveInterval = setInterval(() => {
    res.write('data: {"type":"ping"}\n\n');
    if (res.flush) res.flush();
  }, 30000);

  const onChange = (data) => {
    res.write(`data: ${JSON.stringify({ type: 'change', collection: data.collection })}\n\n`);
    if (res.flush) res.flush();
  };

  db.dbEvents.on('change', onChange);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    db.dbEvents.off('change', onChange);
  });
});

// GET /:collection — requires auth, auto-filter by ownerId, 30s cache + request dedup
router.get('/:collection', requireAuth, (req, res) => {
  const { collection } = req.params;
  const ownerId = req.verifiedOwnerId;
  const isCount = req.query.action === 'count';
  const isStats = req.query.action === 'stats';

  // Build cache key from collection + all query params
  const cacheKey = `${ownerId}:${collection}:${req.query.where || ''}:${req.query.orderBy || ''}:${req.query.limit || ''}:${req.query.offset || ''}:${req.query.search || ''}:${req.query.fromDate || ''}:${req.query.toDate || ''}:${isCount}:${isStats}`;
  
  // Use dedup to avoid duplicate DB queries for identical concurrent requests
  dedupRequest(cacheKey, () => {
    // Always filter by ownerId, EXCEPT for global collections or admin-accessible collections queried by super admin
    const isAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
    const shouldBypassFilter = GLOBAL_COLLECTIONS.includes(collection) || (isAdmin && ADMIN_COLLECTIONS.includes(collection));
    const where = shouldBypassFilter ? [] : [{ field: 'ownerId', op: '==', value: ownerId }];

    // Parse additional query filters
    if (req.query.where) {
      const clauses = Array.isArray(req.query.where) ? req.query.where : [req.query.where];
      for (const clause of clauses) {
        const parts = clause.split(':');
        if (parts.length >= 3) {
          if (parts[0] === 'ownerId') continue;
          where.push({ field: parts[0], op: parts[1], value: parts.slice(2).join(':') });
        }
      }
    }

    const filters = { where };
    
    if (req.query.search) {
      filters.search = String(req.query.search);
    }
    
    if (isCount) {
      return Promise.resolve({ isCount: true, count: db.countAll(collection, filters) });
    }

    // ─── Stats aggregation (action=stats) — returns count, totalAmount, totalProfit ───
    if (isStats) {
      return Promise.resolve({ isStats: true, data: db.getAll(collection, filters) });
    }

    if (req.query.orderBy) {
      const parts = req.query.orderBy.split(':');
      filters.orderBy = { field: parts[0], direction: parts[1] || 'asc' };
    }
    if (req.query.limit) {
      filters.limit = parseInt(req.query.limit) || 500;
    }
    if (req.query.offset) {
      filters.offset = parseInt(req.query.offset) || 0;
    }

    return Promise.resolve({ isCount: false, data: db.getAll(collection, filters) });
  }).then(result => {
    if (result.isCount) {
      res.json({ success: true, count: result.count });
    } else if (result.isStats) {
      // Aggregate stats from all docs, applying date filter if provided
      const fromDate = req.query.fromDate || '';
      const toDate = req.query.toDate || '';
      
      let filteredDocs = result.data;
      if (fromDate || toDate) {
        const start = fromDate || '0000-00-00';
        const end = toDate || '9999-99-99';
        filteredDocs = result.data.filter(doc => {
          const txDate = doc.orderDate || (doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : '');
          return txDate >= start && txDate <= end;
        });
      }
      
      // Filter only "Đơn chốt" for stats
      const closedOrders = filteredDocs.filter(doc => doc.status === 'Đơn chốt');
      
      let totalAmount = 0;
      let totalProfit = 0;
      for (const doc of closedOrders) {
        totalAmount += Number(doc.totalAmount) || 0;
        totalProfit += Number(doc.totalProfit) || 0;
      }
      
      res.json({
        success: true,
        count: closedOrders.length,
        totalAmount,
        totalProfit,
      });
    } else {
      res.json({ success: true, count: result.data.length, data: result.data });
    }
  }).catch(e => {
    res.status(500).json({ error: e.message });
  });
});

// Helper for security
function authorizeDocAccess(doc, collection, ownerId) {
  if (!doc) return true;
  if (collection === 'users' || collection === 'permissions' || collection === 'settings') return true;
  if (collection === 'system_config' || collection === 'subscription_packages') return true;
  return doc.ownerId === ownerId || doc.id === ownerId;
}

// Cascade cleanup: remove related `debts` ledger entries when a doc is deleted.
// Returns the customerId whose cached debt should be recomputed (or null).
function cascadeDebtCleanup(collection, id, existingDoc) {
  let field = null;
  if (collection === 'orders') field = 'orderId';
  else if (collection === 'payments') field = 'paymentId';
  else if (collection === 'customers') field = 'customerId';
  if (field) {
    const related = db.getAll('debts', { where: [{ field, op: '==', value: id }] });
    related.forEach(d => db.remove('debts', d.id));
  }
  return existingDoc?.customerId || (collection === 'customers' ? id : null);
}

// Recompute a customer's cached debt fields from their orders + payments
function recalcCustomerDebt(customerId) {
  const orders = (db.getAll('orders') || []).filter(o => o.customerId === customerId && o.status === 'Đơn chốt');
  const payments = (db.getAll('payments') || []).filter(p => p.customerId === customerId);
  const totalOrder = orders.reduce((s, o) => s + (Number(o.totalAmount) || Number(o.finalTotal) || Number(o.total) || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const debt = totalOrder - totalPaid;
  const c = db.get('customers', customerId);
  if (c) {
    db.update('customers', customerId, {
      debt,
      totalDebt: debt,
      totalOrdersAmount: totalOrder,
      totalPaymentsAmount: totalPaid,
      updatedAt: new Date().toISOString(),
    });
  }
}

// Auto-sync employee user record whenever an invitation is created/updated
function syncPendingPermissionToUser(permDoc) {
  if (!permDoc || !permDoc.email || !permDoc.ownerId) return;
  const cleanEmail = String(permDoc.email).toLowerCase().trim();
  const allUsers = db.getAll('users') || [];
  const existing = allUsers.find(u => (u.email || '').toLowerCase().trim() === cleanEmail);
  if (existing) {
    const updated = {
      ...existing,
      ownerId: permDoc.ownerId,
      ownerEmail: permDoc.ownerEmail || existing.ownerEmail,
      role: permDoc.role || 'sale',
      marketPointsRequired: permDoc.marketPointsRequired || 1,
      status: 'active',
      accessRights: permDoc.accessRights || existing.accessRights || {
        dashboard: true,
        orders_view: true,
        orders_create: true,
        inventory_view: true,
        customers_manage: true,
        debts_manage: true,
        users_manage: false,
        admin: false,
        system_manage: false
      }
    };
    db.update('users', existing.id || existing.uid, updated);
    invalidateCache('users', permDoc.ownerId);
    invalidateCache('users', existing.uid || existing.id);
  }
}


// GET /:collection/:id — requires auth + dedup cache
router.get('/:collection/:id', requireAuth, (req, res) => {
  const { collection, id } = req.params;
  const ownerId = req.verifiedOwnerId;
  const cacheKey = `${ownerId}:${collection}:id:${id}`;

  dedupRequest(cacheKey, () => Promise.resolve(db.getById(collection, id)))
    .then(doc => {
      if (!doc) return res.json({ success: true, data: null });
      const isAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
      const isDocAdminAccessible = isAdmin && [...ADMIN_COLLECTIONS, ...GLOBAL_COLLECTIONS].includes(collection);
      if (!authorizeDocAccess(doc, collection, ownerId) && !isDocAdminAccessible) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      res.json({ success: true, data: doc });
    })
    .catch(e => res.status(500).json({ error: e.message }));
});

// ─── Trash & Approval Helpers ──────────────────────────────

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

function softDeleteDoc(collection, id, existingDoc, req, afterCommit) {
  if (!existingDoc) return;

  // 🚫 System & ephemeral collections (like notifications, logs) should be hard-deleted silently without trash or Telegram notification
  if (['notifications', 'logs', 'inventory_logs', 'audit_logs', 'sessions'].includes(collection)) {
    db.remove(collection, id);
    invalidateCache(collection, req.verifiedOwnerId);
    return;
  }

  const trashRecord = {
    id: 'trash_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    originalCollection: collection,
    originalId: id,
    doc: existingDoc,
    deletedAt: new Date().toISOString(),
    deletedBy: {
      uid: req.user?.uid || '',
      email: req.user?.email || '',
      displayName: req.user?.displayName || req.user?.email || ''
    },
    ownerId: req.verifiedOwnerId || existingDoc.ownerId
  };
  db.create('trash', trashRecord, trashRecord.id);
  db.remove(collection, id);
  invalidateCache('trash', req.verifiedOwnerId);

  // 🔔 Send Notification via Telegram / n8n
  const label = getCollectionLabel(collection);
  const title = getItemDisplayName(collection, existingDoc);
  const userName = req.user?.displayName || req.user?.email || 'Hệ thống';
  const msg = `🗑️ <b>[DUNVEX BUILD] Đã chuyển vào Thùng rác</b>\n• Loại: <b>${label}</b>\n• Tên/Mã: <b>${title}</b>\n• Người xoá: <b>${userName}</b>\n• Thời gian: ${new Date().toLocaleString('vi-VN')}\n💡 <i>Tự động xoá vĩnh viễn sau 5 ngày nếu không được khôi phục.</i>`;

  const notify = () => dispatchNotification(req.verifiedOwnerId || existingDoc.ownerId, 'trash_moved', msg, {
    collection,
    docId: id,
    title,
    deletedBy: userName
  });
  if (afterCommit) afterCommit.push(notify);
  else notify();
}

function isStaffUser(req) {
  if (!req.user) return false;
  const isOwnerOrAdmin = req.user.uid === req.verifiedOwnerId || req.user.email === SUPER_ADMIN_EMAIL || req.user.role === 'admin';
  if (isOwnerOrAdmin) return false;
  return req.user.role === 'sale' || req.user.role === 'staff';
}

function applyCouponToOrder(data, ownerId) {
  if (!data || !Array.isArray(data.items)) return;
  const couponCode = data.couponCode ? String(data.couponCode).toUpperCase().trim() : '';
  if (!couponCode) return;

  const allCoupons = db.getAll('coupons') || [];
  const coupon = allCoupons.find(c => c.ownerId === ownerId && String(c.code).toUpperCase().trim() === couponCode && c.status === 'active');
  if (!coupon) return;

  const today = new Date().toISOString().split('T')[0];
  if (coupon.expiry && coupon.expiry < today) return;

  const subTotal = (data.items || []).reduce((sum, item) => {
    const qty = Number(item.qty) || 0;
    const price = Number(item.priceSell) || Number(item.price) || 0;
    return sum + (qty * price);
  }, 0);

  const shippingFee = Number(data.shippingFee) || 0;
  const discountVal = parseFloat(coupon.discount) || 0;
  const scope = coupon.scope || 'order';

  let totalDiscount = 0;

  if (scope === 'product') {
    const targetIds = Array.isArray(coupon.targetProductIds) ? coupon.targetProductIds.map(String) : [];
    const targetSkus = Array.isArray(coupon.targetProductSkus) ? coupon.targetProductSkus.map(s => String(s).toLowerCase().trim()) : [];

    for (const item of data.items) {
      const itemId = item.productId ? String(item.productId) : '';
      const itemSku = item.sku ? String(item.sku).toLowerCase().trim() : '';

      if ((itemId && targetIds.includes(itemId)) || (itemSku && targetSkus.includes(itemSku))) {
        const qty = Number(item.qty) || 0;
        const price = Number(item.priceSell) || Number(item.price) || 0;
        let itemDiscount = 0;

        if (coupon.type === 'percentage') {
          itemDiscount = (qty * price) * (discountVal / 100);
        } else if (coupon.type === 'fixed') {
          itemDiscount = qty * discountVal;
        }

        totalDiscount += itemDiscount;
      }
    }
  } else {
    if (coupon.type === 'percentage') {
      totalDiscount = subTotal * (discountVal / 100);
    } else if (coupon.type === 'fixed') {
      totalDiscount = discountVal;
    } else if (coupon.type === 'shipping') {
      totalDiscount = shippingFee;
    }
  }

  totalDiscount = Math.min(Math.max(0, Math.round(totalDiscount)), Math.max(0, subTotal));

  data.discountAmt = totalDiscount;
  data.discountValue = totalDiscount;
  data.couponId = coupon.id;
  data.couponCode = coupon.code;
  data.finalTotal = Math.max(0, subTotal + shippingFee - totalDiscount);
  data.totalAmount = data.finalTotal;
}

// ALL /trash/:id/purge — permanently delete from trash (handles both DELETE and POST)
router.all('/trash/:id/purge', requireAuth, (req, res) => {
  const { id } = req.params;
  try {
    const trashDoc = db.getById('trash', id);
    if (!trashDoc) {
      return res.json({ success: true, message: 'Bản ghi không còn trong Thùng rác' });
    }
    if (!authorizeDocAccess(trashDoc, 'trash', req.verifiedOwnerId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const label = getCollectionLabel(trashDoc.originalCollection);
    const title = getItemDisplayName(trashDoc.originalCollection, trashDoc.doc);
    const userName = req.user?.displayName || req.user?.email || 'Hệ thống';
    const msg = `❌ <b>[DUNVEX BUILD] Đã xoá vĩnh viễn khỏi Thùng rác</b>\n• Loại: <b>${label}</b>\n• Tên/Mã: <b>${title}</b>\n• Người xoá: <b>${userName}</b>\n• Thời gian: ${new Date().toLocaleString('vi-VN')}`;

    dispatchNotification(req.verifiedOwnerId || trashDoc.ownerId, 'trash_purge', msg, {
      collection: trashDoc.originalCollection,
      docId: trashDoc.originalId,
      title,
      purgedBy: userName
    });

    db.remove('trash', id);
    invalidateCache('trash', req.verifiedOwnerId);
    res.json({ success: true, message: 'Đã xoá vĩnh viễn khỏi Thùng rác' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /_batch — Apply all write operations atomically
router.post('/_batch', requireAuth, writeLimiter, (req, res) => {
  const { operations } = req.body;
  if (!Array.isArray(operations)) {
    return res.status(400).json({ error: 'operations must be an array' });
  }

  const ownerId = req.verifiedOwnerId;
  const changedCollections = new Set();
  const afterCommit = [];

  try {
    db.withTransaction(() => {
      for (const op of operations) {
        const { type, collection, id, data } = op;
        if (!collection || !type) continue;
        changedCollections.add(collection);

        if (type === 'create') {
          const createData = { ...(data || {}), ownerId: data?.ownerId || ownerId };
          if (collection === 'orders') {
            applyCouponToOrder(createData, createData.ownerId);
          }
          db.create(collection, createData, id);
        } else if (type === 'update') {
          if (!id) continue;
          const existing = db.getById(collection, id);
          if (existing) {
            const updateData = { ...(data || {}) };
            for (const [k, v] of Object.entries(updateData)) {
              if (typeof v === 'string' && v.startsWith('__inc__')) {
                const incVal = Number(v.replace('__inc__', '')) || 0;
                updateData[k] = (Number(existing[k]) || 0) + incVal;
              }
            }
            db.update(collection, id, updateData);
          }
        } else if (type === 'delete') {
          if (!id) continue;
          const existing = db.getById(collection, id);
          if (existing) {
            if (collection === 'trash') {
              db.remove('trash', id);
            } else if (isStaffUser(req) && (collection === 'products' || collection === 'customers')) {
              db.update(collection, id, {
                approvalStatus: 'pending_delete',
                deleteRequestedBy: {
                  uid: req.user?.uid || '',
                  email: req.user?.email || '',
                  displayName: req.user?.displayName || req.user?.email || ''
                },
                deleteRequestedAt: new Date().toISOString()
              });
            } else {
              softDeleteDoc(collection, id, existing, req, afterCommit);
            }
            const customerId = cascadeDebtCleanup(collection, id, existing);
            if (customerId) recalcCustomerDebt(customerId);
          }
        }
      }
    });

    for (const notify of afterCommit) {
      try {
        notify();
      } catch (err) {
        console.error('Post-commit notification failed:', err);
      }
    }

    for (const col of changedCollections) {
      invalidateCache(col, ownerId);
    }

    notifyOwnerDevices(ownerId, Array.from(changedCollections), req.headers['x-device-id'] || '');

    res.json({ success: true, count: operations.length });
  } catch (err) {
    console.error('Batch write error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /trash/:id/restore — restore soft deleted doc back to original collection
router.post('/trash/:id/restore', requireAuth, (req, res) => {
  const { id } = req.params;
  try {
    const trashDoc = db.getById('trash', id);
    if (!trashDoc) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi trong Thùng rác' });
    }
    if (!authorizeDocAccess(trashDoc, 'trash', req.verifiedOwnerId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { originalCollection, originalId, doc: originalDoc } = trashDoc;
    if (originalCollection && originalDoc) {
      delete originalDoc.approvalStatus;
      delete originalDoc.deleteRequestedBy;
      delete originalDoc.deleteRequestedAt;
      db.create(originalCollection, originalDoc, originalId || originalDoc.id);
      invalidateCache(originalCollection, req.verifiedOwnerId);
    }

    db.remove('trash', id);
    invalidateCache('trash', req.verifiedOwnerId);

    // 🔔 Send Notification via Telegram / n8n
    const label = getCollectionLabel(originalCollection);
    const title = getItemDisplayName(originalCollection, originalDoc);
    const userName = req.user?.displayName || req.user?.email || 'Hệ thống';
    const msg = `♻️ <b>[DUNVEX BUILD] Khôi phục dữ liệu từ Thùng rác</b>\n• Loại: <b>${label}</b>\n• Tên/Mã: <b>${title}</b>\n• Người khôi phục: <b>${userName}</b>\n• Thời gian: ${new Date().toLocaleString('vi-VN')}\n✅ <b>Đã restore về lại hệ thống thành công</b>`;

    dispatchNotification(req.verifiedOwnerId || trashDoc.ownerId, 'trash_restore', msg, {
      collection: originalCollection,
      docId: originalId,
      title,
      restoredBy: userName
    });

    res.json({ success: true, restoredCollection: originalCollection, data: originalDoc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /approvals/:collection/:id/decision — Admin approves/rejects creation or deletion request
router.post('/approvals/:collection/:id/decision', requireAuth, (req, res) => {
  const { collection, id } = req.params;
  const { decision } = req.body; // 'approve' | 'reject'

  if (isStaffUser(req)) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền phê duyệt yêu cầu.' });
  }

  try {
    const existing = db.getById(collection, id);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi cần xử lý' });
    }

    const label = getCollectionLabel(collection);
    const title = getItemDisplayName(collection, existing);
    const adminName = req.user?.displayName || req.user?.email || 'Admin';

    if (existing.approvalStatus === 'pending_approval') {
      if (decision === 'approve') {
        const updated = db.update(collection, id, { approvalStatus: 'approved' });
        invalidateCache(collection, req.verifiedOwnerId);

        const msg = `✅ <b>[DUNVEX BUILD] Admin đã phê duyệt tạo mới</b>\n• Loại: <b>${label}</b>\n• Tên/Mã: <b>${title}</b>\n• Người duyệt: <b>${adminName}</b>\n• Trạng thái: <b>Đã kích hoạt trên hệ thống</b>`;
        dispatchNotification(req.verifiedOwnerId || existing.ownerId, 'approval_decision', msg, {
          action: 'approved_creation', collection, id, title, adminName
        });

        return res.json({ success: true, action: 'approved_creation', data: updated });
      } else {
        db.remove(collection, id);
        invalidateCache(collection, req.verifiedOwnerId);

        const msg = `❌ <b>[DUNVEX BUILD] Admin đã từ chối tạo mới</b>\n• Loại: <b>${label}</b>\n• Tên/Mã: <b>${title}</b>\n• Người duyệt: <b>${adminName}</b>\n• Trạng thái: <b>Đã huỷ bản ghi tạo mới</b>`;
        dispatchNotification(req.verifiedOwnerId || existing.ownerId, 'approval_decision', msg, {
          action: 'rejected_creation', collection, id, title, adminName
        });

        return res.json({ success: true, action: 'rejected_creation' });
      }
    } else if (existing.approvalStatus === 'pending_delete') {
      if (decision === 'approve') {
        softDeleteDoc(collection, id, existing, req);
        const customerId = cascadeDebtCleanup(collection, id, existing);
        if (customerId) recalcCustomerDebt(customerId);
        invalidateCache(collection, req.verifiedOwnerId);

        const msg = `🗑️ <b>[DUNVEX BUILD] Admin đã đồng ý xoá</b>\n• Loại: <b>${label}</b>\n• Tên/Mã: <b>${title}</b>\n• Người duyệt: <b>${adminName}</b>\n• Trạng thái: <b>Đã chuyển vào Thùng rác</b>`;
        dispatchNotification(req.verifiedOwnerId || existing.ownerId, 'approval_decision', msg, {
          action: 'approved_deletion', collection, id, title, adminName
        });

        return res.json({ success: true, action: 'approved_deletion', movedToTrash: true });
      } else {
        const updated = db.update(collection, id, {
          approvalStatus: 'approved',
          deleteRequestedBy: null,
          deleteRequestedAt: null
        });
        invalidateCache(collection, req.verifiedOwnerId);

        const msg = `🛡️ <b>[DUNVEX BUILD] Admin từ chối lệnh xoá của Nhân viên</b>\n• Loại: <b>${label}</b>\n• Tên/Mã: <b>${title}</b>\n• Người duyệt: <b>${adminName}</b>\n• Trạng thái: <b>Giữ nguyên dữ liệu an toàn trên hệ thống</b>`;
        dispatchNotification(req.verifiedOwnerId || existing.ownerId, 'approval_decision', msg, {
          action: 'rejected_deletion', collection, id, title, adminName
        });

        return res.json({ success: true, action: 'rejected_deletion', data: updated });
      }
    } else {
      return res.status(400).json({ error: 'Bản ghi không trong trạng thái chờ duyệt' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /:collection — requires auth, validated, write-limited
router.post('/:collection', requireAuth, writeLimiter, (req, res) => {
  const { collection } = req.params;
  const data = req.body;

  // Basic validation
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }
  // Block unsafe collection names
  if (collection.startsWith('_') || collection.includes('..')) {
    return res.status(400).json({ error: 'Invalid collection name' });
  }

  data.ownerId = req.verifiedOwnerId;

  // Staff creation approval flow for products & customers
  if (collection === 'products' || collection === 'customers') {
    if (isStaffUser(req)) {
      data.approvalStatus = 'pending_approval';
      data.requestedBy = {
        uid: req.user?.uid || '',
        email: req.user?.email || '',
        displayName: req.user?.displayName || req.user?.email || ''
      };
      data.requestedAt = new Date().toISOString();
    } else {
      data.approvalStatus = 'approved';
    }
  }

  // Validate GPS check-in if collection is attendance_logs
  if (collection === 'attendance_logs') {
    const ownerId = req.verifiedOwnerId;
    // Skip requests or other types
    if (data.type === 'customer') {
      if (!data.customerId) {
        return res.status(400).json({ error: 'Thiếu thông tin khách hàng/công trình.' });
      }
      if (!data.location || typeof data.location.lat !== 'number' || typeof data.location.lng !== 'number') {
        return res.status(400).json({ error: 'Không tìm thấy tọa độ GPS hiện tại.' });
      }
      const customer = db.getById('customers', data.customerId);
      if (!customer) {
        return res.status(404).json({ error: 'Không tìm thấy thông tin khách hàng/công trình.' });
      }
      if (typeof customer.lat !== 'number' || typeof customer.lng !== 'number') {
        return res.status(400).json({ error: 'Khách hàng/công trình chưa được thiết lập tọa độ GPS.' });
      }
      const distance = calculateHaversine(
        data.location.lat, data.location.lng,
        customer.lat, customer.lng
      );
      const allowedRadius = 100; // 100 meters
      if (distance > allowedRadius) {
        return res.status(400).json({ 
          error: `Chấm công thất bại: Bạn đang cách vị trí khách hàng ${Math.round(distance)}m, vượt quá bán kính cho phép ${allowedRadius}m.` 
        });
      }
      data.checkInDistance = Math.round(distance);
    } else if ((data.type === 'store' || !data.type) && !data.type?.includes('request')) {
      // Office/store check-in (type is undefined/store) and not request
      if (data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
        const settings = db.getById('settings', ownerId);
        if (settings && typeof settings.lat === 'number' && typeof settings.lng === 'number') {
          const distance = calculateHaversine(
            data.location.lat, data.location.lng,
            settings.lat, settings.lng
          );
          const geofenceRadius = settings.geofenceRadius || 500;
          if (distance > geofenceRadius) {
            return res.status(400).json({
              error: `Chấm công thất bại: Bạn đang cách văn phòng ${Math.round(distance)}m, vượt quá bán kính cho phép ${geofenceRadius}m.`
            });
          }
          data.checkInDistance = Math.round(distance);
        }
      }
    }
  }

  try {
    if (collection === 'orders') {
      applyCouponToOrder(data, req.verifiedOwnerId || data.ownerId);
    }
    const doc = db.create(collection, data);
    if (collection === 'permissions') {
      syncPendingPermissionToUser({ ...data, id: doc.id });
    }
    invalidateCache(collection, req.verifiedOwnerId);
    notifyOwnerDevices(req.verifiedOwnerId || data.ownerId, [collection], req.headers['x-device-id'] || '');
    res.json({ success: true, id: doc.id, data: doc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:collection/:id — requires auth
router.put('/:collection/:id', requireAuth, (req, res) => {
  const { collection, id } = req.params;
  const data = req.body;
  
  try {
    const existing = db.getById(collection, id);
    const isAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
    const isDocAdminAccessible = isAdmin && [...ADMIN_COLLECTIONS, ...GLOBAL_COLLECTIONS].includes(collection);
    
    if (existing && !authorizeDocAccess(existing, collection, req.verifiedOwnerId) && !isDocAdminAccessible) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Ensure ownerId cannot be hijacked via PUT (unless super admin bypass for admin collections)
    if (collection !== 'users' && collection !== 'permissions' && !isDocAdminAccessible) {
      data.ownerId = req.verifiedOwnerId;
    }

    // Validate GPS check-out if collection is attendance_logs
    if (collection === 'attendance_logs') {
      if (data.checkOutAt && existing) {
        const checkoutLoc = data.checkOutLocation || data.location;
        if (checkoutLoc && typeof checkoutLoc.lat === 'number' && typeof checkoutLoc.lng === 'number') {
          if (existing.type === 'customer') {
            const customer = db.getById('customers', existing.customerId);
            if (customer && typeof customer.lat === 'number' && typeof customer.lng === 'number') {
              const distance = calculateHaversine(
                checkoutLoc.lat, checkoutLoc.lng,
                customer.lat, customer.lng
              );
              const allowedRadius = 100; // 100 meters
              if (distance > allowedRadius) {
                return res.status(400).json({
                  error: `Chấm công thất bại: Bạn đang cách vị trí khách hàng ${Math.round(distance)}m khi Check-out, vượt quá bán kính cho phép ${allowedRadius}m.`
                });
              }
              data.checkOutDistance = Math.round(distance);
            }
          } else if (existing.type === 'store' || !existing.type) {
            const settings = db.getById('settings', existing.ownerId);
            if (settings && typeof settings.lat === 'number' && typeof settings.lng === 'number') {
              const distance = calculateHaversine(
                checkoutLoc.lat, checkoutLoc.lng,
                settings.lat, settings.lng
              );
              const geofenceRadius = settings.geofenceRadius || 500;
              const checkoutGeofence = geofenceRadius * 1.5; // Allow slightly larger radius for checkout
              if (distance > checkoutGeofence) {
                return res.status(400).json({
                  error: `Chấm công thất bại: Bạn đang cách văn phòng ${Math.round(distance)}m khi Check-out, vượt quá bán kính cho phép ${Math.round(checkoutGeofence)}m.`
                });
              }
              data.checkOutDistance = Math.round(distance);
            }
          }
        }
      }
    }
    
    const doc = db.update(collection, id, data);
    if (collection === 'permissions') {
      syncPendingPermissionToUser({ ...existing, ...data, id });
    }
    invalidateCache(collection, req.verifiedOwnerId);
    notifyOwnerDevices(req.verifiedOwnerId || existing.ownerId, [collection], req.headers['x-device-id'] || '');
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:collection/:id — requires auth (with Soft Delete to Trash & Staff Approval Workflow)
router.delete('/:collection/:id', requireAuth, (req, res) => {
  const { collection, id } = req.params;
  try {
    const existing = db.getById(collection, id);
    if (!existing) {
      return res.json({ success: true, message: 'Doc not found' });
    }
    const isAdmin = req.user?.email === SUPER_ADMIN_EMAIL;
    const isDocAdminAccessible = isAdmin && [...ADMIN_COLLECTIONS, ...GLOBAL_COLLECTIONS].includes(collection);
    
    if (!authorizeDocAccess(existing, collection, req.verifiedOwnerId) && !isDocAdminAccessible) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 1. Hard delete from trash
    if (collection === 'trash') {
      db.remove('trash', id);
      invalidateCache('trash', req.verifiedOwnerId);
      return res.json({ success: true, message: 'Permanently deleted from trash' });
    }

    // 2. Staff delete request approval workflow
    if (isStaffUser(req) && (collection === 'products' || collection === 'customers')) {
      const updatedDoc = db.update(collection, id, {
        approvalStatus: 'pending_delete',
        deleteRequestedBy: {
          uid: req.user?.uid || '',
          email: req.user?.email || '',
          displayName: req.user?.displayName || req.user?.email || ''
        },
        deleteRequestedAt: new Date().toISOString()
      });
      invalidateCache(collection, req.verifiedOwnerId);
      return res.json({ success: true, pendingApproval: true, message: 'Đã gửi yêu cầu xoá cho Admin phê duyệt.', data: updatedDoc });
    }

    // 3. Admin soft delete -> Trash
    softDeleteDoc(collection, id, existing, req);

    const customerId = cascadeDebtCleanup(collection, id, existing);
    if (customerId) recalcCustomerDebt(customerId);

    invalidateCache(collection, req.verifiedOwnerId);
    notifyOwnerDevices(req.verifiedOwnerId || existing.ownerId, [collection], req.headers['x-device-id'] || '');
    res.json({ success: true, movedToTrash: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
