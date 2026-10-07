import express from 'express';

import telegramWebhook from './telegram-webhook.js';
import telegramNotify from './telegram-notify.js';
import setupTelegram from './setup-telegram.js';
import cronEod from './cron-eod.js';
import confirmTransfer from './confirm-transfer.js';
import orderWebhook from './order-webhook.js';
import products from './products.js';
import customers from './customers.js';
import cronDebtSync from './cron-debt-sync.js';
import uploadRouter from './upload.js';
import exportData from './export-data.js';
import importData from './import-data.js';
import bankTransactions from './bank-transactions.js';
import bankWebhook from './bank-webhook.js';
import dataApi from './data-api.js';
import syncRouter from './sync.js';
import createUser from './create-user.js';
import authRouter from './auth.js';
import { downloadDb, uploadDb } from './db-backup.js';
import backupGdrive from './backup-gdrive.js';

import cronTrash from './cron-trash.js';
import cronSubscriptionExpiry from './cron-subscription-expiry.js';
import otaUpdate from './ota-update.js';
import releases, { getReleaseManifest } from './releases.js';
import licenseRouter from './license.js';

const router = express.Router();

router.use('/license', licenseRouter);
router.use('/ota-update', otaUpdate);
router.use('/releases', releases);
router.all('/backup-gdrive', backupGdrive);
router.get('/db/download', downloadDb);
router.post('/db/upload', uploadDb);
router.use('/auth', authRouter);
router.use('/sync', syncRouter);
router.use('/create-user', createUser);
router.use('/telegram-webhook', telegramWebhook);
router.use('/telegram-notify', telegramNotify);
router.use('/setup-telegram', setupTelegram);
router.use('/cron-eod', cronEod);
router.use('/cron-subscription-expiry', cronSubscriptionExpiry);
router.use('/confirm-transfer', confirmTransfer);
router.use('/order-webhook', orderWebhook);
router.use('/products', products);
router.use('/customers', customers);
router.use('/cron-debt-sync', cronDebtSync);
router.use('/cron-trash', cronTrash);
router.use('/upload', uploadRouter);
router.use('/export-data', exportData);
router.use('/import-data', importData);
router.use('/bank-transactions', bankTransactions);
router.use('/data', dataApi);

// Legacy Android updater endpoint; its metadata is now isolated from desktop releases.
router.get('/app-version', (req, res) => {
  try {
    const manifest = getReleaseManifest('android');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      ...manifest,
      updateUrl: 'https://dunvex.com',
      apkUrl: manifest.apkUrl || 'https://dunvex.com/dunvex_app.apk',
      changelog: manifest.changelog || [manifest.releaseNotes].filter(Boolean),
    });
  } catch (error) {
    console.error('[App Version] Failed to load Android release metadata:', error);
    res.status(500).json({ error: 'Unable to load Android release metadata' });
  }
});


// GET /payment-requests/pending — for auto payment matcher
import * as db from "../db.js";
router.get("/payment-requests/pending", (req, res) => {
  try {
    const token = req.query.token || "";
    const NEXUS_TOKEN = process.env.NEXUS_WEBHOOK_TOKEN || "dunvex-nexus-2026";
    if (token !== NEXUS_TOKEN) return res.status(403).json({ error: "Unauthorized" });
    const requests = (db.getAll("payment_requests") || []).filter(r => r.status === "pending");
    res.json({ success: true, requests });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /ecosystem-users — for external ecosystem app integration
router.get("/ecosystem-users", (req, res) => {
  try {
    const token = req.query.token || req.headers["x-ecosystem-token"] || "";
    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const systemConfig = db.get("system_config", "main");
    if (!systemConfig || !systemConfig.ecosystem_api_enabled) {
      return res.status(403).json({ error: "Ecosystem API is disabled" });
    }

    if (systemConfig.ecosystem_api_token !== token) {
      return res.status(403).json({ error: "Invalid token" });
    }

    const users = db.getAll("users") || [];
    const settingsList = db.getAll("settings") || [];
    const settingsMap = {};
    settingsList.forEach(s => {
      settingsMap[s.id] = s;
    });

    // Merge users & settings to get tenant statuses
    const owners = users.filter(u => u.uid === u.ownerId || !u.ownerId);
    const data = owners.map(u => {
      const s = settingsMap[u.uid] || {};
      return {
        uid: u.uid,
        displayName: u.displayName || "",
        email: u.email || "",
        createdAt: u.createdAt || "",
        planId: s.planId || u.planId || "",
        isPro: s.isPro ?? u.isPro ?? false,
        subscriptionExpiresAt: s.subscriptionExpiresAt || null,
        subscriptionStatus: s.subscriptionStatus || null,
        manualLockOrders: !!s.manualLockOrders,
        manualLockDebts: !!s.manualLockDebts,
        manualLockSheets: !!s.manualLockSheets,
        manualLockAi: !!s.manualLockAi,
      };
    });

    res.json({ 
      success: true, 
      systemConfig: {
        lock_free_orders: !!systemConfig.lock_free_orders,
        lock_free_debts: !!systemConfig.lock_free_debts,
        lock_free_sheets: !!systemConfig.lock_free_sheets,
        ai_auto_lock: !!systemConfig.ai_auto_lock,
        maintenance_mode: !!systemConfig.maintenance_mode
      },
      count: data.length, 
      users: data 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
