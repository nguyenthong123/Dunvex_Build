import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function auditDebts() {
  console.log("Starting debt audit...");
  
  // 1. Get all customers
  const customersSnapshot = await db.collection('customers').get();
  const customers = [];
  customersSnapshot.forEach(doc => {
    customers.push({ id: doc.id, ...doc.data() });
  });
  
  console.log(`Found ${customers.length} customers.`);

  // 2. Get all orders
  const ordersSnapshot = await db.collection('orders').get();
  const orders = [];
  ordersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.status === 'Đơn chốt') { // Only count completed orders
      orders.push({ id: doc.id, ...data });
    }
  });

  // 3. Get all payments
  const paymentsSnapshot = await db.collection('payments').get();
  const payments = [];
  paymentsSnapshot.forEach(doc => {
    payments.push({ id: doc.id, ...doc.data() });
  });

  // 4. Calculate real debt for each customer
  let outOfSyncCount = 0;
  
  for (const customer of customers) {
    if (customer.isGuest || customer.name === 'Khách vãng lai') continue;

    const customerOrders = orders.filter(o => o.customerId === customer.id);
    const customerPayments = payments.filter(p => p.customerId === customer.id);
    
    const totalOrderAmount = customerOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const totalPaymentAmount = customerPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    
    const realDebt = totalOrderAmount - totalPaymentAmount;
    const storedDebt = Number(customer.debt || 0);
    
    // Allow small floating point differences
    if (Math.abs(realDebt - storedDebt) > 1000) {
      console.log(`\n❌ Khách hàng: ${customer.name} (ID: ${customer.id})`);
      console.log(`   - Nợ lưu trên hệ thống (sai): ${storedDebt.toLocaleString('vi-VN')} đ`);
      console.log(`   - Nợ thực tế (từ Đơn hàng - Thanh toán): ${realDebt.toLocaleString('vi-VN')} đ`);
      console.log(`   - Lệch: ${(storedDebt - realDebt).toLocaleString('vi-VN')} đ`);
      console.log(`   - Số đơn hàng: ${customerOrders.length} | Số thanh toán: ${customerPayments.length}`);
      outOfSyncCount++;
    }
  }
  
  if (outOfSyncCount === 0) {
    console.log("\n✅ Tất cả công nợ khách hàng đều khớp với thực tế!");
  } else {
    console.log(`\n⚠️ Phát hiện ${outOfSyncCount} khách hàng bị lệch công nợ.`);
  }
}

auditDebts().catch(console.error);
