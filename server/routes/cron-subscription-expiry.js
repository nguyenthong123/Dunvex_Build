import express from 'express';
import * as db from '../db.js';

const router = express.Router();

const SUPER_ADMIN_EMAILS = ['dunvex.green@gmail.com'];

function parseDateSafe(val) {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (val?.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function runSubscriptionExpiryScan() {
  const now = new Date();
  const allUsers = db.getAll('users') || [];
  const allSettings = db.getAll('settings') || [];
  const allPackages = db.getAll('subscription_packages') || [];

  const settingsMap = {};
  allSettings.forEach(s => {
    settingsMap[s.id] = s;
  });

  const packageMap = {};
  allPackages.forEach(p => {
    packageMap[p.id] = p;
  });

  const owners = allUsers.filter(u => u.uid === u.ownerId || !u.ownerId);
  const staffUsers = allUsers.filter(u => u.uid !== u.ownerId && u.ownerId && u.role !== 'admin');

  const batchOps = [];
  const results = {
    totalOwners: owners.length,
    lockedCount: 0,
    graceCount: 0,
    autoUnlockedCount: 0,
    activeCount: 0,
    details: []
  };

  for (const owner of owners) {
    const email = (owner.email || '').toLowerCase().trim();
    if (SUPER_ADMIN_EMAILS.includes(email)) continue; // Never lock master admin

    const ownerId = owner.uid || owner.id;
    const s = settingsMap[ownerId] || {};

    const createdAt = parseDateSafe(owner.createdAt) || parseDateSafe(s.createdAt) || now;
    const paymentConfirmedAt = parseDateSafe(s.paymentConfirmedAt);
    let expireAt = parseDateSafe(s.subscriptionExpiresAt);

    // If no expireAt is specified, compute effective expiration based on package duration or default 30 days
    if (!expireAt) {
      const planId = s.planId || (s.isPro ? 'premium_monthly' : 'free');
      const pkg = packageMap[planId] || (planId === 'free' ? allPackages.find(p => Number(p.price) === 0) : null);
      expireAt = new Date((paymentConfirmedAt || createdAt).getTime());

      if (pkg) {
        if (pkg.durationMonths) {
          expireAt.setMonth(expireAt.getMonth() + Number(pkg.durationMonths));
        } else if (pkg.durationDays) {
          expireAt.setDate(expireAt.getDate() + Number(pkg.durationDays));
        } else {
          expireAt.setMonth(expireAt.getMonth() + 1);
        }
      } else {
        expireAt.setMonth(expireAt.getMonth() + 1);
      }
    }

    const isExpired = expireAt ? expireAt < now : false;

    // 1. Check AI Pocket Click Anomaly Auto-Unlock (30 mins)
    if (s.manualLockAi && s.aiLockedAt) {
      const lockedAt = parseDateSafe(s.aiLockedAt);
      if (lockedAt && (now.getTime() - lockedAt.getTime()) > 30 * 60 * 1000) {
        batchOps.push({
          type: 'update',
          collection: 'settings',
          id: ownerId,
          data: {
            manualLockOrders: false,
            manualLockDebts: false,
            manualLockSheets: false,
            manualLockAi: false,
            aiLockedAt: null,
            aiLockReason: null
          }
        });
        batchOps.push({
          type: 'create',
          collection: 'notifications',
          id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7),
          data: {
            userId: ownerId,
            title: '🔓 TỰ ĐỘNG MỞ KHOÁ',
            body: 'Hệ thống đã tự mở khoá sau 30 phút bảo vệ.',
            type: 'unlock',
            priority: 'normal',
            read: false,
            createdAt: now.toISOString()
          }
        });
        results.autoUnlockedCount++;
        results.details.push({ ownerId, email, action: 'AUTO_UNLOCK_ANOMALY' });
        continue;
      }
    }

    // 2. Handle Expired Subscriptions
    if (isExpired) {
      const graceEnd = new Date(expireAt.getTime());
      graceEnd.setDate(graceEnd.getDate() + 3); // 3-day grace period

      if (now < graceEnd) {
        // Within Grace Period
        if (s.subscriptionStatus !== 'grace') {
          batchOps.push({
            type: 'update',
            collection: 'settings',
            id: ownerId,
            data: {
              subscriptionStatus: 'grace',
              graceUntil: graceEnd.toISOString()
            }
          });
          batchOps.push({
            type: 'create',
            collection: 'notifications',
            id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7),
            data: {
              userId: ownerId,
              title: '⚠️ GÓI ĐÃ HẾT HẠN — 3 NGÀY ÂN HẠN',
              body: `Gói dịch vụ đã hết hạn. Bạn có 3 ngày (đến ${graceEnd.toLocaleDateString('vi-VN')}) để gia hạn trước khi bị khoá toàn bộ tính năng.`,
              type: 'warning',
              priority: 'high',
              read: false,
              createdAt: now.toISOString()
            }
          });
          results.graceCount++;
          results.details.push({ ownerId, email, action: 'SET_GRACE_PERIOD', graceUntil: graceEnd.toISOString() });
        }
      } else {
        // Past Grace Period -> Full Feature Lock
        const alreadyAllLocked = s.manualLockOrders && s.manualLockDebts && s.manualLockSheets && s.manualLockAi && s.subscriptionStatus === 'expired';
        
        if (!alreadyAllLocked) {
          batchOps.push({
            type: 'update',
            collection: 'settings',
            id: ownerId,
            data: {
              manualLockOrders: true,
              manualLockDebts: true,
              manualLockSheets: true,
              manualLockAi: true,
              subscriptionStatus: 'expired',
              isPro: false,
              graceUntil: null
            }
          });

          batchOps.push({
            type: 'create',
            collection: 'notifications',
            id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7),
            data: {
              userId: ownerId,
              title: '🔒 TÍNH NĂNG ĐÃ BỊ KHOÁ',
              body: 'Gói dịch vụ của bạn đã hết hạn. Vui lòng nạp hoặc gia hạn gói để tiếp tục sử dụng.',
              type: 'lock',
              priority: 'high',
              read: false,
              createdAt: now.toISOString()
            }
          });

          // Cascade Lock for staff
          const staffUnderAdmin = staffUsers.filter(st => (st.ownerId === ownerId || st.ownerId === owner.uid));
          for (const staff of staffUnderAdmin) {
            const staffUid = staff.uid || staff.id;
            batchOps.push({
              type: 'update',
              collection: 'settings',
              id: staffUid,
              data: {
                manualLockOrders: true,
                manualLockDebts: true,
                manualLockSheets: true,
                manualLockAi: true,
                subscriptionStatus: 'expired',
                isPro: false
              }
            });
          }

          results.lockedCount++;
          results.details.push({ 
            ownerId, 
            email, 
            action: 'LOCKED_ALL_FEATURES', 
            staffLocked: staffUnderAdmin.length 
          });
        }
      }
    } else {
      results.activeCount++;
    }
  }

  if (batchOps.length > 0) {
    db.batchWrite(batchOps);
    console.log(`[CRON-EXPIRY] Processed ${batchOps.length} DB operations. Locked: ${results.lockedCount}, Grace: ${results.graceCount}, Unlocked: ${results.autoUnlockedCount}`);
  }

  return results;
}

router.all('/', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const cronSecret = process.env.CRON_SECRET || 'dunvex-cron-secret';
    const nexusToken = process.env.NEXUS_WEBHOOK_TOKEN || 'dunvex-nexus-2026';
    const queryToken = req.query.token || '';

    if (
      authHeader !== `Bearer ${cronSecret}` &&
      authHeader !== `Bearer ${nexusToken}` &&
      queryToken !== cronSecret &&
      queryToken !== nexusToken &&
      req.ip !== '127.0.0.1' &&
      req.ip !== '::1'
    ) {
      // Allow internal/localhost or authorized tokens
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const scanResult = await runSubscriptionExpiryScan();
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ...scanResult
    });
  } catch (err) {
    console.error('[CRON-EXPIRY] Error executing scan:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

export default router;
