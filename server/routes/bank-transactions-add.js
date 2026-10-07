import dotenv from 'dotenv';
import * as db from '../db.js';
dotenv.config();

export default async function handler(req, res) {
  const apiToken = process.env.NEXUS_WEBHOOK_TOKEN || 'dunvex-nexus-2026';
  if (req.body?.token !== apiToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { date, amount, content, transactionId, subject } = req.body;
    if (!date || !amount || !content) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const docId = date.replace(/\//g, "-") + "_" + (transactionId || Date.now());
    
    db.create('bank_transactions', {
      date,
      amount: Number(amount),
      content,
      transactionId: transactionId || '',
      subject: subject || '',
      processedAt: new Date().toISOString()
    }, docId);

    console.log('[bank-transactions-add] Added tx:', docId);
    res.json({ success: true, docId });
  } catch (e) {
    console.error('bank-transactions-add error:', e);
    res.status(500).json({ error: e.message });
  }
}
