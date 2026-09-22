import crypto from 'crypto';

/**
 * Vercel Serverless: POST /api/export-data
 * Fetch dữ liệu từ Firestore, lọc theo thời gian, trả JSON cho client tạo Excel
 * Plan B: Server fetch + filter → Client tạo file xlsx
 */

const PROJECT_ID = 'dunvex-89461';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ─── Auth ──────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!json) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT env');
  const sa = JSON.parse(json);

  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  };

  function b64obj(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64url');
  }
  function sign(pk: string, data: string): string {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(data);
    signer.end();
    return signer.sign(pk, 'base64url');
  }

  const partial = `${b64obj(header)}.${b64obj(claim)}`;
  const signature = sign(sa.private_key, partial);
  const jwt = `${partial}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (data.error) throw new Error(`Auth error: ${data.error_description || data.error}`);
  return data.access_token;
}

// ─── Firestore Value Parser ────────────────────────────────────

function parseFirestoreValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'object') return val;
  
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  
  if ('timestampValue' in val) {
    const d = new Date(val.timestampValue);
    return d.toLocaleString('vi-VN');
  }
  
  if ('arrayValue' in val && val.arrayValue?.values) {
    return val.arrayValue.values.map(parseFirestoreValue);
  }
  
  if ('mapValue' in val && val.mapValue?.fields) {
    const result: any = {};
    for (const [k, v] of Object.entries(val.mapValue.fields)) {
      result[k] = parseFirestoreValue(v);
    }
    return result;
  }
  
  return JSON.stringify(val);
}

function parseFirestoreDoc(doc: any): { id: string; [key: string]: any } {
  const nameParts = doc.name.split('/');
  const id = nameParts[nameParts.length - 1];
  const fields = doc.fields || {};
  const result: any = { id };
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val as any);
  }
  return result;
}

// ─── Fetch Collection ──────────────────────────────────────────

async function fetchCollection(
  token: string,
  collectionId: string,
  ownerId: string,
  limit = 1000
): Promise<any[]> {
  const allDocs: any[] = [];
  let pageToken: string | null = null;

  do {
    const body: any = {
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'ownerId' },
            op: 'EQUAL',
            value: { stringValue: ownerId }
          }
        },
        limit,
        ...(pageToken ? { startAt: pageToken } : {}),
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }]
      }
    };

    // Firestore REST pagination uses cursor, not startAt in structuredQuery
    // We'll use a simpler approach: loop with document.name as cursor
    const url: string = pageToken
      ? `${FIRESTORE_BASE}:runQuery`
      : `${FIRESTORE_BASE}:runQuery`;

    const res: any = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Firestore ${collectionId} query failed:`, res.status, errText);
      break;
    }

    const data: any = await res.json();
    const batch: any[] = Array.isArray(data)
      ? data.filter((item: any) => item.document).map((item: any) => item.document)
      : [];

    if (batch.length === 0) break;

    allDocs.push(...batch);

    // Pagination: use the last doc's name as cursor
    if (batch.length === limit) {
      const lastDoc: any = batch[batch.length - 1];
      pageToken = lastDoc.name;
    } else {
      break;
    }
  } while (true);

  return allDocs.map(parseFirestoreDoc);
}

// ─── Technical fields to strip ─────────────────────────────────

const TECHNICAL_FIELDS = ['ownerId', 'ownerEmail', 'createdBy', 'createdByEmail', 'updatedBy', 'updatedAt'];

function stripTechnicalFields(item: any): any {
  const cleaned: any = {};
  for (const [key, val] of Object.entries(item)) {
    if (TECHNICAL_FIELDS.includes(key)) continue;
    cleaned[key] = val;
  }
  return cleaned;
}

// ─── Filter by date range ──────────────────────────────────────

function filterByDate(data: any[], startTS: Date | null, endTS: Date | null): any[] {
  if (!startTS || !endTS) return data;
  return data.filter((item: any) => {
    if (!item.createdAt) return false;
    const d = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
    return d >= startTS && d <= endTS;
  });
}

