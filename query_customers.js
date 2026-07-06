import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const customersSnapshot = await db.collection('customers').get();
  console.log("Found", customersSnapshot.size, "customers");
  
  let totalDebt = 0;
  let totalPositiveDebt = 0;
  customersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.name === 'ZALO TUẤN LÊ' || data.name === 'ANH PHƯƠNG THẦU') {
       console.log(data.name, "debt:", data.debt);
    }
    totalDebt += (Number(data.debt) || 0);
    if ((Number(data.debt) || 0) > 0) {
      totalPositiveDebt += (Number(data.debt) || 0);
    }
  });
  console.log("Total debt of all customers in DB:", totalDebt);
  console.log("Total positive debt:", totalPositiveDebt);
}

run().catch(console.error);
