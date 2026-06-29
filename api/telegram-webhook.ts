import crypto from 'crypto';

/**
 * Vercel Serverless: POST /api/telegram-webhook
 * Webhook nhận sự kiện trực tiếp từ Telegram.
 *
 * Query params:
 * ?ownerId=[OWNER_ID]
 *
 * POST body:
 * Theo chuẩn Telegram Update Object
 */

const PROJECT_ID = 'dunvex-89461';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

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
  const sign = (pk: string, data: string) => {
    return crypto.createSign('RSA-SHA256').update(data).sign(pk, 'base64url');
  };
  const partial = `${b64obj(header)}.${b64obj(claim)}`;
  const jwt = `${partial}.${sign(sa.private_key, partial)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const td = await tokenRes.json();
  if (td.error) throw new Error(`Auth: ${td.error_description || td.error}`);
  return td.access_token;
}

async function restGet(token: string, path: string) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${path}: ${res.status}`);
  return res.json();
}

async function runStructuredQuery(token: string, collectionId: string, fieldFilters: any[], limit?: number, orderBy?: any): Promise<any[]> {
  const url = `${FIRESTORE_BASE}:runQuery`;
  const filter = fieldFilters.length === 1
    ? fieldFilters[0]
    : {
        compositeFilter: {
          op: 'AND',
          filters: fieldFilters
        }
      };

  const body: any = {
    structuredQuery: {
      from: [{ collectionId }],
      where: filter
    }
  };
  
  if (limit) body.structuredQuery.limit = limit;
  if (orderBy) body.structuredQuery.orderBy = [orderBy];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Firestore query failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter((item: any) => item.document)
    .map((item: any) => item.document);
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not configured on server');
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const ownerId = req.query.ownerId;
    if (!ownerId) {
      console.error('Missing ownerId in query');
      return res.status(400).json({ error: 'Missing ownerId' });
    }

    const body = req.body;
    // Telegram webhook sends { update_id, message: { message_id, from, chat, date, text } }
    if (!body || !body.message || !body.message.text || !body.message.chat) {
      // Ignore non-message updates (like edited_message, channel_post) to avoid errors
      return res.status(200).json({ status: 'ignored' });
    }

    const userMessage = body.message.text || body.message.caption || '';
    const chatId = body.message.chat.id;
    const chatType = body.message.chat.type; // 'private', 'group', 'supergroup', etc.

    // Nếu là group, chỉ phản hồi khi được tag (@dunvexbot), dùng lệnh (/...), reply tin nhắn của bot, hoặc có chữ "bot"
    if (chatType === 'group' || chatType === 'supergroup') {
      const hasMentionOrCommand = body.message.entities?.some((e: any) => e.type === 'mention' || e.type === 'bot_command');
      const isReply = !!body.message.reply_to_message;
      const containsBotKeyword = userMessage.toLowerCase().includes('bot') || userMessage.includes('@');
      
      if (!hasMentionOrCommand && !isReply && !containsBotKeyword) {
        // Bỏ qua tin nhắn trò chuyện bình thường của các thành viên trong nhóm
        return res.status(200).json({ status: 'ignored_group_chatter' });
      }
    }

    const token = await getAccessToken();

    // Lấy API Key doc để tìm telegramBotToken
    const keyDoc = await restGet(token, `api_keys/${ownerId}`);
    if (!keyDoc) {
      console.error('API key doc not found for owner:', ownerId);
      return res.status(403).json({ error: 'Owner not found' });
    }
    const kf = keyDoc.fields || {};
    const botToken = kf.telegramBotToken?.stringValue;
    if (!botToken || kf.enabled?.booleanValue !== true) {
      console.error('Invalid or disabled bot token for owner:', ownerId);
      return res.status(403).json({ error: 'Invalid or disabled bot token' });
    }

    // Save telegramChatId to Firestore if it's missing or different (for active notifications later)
    if (!kf.telegramChatId?.stringValue || kf.telegramChatId.stringValue !== String(chatId)) {
      await fetch(`${FIRESTORE_BASE}/api_keys/${ownerId}?updateMask.fieldPaths=telegramChatId`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            telegramChatId: { stringValue: String(chatId) }
          }
        })
      });
    }

    // Lấy thông tin user (admin)
    const userDoc = await restGet(token, `users/${ownerId}`);
    const adminName = userDoc?.fields?.displayName?.stringValue || userDoc?.fields?.email?.stringValue || 'Admin';

    // 1. Fetch data for context (Customers with debt)
    const customers = await runStructuredQuery(token, 'customers', [
      {
        fieldFilter: {
          field: { fieldPath: 'ownerId' },
          op: 'EQUAL',
          value: { stringValue: ownerId }
        }
      }
    ]);
    const customersWithDebt = customers.filter((c: any) => {
      const debt = Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0);
      return debt > 0;
    }).map((c: any) => {
      return {
        name: c.fields?.name?.stringValue || '',
        debt: Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0),
        days: c.fields?.debtDays?.integerValue || 0
      };
    });

    // 1.5 Fetch Suppliers with debt
    const suppliers = await runStructuredQuery(token, 'suppliers', [
      {
        fieldFilter: {
          field: { fieldPath: 'ownerId' },
          op: 'EQUAL',
          value: { stringValue: ownerId }
        }
      }
    ]);
    const suppliersWithDebt = suppliers.filter((s: any) => {
      const debt = Number(s.fields?.totalDebt?.integerValue || s.fields?.totalDebt?.doubleValue || 0);
      return debt > 0;
    }).map((s: any) => {
      return {
        name: s.fields?.name?.stringValue || '',
        debt: Number(s.fields?.totalDebt?.integerValue || s.fields?.totalDebt?.doubleValue || 0)
      };
    });

    // 2. Fetch data for context (Recent orders for revenue info)
    const recentOrders = await runStructuredQuery(token, 'orders', [
      {
        fieldFilter: {
          field: { fieldPath: 'ownerId' },
          op: 'EQUAL',
          value: { stringValue: ownerId }
        }
      }
    ], 50, { field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' });
    
    const ordersData = recentOrders.map((o: any) => {
      const emailName = o.fields?.createdByEmail?.stringValue ? o.fields.createdByEmail.stringValue.split('@')[0] : '';
      const fallbackStaff = o.fields?.createdBy?.stringValue === ownerId ? adminName : (emailName || 'Nhân viên');
      
      return {
        customerName: o.fields?.customerName?.stringValue || '',
        totalAmount: Number(o.fields?.totalAmount?.integerValue || o.fields?.totalAmount?.doubleValue || 0),
        staffName: o.fields?.staffName?.stringValue || fallbackStaff,
        date: o.fields?.orderDate?.stringValue || ''
      };
    });

    // 3. Construct prompt
    const systemPrompt = `Bạn là trợ lý AI (Telegram Bot) phục vụ ĐỘC QUYỀN cho tài khoản: ${adminName} của phần mềm quản lý Dunvex Build.
Nhiệm vụ của bạn: Trả lời tự nhiên, thân thiện và cung cấp thông tin chính xác từ hệ thống.
QUY TẮC QUAN TRỌNG: 
1. BẮT BUỘC SỬ DỤNG HTML ĐỂ ĐỊNH DẠNG (ví dụ: <b>chữ đậm</b>, <i>chữ nghiêng</i>). 
2. TUYỆT ĐỐI KHÔNG DÙNG MARKDOWN (không dùng dấu * hay ** hay #). Các danh sách hãy dùng gạch đầu dòng (-) hoặc các emoji (👉, 📦, 💰, 👤).
3. Hiện tại bạn CHỈ ĐƯỢC PHÉP TRẢ LỜI CÂU HỎI THÔNG TIN (đơn hàng, doanh thu, công nợ).
4. NẾU NGƯỜI DÙNG YÊU CẦU TẠO, SỬA, HAY XÓA ĐƠN HÀNG/KHÁCH HÀNG: Bạn PHẢI TỪ CHỐI và yêu cầu người dùng truy cập vào Web App.
5. Báo cáo doanh thu hoặc công nợ một cách dễ hiểu, format tiền tệ VNĐ (ví dụ: 10.000.000đ).
6. Nhắc đến tên admin là ${adminName} nếu người dùng hỏi bạn đang phục vụ ai.

--- DỮ LIỆU HIỆN TẠI TỪ HỆ THỐNG CỦA ADMIN: ${adminName} ---
Khách hàng đang có công nợ (Khách hàng nợ mình):
${customersWithDebt.map((c: any) => `- ${c.name}: Nợ ${c.debt.toLocaleString('vi-VN')}đ (Số ngày: ${c.days})`).join('\n') || 'Không có khách nợ.'}

Nhà cung cấp đang có công nợ (Mình nợ NCC):
${suppliersWithDebt.map((s: any) => `- ${s.name}: Đang nợ ${s.debt.toLocaleString('vi-VN')}đ`).join('\n') || 'Không có nợ nhà cung cấp.'}

50 Đơn hàng gần nhất (Khách hàng / Doanh thu / Nhân viên / Ngày):
${ordersData.map((o: any) => `- ${o.customerName}: ${o.totalAmount.toLocaleString('vi-VN')}đ (Nhân viên: ${o.staffName}, Ngày: ${new Date(o.date).toLocaleDateString('vi-VN')})`).join('\n') || 'Chưa có đơn hàng.'}
------------------------------------------------

Câu hỏi của người dùng: "${userMessage}"
Dựa vào dữ liệu trên, hãy trả lời câu hỏi:`;

    // 4. Call Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.2 }, // We want raw string output, not strict JSON.
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini error:', data);
      return res.status(500).json({ error: 'Lỗi khi gọi AI', details: data });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin lỗi, tôi không thể xử lý câu hỏi này lúc này.';
    
    // Gửi tin nhắn lại Telegram
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    });
    
    // Luôn trả về 200 OK cho Telegram Webhook để nó không gửi lại
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    // Trả về 200 ngay cả khi lỗi để Telegram không retry làm kẹt hàng đợi
    return res.status(200).json({ error: error.message || 'Internal server error' });
  }
}