// ─── Main Handler ──────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { ownerId, startDate, endDate } = req.body || {};

  if (!ownerId) {
    return res.status(400).json({ error: 'Missing ownerId' });
  }

  try {
    const token = await getAccessToken();

    // Parse time range
    const startTS = startDate ? new Date(startDate + 'T00:00:00') : null;
    const endTS = endDate ? new Date(endDate + 'T23:59:59') : null;

    // Fetch all collections in parallel
    const collections = [
      'products',
      'customers',
      'orders',
      'debts',
      'checkins',
      'attendance_logs',
      'payments',
      'inventory_logs',
      'supplier_debts',
      'purchase_orders'
    ];
    const results: Record<string, any[]> = {};

    await Promise.all(collections.map(async (colName) => {
      try {
        const docs = await fetchCollection(token, colName, ownerId);
        // Filter by date
        const filtered = filterByDate(docs, startTS, endTS);
        // Strip technical fields & unused fields
        results[colName] = filtered.map((item: any) => {
          const cleaned = stripTechnicalFields(item);
          if (colName === 'customers') {
            delete cleaned.businessName;
          }
          return cleaned;
        });
      } catch (err: any) {
        console.error(`Error fetching ${colName}:`, err.message);
        results[colName] = [];
      }
    }));

    // Extract order details for chi_tiet_don_hang
    const orderDetails: any[] = [];
    if (results.orders) {
      const productMapById: Record<string, any> = {};
      const productMapByName: Record<string, any> = {};
      if (results.products) {
        for (const p of results.products) {
          if (p.id) productMapById[p.id] = p;
          if (p.name) productMapByName[p.name.trim().toLowerCase()] = p;
        }
      }

      const EXCLUDE_PROFIT_KEYWORDS = ['ứng tiền', 'ung tien', 'ưng tiền', 'ứng trước', 'ung truoc', 'tạm ứng', 'tam ung'];
      const isExcludedFromProfit = (name: string, flag?: boolean) => {
        if (flag) return true;
        if (!name) return false;
        const lower = String(name).toLowerCase();
        return EXCLUDE_PROFIT_KEYWORDS.some((kw) => lower.includes(kw));
      };

      const overheadRate = 8.5; // Default overhead rate

      for (const order of results.orders) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            const rawItem = typeof item === 'object' ? item : { item };
            const prodId = rawItem.id || rawItem.productId;
            const prodName = rawItem.name || rawItem.productName || '';
            const matchedProd = productMapById[prodId] || productMapByName[prodName.trim().toLowerCase()] || {};

            const excluded = isExcludedFromProfit(prodName, rawItem.excludeProfit || matchedProd.excludeProfit);
            const applyOverhead = rawItem.applyOverheadCost !== undefined 
              ? Boolean(rawItem.applyOverheadCost) 
              : Boolean(matchedProd.applyOverheadCost);

            const qty = Number(rawItem.qty || 0);
            const priceSell = Number(rawItem.price !== undefined ? rawItem.price : (rawItem.priceSell || 0));
            const buyPrice = Number(rawItem.buyPrice !== undefined && rawItem.buyPrice !== null
              ? rawItem.buyPrice 
              : (matchedProd.priceImport || matchedProd.costPrice || matchedProd.buyPrice || 0));

            let unitProfit = 0;
            let profit = 0;

            if (!excluded) {
              let effectiveCost = buyPrice;
              if (applyOverhead && overheadRate > 0) {
                effectiveCost = buyPrice * (1 + overheadRate / 100);
              }
              unitProfit = priceSell - effectiveCost;
              profit = unitProfit * qty;
            }

            orderDetails.push({
              orderId: order.id,
              orderDate: order.orderDate || (order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : ''),
              customerName: order.customerName || '',
              ...rawItem,
              buyPrice: Math.round(buyPrice),
              profit: Math.round(profit),
              unitProfit: Math.round(unitProfit),
            });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        products: results.products || [],
        customers: results.customers || [],
        orders: results.orders || [],
        debts: results.debts || [],
        checkins: results.checkins || [],
        attendance_logs: results.attendance_logs || [],
        payments: results.payments || [],
        inventory_logs: results.inventory_logs || [],
        supplier_debts: results.supplier_debts || [],
        purchase_orders: results.purchase_orders || [],
        orderDetails,
      },
      counts: {
        products: results.products?.length || 0,
        customers: results.customers?.length || 0,
        orders: results.orders?.length || 0,
        debts: results.debts?.length || 0,
        checkins: results.checkins?.length || 0,
        attendance_logs: results.attendance_logs?.length || 0,
        payments: results.payments?.length || 0,
        inventory_logs: results.inventory_logs?.length || 0,
        supplier_debts: results.supplier_debts?.length || 0,
        purchase_orders: results.purchase_orders?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('Export API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
