/**
 * Vercel Serverless Function: /api/order-webhook
 * Nhận đơn hàng từ website bên ngoài → tạo đơn trong Firestore
 * 
 * POST body format:
 * {
 *   customerName: string,
 *   customerPhone?: string,
 *   items: [{ productName: string, qty: number, price: number }],
 *   note?: string,
 *   paidAmount?: number
 * }
 */

import { cert, initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Init Firebase Admin (reuse if already initialized)
function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : undefined;
    
    initializeApp({
      credential: serviceAccount ? cert(serviceAccount) : undefined,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'dunvex-89461',
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  try {
    const db = getAdminDb();
    const body = req.body;

    // Validate required fields
    if (!body.ownerId) {
      return res.status(400).json({ error: 'Missing ownerId' });
    }
    if (!body.customerName || !body.items?.length) {
      return res.status(400).json({ error: 'Missing customerName or items' });
    }

    // Verify API key
    const valid = await verifyApiKey(db, body.ownerId, apiKey);
    if (!valid) {
      return res.status(403).json({ error: 'Invalid or disabled API key' });
    }

    // Get owner info
    const ownerSnap = await db.collection('owners').doc(body.ownerId).get();
    const ownerData = ownerSnap.exists ? ownerSnap.data() : null;

    // Match products by name
    const productSnaps = await db.collection('products')
      .where('ownerId', '==', body.ownerId)
      .get();
    
    const products: Record<string, any> = {};
    productSnaps.forEach(doc => {
      const p = doc.data();
      products[p.name?.toLowerCase()] = { id: doc.id, ...p };
    });

    const items = [];
    const notFound = [];
    for (const item of body.items) {
      const matched = products[item.productName?.toLowerCase()];
      if (matched) {
        items.push({
          productId: matched.id,
          name: matched.name,
          qty: Number(item.qty) || 0,
          price: Number(item.price) || matched.priceSell || 0,
          buyPrice: matched.priceImport || 0,
          unit: matched.unit || '',
          weight: matched.weight || '',
        });
      } else {
        notFound.push(item.productName);
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'No matching products found', notFound });
    }

    // Calculate totals
    const subTotal = items.reduce((s, i) => s + (i.price * i.qty), 0);
    const paidAmount = Number(body.paidAmount) || 0;
    const orderStatus = paidAmount >= subTotal ? 'Đơn chốt' : 'Chưa thanh toán';
    const debtAmount = Math.max(0, subTotal - paidAmount);

    // Match/find customer
    let customerId = body.customerId || null;
    if (!customerId) {
      const custSnaps = await db.collection('customers')
        .where('ownerId', '==', body.ownerId)
        .where('name', '==', body.customerName)
        .limit(1)
        .get();
      if (!custSnaps.empty) {
        customerId = custSnaps.docs[0].id;
      }
    }

    // Create order
    const orderData = {
      ownerId: body.ownerId,
      customerName: body.customerName,
      customerPhone: body.customerPhone || '',
      customerId: customerId || '',
      items,
      subTotal,
      totalAmount: subTotal,
      debtAmount,
      paidAmount,
      discountValue: 0,
      adjustmentValue: 0,
      totalWeight: items.reduce((s, i) => s + (parseFloat(i.weight) || 0) * i.qty, 0),
      totalCost: items.reduce((s, i) => s + (i.buyPrice || 0) * i.qty, 0),
      totalProfit: items.reduce((s, i) => s + (i.price - (i.buyPrice || 0)) * i.qty, 0),
      note: body.note || `Đơn từ Webhook API`,
      status: orderStatus,
      orderDate: new Date().toISOString(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: body.ownerId,
      createdByEmail: ownerData?.email || body.createdByEmail || 'webhook',
      source: 'webhook',
    };

    const orderRef = await db.collection('orders').add(orderData);

    // Update stock
    const batch = db.batch();
    for (const item of items) {
      const prodRef = db.collection('products').doc(item.productId);
      batch.update(prodRef, { 
        stock: (await prodRef.get()).data()?.stock || 0 - item.qty 
      });
    }
    await batch.commit();

    return res.status(200).json({
      success: true,
      orderId: orderRef.id,
      totalAmount: subTotal,
      items: items.length,
      notFound: notFound.length > 0 ? notFound : undefined,
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
