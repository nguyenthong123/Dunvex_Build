/**
 * Dunvex Auto Payment Matcher v5 — API-BACKED (no Firestore REST)
 * Dùng /api/bank-transactions/recent thay vì Firestore REST
 */

const axios = require('axios');
require('dotenv').config();

const DUNVEX_API = 'http://localhost:5000';
const NEXUS_TOKEN = process.env.NEXUS_WEBHOOK_TOKEN || 'dunvex-nexus-2026';
const POLL_INTERVAL_MS = 2 * 60 * 1000;

const processedTxIds = new Set();
const MAX_CACHE = 500;

function normalizeCode(code) {
  return (code || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
}

function codeInContent(code, content) {
  if (!code || !content) return false;
  return normalizeCode(content).includes(normalizeCode(code));
}

function amountMatches(expected, actual) {
  if (!expected || !actual) return false;
  if (expected === 0) return true;
  const tolerance = Math.max(expected * 0.05, 10000);
  return Math.abs(expected - actual) <= tolerance;
}

async function getRecentTransactions() {
  const url = `${DUNVEX_API}/api/bank-transactions/recent?token=${encodeURIComponent(NEXUS_TOKEN)}`;
  try {
    const res = await axios.get(url, { timeout: 15000 });
    return res.data?.transactions || [];
  } catch (e) {
    console.error('Bank API error:', e.response?.status, e.response?.data || e.message);
    return [];
  }
}

async function pollAndMatch() {
  try {
    console.log(`\n[${new Date().toLocaleString('vi-VN')}] Quet...`);

    // 1. Pending payment_requests
    const pendingRes = await axios.get(`${DUNVEX_API}/api/payment-requests/pending?token=${encodeURIComponent(NEXUS_TOKEN)}`);
    const pending = (pendingRes.data?.requests || [])
      .filter(r => r.transferCode && r.status === 'pending' && r.amount > 0);
    console.log(`${pending.length} pending`);

    if (pending.length === 0) return;

    // 2. Bank transactions
    console.log('Doc bank_transactions...');
    const transactions = await getRecentTransactions();
    console.log(`${transactions.length} giao dich`);

    // 3. Match
    let matchedCount = 0;
    for (const req of pending) {
      for (const tx of transactions) {
        if (processedTxIds.has(tx.id)) continue;
        if (!codeInContent(req.transferCode, tx.content)) continue;
        if (!amountMatches(req.amount, tx.amount)) {
          console.log(`Code "${req.transferCode}" khop nhung tien: Bank=${tx.amount} | Expected=${req.amount} -> BO`);
          continue;
        }

        console.log(`MATCH! "${req.transferCode}" | ${tx.amount}d`);

        try {
          const confirmRes = await axios.post(`${DUNVEX_API}/api/confirm-transfer`, {
            token: NEXUS_TOKEN,
            requestId: req.id, ownerId: req.ownerId, userEmail: req.userEmail,
            planId: req.planId, planName: req.planName, amount: req.amount,
            matchedAmount: tx.amount, transferCode: req.transferCode,
            durationDays: req.durationDays || null,
            durationMonths: req.durationMonths || null,
            matchConfidence: 'auto_bot_v5'
          }, { headers: { 'Authorization': `Bearer ${NEXUS_TOKEN}` } });

          if (confirmRes.data?.success) {
            console.log(`KICH HOAT ${req.planName} cho ${req.userEmail}`);
            processedTxIds.add(tx.id);
            matchedCount++;
          }
        } catch (err) {
          console.error('Confirm error:', err.response?.data || err.message);
        }
        break;
      }
    }

    if (processedTxIds.size > MAX_CACHE) {
      const arr = [...processedTxIds];
      arr.slice(0, 50).forEach(id => processedTxIds.delete(id));
    }

    console.log(`Done: ${matchedCount} approved`);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

console.log('Dunvex Payment Matcher v5 (API, no Firestore REST)');
console.log('Poll: ' + (POLL_INTERVAL_MS / 1000) + 's | Source: /api/bank-transactions/recent');

pollAndMatch();
setInterval(pollAndMatch, POLL_INTERVAL_MS);
