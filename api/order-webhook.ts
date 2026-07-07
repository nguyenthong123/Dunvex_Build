import crypto from 'crypto';

/**
 * Vercel Serverless: POST /api/order-webhook
 * Nhận đơn hàng từ bot web → tạo đơn trong Firestore
 * Dùng Firebase REST API (không cần firebase-admin)
 *
 * POST body:
 * { ownerId, customerName, customerPhone, customerEmail, items: [{productId, qty}] }
 */

const PROJECT_ID = 'dunvex-89461';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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

function fString(v: string) { return { stringValue: v }; }
function fInt(v: number) { return { integerValue: String(v) }; }
function fDouble(v: number) { return { doubleValue: v }; }
function fBool(v: boolean) { return { booleanValue: v }; }
function fTs() { return { timestampValue: new Date().toISOString() }; }

async function restGet(token: string, path: string) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${path}: ${res.status}`);
  return res.json();
}

async function runStructuredQuery(token: string, collectionId: string, fieldFilters: any[]): Promise<any[]> {
  const url = `${FIRESTORE_BASE}:runQuery`;
  const filter = fieldFilters.length === 1
    ? fieldFilters[0]
    : {
        compositeFilter: {
          op: 'AND',
          filters: fieldFilters
        }
      };

  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: filter
    }
  };

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
  const res = await fetch(`${FIRESTORE_BASE}/${collection}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Firestore create: ${JSON.stringify(data.error)}`);
  // Extract doc ID from name
  const parts = (data.name || '').split('/');
  return parts[parts.length - 1];
}

async function restUpdate(token: string, path: string, fields: any) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}?updateMask.fieldPaths=${Object.keys(fields).join('&updateMask.fieldPaths=')}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return res.json();
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = req.headers['x-api-key'] || req.headers['X-Api-Key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key header' });

  try {
    const body = req.body;
    if (!body.ownerId) return res.status(400).json({ error: 'Missing ownerId' });
    if (!body.customerName || !body.items?.length) return res.status(400).json({ error: 'Missing customerName or items' });

    const token = await getAccessToken();

    // Verify API key
    const keyDoc = await restGet(token, `api_keys/${body.ownerId}`);
    if (!keyDoc) return res.status(403).json({ error: 'API key not found' });
    const kf = keyDoc.fields || {};
    if (kf.enabled?.booleanValue !== true || kf.key?.stringValue !== apiKey) {
      return res.status(403).json({ error: 'Invalid or disabled API key' });
    }

    // Tải toàn bộ danh sách sản phẩm của owner để so khớp (tối ưu hóa số lần gọi API)
    const allProducts = await runStructuredQuery(token, 'products', [
      {
        fieldFilter: {
          field: { fieldPath: 'ownerId' },
          op: 'EQUAL',
          value: { stringValue: body.ownerId }
        }
      }
    ]);

    // Match products
    const items: any[] = [];
    const notFound: string[] = [];

    for (const item of body.items) {
      let matched: any = null;

      // Ưu tiên productId
      if (item.productId) {
        const found = allProducts.find((p: any) => p.name.split('/').pop() === item.productId);
        if (found) {
          matched = { id: item.productId, ...found.fields };
        } else {
          // Fallback: GET trực tiếp document phòng trường hợp sản phẩm mới hoặc ngoài danh sách 500
          const prodDoc = await restGet(token, `products/${item.productId}`);
          if (prodDoc) {
            const pf = prodDoc.fields || {};
            if (pf.ownerId?.stringValue === body.ownerId) {
              matched = { id: item.productId, ...pf };
            }
          }
        }
      }

      // Fallback: match theo tên
      if (!matched && item.productName) {
        const found = allProducts.find((doc: any) => {
          const f = doc.fields || {};
          return f.name?.stringValue?.toLowerCase() === item.productName.toLowerCase();
        });
        if (found) {
          matched = { id: found.name.split('/').pop()!, ...found.fields };
        }
      }

      if (matched) {
        items.push({
          productId: (matched as any).id,
          name: (matched as any).name?.stringValue || '',
          qty: Number(item.qty) || 0,
          price: Number(item.price) || Number((matched as any).priceSell?.doubleValue || (matched as any).priceSell?.integerValue || 0),
          buyPrice: Number((matched as any).priceImport?.doubleValue || (matched as any).priceImport?.integerValue || 0),
          unit: (matched as any).unit?.stringValue || '',
          weight: (matched as any).density?.stringValue || 
                  ((matched as any).density?.doubleValue !== undefined ? String((matched as any).density.doubleValue) : '') ||
                  ((matched as any).density?.integerValue !== undefined ? String((matched as any).density.integerValue) : '') ||
                  '',
          stock: Number((matched as any).stock?.doubleValue || (matched as any).stock?.integerValue || 0),
        });
      } else {
        notFound.push(item.productId || item.productName || 'unknown');
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'No matching products found', notFound });
    }

    // Match/find or create customer
    const customerName = body.customerName || '';
    const customerPhone = body.customerPhone || '';
    const customerEmail = body.customerEmail || '';
    let customerId = body.customerId || null;

    if (!customerId) {
      let matchedCust: any = null;
      const filters: any[] = [
        {
          fieldFilter: {
            field: { fieldPath: 'ownerId' },
            op: 'EQUAL',
            value: { stringValue: body.ownerId }
          }
        }
      ];

      // 1. Match by email
      if (customerEmail) {
        const docs = await runStructuredQuery(token, 'customers', [
          ...filters,
          {
            fieldFilter: {
              field: { fieldPath: 'email' },
              op: 'EQUAL',
              value: { stringValue: customerEmail }
            }
          }
        ]);
        if (docs.length > 0) matchedCust = docs[0];
      }

      // 2. Match by phone
      if (!matchedCust && customerPhone) {
        const docs = await runStructuredQuery(token, 'customers', [
          ...filters,
          {
            fieldFilter: {
              field: { fieldPath: 'phone' },
              op: 'EQUAL',
              value: { stringValue: customerPhone }
            }
          }
        ]);
        if (docs.length > 0) matchedCust = docs[0];
      }

      // 3. Match by name
      if (!matchedCust && customerName) {
        const docs = await runStructuredQuery(token, 'customers', [
          ...filters,
          {
            fieldFilter: {
              field: { fieldPath: 'name' },
              op: 'EQUAL',
              value: { stringValue: customerName }
            }
          }
        ]);
        if (docs.length > 0) matchedCust = docs[0];
      }

      if (matchedCust) {
        customerId = matchedCust.name.split('/').pop()!;
      } else {
        // Tạo KH mới
        customerId = await restCreate(token, 'customers', {
          ownerId: fString(body.ownerId),
          name: fString(customerName),
          phone: fString(customerPhone),
          email: fString(customerEmail),
          address: fString(body.customerAddress || ''),
          type: fString('Khách web'),
          createdAt: fTs(),
          createdBy: fString(body.ownerId),
        });
      }
    }

    const shippingFee = Number(body.shippingFee) || 0;

    // Calculate totals
    const subTotal = items.reduce((s: number, i: any) => s + (i.price * i.qty), 0);
    const totalWeight = items.reduce((s: number, i: any) => s + (parseFloat(i.weight) || 0) * i.qty, 0);
    const totalCost = items.reduce((s: number, i: any) => s + (i.buyPrice || 0) * i.qty, 0);
    const totalAmount = subTotal + shippingFee;

    // Build order fields
    const orderFields: any = {
      ownerId: fString(body.ownerId),
      customerName: fString(customerName),
      customerPhone: fString(customerPhone),
      customerId: fString(customerId || ''),
      items: {
        arrayValue: {
          values: items.map((i: any) => ({
            mapValue: {
              fields: {
                productId: fString(i.productId),
                name: fString(i.name),
                qty: fInt(i.qty),
                price: fDouble(i.price),
                buyPrice: fDouble(i.buyPrice),
                unit: fString(i.unit),
                weight: fString(i.weight),
              }
            }
          }))
        }
      },
      subTotal: fDouble(subTotal),
      totalAmount: fDouble(totalAmount),
      paidAmount: fDouble(totalAmount),
      debtAmount: fDouble(0),
      discountValue: fDouble(0),
      adjustmentValue: fDouble(shippingFee),
      totalWeight: fDouble(totalWeight),
      totalCost: fDouble(totalCost),
      totalProfit: fDouble(subTotal - totalCost),
      status: fString('Đơn chốt'),
      note: fString(body.note || 'Đơn từ Webhook API'),
      orderDate: fString(body.orderDate ? new Date(body.orderDate).toISOString() : new Date().toISOString()),
      createdAt: fTs(),
      updatedAt: fTs(),
      createdBy: fString(body.ownerId),
      createdByEmail: fString(customerEmail || 'webhook'),
      source: fString('webhook'),
    };

    const orderId = await restCreate(token, 'orders', orderFields);

    // Update stock cho từng sản phẩm
    for (const item of items) {
      const newStock = Math.max(0, item.stock - item.qty);
      await restUpdate(token, `products/${item.productId}`, {
        stock: fDouble(newStock),
        updatedAt: fTs(),
      });
    }

    // Cập nhật công nợ khách hàng
    if (customerId) {
      try {
        const custDoc = await restGet(token, `customers/${customerId}`);
        const currentDebt = Number(custDoc?.fields?.debt?.doubleValue || custDoc?.fields?.debt?.integerValue || 0);
        await restUpdate(token, `customers/${customerId}`, {
          debt: fDouble(currentDebt + totalAmount)
        });
      } catch (debtErr) {
        console.error('Failed to update customer debt in webhook:', debtErr);
      }
    }

    // Gửi thông báo Telegram
    try {
      const keyDoc = await restGet(token, `api_keys/${body.ownerId}`);
      if (keyDoc && keyDoc.fields) {
        const kf = keyDoc.fields;
        const botToken = kf.telegramBotToken?.stringValue;
        const chatId = kf.telegramChatId?.stringValue;
        if (botToken && chatId && kf.enabled?.booleanValue === true) {
          const message = `📦 <b>ĐƠN HÀNG MỚI (CHỐT)</b>\n- Khách hàng: <b>${customerName || 'Khách vãng lai'}</b>\n- Tổng tiền: <b>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalAmount)}</b>\n- Người thao tác: Bot Trợ Lý (Webhook)`;
          
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: 'HTML'
            })
          });
        }
      }
    } catch (teleErr) {
      console.error('Failed to send Telegram notification in webhook:', teleErr);
    }

    return res.status(200).json({
      success: true,
      orderId,
      customerId: customerId || null,
      totalAmount,
      items: items.length,
      notFound: notFound.length > 0 ? notFound : undefined,
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
