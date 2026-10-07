import dotenv from 'dotenv';
import * as db from '../db.js';
dotenv.config();

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  const authHeader = req.headers.authorization || '';
  const token = req.query.token || '';
  const apiToken = process.env.NEXUS_WEBHOOK_TOKEN || 'dunvex-nexus-2026';
  
  if (authHeader !== `Bearer ${apiToken}` && token !== apiToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const requests = (db.getAll('payment_requests') || [])
      .filter(request => request.status === 'pending')
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 50)
      .map(request => ({
        id: request.id,
        userId: request.userId,
        userEmail: request.userEmail,
        ownerId: request.ownerId,
        planId: request.planId,
        planName: request.planName,
        amount: request.amount || request.originalAmount,
        durationDays: request.durationDays || null,
        durationMonths: request.durationMonths || null,
        transferCode: request.transferCode,
        status: request.status,
        createdAt: request.createdAt?.toDate?.()?.toISOString?.() || request.createdAt || null,
      }));
    
    return res.status(200).json({ success: true, count: requests.length, requests });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default handler;
