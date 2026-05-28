import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "mock-key",
  authDomain: "dunvex-build.firebaseapp.com",
  projectId: "dunvex-build",
  storageBucket: "dunvex-build.appspot.com",
  messagingSenderId: "123",
  appId: "1:123:web:123"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const querySnapshot = await getDocs(collection(db, "payment_requests"));
  querySnapshot.forEach((doc) => {
    console.log(doc.id, " => ", doc.data());
  });
}

check().catch(console.error);
