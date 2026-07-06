import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const ordersSnapshot = await db.collection('orders').limit(500).get();
  console.log("Found", ordersSnapshot.size, "orders");
  ordersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.customerName && data.customerName.toUpperCase().includes('TUẤN LÊ')) {
       console.log(data.customerName, "order total:", data.totalAmount);
    }
    if (data.customerName && data.customerName.toUpperCase().includes('PHƯƠNG THẦU')) {
       console.log(data.customerName, "order total:", data.totalAmount);
    }
  });
}

run().catch(console.error);
