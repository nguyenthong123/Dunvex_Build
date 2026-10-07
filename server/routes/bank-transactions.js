import * as db from '../db.js';
import dotenv from 'dotenv';
dotenv.config();

export default async function handler(req, res) {
  const apiToken = process.env.NEXUS_WEBHOOK_TOKEN || 'dunvex-nexus-2026';
  const token = req.body?.token || req.query?.token;
  
  if (token !== apiToken && req.headers['x-api-key'] !== apiToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const action = req.path.replace(/^\//, '');

    if (req.method === 'POST' && (action === 'add' || req.body.action === 'add')) {
      const { date, amount, content, transactionId, subject } = req.body;
      
      const newTx = {
        date: date || new Date().toISOString(),
        amount: Number(amount) || 0,
        content: content || '',
        subject: subject || '',
        processedAt: new Date().toISOString(),
      };

      const docId = transactionId || Date.now().toString();
      db.create('bank_transactions', newTx, docId);
      return res.json({ success: true, message: "Transaction added", transactionId: docId });
    }

    if (req.method === 'GET') {
      const days = parseInt(req.query.days) || 30;
      const sinceTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      let allTxs = [];

      // Check if custom bank API URL is configured & enabled
      const config = db.get('system_config', 'bank_api');
      if (config && config.isEnabled && config.apiUrl) {
        try {
          console.log(`Fetching bank transactions from custom API URL: ${config.apiUrl}`);
          const fetchRes = await fetch(config.apiUrl);
          if (fetchRes.ok) {
            const rawData = await fetchRes.json();
            let list = [];
            if (Array.isArray(rawData)) {
              list = rawData;
            } else if (rawData && Array.isArray(rawData.transactions)) {
              list = rawData.transactions;
            } else if (rawData && Array.isArray(rawData.data)) {
              list = rawData.data;
            } else if (rawData && Array.isArray(rawData.history)) {
              list = rawData.history;
            }

            allTxs = list.map(item => {
              const amount = Number(
                item.amount || item.money || item.value || 
                item.sotien || item.so_tien || item.amount_in || 0
              );
              const content = String(
                item.content || item.description || item.memo || 
                item.noidung || item.noi_dung || item.message || 
                item.subject || ''
              );
              const date = String(
                item.date || item.time || item.created_at || 
                item.ngay || item.timestamp || new Date().toISOString()
              );
              const id = String(
                item.id || item.transactionId || item.transaction_id || 
                item.ref || item.ma_gd || Date.now().toString() + Math.random()
              );
              return { id, amount, content, date, processedAt: date };
            });
          } else {
            console.error(`Custom API returned non-OK status: ${fetchRes.status}`);
          }
        } catch (fetchErr) {
          console.error(`Error fetching custom API URL:`, fetchErr.message);
        }
      }

      // Fallback to local SQLite if custom fetch failed or returned empty list, or if not enabled
      if (allTxs.length === 0) {
        allTxs = db.getAll('bank_transactions') || [];
      }

      allTxs.sort((a, b) => new Date(b.processedAt || b.date) - new Date(a.processedAt || a.date));
      allTxs = allTxs.slice(0, 500);

      const data = [];
      allTxs.forEach(d => {
        if (new Date(d.processedAt || d.date) >= sinceTime) {
          data.push({
            "Ngày": d.date,
            "Phát sinh": `+${(d.amount || 0).toLocaleString('vi-VN')} đ`,
            "Nội dung": d.content || d.subject || '',
            "transactionId": d.id
          });
        }
      });

      const transactions = allTxs
        .filter(d => new Date(d.processedAt || d.date) >= sinceTime)
        .map(d => ({
          id: d.id,
          amount: Number(d.amount) || 0,
          content: d.content || d.subject || '',
          date: d.date
        }));

      return res.json({ 
        success: true, 
        count: data.length, 
        data,
        transactions
      });
    }

    return res.status(404).json({ error: "Not found or invalid method" });

  } catch (e) {
    console.error('bank-transactions error:', e);
    res.status(500).json({ error: e.message });
  }
}
