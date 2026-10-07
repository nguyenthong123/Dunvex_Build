import * as db from '../db.js';
import dotenv from 'dotenv';
dotenv.config();

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("[Hourly Cron] Starting debt sync check...");

    const customersSnap = db.getAll('customers') || [];
    const ordersSnap = (db.getAll('orders') || []).filter(o => o.status === 'Đơn chốt');
    const paymentsSnap = db.getAll('payments') || [];

    const operations = [];
    let updated = 0;

    customersSnap.forEach(c => {
      const customerOrders = ordersSnap.filter(o => o.customerId === c.id);
      const customerPayments = paymentsSnap.filter(p => p.customerId === c.id);

      const totalOrder = customerOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || Number(o.finalTotal) || Number(o.total) || 0), 0);
      const totalPaid = customerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const debt = totalOrder - totalPaid;

      if (
        debt !== Number(c.totalDebt || 0) ||
        debt !== Number(c.debt || 0) ||
        totalOrder !== Number(c.totalOrdersAmount || 0) ||
        totalPaid !== Number(c.totalPaymentsAmount || 0)
      ) {
        operations.push({
          type: 'update',
          collection: 'customers',
          id: c.id,
          data: {
            debt: debt,
            totalDebt: debt, 
            totalOrdersAmount: totalOrder, 
            totalPaymentsAmount: totalPaid, 
            updatedAt: new Date().toISOString()
          }
        });
        updated++;
      }
    });

    if (operations.length > 0) {
      db.batchWrite(operations);
      console.log(`[Hourly Cron] Updated ${updated} customer debts`);
    }

    return res.status(200).json({ success: true, updated });
  } catch (e) {
    console.error('[Hourly Cron] Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
