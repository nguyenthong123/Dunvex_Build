/**
 * Vercel Serverless: GET /api/products
 * Bot web gọi để lấy toàn bộ sản phẩm + tồn kho
 * Dùng Firebase REST API (không cần firebase-admin nặng)
 */

const PROJECT_ID = 'dunvex-89461';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getAccessToken(): Promise<string> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!json) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT env');
  const sa = JSON.parse(json);

  // Tạo JWT để lấy OAuth2 token
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

  // Encode JWT thủ công (không cần thư viện)
  function b64(str: string): string {
    return Buffer.from(str).toString('base64url');
  }
  function b64obj(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64url');
  }
  function sign(pk: string, data: string): string {
    const crypto = require('crypto');
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const apiKey = req.headers['x-api-key'];
  const ownerId = req.headers['x-owner-id'];

  if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key header' });
  if (!ownerId) return res.status(400).json({ error: 'Missing x-owner-id header' });

  try {
    const valid = await verifyApiKey(ownerId, apiKey);
    if (!valid) return res.status(403).json({ error: 'Invalid or disabled API key' });

    // Lấy products
    const token = await getAccessToken();
    const url = `${FIRESTORE_BASE}/products?orderBy=ownerId&equalTo=${ownerId}&pageSize=500`;
    const productsRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await productsRes.json();
    const docs = data.documents || [];

    const products = docs.map((doc: any) => {
      const nameParts = doc.name.split('/');
      const id = nameParts[nameParts.length - 1];
      const f = doc.fields || {};
      return {
        id,
        name: f.name?.stringValue || '',
        category: f.category?.stringValue || f.categories?.stringValue || '',
        priceSell: Number(f.priceSell?.doubleValue || f.priceSell?.integerValue || 0),
        priceImport: Number(f.priceImport?.doubleValue || f.priceImport?.integerValue || 0),
        unit: f.unit?.stringValue || '',
        weight: f.weight?.stringValue || '',
        stock: Number(f.stock?.doubleValue || f.stock?.integerValue || 0),
        articleNo: f.articleNo?.stringValue || '',
      };
    });

    return res.status(200).json({
      success: true,
      total: products.length,
      products,
    });
  } catch (error: any) {
    console.error('Products API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
