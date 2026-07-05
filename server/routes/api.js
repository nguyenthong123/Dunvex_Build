import express from 'express';

import geminiProxy from './gemini-proxy.js';
import geminiVision from './gemini-vision.js';
import telegramWebhook from './telegram-webhook.js';
import telegramNotify from './telegram-notify.js';
import setupTelegram from './setup-telegram.js';
import cronEod from './cron-eod.js';
import confirmTransfer from './confirm-transfer.js';
import orderWebhook from './order-webhook.js';
import products from './products.js';

const router = express.Router();

// Map all 9 Vercel serverless functions to Express routes
router.all('/gemini-proxy', geminiProxy);
router.all('/gemini-vision', geminiVision);
router.all('/telegram-webhook', telegramWebhook);
router.all('/telegram-notify', telegramNotify);
router.all('/setup-telegram', setupTelegram);
router.all('/cron-eod', cronEod);
router.all('/confirm-transfer', confirmTransfer);
router.all('/order-webhook', orderWebhook);
router.all('/products', products);

export default router;
