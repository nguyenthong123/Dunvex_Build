import crypto from 'crypto';

/**
 * Vercel Serverless: GET /api/customers  - Lấy danh sách khách hàng
 *                    POST /api/customers - Tạo/cập nhật khách hàng (upsert theo email)
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

async function verifyApiKey(ownerId: string, key: string): Promise<boolean> {
  const token = await getAccessToken();
  const res = await fetch(`${FIRESTORE_BASE}/api_keys/${ownerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return false;
  const doc = await res.json();
  const fields = doc.fields || {};
  return fields.enabled?.booleanValue === true && fields.key?.stringValue === key;
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-owner-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = req.headers['x-api-key'] || req.headers['X-Api-Key'];
  const ownerId = req.headers['x-owner-id'] || req.headers['X-Owner-Id'];

  if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key header' });
  if (!ownerId) return res.status(400).json({ error: 'Missing x-owner-id header' });

  try {
    const valid = await verifyApiKey(ownerId, apiKey);
    if (!valid) return res.status(403).json({ error: 'Invalid or disabled API key' });

    const token = await getAccessToken();

    // ─── GET: Lấy danh sách khách hàng ────────────────────────────────────────
    if (req.method === 'GET') {
      const url = `${FIRESTORE_BASE}:runQuery`;
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: 'customers' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'ownerId' },
              op: 'EQUAL',
              value: { stringValue: ownerId },
            },
          },
          limit: 1000,
        },
      };

      const customersRes = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(queryBody),
      });

      if (!customersRes.ok) {
        const errText = await customersRes.text();
        throw new Error(`Firestore runQuery failed: ${customersRes.status} ${errText}`);
      }

      const data = await customersRes.json();
      const docs = Array.isArray(data)
        ? data.filter((item: any) => item.document).map((item: any) => item.document)
        : [];

      const customers = docs.map((doc: any) => {
        const nameParts = doc.name.split('/');
        const id = nameParts[nameParts.length - 1];
        const f = doc.fields || {};
        return {
          id,
          name: f.name?.stringValue || '',
          phone: f.phone?.stringValue || '',
          email: f.email?.stringValue || '',
          type: f.type?.stringValue || 'Chưa phân loại',
          status: f.status?.stringValue || 'Hoạt động',
          address: f.address?.stringValue || '',
          note: f.note?.stringValue || '',
        };
      });

      return res.status(200).json({ success: true, total: customers.length, customers });
    }

    // ─── POST: Tạo mới hoặc cập nhật khách hàng (Upsert theo email) ───────────
    if (req.method === 'POST') {
      const { name, phone, email, address } = req.body || {};

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      // Kiểm tra email đã tồn tại chưa
      if (email) {
        const queryUrl = `${FIRESTORE_BASE}:runQuery`;
        const emailQueryBody = {
          structuredQuery: {
            from: [{ collectionId: 'customers' }],
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  { fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId } } },
                  { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
                ],
              },
            },
            limit: 1,
          },
        };

        const existingRes = await fetch(queryUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(emailQueryBody),
        });

        const existingData = await existingRes.json();
        const existingDocs = Array.isArray(existingData)
          ? existingData.filter((item: any) => item.document).map((item: any) => item.document)
          : [];

        // Nếu đã tồn tại → cập nhật
        if (existingDocs.length > 0) {
          const docPath = existingDocs[0].name;
          const docId = docPath.split('/').pop();
          const updateUrl = `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=name&updateMask.fieldPaths=phone&updateMask.fieldPaths=address`;
          const updateBody = {
            fields: {
              name: { stringValue: name },
              phone: { stringValue: phone || '' },
              address: { stringValue: address || '' },
            },
          };

          const patchRes = await fetch(updateUrl, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(updateBody),
          });

          if (!patchRes.ok) {
            const errText = await patchRes.text();
            throw new Error(`Failed to update customer: ${patchRes.status} ${errText}`);
          }

          return res.status(200).json({ success: true, message: 'Customer updated', customerId: docId });
        }
      }

      // Tạo mới
      const createRes = await fetch(`${FIRESTORE_BASE}/customers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            name: { stringValue: name },
            phone: { stringValue: phone || '' },
            email: { stringValue: email || '' },
            address: { stringValue: address || '' },
            type: { stringValue: 'Khách hàng' },
            status: { stringValue: 'Hoạt động' },
            ownerId: { stringValue: ownerId },
            createdByEmail: { stringValue: 'Website Sync' },
            createdAt: { timestampValue: new Date().toISOString() },
          },
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Firestore create failed: ${createRes.status} ${errText}`);
      }

      const createdData = await createRes.json();
      const newId = createdData.name.split('/').pop();

      return res.status(201).json({ success: true, message: 'Customer created', customerId: newId });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('Customers API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
