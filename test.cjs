const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // assuming you have it or can use default
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
async function run() {
  const prods = await db.collection('products').get();
  prods.forEach(d => console.log('Product:', d.data().name, d.data().category));
  const custs = await db.collection('customers').get();
  custs.forEach(d => console.log('Customer:', d.data().name));
}
run();
