const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { google } = require('googleapis');

admin.initializeApp();

const db = admin.firestore();

/**
 * Cloud Function to export company data to Google Sheets
 * Limit: 5 times per month (enforced on frontend and here)
 */
exports.exportCompanyData = functions.https.onCall(async (data, context) => {
	// 1. Authentication Check
	if (!context.auth) {
		throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
	}

	const { companyId, startDate, endDate } = data;
	const userId = context.auth.uid;
	const userEmail = context.auth.token.email;

	if (!companyId) {
		throw new functions.https.HttpsError('invalid-argument', 'Company ID is required.');
	}

	// 2. Authorization & Multi-tenant Check
	const userDoc = await db.collection('users').doc(userId).get();
	const userData = userDoc.data();

	if (!userData) {
		throw new functions.https.HttpsError('not-found', 'User profile not found.');
	}

	// Determine the user's actual company ID
	// If they are an owner, it's their uid. If they are staff, it's their ownerId.
	const actualUserCompanyId = userData.ownerId || userData.uid;

	// SECURITY: Verify that the admin belongs to the company they are trying to export
	if (userData.role !== 'admin' || actualUserCompanyId !== companyId) {
		throw new functions.https.HttpsError('permission-denied', 'You do not have permission to access this company data.');
	}

	// 3. Usage Limit Check (5 times per month)
	const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
	const usageRef = db.collection('usage_limits').doc(`${companyId}_${currentMonth}`);

	const usageDoc = await usageRef.get();
	const currentCount = usageDoc.exists ? usageDoc.data().count : 0;

	if (currentCount >= 5) {
		throw new functions.https.HttpsError('resource-exhausted', 'Monthly export limit (5) reached.');
	}

	try {
		// 4. Fetch Data from Firestore
		const collections = ['products', 'customers', 'orders', 'debts', 'finance_transactions', 'checkins'];
		const exportData = {};

		const startTS = startDate ? admin.firestore.Timestamp.fromDate(new Date(startDate + 'T00:00:00')) : null;
		const endTS = endDate ? admin.firestore.Timestamp.fromDate(new Date(endDate + 'T23:59:59')) : null;

		for (const col of collections) {
			let query = db.collection(col).where('ownerId', '==', companyId);

			// Apply date filter for transactional collections if dates are provided
			if (['orders', 'debts', 'finance_transactions', 'checkins'].includes(col) && startTS && endTS) {
				query = query.where('createdAt', '>=', startTS).where('createdAt', '<=', endTS);
			}

			const snap = await query.limit(10000).get();
			exportData[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		}

		// 5. Initialize Google APIs
		// Authenticate using the service account associated with the Cloud Function
		const auth = new google.auth.GoogleAuth({
			scopes: [
				'https://www.googleapis.com/auth/spreadsheets',
				'https://www.googleapis.com/auth/drive'
			],
		});
		const authClient = await auth.getClient();
		const sheets = google.sheets({ version: 'v4', auth: authClient });
		const drive = google.drive({ version: 'v3', auth: authClient });

		// 6. Create Google Sheet
		const resource = {
			properties: {
				title: `Dunvex Data Export - ${companyId} - ${new Date().toLocaleDateString()}`,
			},
		};
		const spreadsheet = await sheets.spreadsheets.create({
			resource,
			fields: 'spreadsheetId',
		});
		const spreadsheetId = spreadsheet.data.spreadsheetId;

		// 7. Populating sheets with data
		const sheetUpdates = [];

		for (const [colName, items] of Object.entries(exportData)) {
			if (items.length === 0) continue;

			const headers = Object.keys(items[0]);
			const rows = items.map(item => headers.map(h => {
				const val = item[h];
				if (val && typeof val === 'object' && val._seconds) {
					return new Date(val._seconds * 1000).toLocaleString();
				}
				return val === null || val === undefined ? '' : String(val);
			}));

			// Create a new sheet for each collection (except the first one which is default)
			if (colName !== 'products') {
				await sheets.spreadsheets.batchUpdate({
					spreadsheetId,
					resource: {
						requests: [{
							addSheet: {
								properties: { title: colName }
							}
						}]
					}
				});
			} else {
				// Rename first sheet to 'products'
				await sheets.spreadsheets.batchUpdate({
					spreadsheetId,
					resource: {
						requests: [{
							updateSheetProperties: {
								properties: { sheetId: 0, title: 'products' },
								fields: 'title'
							}
						}]
					}
				});
			}

			sheetUpdates.push({
				range: `${colName}!A1`,
				values: [headers, ...rows]
			});
		}

		// Write all data
		if (sheetUpdates.length > 0) {
			await sheets.spreadsheets.values.batchUpdate({
				spreadsheetId,
				resource: {
					data: sheetUpdates,
					valueInputOption: 'RAW'
				}
			});
		}

		// 8. Set Permissions (Anyone with link can view)
		await drive.permissions.create({
			fileId: spreadsheetId,
			resource: {
				role: 'reader',
				type: 'anyone',
			},
		});

		// 9. Increment Usage Count
		await usageRef.set({
			count: currentCount + 1,
			lastExportAt: admin.firestore.FieldValue.serverTimestamp(),
			lastExportBy: userEmail
		}, { merge: true });

		// 10. Audit Log
		await db.collection('audit_logs').add({
			action: 'Bộ lưu dữ liệu (Export)',
			user: userEmail,
			userId: userId,
			ownerId: companyId,
			details: `Đã xuất dữ liệu ra Google Sheets (Lần thứ ${currentCount + 1} trong tháng)`,
			createdAt: admin.firestore.FieldValue.serverTimestamp()
		});

		// 11. Return the link with /copy suffix
		return {
			status: 'success',
			exportUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/copy`,
			countRemaining: 5 - (currentCount + 1)
		};

	} catch (error) {
		console.error('Export Error:', error);
		throw new functions.https.HttpsError('internal', error.message || 'Internal Server Error');
	}
});
