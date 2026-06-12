const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});
const db = admin.firestore();

async function fix() {
  const snapshot = await db.collection("orders").limit(1).get();
  console.log("Success! Found", snapshot.docs.length, "orders.");
}
fix().catch(console.error);
