import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const customersSnapshot = await db.collection('customers').get();
  customersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.name && data.name.toUpperCase().includes('TUẤN LÊ')) {
       console.log(data.name, "debt:", data.debt);
    }
    if (data.name && data.name.toUpperCase().includes('PHƯƠNG THẦU')) {
       console.log(data.name, "debt:", data.debt);
    }
  });
}

run().catch(console.error);
