import crypto from 'crypto';

const PROJECT_ID = 'dunvex-89461';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function getAccessToken(): Promise<string> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!json) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT env');
  const sa = JSON.parse(json);
  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email, sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  };
  const b64obj = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sign = (pk: string, data: string) => crypto.createSign('RSA-SHA256').update(data).sign(pk, 'base64url');
  const partial = `${b64obj(header)}.${b64obj(claim)}`;
  const jwt = `${partial}.${sign(sa.private_key, partial)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const td = await res.json();
  if (td.error) throw new Error(`Auth: ${td.error_description || td.error}`);
  return td.access_token;
}

async function runStructuredQuery(token: string, collectionId: string, filters: any[] = [], limitNum?: number, orderByClause?: any) {
  const body: any = {
    structuredQuery: {
      from: [{ collectionId }],
      where: filters.length > 0 ? (filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } }) : undefined
    }
  };
  if (limitNum) body.structuredQuery.limit = limitNum;
  if (orderByClause) body.structuredQuery.orderBy = [orderByClause];
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) return [];
  const results = await res.json();
  if (!Array.isArray(results)) return [];
  return results.filter((r: any) => r.document).map((r: any) => ({ id: r.document.name.split('/').pop(), fields: r.document.fields }));
}

async function restGet(token: string, path: string) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  return res.json();
}

export default async function handler(req: any, res: any) {
  // Chỉ cho phép cron chạy nếu CRON_SECRET đúng (trên Vercel)
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = await getAccessToken();

    // 1. Lấy tất cả API Keys có bật telegram
    const apiKeys = await runStructuredQuery(token, 'api_keys', []);
    
    let processedCount = 0;
    const now = new Date();
    const offset = 7 * 60 * 60 * 1000; // ICT offset
    const localNow = new Date(now.getTime() + offset);
    localNow.setUTCHours(0, 0, 0, 0);
    const startOfDayUTC = new Date(localNow.getTime() - offset);

    for (const keyDoc of apiKeys) {
      const kf = keyDoc.fields || {};
      const ownerId = keyDoc.id;
      const botToken = kf.telegramBotToken?.stringValue;
      // Ưu tiên gửi báo cáo vào nhóm, nếu không có mới gửi cá nhân
      const chatId = kf.telegramGroupChatId?.stringValue || kf.telegramChatId?.stringValue;
      const enabled = kf.enabled?.booleanValue !== false;

      if (!botToken || !chatId || !enabled) continue;

      // Lấy thông tin admin
      const userDoc = await restGet(token, `users/${ownerId}`);
      const adminName = userDoc?.fields?.displayName?.stringValue || 'Admin';

      // 2. Lấy Đơn hàng CHỐT trong ngày hôm nay
      const orders = await runStructuredQuery(token, 'orders', [
        { fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } },
        { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'Đơn chốt' } } }
      ]);

      const todaysOrders = orders.filter((o: any) => {
        const orderDateStr = o.fields?.orderDate?.stringValue || o.fields?.createdAt?.timestampValue;
        if (!orderDateStr) return false;
        const d = new Date(orderDateStr);
        return d >= startOfDayUTC; // Đơn hàng tạo từ 00:00 hôm nay (giờ VN)
      });

      // Thống kê doanh thu theo Nhân viên
      const revenueByStaff: Record<string, number> = {};
      const revenueByCustomer: Record<string, number> = {};
      let totalRevenue = 0;

      todaysOrders.forEach((o: any) => {
        const amount = Number(o.fields?.totalAmount?.integerValue ?? o.fields?.totalAmount?.doubleValue ?? 0);
        const staff = o.fields?.staffName?.stringValue || o.fields?.createdBy?.stringValue || 'Admin';
        const customer = o.fields?.customerName?.stringValue || 'Khách vãng lai';

        revenueByStaff[staff] = (revenueByStaff[staff] || 0) + amount;
        revenueByCustomer[customer] = (revenueByCustomer[customer] || 0) + amount;
        totalRevenue += amount;
      });

      // 3. Lấy Danh sách Công nợ Khách hàng
      const customers = await runStructuredQuery(token, 'customers', [
        { fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } }
      ]);
      const debtorsRaw = customers.filter((c: any) => {
        const debt = Number(c.fields?.debt?.integerValue ?? c.fields?.debt?.doubleValue ?? 0);
        return debt > 0;
      });
      
      const debtors = [];
      for (const c of debtorsRaw) {
        let days = Number(c.fields?.debtDays?.integerValue || 0);
        try {
          const lastOrders = await runStructuredQuery(token, 'orders', [
            { fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } },
            { fieldFilter: { field: { fieldPath: 'customerId' }, op: 'EQUAL', value: { stringValue: c.id } } },
            { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'Đơn chốt' } } }
          ], 1, { field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' });

          const lastPayments = await runStructuredQuery(token, 'payments', [
            { fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } },
            { fieldFilter: { field: { fieldPath: 'customerId' }, op: 'EQUAL', value: { stringValue: c.id } } }
          ], 1, { field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' });

          let lastTxTime = 0;
          if (lastOrders.length > 0 && lastOrders[0].fields?.createdAt?.timestampValue) {
            lastTxTime = Math.max(lastTxTime, new Date(lastOrders[0].fields.createdAt.timestampValue).getTime());
          }
          if (lastPayments.length > 0 && lastPayments[0].fields?.createdAt?.timestampValue) {
            lastTxTime = Math.max(lastTxTime, new Date(lastPayments[0].fields.createdAt.timestampValue).getTime());
          }

          if (lastTxTime > 0) {
            days = Math.floor((Date.now() - lastTxTime) / (1000 * 60 * 60 * 24));
          }
        } catch (e) {
          console.error("Error fetching lastTx for debtor", c.id, e);
        }
        debtors.push({
          name: c.fields?.name?.stringValue || '',
          debt: Number(c.fields?.debt?.integerValue ?? c.fields?.debt?.doubleValue ?? 0),
          days: days
        });
      }
      debtors.sort((a, b) => b.debt - a.debt); // Sắp xếp nợ nhiều nhất lên đầu

      // 3b. Lấy Công nợ Nhà cung cấp (suppliers + supplier_debts)
      const suppliers = await runStructuredQuery(token, 'suppliers', [
        { fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } }
      ]);
      const supplierDebts = await runStructuredQuery(token, 'supplier_debts', [
        { fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } }
      ]);

      // Tính công nợ thực tế cho từng NCC: SUM(debt_increase) - SUM(payment)
      const supplierDebtors: { name: string; debt: number }[] = [];
      for (const s of suppliers) {
        const sDebts = supplierDebts.filter((d: any) => {
          const supplierId = d.fields?.supplierId?.stringValue;
          return supplierId === s.id;
        });
        const netDebt = sDebts.reduce((sum: number, d: any) => {
          const amount = Number(d.fields?.amount?.integerValue ?? d.fields?.amount?.doubleValue ?? 0);
          const type = d.fields?.type?.stringValue;
          if (type === 'debt_increase') return sum + amount;
          if (type === 'payment') return sum - amount;
          return sum;
        }, 0);
        if (netDebt > 0) {
          supplierDebtors.push({
            name: s.fields?.name?.stringValue || '',
            debt: netDebt
          });
        }
      }
      supplierDebtors.sort((a, b) => b.debt - a.debt);

      // 4. Format cứng phần số liệu (không cho Gemini viết lại số)
      const fmtVND = (n: number) => n.toLocaleString('vi-VN') + 'đ';
      
      let dataSection = `\n📊 <b>TỔNG KẾT DOANH THU HÔM NAY</b>\n`;
      dataSection += `💰 Tổng doanh thu: <b>${fmtVND(totalRevenue)}</b>\n`;
      if (Object.keys(revenueByStaff).length > 0) {
        dataSection += `\n👥 <i>Theo nhân viên:</i>\n`;
        for (const [staff, amount] of Object.entries(revenueByStaff)) {
          dataSection += `  - ${staff}: ${fmtVND(amount)}\n`;
        }
      }
      if (Object.keys(revenueByCustomer).length > 0) {
        dataSection += `\n🛒 <i>Theo khách hàng:</i>\n`;
        for (const [cust, amount] of Object.entries(revenueByCustomer)) {
          dataSection += `  - ${cust}: ${fmtVND(amount)}\n`;
        }
      }
      if (totalRevenue === 0) {
        dataSection += `  Hôm nay chưa có đơn hàng nào.\n`;
      }

      dataSection += `\n📋 <b>CÔNG NỢ KHÁCH HÀNG</b>\n`;
      if (debtors.length === 0) {
        dataSection += `  ✅ Tuyệt vời, không có khách nào nợ!\n`;
      } else {
        const top5 = debtors.slice(0, 5);
        top5.forEach((d, i) => {
          dataSection += `  ${i + 1}. ${d.name}: <b>${fmtVND(d.debt)}</b> (${d.days} ngày)\n`;
        });
        if (debtors.length > 5) {
          dataSection += `  <i>... và ${debtors.length - 5} khách nợ khác</i>\n`;
        }
      }

      dataSection += `\n🏭 <b>CÔNG NỢ NHÀ CUNG CẤP (Mình nợ NCC)</b>\n`;
      if (supplierDebtors.length === 0) {
        dataSection += `  ✅ Không có khoản nợ NCC nào!\n`;
      } else {
        supplierDebtors.forEach((s, i) => {
          dataSection += `  ${i + 1}. ${s.name}: <b>${fmtVND(s.debt)}</b>\n`;
        });
      }

      // 5. Gọi Gemini — CHỈ viết lời chào + nhận xét ngắn (KHÔNG cho số liệu)
      const prompt = `Bạn là trợ lý AI (Telegram Bot) của phần mềm Dunvex Build, phục vụ sếp: ${adminName}.
