import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function debugCustomer() {
  const ordersSnap = await db.collection('orders').get();
  let targetOrder = null;
  ordersSnap.forEach(doc => {
    if (doc.id.toLowerCase().startsWith('wah8hykt'.toLowerCase())) {
      targetOrder = { id: doc.id, ...doc.data() };
    }
  });

  if (!targetOrder) {
    console.log('Order not found!');
    return;
  }

  console.log('Found Order:', targetOrder);

  const customerId = targetOrder.customerId;
  console.log('Customer ID:', customerId);

  if (customerId) {
    const customerDoc = await db.collection('customers').doc(customerId).get();
    console.log('Customer:', { id: customerDoc.id, ...customerDoc.data() });
    
    // Find all orders for this customer
    const allOrders = [];
    ordersSnap.forEach(doc => {
      const data = doc.data();
      if (data.customerId === customerId) {
        allOrders.push({ id: doc.id, totalAmount: data.totalAmount, status: data.status, customerName: data.customerName });
      }
    });
    console.log(`All orders for customer ${customerId}:`, allOrders);

    // Find all payments
    const paymentsSnap = await db.collection('payments').where('customerId', '==', customerId).get();
    const allPayments = [];
    paymentsSnap.forEach(doc => {
      allPayments.push({ id: doc.id, amount: doc.data().amount, customerName: doc.data().customerName });
    });
    console.log(`All payments for customer ${customerId}:`, allPayments);
  } else {
    // Guest customer?
    console.log('Order has no customerId (Guest)!');
    console.log('Order customerName:', targetOrder.customerName);
    
    // Find all orders with this name
    const allOrders = [];
    ordersSnap.forEach(doc => {
      const data = doc.data();
      if ((!data.customerId) && data.customerName === targetOrder.customerName) {
        allOrders.push({ id: doc.id, totalAmount: data.totalAmount, status: data.status });
      }
    });
    console.log(`All orders for guest ${targetOrder.customerName}:`, allOrders);
    
    const paymentsSnap = await db.collection('payments').where('customerName', '==', targetOrder.customerName).get();
    const allPayments = [];
    paymentsSnap.forEach(doc => {
      if (!doc.data().customerId) {
        allPayments.push({ id: doc.id, amount: doc.data().amount });
      }
    });
    console.log(`All payments for guest ${targetOrder.customerName}:`, allPayments);
  }
}

debugCustomer().catch(console.error);
