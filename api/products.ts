/**
 * GET /api/products
 * Bot web gọi để lấy toàn bộ sản phẩm + tồn kho
 * 
 * Headers: x-api-key, x-owner-id
 * Response: { success, total, products: [{ id, name, category, price, stock, unit, ... }] }
 */

import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminDb() {
  if (!getApps().length) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!json) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT env');
    const serviceAccount = JSON.parse(json);
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  return getFirestore();
}

async function verifyApiKey(db: FirebaseFirestore.Firestore, ownerId: string, key: string): Promise<boolean> {
  const snap = await db.collection('api_keys').doc(ownerId).get();
  if (!snap.exists) return false;
  const data = snap.data();
  return data?.enabled === true && data?.key === key;
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
    const db = getAdminDb();

    const valid = await verifyApiKey(db, ownerId, apiKey);
    if (!valid) return res.status(403).json({ error: 'Invalid or disabled API key' });

    const snaps = await db.collection('products')
      .where('ownerId', '==', ownerId)
      .get();

    const products: any[] = [];
    snaps.forEach(doc => {
      const p = doc.data();
      products.push({
        id: doc.id,
        name: p.name || '',
        category: p.category || p.categories || '',
        priceSell: p.priceSell || 0,
        priceImport: p.priceImport || 0,
        unit: p.unit || '',
        weight: p.weight || '',
        stock: p.stock || 0,
        articleNo: p.articleNo || '',
        images: p.images || [],
        updatedAt: p.updatedAt?.toDate?.() || p.updatedAt || null,
      });
    });

    return res.status(200).json({
      success: true,
      total: products.length,
      products,
    });
  } catch (error: any) {
    console.error('Products API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
