/**
 * Dunvex Auto Payment Matcher Bot v2
 * 
 * Chạy trên VPS, poll mỗi 2 phút:
 * 1. Lấy giao dịch mới từ GAS (Google Sheet)
 * 2. Lấy pending payment_requests qua API nội bộ
 * 3. Match cả transferCode + số tiền (±5%)
 * 4. Gọi confirm-transfer API để tự động kích hoạt
 */

const axios = require('axios');
require('dotenv').config();

const GAS_URL = process.env.GAS_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycby654qMZsV0IkzHs6XCVprXsn9rEgHpc4Cb9kyNDXJUFumqqYZvpOu8NGUlmSZHLpB0og/exec';
const DUNVEX_API = 'http://localhost:5000';
const NEXUS_TOKEN = process.env.NEXUS_WEBHOOK_TOKEN || 'dunvex-nexus-2026';

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 phút
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ

const processedTxIds = new Set();
let lastCleanup = Date.now();

/** Parse số tiền từ "Phát sinh" (e.g., "+ 419,000 VND" hoặc "419000") */
function parseAmount(psText) {
  if (!psText) return null;
  const cleaned = String(psText).replace(/[+\sVNDvndđ,]/gi, '').replace(/\./g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/** Normalize code để so sánh */
function normalizeCode(code) {
  return (code || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
}

function codeInContent(code, content) {
  if (!code || !content) return false;
  const nCode = normalizeCode(code);
  const nContent = normalizeCode(content);
  return nContent.includes(nCode) || nCode.includes(nContent);
}

function amountMatches(expected, actual) {
  if (!expected || !actual) return false;
  // Bỏ qua check amount nếu expected = 0 (gói free)
  if (expected === 0) return true;
  const tolerance = Math.max(expected * 0.05, 10000);
  return Math.abs(expected - actual) <= tolerance;
}

async function pollAndMatch() {
  try {
    console.log(`\n🔄 [${new Date().toLocaleString('vi-VN')}] Bắt đầu quét...`);
    
    // 1. Lấy pending payment_requests từ Dunvex API
    const pendingRes = await axios.get(`${DUNVEX_API}/api/payment-requests/pending?token=${NEXUS_TOKEN}`);
    const pending = pendingRes.data?.requests || [];
    const filteredPending = pending.filter(r => r.transferCode && r.status === 'pending' && r.amount > 0);
    console.log(`📋 ${filteredPending.length}/${pending.length} payment_requests cần match`);
    
    if (filteredPending.length === 0) {
      console.log('Không có pending requests nào cần match');
      return;
    }
    
    // 2. Lấy giao dịch mới từ GAS
    console.log('📡 Gọi GAS lấy giao dịch...');
    await axios.get(`${GAS_URL}?action=check_now_silent&t=${Date.now()}`).catch(() => {});
    const gasRes = await axios.get(`${GAS_URL}?type=income&t=${Date.now()}`);
    const transactions = gasRes.data?.data || [];
    console.log(`💳 ${transactions.length} giao dịch từ GAS`);
    
    // 3. Match
    let matchedCount = 0;
    for (const req of filteredPending) {
      for (const tx of transactions) {
        const txId = tx['Transaction ID'];
        if (!txId || processedTxIds.has(txId)) continue;
        
        if (!codeInContent(req.transferCode, tx['Nội dung'])) continue;
        
        const bankAmount = parseAmount(tx['Phát sinh']);
        if (!amountMatches(req.amount, bankAmount)) {
          console.log(`⚠️ Code "${req.transferCode}" khớp nhưng tiền: Bank=${bankAmount}đ | Expected=${req.amount}đ → BỎ QUA`);
          continue;
        }
        
        // 🎯 MATCH!
        console.log(`✅ MATCH! "${req.transferCode}" | Bank: ${bankAmount}đ | Expected: ${req.amount}đ | ${tx['Ngày']}`);
        
        try {
          const confirmRes = await axios.post(`${DUNVEX_API}/api/confirm-transfer`, {
            token: NEXUS_TOKEN,
            requestId: req.id,
            ownerId: req.ownerId,
            userEmail: req.userEmail,
            planId: req.planId,
            planName: req.planName,
            amount: req.amount,
            matchedAmount: bankAmount,
            transferCode: req.transferCode,
            matchConfidence: 'auto_bot_vps'
          }, {
            headers: { 'Authorization': `Bearer ${NEXUS_TOKEN}` }
          });
          
          if (confirmRes.data?.success) {
            console.log(`🎉 KÍCH HOẠT ${req.planName} cho ${req.userEmail}`);
            processedTxIds.add(txId);
            matchedCount++;
          } else {
            console.error(`❌ Confirm thất bại:`, confirmRes.data);
          }
        } catch (err) {
          console.error(`❌ Lỗi confirm:`, err.response?.data || err.message);
        }
        
        break;
      }
    }
    
    if (Date.now() - lastCleanup > CACHE_TTL_MS) {
      processedTxIds.clear();
      lastCleanup = Date.now();
    }
    
    console.log(`✅ Hoàn tất: ${matchedCount} giao dịch được auto-approve`);
  } catch (err) {
    console.error('❌ Lỗi:', err.response?.data || err.message);
  }
}

// 🚀 Start
console.log('🤖 Dunvex Auto Payment Matcher v2');
console.log(`⏱️ Poll: ${POLL_INTERVAL_MS / 1000}s | 🔗 API: ${DUNVEX_API}`);
pollAndMatch();
setInterval(pollAndMatch, POLL_INTERVAL_MS);
