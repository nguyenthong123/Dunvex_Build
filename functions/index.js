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

const { onDocumentWritten } = require("firebase-functions/v2/firestore");

/**
 * Cloud Function to sync user ownerId and role to Custom Claims.
 * This runs automatically when a user document is created or updated.
 */
exports.syncUserClaims = onDocumentWritten('users/{userId}', async (event) => {
	const userId = event.params.userId;
	const userDoc = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;

	if (!userDoc) {
		return null;
	}

	const claims = {
		ownerId: userDoc.ownerId || userDoc.uid || null,
		role: userDoc.role || null
	};

	try {
		await admin.auth().setCustomUserClaims(userId, claims);
		console.log(`Custom claims set for ${userId}:`, claims);
	} catch (error) {
		console.error(`Error setting custom claims for ${userId}:`, error);
	}

	return null;
});

const { onSchedule } = require("firebase-functions/v2/scheduler");

/**
 * Autonomous AI Manager Bot
 * Runs every hour to check bank transfers, provision users, and lock expired accounts.
 */
exports.nexusAutonomousBot = onSchedule("every 1 hours", async (event) => {
	console.log("Nexus Autonomous Bot: Starting cycle...");
	const now = new Date();

	// 1. Check Bank Transfers & AI Fuzzy Matching
	try {
		const pendingReqsSnap = await db.collection('payment_requests').where('status', '==', 'pending').get();
		if (!pendingReqsSnap.empty) {
			const pendingRequests = pendingReqsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
			
			const appscriptUrl = 'https://script.google.com/macros/s/AKfycbwu682rk8EZl4__DKtw-LgRLjozSvUk5Jj9QFQvvZnT5NLrUwdRn8a-1tfJ5oU5XIAABQ/exec';
			const res = await fetch(`${appscriptUrl}?token=dunvex-nexus-2026&action=get_transactions`);
			
			if (res.ok) {
				const data = await res.json();
				if (data.data && Array.isArray(data.data)) {
					// Filter incoming money only
					const incomingTxs = data.data.filter(t => t['Phát sinh']?.startsWith('+')).slice(0, 50); // Last 50 incoming
					
					// Initialize Gemini
					const { GoogleGenerativeAI } = require("@google/generative-ai");
					const genAI = new GoogleGenerativeAI("AIzaSyD4T4RU6J3g_DeakZrWb7kSS82SKYJRVic");
					const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
					
					const prompt = `You are an AI Accountant. 
Match the following pending Payment Requests with the Incoming Bank Transactions.
A match occurs when the transaction amount closely or exactly matches the payment request amount, AND the transaction description contains the user's email, name, transfer code, or plan ID.
Respond ONLY with a valid JSON object in this exact format:
{
	"matches": [
		{
			"requestId": "the ID of the matched payment_request",
			"transactionId": "the ID of the matched bank transaction",
			"reason": "Short explanation in Vietnamese of why it matches"
		}
	]
}
If no matches are found, return { "matches": [] }.

Pending Payment Requests:
${JSON.stringify(pendingRequests.map(r => ({ id: r.id, email: r.ownerEmail, amount: r.amount, planId: r.planId, transferCode: r.transferCode })), null, 2)}

Incoming Bank Transactions:
${JSON.stringify(incomingTxs.map(t => ({ id: t['Transaction ID'], date: t['Ngày'], amount: t['Phát sinh'], description: t['Nội dung'] })), null, 2)}
`;

					const result = await model.generateContent(prompt);
					let text = result.response.text();
					text = text.replace(/```json/g, '').replace(/```/g, '').trim();
					const aiResponse = JSON.parse(text);

					if (aiResponse.matches && aiResponse.matches.length > 0) {
						for (const match of aiResponse.matches) {
							const reqDoc = pendingReqsSnap.docs.find(d => d.id === match.requestId);
							if (!reqDoc) continue;
							
							const request = reqDoc.data();
							console.log('Nexus AI: Auto-approving matched payment for', request.ownerEmail, 'Reason:', match.reason);
							
							// Approve
							await reqDoc.ref.update({
								status: 'approved',
								handledAt: admin.firestore.FieldValue.serverTimestamp(),
								handledBy: 'nexus-ai-bot',
								aiMatchReason: match.reason,
								matchedTransactionId: match.transactionId
							});

							const planId = request.planId;
							if (planId && planId.startsWith('addon_export')) {
								const currentMonth = new Date().toISOString().slice(0, 7);
								await db.collection('usage_limits').doc(`${request.ownerId}_${currentMonth}`).set({
									extraExportLimit: admin.firestore.FieldValue.increment(5)
								}, { merge: true });
							} else if (planId === 'addon_ai_assistant') {
								await db.collection('settings').doc(request.ownerId).set({
									hasAIAssistant: true
								}, { merge: true });
							} else {
								let durMonths = 1;
								let durDays = 0;
								try {
									const planSnap = await db.collection('subscription_packages').doc(request.planId).get();
									if (planSnap.exists) {
										if (planSnap.data().durationMonths) {
											durMonths = Number(planSnap.data().durationMonths);
										} else if (planSnap.data().durationDays) {
											durDays = Number(planSnap.data().durationDays);
											durMonths = 0;
										}
									}
								} catch (e) {}

								const sDoc = await db.collection('settings').doc(request.ownerId).get();
								const currentExpire = sDoc.exists && sDoc.data().subscriptionExpiresAt ? sDoc.data().subscriptionExpiresAt.toDate() : new Date();
								const newExpire = new Date(Math.max(now.getTime(), currentExpire.getTime()));
								if (durMonths > 0) {
									newExpire.setMonth(newExpire.getMonth() + durMonths);
								} else if (durDays > 0) {
									newExpire.setDate(newExpire.getDate() + durDays);
								}

								await db.collection('settings').doc(request.ownerId).set({
									subscriptionStatus: 'active',
									isPro: true,
									planId: request.planId,
									paymentConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
									subscriptionExpiresAt: admin.firestore.Timestamp.fromDate(newExpire),
									manualLockOrders: false,
									manualLockDebts: false,
									manualLockSheets: false,
									manualLockAi: false
								}, { merge: true });
							}

							// Notify
							await db.collection('notifications').add({
								userId: request.ownerId,
								title: '✨ GIA HẠN THÀNH CÔNG',
								body: `Hệ thống Nexus Bot đã nhận được thanh toán. Gói ${request.planName || request.planId} đã được kích hoạt.`,
								type: 'success',
								priority: 'high',
								read: false,
								createdAt: admin.firestore.FieldValue.serverTimestamp()
							});
						}
					}
				}
			}
		}
	} catch (e) {
		console.error("Bank check error:", e);
	}

	// 2. Fetch Users and Settings
	const usersSnap = await db.collection('users').get();
	const settingsSnap = await db.collection('settings').get();
	const settingsMap = {};
	settingsSnap.docs.forEach(d => settingsMap[d.id] = d.data());

	const owners = usersSnap.docs
		.map(d => ({ id: d.id, ...d.data(), uid: d.data().uid || d.id }))
		.filter(u => u.uid === u.ownerId || !u.ownerId);

	// Fetch Trial Package duration
	let trialDays = 60;
	try {
		const pkgSnap = await db.collection('subscription_packages').where('price', '==', 0).limit(1).get();
		if (!pkgSnap.empty) {
			trialDays = Number(pkgSnap.docs[0].data().durationDays) || 60;
		}
	} catch (e) {}

	const parseDate = (val) => {
		if (!val) return null;
		if (val.toDate) return val.toDate();
		if (val.seconds) return new Date(val.seconds * 1000);
		if (val instanceof Date) return val;
		if (typeof val === 'string') return new Date(val);
		return null;
	};

	for (const u of owners) {
		if (u.email === 'dunvex.green@gmail.com') continue; // Skip master admin
		const s = settingsMap[u.uid] || {};
		const customer = {
			uid: u.uid,
			createdAt: u.createdAt || null,
			paymentConfirmedAt: s.paymentConfirmedAt || null,
			planId: s.planId || null,
			isPro: s.isPro || false,
			subscriptionExpiresAt: s.subscriptionExpiresAt || null,
			manualLockOrders: s.manualLockOrders || false,
			manualLockDebts: s.manualLockDebts || false,
			manualLockSheets: s.manualLockSheets || false,
			manualLockAi: s.manualLockAi || false,
			isAiProcessed: s.isAiProcessed || false,
			graceUntil: s.graceUntil || null,
			aiLockedAt: s.aiLockedAt || null
		};

		// 3. Provision new users
		if (!customer.planId && !customer.isAiProcessed) {
			let trialDays = 60;
			try {
				const pkgSnap = await db.collection('subscription_packages').where('price', '==', 0).limit(1).get();
				if (!pkgSnap.empty) {
					trialDays = Number(pkgSnap.docs[0].data().durationDays) || 60;
				}
			} catch (e) {}
			const expireDate = new Date();
			expireDate.setDate(expireDate.getDate() + trialDays);
			await db.collection('settings').doc(customer.uid).set({
				planId: 'free_trial',
				isPro: false,
				subscriptionStatus: 'trial',
				subscriptionExpiresAt: admin.firestore.Timestamp.fromDate(expireDate),
				graceUntil: null,
				isAiProcessed: true
			}, { merge: true });
			continue;
		}

		const parseDate = (val) => {
			if (!val) return null;
			if (val.toDate) return val.toDate();
			if (val.seconds) return new Date(val.seconds * 1000);
			if (val instanceof Date) return val;
			if (typeof val === 'string') return new Date(val);
			return null;
		};

		// Calculate Effective Status
		const joinedAt = parseDate(customer.paymentConfirmedAt) || parseDate(customer.createdAt);
		const expireAt = parseDate(customer.subscriptionExpiresAt);
		let effectiveExpireAt = expireAt;
		if (!effectiveExpireAt && joinedAt) {
			const planId = customer.planId || (customer.isPro ? 'premium_monthly' : 'free');
			const pkg = packages.find(p => p.id === planId);
			effectiveExpireAt = new Date(joinedAt.getTime());
			
			if (pkg) {
				if (pkg.durationMonths) {
					effectiveExpireAt.setMonth(effectiveExpireAt.getMonth() + Number(pkg.durationMonths));
				} else if (pkg.durationDays) {
					effectiveExpireAt.setDate(effectiveExpireAt.getDate() + Number(pkg.durationDays));
				} else {
					effectiveExpireAt.setMonth(effectiveExpireAt.getMonth() + 1);
				}
			} else {
				if (planId === 'free') {
					effectiveExpireAt.setMonth(effectiveExpireAt.getMonth() + 2); // 2 months
				} else if (planId === 'premium_monthly') {
					effectiveExpireAt.setMonth(effectiveExpireAt.getMonth() + 1); // 1 month
				} else {
					effectiveExpireAt.setFullYear(effectiveExpireAt.getFullYear() + 1); // 1 year
				}
			}
		}
		const isExpired = effectiveExpireAt ? effectiveExpireAt < now : false;

		// 4. Grace Period and Locks
		if (isExpired) {
			const graceUntil = parseDate(customer.graceUntil);
			if (!graceUntil && effectiveExpireAt) {
				const graceEnd = new Date(effectiveExpireAt.getTime());
				graceEnd.setDate(graceEnd.getDate() + 3);
				if (now < graceEnd) {
					await db.collection('settings').doc(customer.uid).set({
						graceUntil: admin.firestore.Timestamp.fromDate(graceEnd),
						subscriptionStatus: 'grace'
					}, { merge: true });
					await db.collection('notifications').add({
						userId: customer.uid,
						title: '⚠️ GÓI ĐÃ HẾT HẠN — 3 NGÀY ÂN HẠN',
						body: `Gói đã hết hạn. Bạn có 3 ngày (đến ${graceEnd.toLocaleDateString('vi-VN')}) để gia hạn trước khi bị khoá.`,
						type: 'warning',
						priority: 'high',
						read: false,
						createdAt: admin.firestore.FieldValue.serverTimestamp()
					});
					continue;
				}
			}

			if (graceUntil && now >= graceUntil) {
				if (!customer.manualLockOrders || !customer.manualLockDebts || !customer.manualLockSheets || !customer.manualLockAi) {
					await db.collection('settings').doc(customer.uid).set({
						manualLockOrders: true,
						manualLockDebts: true,
						manualLockSheets: true,
						manualLockAi: true,
						subscriptionStatus: 'expired',
						isPro: false,
						graceUntil: null
					}, { merge: true });
					await db.collection('notifications').add({
						userId: customer.uid,
						title: '🔒 TÍNH NĂNG ĐÃ BỊ KHOÁ',
						body: 'Gói đã hết hạn. Vui lòng gia hạn để tiếp tục.',
						type: 'lock',
						priority: 'high',
						read: false,
						createdAt: admin.firestore.FieldValue.serverTimestamp()
					});
				}
			}
		}

		// 5. Auto-unlock after 30 min (Anomaly locked)
		if (customer.manualLockAi && customer.aiLockedAt) {
			const lockedAt = parseDate(customer.aiLockedAt);
			if (lockedAt && (now.getTime() - lockedAt.getTime()) > 30 * 60 * 1000) {
				await db.collection('settings').doc(customer.uid).set({
					manualLockOrders: false,
					manualLockDebts: false,
					manualLockSheets: false,
					manualLockAi: false,
					aiLockedAt: null,
					aiLockReason: null
				}, { merge: true });
				await db.collection('notifications').add({
					userId: customer.uid,
					title: '🔓 TỰ ĐỘNG MỞ KHOÁ',
					body: 'Hệ thống đã tự mở khoá sau 30 phút.',
					type: 'unlock',
					read: false,
					createdAt: admin.firestore.FieldValue.serverTimestamp()
				});
			}
		}
	}

	console.log("Nexus Autonomous Bot: Cycle completed.");
});