Nhiệm vụ: Viết 1 LỜI CHÀO mở đầu và 1 LỜI KẾT cho báo cáo cuối ngày.

Thông tin tham khảo (KHÔNG viết lại số liệu, phần số liệu sẽ được chèn tự động):
- Doanh thu hôm nay: ${totalRevenue.toLocaleString('vi-VN')} đ
- Số đơn hàng: ${todaysOrders.length}
- Số khách đang nợ: ${debtors.length}

YÊU CẦU:
1. Dùng emoji phù hợp, lời văn kính trọng, thân thiện và động viên tinh thần.
2. BẮT BUỘC dùng HTML TAGS (Ví dụ: <b>chữ đậm</b>, <i>chữ nghiêng</i>).
3. TUYỆT ĐỐI KHÔNG DÙNG MARKDOWN (không dùng dấu * hay ** hay #).
4. TUYỆT ĐỐI KHÔNG liệt kê lại số liệu hay số tiền cụ thể.
5. Trả về ĐÚNG 2 dòng, phân cách bằng |||:
   Dòng 1: Lời chào mở đầu (1-2 câu)
   Dòng 2: Lời kết động viên (1-2 câu)
Ví dụ: 🌙 Chào sếp ${adminName}! Dưới đây là báo cáo cuối ngày ạ!|||💪 Chúc sếp nghỉ ngơi thật tốt, ngày mai tiếp tục chinh phục nhé! 🚀`;

      let greeting = `🌙 Chào sếp ${adminName}! Dưới đây là báo cáo cuối ngày ạ!`;
      let closing = `💪 Chúc sếp nghỉ ngơi thật tốt! 🚀`;

      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          }
        );
        if (!geminiRes.ok) {
          console.error('Gemini API error:', geminiRes.status, await geminiRes.text());
        } else {
          const data = await geminiRes.json();
          if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const aiText = data.candidates[0].content.parts[0].text.trim();
            const parts = aiText.split('|||');
            if (parts.length >= 2) {
              greeting = parts[0].trim();
              closing = parts[1].trim();
            } else {
              // Nếu AI không trả đúng format, dùng toàn bộ làm greeting
              greeting = aiText;
            }
          } else {
            console.error('Gemini: no candidates in response', JSON.stringify(data).substring(0, 500));
          }
        }
      } catch (e) {
        console.error('Gemini error:', e);
      }

      // 6. Ghép báo cáo hoàn chỉnh: Lời chào + Số liệu + Lời kết
      const reportText = `${greeting}\n${dataSection}\n${closing}`;

      // 7. Gửi báo cáo qua Telegram
      const teleRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: reportText,
          parse_mode: 'HTML'
        })
      });

      if (teleRes.ok) {
        processedCount++;
      } else {
        console.error('Telegram send EOD error:', await teleRes.text());
      }
    }

    return res.status(200).json({ success: true, processed: processedCount });
  } catch (error: any) {
    console.error('CRON EOD Error:', error);
    return res.status(500).json({ error: error.message || 'Server Error' });
  }
}
