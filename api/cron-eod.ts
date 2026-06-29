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

async function runStructuredQuery(token: string, collectionId: string, filters: any[] = []) {
  const body: any = {
    structuredQuery: {
      from: [{ collectionId }],
      where: filters.length > 0 ? { compositeFilter: { op: 'AND', filters } } : undefined
    }
  };
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) return [];
  const results = await res.json();
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
      const chatId = kf.telegramChatId?.stringValue;
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
        const amount = Number(o.fields?.totalAmount?.integerValue || o.fields?.totalAmount?.doubleValue || 0);
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
      const debtors = customers.filter((c: any) => {
        const debt = Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0);
        return debt > 0;
      }).map((c: any) => ({
        name: c.fields?.name?.stringValue || '',
        debt: Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0),
        days: Number(c.fields?.debtDays?.integerValue || 0)
      })).sort((a, b) => b.debt - a.debt); // Sắp xếp nợ nhiều nhất lên đầu

      // 4. Tạo prompt cho Gemini
      const prompt = `Bạn là trợ lý AI (Telegram Bot) của phần mềm Dunvex Build, phục vụ sếp: ${adminName}.
Nhiệm vụ: Dựa vào số liệu dưới đây, hãy viết 1 tin nhắn BÁO CÁO CUỐI NGÀY gửi cho sếp.
YÊU CẦU:
1. Dùng emoji phù hợp, lời văn kính trọng, thân thiện và động viên tinh thần.
2. Format tiền tệ VNĐ (ví dụ: 10.000.000đ).
3. BẮT BUỘC SỬ DỤNG HTML TAGS để làm nổi bật (Ví dụ: <b>chữ đậm</b>, <i>chữ nghiêng</i>).
4. TUYỆT ĐỐI KHÔNG DÙNG MARKDOWN (không dùng dấu * hay ** hay #). Các mục danh sách hãy dùng gạch đầu dòng (-) hoặc emoji (👉, 📦).
5. Nội dung báo cáo cần ngắn gọn, chia làm 2 phần chính: TỔNG KẾT DOANH THU HÔM NAY và DANH SÁCH NHẮC NỢ (chỉ liệt kê 5 khách nợ nhiều nhất nếu danh sách quá dài).

=== DỮ LIỆU ===
DOANH THU HÔM NAY: ${totalRevenue.toLocaleString('vi-VN')} đ
- Theo nhân viên:
${Object.entries(revenueByStaff).map(([k, v]) => `  + ${k}: ${v.toLocaleString('vi-VN')} đ`).join('\n') || 'Không có đơn nào'}
- Theo khách hàng:
${Object.entries(revenueByCustomer).map(([k, v]) => `  + ${k}: ${v.toLocaleString('vi-VN')} đ`).join('\n') || 'Không có đơn nào'}

DANH SÁCH CÔNG NỢ HIỆN TẠI (Tất cả):
${debtors.length > 0 ? debtors.map(d => `- ${d.name}: ${d.debt.toLocaleString('vi-VN')} đ (Số ngày nợ: ${d.days})`).join('\n') : 'Tuyệt vời, không có khách nào nợ!'}
================
Hãy viết báo cáo gửi sếp đi:`;

      // 5. Gọi Gemini
      let reportText = "Báo cáo cuối ngày không khả dụng do lỗi tạo văn bản.";
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          }
        );
        const data = await geminiRes.json();
        if (data.candidates && data.candidates[0].content.parts[0].text) {
          reportText = data.candidates[0].content.parts[0].text;
        }
      } catch (e) {
        console.error('Gemini error:', e);
      }

      // 6. Gửi báo cáo qua Telegram
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
