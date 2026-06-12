import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/Users/zomby/.gemini/antigravity/mcp/firebase-mcp-server/dunvex-89461-firebase-adminsdk-hswnt-d39f60fc18.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
db.collection('users').doc('lTvhXMgatgh1hb5oSM1nrp34YOH2').get().then(doc => {
  console.log('User doc:', doc.data());
  process.exit(0);
});
