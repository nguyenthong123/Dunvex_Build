const admin = require('firebase-admin');

// Note: Ensure GOOGLE_APPLICATION_CREDENTIALS environment variable is set 
// or initialize app with explicit credentials if running outside Google Cloud environment.
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

async function syncAllClaims() {
    console.log('Starting custom claims sync...');
    const snapshot = await db.collection('users').get();
    
    let successCount = 0;
    let failCount = 0;

    for (const doc of snapshot.docs) {
        const userData = doc.data();
        const userId = doc.id;
        
        const claims = {
            ownerId: userData.ownerId || userData.uid || null,
            role: userData.role || null
        };

        try {
            await auth.setCustomUserClaims(userId, claims);
            console.log(`Successfully updated claims for user ${userId} (${userData.email})`);
            successCount++;
        } catch (error) {
            console.error(`Failed to update claims for user ${userId}:`, error.message);
            failCount++;
        }
    }

    console.log(`\nSync completed!`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
}

syncAllClaims().catch(console.error).finally(() => process.exit(0));
