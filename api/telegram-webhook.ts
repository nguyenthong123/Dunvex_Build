import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
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


async function restCreate(token: string, collection: string, fields: any) {
  const url = `${FIRESTORE_BASE}/${collection}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore POST ${collection} failed: ${res.status}`);
  return res.json();
}

async function restPatch(token: string, path: string, fields: any) {
  const keys = Object.keys(fields);
  const mask = keys.map(k => `updateMask.fieldPaths=${k}`).join('&');
  const url = `${FIRESTORE_BASE}/${path}?${mask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore PATCH ${path} failed: ${res.status}`);
  return res.json();
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
    if (!body || !body.message || !body.message.chat) {
      // Ignore non-message updates (like edited_message, channel_post) to avoid errors
      return res.status(200).json({ status: 'ignored' });
    }

    const userMessage = body.message.text || body.message.caption || '';
    const chatId = body.message.chat.id;
    const chatType = body.message.chat.type; // 'private', 'group', 'supergroup', etc.

    // Nếu là group, chỉ phản hồi khi được gọi đích danh (chứa "dunvex bot")
    if (chatType === 'group' || chatType === 'supergroup') {
      const lowerText = userMessage.toLowerCase();
      const isCalledByName = lowerText.includes('dunvex bot');
      
      if (!isCalledByName) {
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

    // Save chatId to Firestore — tách riêng nhóm và cá nhân
    const isGroupChat = chatType === 'group' || chatType === 'supergroup';
    const chatIdField = isGroupChat ? 'telegramGroupChatId' : 'telegramChatId';
    const currentValue = kf[chatIdField]?.stringValue;
    if (!currentValue || currentValue !== String(chatId)) {
      await fetch(`${FIRESTORE_BASE}/api_keys/${ownerId}?updateMask.fieldPaths=${chatIdField}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `projects/${PROJECT_ID}/databases/(default)/documents/api_keys/${ownerId}`,
          fields: {
            [chatIdField]: { stringValue: String(chatId) }
          }
        })
      });
    }

    // Thực hiện các truy vấn độc lập song song (giảm 80% thời gian chờ Firestore)
    const [userDoc, customersData, suppliersData, recentOrders, supplierDebtsData] = await Promise.all([
      restGet(token, `users/${ownerId}`),
      runStructuredQuery(token, 'customers', [{ fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } }]),
      runStructuredQuery(token, 'suppliers', [{ fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } }]),
      runStructuredQuery(token, 'orders', [{ fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } }], 50, { field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }),
      runStructuredQuery(token, 'supplier_debts', [{ fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } }])
    ]);

    const adminName = userDoc?.fields?.displayName?.stringValue || userDoc?.fields?.email?.stringValue || 'Admin';

    // 1. Fetch data for context (Customers with debt)
    const customersWithDebt = customersData.filter((c: any) => {
      const debt = Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0);
      return debt > 0;
    }).map((c: any) => {
      return {
        name: c.fields?.name?.stringValue || '',
        debt: Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0),
        days: c.fields?.debtDays?.integerValue || 0
      };
    });

    // 1.5 Fetch Suppliers with debt (Tính công nợ thực tế: SUM(debt_increase) - SUM(payment))
    const suppliersWithDebt: { name: string; debt: number }[] = [];
    for (const s of suppliersData) {
      const sDebts = supplierDebtsData.filter((d: any) => {
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
        suppliersWithDebt.push({
          name: s.fields?.name?.stringValue || '',
          debt: netDebt
        });
      }
    }

    // 2. Fetch data for context (Recent orders for revenue info)
    
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
    const systemPrompt = `Bạn là trợ lý AI (tên là dunvex bot) phục vụ ĐỘC QUYỀN cho tài khoản: ${adminName} của phần mềm quản lý Dunvex Build.
Nhiệm vụ của bạn: Trả lời tự nhiên, thân thiện và cung cấp thông tin chính xác từ hệ thống.
QUY TẮC QUAN TRỌNG: 
1. BẮT BUỘC SỬ DỤNG HTML ĐỂ ĐỊNH DẠNG (ví dụ: <b>chữ đậm</b>, <i>chữ nghiêng</i>). 
2. TUYỆT ĐỐI KHÔNG DÙNG MARKDOWN (không dùng dấu * hay ** hay #). Các danh sách hãy dùng gạch đầu dòng (-) hoặc các emoji (👉, 📦, 💰, 👤).
3. HIỆN TẠI BẠN ĐÃ CÓ KHẢ NĂNG SỬ DỤNG CÔNG CỤ (TOOLS). Khi người dùng yêu cầu tạo đơn hàng, sửa đơn hàng, hay chỉnh sửa công nợ, HÃY GỌI HÀM TƯƠNG ỨNG.
4. Báo cáo doanh thu hoặc công nợ một cách dễ hiểu, format tiền tệ VNĐ (ví dụ: 10.000.000đ).
5. Nhắc đến tên admin là ${adminName} nếu người dùng hỏi bạn đang phục vụ ai.

--- DỮ LIỆU HIỆN TẠI TỪ HỆ THỐNG CỦA ADMIN: ${adminName} ---
Khách hàng đang có công nợ (Khách hàng nợ mình):
${customersWithDebt.map((c: any) => `- ${c.name}: Nợ ${c.debt.toLocaleString('vi-VN')}đ (Số ngày: ${c.days})`).join('\n') || 'Không có khách nợ.'}

Nhà cung cấp đang có công nợ (Mình nợ NCC):
${suppliersWithDebt.map((s: any) => `- ${s.name}: Đang nợ ${s.debt.toLocaleString('vi-VN')}đ`).join('\n') || 'Không có nợ nhà cung cấp.'}

50 Đơn hàng gần nhất (Khách hàng / Doanh thu / Nhân viên / Ngày):
${ordersData.map((o: any) => `- ${o.customerName}: ${o.totalAmount.toLocaleString('vi-VN')}đ (Nhân viên: ${o.staffName}, Ngày: ${new Date(o.date).toLocaleDateString('vi-VN')})`).join('\n') || 'Chưa có đơn hàng.'}
------------------------------------------------`;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      systemInstruction: systemPrompt,
      tools: [{
        functionDeclarations: [
          {
            name: "create_order",
            description: "Tạo đơn hàng mới cho khách hàng.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                customerName: { type: SchemaType.STRING, description: "Tên khách hàng" },
                totalAmount: { type: SchemaType.NUMBER, description: "Tổng tiền đơn hàng (VNĐ)" }
              },
              required: ["customerName", "totalAmount"]
            }
          },
          {
            name: "update_customer_debt",
            description: "Thêm hoặc trừ công nợ của khách hàng (VD: khách trả nợ thì trừ nợ, khách mua nợ thì thêm nợ).",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                customerName: { type: SchemaType.STRING, description: "Tên khách hàng" },
                adjustmentAmount: { type: SchemaType.NUMBER, description: "Số tiền thay đổi (số ÂM nếu khách trả nợ / giảm nợ, số DƯƠNG nếu khách nợ thêm)" }
              },
              required: ["customerName", "adjustmentAmount"]
            }
          }
        ]
      }]
    });

    const chat = model.startChat();
    let result;
    try {
      result = await chat.sendMessage(userMessage);
    } catch (e: any) {
      console.error('Gemini error:', e);
      return res.status(500).json({ error: 'Lỗi khi gọi AI', details: e.message });
    }

    const call = result.response.functionCalls()?.[0];
    if (call) {
      let funcResult = "";
      try {
        if (call.name === "create_order") {
          const { customerName, totalAmount } = call.args;
          await restCreate(token, 'orders', {
            ownerId: { stringValue: ownerId },
            customerName: { stringValue: customerName },
            totalAmount: { integerValue: String(totalAmount) },
            status: { stringValue: 'Đơn chốt' },
            createdAt: { timestampValue: new Date().toISOString() },
            createdBy: { stringValue: 'Telegram Bot' }
          });
          funcResult = `Tạo đơn hàng thành công cho ${customerName} với số tiền ${totalAmount}đ`;
        } else if (call.name === "update_customer_debt") {
          const { customerName, adjustmentAmount } = call.args;
          const customers = await runStructuredQuery(token, 'customers', [
            { fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } },
            { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: customerName } } }
          ], 1);
          if (customers.length > 0) {
            const c = customers[0];
            const currentDebt = Number(c.fields?.debt?.integerValue || c.fields?.debt?.doubleValue || 0);
            const newDebt = currentDebt + Number(adjustmentAmount);
            const customerId = c.name.split('/').pop();
            await restPatch(token, `customers/${customerId}`, {
              debt: { integerValue: String(newDebt) }
            });
            funcResult = `Đã cập nhật công nợ cho ${customerName}. Nợ cũ: ${currentDebt}đ, Nợ mới: ${newDebt}đ`;
          } else {
            funcResult = `Không tìm thấy khách hàng nào tên ${customerName}. Yêu cầu quản trị viên kiểm tra lại tên.`;
          }
        }
      } catch (e: any) {
        funcResult = `Lỗi hệ thống khi thực hiện: ${e.message}`;
      }

      // Gửi kết quả lại cho Gemini
      try {
        result = await chat.sendMessage([{
          functionResponse: {
            name: call.name,
            response: { result: funcResult }
          }
        }]);
      } catch (e: any) {
        console.error('Gemini function response error:', e);
      }
    }

    const text = result.response.text() || 'Xin lỗi, tôi không thể xử lý câu hỏi này lúc này.';
    
    // Gửi tin nhắn lại Telegram
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
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
