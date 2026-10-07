/**
 * Bank Webhook Receiver — Nhận dữ liệu từ Casso / SeAPAY / VietQR
 * 
 * POST /api/bank-webhook  — nhận callback từ Casso
 * POST /api/bank-webhook/seapay — nhận callback từ SeAPAY
 * 
 * Format Casso:
 * {
 *   "data": [{
 *     "id": 123,
 *     "tid": "FT...",
 *     "description": "DVX dunvex.green@gmail.com",
 *     "amount": 200000,
 *     "when": "2024-01-01T00:00:00Z"
 *   }]
 * }
 * 
 * Format SeAPAY:
 * {
 *   "gateway": "VietQR",
 *   "transactionDate": "...",
 *   "accountNumber": "...",
 *   "content": "DVX ...",
 *   "transferType": "in",
 *   "transferAmount": 200000,
 *   "referenceCode": "..."
 * }
 */

import * as db from '../db.js';

function extractEmailOrUid(content) {
  if (!content) return null;
  // Format: DVX email@domain.com hoặc DVX UID123
  const match = content.match(/DVX\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[A-Za-z0-9]{20,})/i);
  return match ? match[1] : null;
}

function findAdminByIdentifier(identifier) {
  if (!identifier) return null;
  const allUsers = db.getAll('users') || [];
  const lowerId = identifier.toLowerCase();
  // Tìm theo email trước
  const byEmail = allUsers.find(u => (u.email || '').toLowerCase() === lowerId);
  if (byEmail) return byEmail;
  // Tìm theo uid
  const byUid = allUsers.find(u => (u.uid || u.id || '') === identifier);
  if (byUid) return byUid;
  // Tìm theo displayName bắt đầu bằng
  return allUsers.find(u => (u.displayName || '').toLowerCase().startsWith(lowerId));
}

function findMatchingPackage(amount) {
  const pkgs = db.getAll('subscription_packages') || [];
  const activePkgs = pkgs.filter(p => !p.deleted && Number(p.price) > 0);
  // Sắp xếp theo giá gần nhất
  activePkgs.sort((a, b) => Math.abs(Number(a.price) - amount) - Math.abs(Number(b.price) - amount));
  if (activePkgs.length === 0) return null;
  const best = activePkgs[0];
  const diff = Math.abs(Number(best.price) - amount);
  // Cho phép sai số 5% hoặc 10,000đ
  if (diff <= Math.max(amount * 0.05, 10000)) {
    return best;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Xác định loại webhook từ URL path
    const path = req.path || '';
    const isSeapay = path.includes('seapay');

    let transactions = [];
    let source = 'unknown';

    if (isSeapay) {
      // SeAPAY format: single transaction
      source = 'seapay';
      const { content, transferAmount, referenceCode, transactionDate } = req.body;
      transactions = [{
        id: referenceCode || 'SEA_' + Date.now(),
        amount: Number(transferAmount) || 0,
        content: content || '',
        date: transactionDate || new Date().toISOString(),
        source: 'seapay'
      }];
    } else {
      // Casso format: array of transactions
      source = 'casso';
      const data = req.body?.data || (Array.isArray(req.body) ? req.body : [req.body]);
      transactions = data.map(tx => ({
        id: String(tx.id || tx.tid || 'CS_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
        amount: Number(tx.amount || tx.transferAmount || 0),
        content: tx.description || tx.content || '',
        date: tx.when || tx.transactionDate || new Date().toISOString(),
        source: 'casso'
      }));
    }

    console.log(`[BANK-WEBHOOK] Received ${transactions.length} tx from ${source}`);

    let processedCount = 0;
    let autoActivatedCount = 0;

    for (const tx of transactions) {
      // Lưu giao dịch vào bank_transactions
      const existing = db.get('bank_transactions', tx.id);
      if (existing) {
        console.log(`[BANK-WEBHOOK] Skip duplicate: ${tx.id}`);
        continue;
      }

      db.create('bank_transactions', {
        date: tx.date,
        amount: tx.amount,
        content: tx.content,
        source: tx.source,
        processedAt: new Date().toISOString()
      }, tx.id);
      processedCount++;

      // Thử tự động match: tìm admin từ content
      const identifier = extractEmailOrUid(tx.content);
      if (!identifier) continue;

      const admin = findAdminByIdentifier(identifier);
      if (!admin || admin.role !== 'admin') continue;

      const pkg = findMatchingPackage(tx.amount);
      if (!pkg) continue;

      // Tự động activate admin
      const now = new Date();
      const adminUid = admin.uid || admin.id;
      const adminSettings = db.get('settings', adminUid) || {};
      
      const oldExpiry = adminSettings.subscriptionExpiresAt
        ? new Date(adminSettings.subscriptionExpiresAt)
        : new Date();
      if (isNaN(oldExpiry.getTime())) oldExpiry.setTime(Date.now());
      
      const days = Number(pkg.durationDays) || (Number(pkg.durationMonths) * 30) || 30;
      const newExpiry = new Date(Math.max(now.getTime(), oldExpiry.getTime()) + days * 86400000);

      console.log(`[BANK-WEBHOOK] AUTO-ACTIVATE: ${admin.email || adminUid} → ${pkg.name} (${tx.amount}đ) → expires ${newExpiry.toISOString().slice(0,10)}`);

      const batchOps = [
        {
          type: 'update',
          collection: 'settings',
          id: adminUid,
          data: {
            subscriptionStatus: 'active',
            isPro: true,
            planId: pkg.id,
            paymentConfirmedAt: now.toISOString(),
            subscriptionExpiresAt: newExpiry.toISOString(),
            manualLockOrders: false,
            manualLockDebts: false,
            manualLockSheets: false,
            manualLockAi: false,
            graceUntil: null
          }
        },
        {
          type: 'create',
          collection: 'notifications',
          id: 'BANK_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
          data: {
            userId: adminUid,
            title: '✅ THANH TOÁN TỰ ĐỘNG',
            body: `Hệ thống nhận ${tx.amount.toLocaleString('vi-VN')}đ từ ngân hàng. Gói ${pkg.name} đã được kích hoạt đến ${newExpiry.toLocaleDateString('vi-VN')}.`,
            type: 'success',
            priority: 'high',
            read: false,
            createdAt: now.toISOString()
          }
        }
      ];

      // Cascade unlock staff
      const allUsers = db.getAll('users') || [];
      const staffList = allUsers.filter(u =>
        u.ownerId === adminUid && u.role !== 'admin' && (u.uid || u.id) !== adminUid
      );
      for (const staff of staffList) {
        const suid = staff.uid || staff.id;
        batchOps.push({
          type: 'update',
          collection: 'settings',
          id: suid,
          data: {
            manualLockOrders: false,
            manualLockDebts: false,
            manualLockSheets: false,
            manualLockAi: false,
            subscriptionStatus: 'active',
            subscriptionExpiresAt: null,
            planId: null,
            isPro: null
          }
        });
      }

      db.batchWrite(batchOps);
      autoActivatedCount++;
      console.log(`[BANK-WEBHOOK] ✅ ${admin.email || adminUid} activated + ${staffList.length} staff unlocked`);
    }

    return res.status(200).json({
      success: true,
      source,
      received: transactions.length,
      processed: processedCount,
      autoActivated: autoActivatedCount
    });

  } catch (error) {
    console.error('[BANK-WEBHOOK] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
