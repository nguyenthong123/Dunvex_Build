import express from 'express';
import crypto from 'crypto';
import * as db from '../db.js';

const router = express.Router();

const SUPER_ADMIN_EMAILS = ['dunvex.green@gmail.com'];
const LICENSE_SECRET = process.env.CRON_SECRET || 'dunvex_master_license_key_sec_2026';

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

export function signLicensePayload(payload) {
  const raw = `${payload.ownerId}:${payload.planId}:${payload.subscriptionStatus}:${payload.expiresAt}:${payload.features.lockOrders}:${payload.features.lockDebts}:${payload.features.lockSheets}:${payload.features.lockAi}`;
  return crypto.createHmac('sha256', LICENSE_SECRET).update(raw).digest('hex');
}

export function generateLicenseCertificate(ownerId, userEmail = '') {
  const now = new Date();
  const settings = db.get('settings', ownerId) || {};
  const user = db.get('users', ownerId) || {};
  const allPackages = db.getAll('subscription_packages') || [];
  const systemConfigs = db.getAll('system_config') || [];
  const sysConfig = systemConfigs[0] || {};

  const email = (userEmail || user.email || settings.email || '').toLowerCase().trim();
  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email);

  const createdAt = parseDateSafe(user.createdAt) || parseDateSafe(settings.createdAt) || now;
  const paymentConfirmedAt = parseDateSafe(settings.paymentConfirmedAt);
  let expireAt = parseDateSafe(settings.subscriptionExpiresAt);

  // Compute effective expiration if not set
  const planId = settings.planId || (settings.isPro ? 'premium_monthly' : 'free');
  const pkg = allPackages.find(p => p.id === planId) || (planId === 'free' ? allPackages.find(p => Number(p.price) === 0) : null);
  const planName = pkg?.name || (settings.isPro ? 'Gói Tiêu Chuẩn' : (planId === 'free' ? 'Gói Miễn Phí' : 'Gói Dùng Thử'));

  if (!expireAt) {
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

  // Super admin never expires
  if (isSuperAdmin) {
    expireAt = new Date(now.getTime() + 10 * 365 * 86400000); // 10 years
  }

  const isExpired = isSuperAdmin ? false : (expireAt ? expireAt < now : false);
  const isTrial = settings.subscriptionStatus === 'trial' || (!settings.isPro && !isExpired);

  let subscriptionStatus = isExpired ? 'expired' : (settings.subscriptionStatus || (settings.isPro ? 'active' : 'trial'));
  if (isSuperAdmin) subscriptionStatus = 'active';

  const lockOrders = isSuperAdmin ? false : Boolean(settings.manualLockOrders || isExpired);
  const lockDebts = isSuperAdmin ? false : Boolean(settings.manualLockDebts || isExpired);
  const lockSheets = isSuperAdmin ? false : Boolean(settings.manualLockSheets || isExpired);
  const lockAi = isSuperAdmin ? false : Boolean(settings.manualLockAi || isExpired);

  const certificate = {
    licenseId: `lic_${ownerId}_${Date.now()}`,
    ownerId,
    userEmail: email,
    planId,
    planName,
    subscriptionStatus,
    isSuperAdmin,
    issuedAt: now.getTime(),
    expiresAt: expireAt ? expireAt.getTime() : (now.getTime() + 30 * 86400000),
    maxOfflineDays: isSuperAdmin ? 365 : 30,
    features: {
      lockOrders,
      lockDebts,
      lockSheets,
      lockAi,
    },
    systemConfig: {
      lock_free_orders: Boolean(sysConfig.lock_free_orders),
      lock_free_debts: Boolean(sysConfig.lock_free_debts),
      lock_free_sheets: Boolean(sysConfig.lock_free_sheets),
    },
    signature: '',
  };

  certificate.signature = signLicensePayload(certificate);
  return certificate;
}

/**
 * GET /api/license/certificate
 * Issues or refreshes the tamper-resistant license certificate for the authenticated user/owner
 */
router.get('/certificate', (req, res) => {
  try {
    const ownerId = req.headers['x-owner-id'] || req.query.ownerId || (req.user && req.user.ownerId) || (req.user && req.user.uid);
    if (!ownerId) {
      return res.status(400).json({ success: false, error: 'Missing ownerId header or parameter' });
    }

    const email = req.user?.email || req.query.email || '';
    const certificate = generateLicenseCertificate(ownerId, email);

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      success: true,
      certificate,
    });
  } catch (err) {
    console.error('[License API] Error issuing certificate:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

/**
 * POST /api/license/verify
 * Validates a certificate submitted by an app
 */
router.post('/verify', (req, res) => {
  try {
    const { certificate } = req.body || {};
    if (!certificate || !certificate.ownerId || !certificate.signature) {
      return res.status(400).json({ success: false, valid: false, error: 'Invalid certificate payload' });
    }

    const expectedSignature = signLicensePayload(certificate);
    const valid = certificate.signature === expectedSignature;

    res.json({
      success: true,
      valid,
      isExpired: certificate.expiresAt < Date.now(),
    });
  } catch (err) {
    console.error('[License API] Error verifying certificate:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

export default router;
