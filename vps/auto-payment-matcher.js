/**
 * Dunvex Auto Payment Matcher v3 — NO GAS
 * Đọc Gmail trực tiếp qua IMAP, parse email ngân hàng, match + auto-activate
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const axios = require('axios');
require('dotenv').config();

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const DUNVEX_API = 'http://localhost:5000';
const NEXUS_TOKEN = process.env.NEXUS_WEBHOOK_TOKEN || 'dunvex-nexus-2026';

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 phút

// Cache transaction IDs đã xử lý
const processedTxIds = new Set();
const MAX_CACHE = 500;

/** Parse số tiền từ text (e.g., "+ 419,000 VND", "419.000đ", "419000") */
function parseAmount(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[+\sVNDvndđ,]/gi, '').replace(/\./g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/** Trích xuất nội dung CK từ body email */
function extractContent(body, subject) {
  const text = (subject + '\n' + body).toUpperCase();
  const patterns = [
    /(?:NỘI DUNG|NOI DUNG|ND|NOIDUNG|LÝ DO|LY DO|GHI CHÚ)[:\s]+(.+?)(?:\n|$)/i,
    /(?:CHUYỂN KHOẢN|CHUYEN KHOAN|CK)[:\s]+(.+?)(?:\n|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

/** Trích xuất số tiền từ email ngân hàng */
function extractAmount(body, subject) {
  const text = subject + ' ' + body;
  const patterns = [
    /(\+?\d{1,3}(?:[.,]\d{3})*(?:\s*VND|\s*vnd|\s*đ|\s*VNĐ)?)/gi,
    /(?:số tiền|so tien|amount|PS)[:\s]*(\+?\d[\d.,]*)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const amt = parseAmount(m[1]);
      if (amt && amt > 1000) return amt; // ignore tiny amounts
    }
  }
  return null;
}

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

/** Đọc Gmail qua IMAP, tìm email ngân hàng mới */
function scanGmail() {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: GMAIL_USER,
      password: GMAIL_APP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 30000,
      authTimeout: 30000,
      keepalive: true,
    });

    const transactions = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return reject(err); }

        // Tìm email ngân hàng trong 1 giờ gần đây
        const since = new Date(Date.now() - 60 * 60 * 1000);
        const dateStr = since.toISOString().split('T')[0];
        
        imap.search([['SINCE', dateStr], ['UNSEEN']], (err, results) => {
          if (err || !results || results.length === 0) {
            imap.end();
            return resolve(transactions);
          }

          const fetch = imap.fetch(results.slice(-30), { bodies: '', struct: true });
          let count = 0;

          fetch.on('message', (msg) => {
            let body = '';
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => { body += chunk.toString('utf8'); });
            });

            msg.once('attributes', (attrs) => {
              msg.once('end', async () => {
                count++;
                try {
                  const parsed = await simpleParser(body);
                  const subject = parsed.subject || '';
                  const text = parsed.text || '';
                  
                  // Chỉ xử lý email biến động số dư / giao dịch
                  const isBankEmail = /biến động|giao dịch|GD:|số dư|chuyển khoản|\+ \d|credit/i.test(subject + ' ' + text.substring(0, 500));
                  if (!isBankEmail) return;

                  const content = extractContent(text, subject);
                  const amount = extractAmount(text, subject);
                  if (!content || !amount) return;

                  // Tạo ID duy nhất từ nội dung + số tiền
                  const txId = `${content}_${amount}`.replace(/\s+/g, '_').substring(0, 100);
                  if (processedTxIds.has(txId)) return;

                  transactions.push({
                    id: txId,
                    content,
                    amount,
                    date: parsed.date || new Date(),
                  });

                  console.log(`📧 Bank TX: ${amount.toLocaleString()}đ — "${content.substring(0, 60)}"`);
                } catch (e) {
                  // parse error, skip
                }

                if (count >= results.length) {
                  imap.end();
                  resolve(transactions);
                }
              });
            });
          });

          fetch.once('error', (err) => { imap.end(); reject(err); });
          fetch.once('end', () => {
            if (count === 0) { imap.end(); resolve(transactions); }
          });
        });
      });
    });

    imap.once('error', (err) => { reject(err); });
    imap.connect();
  });
}

async function pollAndMatch() {
  try {
    console.log(`\n🔄 [${new Date().toLocaleString('vi-VN')}] Bắt đầu quét Gmail...`);

    // 1. Lấy pending payment_requests
    const pendingRes = await axios.get(`${DUNVEX_API}/api/payment-requests/pending?token=${NEXUS_TOKEN}`);
    const pending = (pendingRes.data?.requests || [])
      .filter(r => r.transferCode && r.status === 'pending' && r.amount > 0);
    console.log(`📋 ${pending.length} payment_requests pending`);

    if (pending.length === 0) {
      console.log('Không có pending requests');
      return;
    }

    // 2. Quét Gmail
    console.log('📡 Đọc Gmail qua IMAP...');
    const transactions = await scanGmail();
    console.log(`💳 ${transactions.length} giao dịch từ Gmail`);

    // 3. Match
    let matchedCount = 0;
    for (const req of pending) {
      for (const tx of transactions) {
        if (processedTxIds.has(tx.id)) continue;
        if (!codeInContent(req.transferCode, tx.content)) continue;
        if (!amountMatches(req.amount, tx.amount)) {
          console.log(`⚠️ Code "${req.transferCode}" khớp nhưng tiền: Bank=${tx.amount}đ | Expected=${req.amount}đ → BỎ`);
          continue;
        }

        console.log(`✅ MATCH! "${req.transferCode}" | Bank: ${tx.amount}đ | Expected: ${req.amount}đ`);

        try {
          const confirmRes = await axios.post(`${DUNVEX_API}/api/confirm-transfer`, {
            token: NEXUS_TOKEN,
            requestId: req.id,
            ownerId: req.ownerId,
            userEmail: req.userEmail,
            planId: req.planId,
            planName: req.planName,
            amount: req.amount,
            matchedAmount: tx.amount,
            transferCode: req.transferCode,
            durationDays: req.durationDays || null,
            durationMonths: req.durationMonths || null,
            matchConfidence: 'auto_bot_imap'
          }, {
            headers: { 'Authorization': `Bearer ${NEXUS_TOKEN}` }
          });

          if (confirmRes.data?.success) {
            console.log(`🎉 KÍCH HOẠT ${req.planName} cho ${req.userEmail}`);
            processedTxIds.add(tx.id);
            matchedCount++;
          }
        } catch (err) {
          console.error(`❌ Confirm lỗi:`, err.response?.data || err.message);
        }
        break;
      }
    }

    // Cleanup cache
    if (processedTxIds.size > MAX_CACHE) {
      const arr = [...processedTxIds];
      arr.slice(0, 100).forEach(id => processedTxIds.delete(id));
    }

    console.log(`✅ Xong: ${matchedCount} auto-approved`);
  } catch (err) {
    console.error('❌ Lỗi:', err.response?.data || err.message);
  }
}

console.log('🤖 Dunvex Auto Payment Matcher v3 (IMAP, no GAS)');
console.log(`⏱️ Poll: ${POLL_INTERVAL_MS / 1000}s | 📧 Gmail: ${GMAIL_USER}`);

pollAndMatch();
setInterval(pollAndMatch, POLL_INTERVAL_MS);
