import React, { useEffect } from 'react';
import { db, auth } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';

/**
 * SystemAlertManager
 * Background component that monitors Business Intelligence:
 * 1. Inventory Sales Velocity -> Low Stock warnings.
 * 2. Debt Aging -> Collection reminders (6-day threshold).
 * 3. Auto-sync to Google Sheets (Weekly, Monthly, Quarterly).
 */
const SystemAlertManager: React.FC = () => {
	const owner = useOwner();

	useEffect(() => {
		if (owner.loading || !owner.ownerId || !auth.currentUser) return;

		const runSystemChecks = async () => {
			await checkInventory();
			await checkDebts();
			// checkAutoSync is handled inside its own logic with internal notifications
			await checkAutoSync();
		};

		const checkInventory = async () => {
			const lastChecked = localStorage.getItem(`lastInvCheck_${owner.ownerId}`);
			const now = Date.now();
			if (lastChecked && now - parseInt(lastChecked) < 6 * 60 * 60 * 1000) return;

			try {
				const productSnap = await getDocs(query(
					collection(db, 'products'),
					where('ownerId', '==', owner.ownerId)
				));
				const products = productSnap.docs.map(d => ({ id: d.id, ...d.data() as any })).filter(p => p.status === 'Kinh doanh');

				const thirtyDaysAgo = new Date();
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

				const logSnap = await getDocs(query(
					collection(db, 'inventory_logs'),
					where('ownerId', '==', owner.ownerId)
				));
				const logs = logSnap.docs.map(d => d.data() as any).filter(log => {
					const createdDate = log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt);
					return log.type === 'out' && createdDate >= thirtyDaysAgo;
				});

				const salesMap = new Map<string, number>();
				logs.forEach((log: any) => {
					const current = salesMap.get(log.productId) || 0;
					salesMap.set(log.productId, current + (Number(log.qty) || 0));
				});

				for (const product of products as any[]) {
					const totalSold30Days = salesMap.get(product.id) || 0;
					const dailyVelocity = totalSold30Days / 30;
					const currentStock = Number(product.stock) || 0;

					if (dailyVelocity > 0) {
						const daysLeft = currentStock / dailyVelocity;
						if (daysLeft < 7) {
							await createNotificationIfNew('low_stock', product.id, product.name, daysLeft, dailyVelocity, product.unit, product.stock);
						}
					} else if (currentStock <= 5 && currentStock > 0) {
						await createNotificationIfNew('low_stock', product.id, product.name, -1, 0, product.unit, product.stock, true);
					}
				}
				localStorage.setItem(`lastInvCheck_${owner.ownerId}`, now.toString());
			} catch (error) {
				console.error("SystemAlertManager (Inventory) Error:", error);
			}
		};

		const checkDebts = async () => {
			const lastChecked = localStorage.getItem(`lastDebtCheck_${owner.ownerId}`);
			const now = Date.now();
			if (lastChecked && now - parseInt(lastChecked) < 12 * 60 * 60 * 1000) return;

			try {
				const orderSnap = await getDocs(query(
					collection(db, 'orders'),
					where('ownerId', '==', owner.ownerId)
				));
				const orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() as any })).filter(o => o.status === 'Đơn chốt');

				const paymentSnap = await getDocs(query(
					collection(db, 'payments'),
					where('ownerId', '==', owner.ownerId)
				));
				const payments = paymentSnap.docs.map(d => d.data());

				const balances = new Map<string, number>();
				orders.forEach((o: any) => {
					if (o.customerId) {
						balances.set(o.customerId, (balances.get(o.customerId) || 0) + (o.totalAmount || 0));
					}
				});
				payments.forEach((p: any) => {
					if (p.customerId) {
						balances.set(p.customerId, (balances.get(p.customerId) || 0) - (p.amount || 0));
					}
				});

				const threeDaysAgo = new Date();
				threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
				const compareDateStr = threeDaysAgo.toISOString().split('T')[0];

				for (const order of orders as any[]) {
					if (!order.customerId) continue;
					const customerDebt = balances.get(order.customerId) || 0;

					if (customerDebt > 10000) {
						const dateString = order.createdAt?.toDate ?
							order.createdAt.toDate().toISOString().split('T')[0] :
							(order.orderDate || '');

						if (dateString === compareDateStr) {
							await createNotificationIfNew('debt_warning', order.id, order.customerName, 3, 0, '', customerDebt);
						}
					}
				}
				localStorage.setItem(`lastDebtCheck_${owner.ownerId}`, now.toString());
			} catch (error) {
				console.error("SystemAlertManager (Debt) Error:", error);
			}
		};

		const checkAutoSync = async () => {
			try {
				const settingsRef = doc(db, 'settings', owner.ownerId);
				const settingsSnap = await getDoc(settingsRef);
				if (!settingsSnap.exists()) return;

				const settings = settingsSnap.data();
				const schedule = settings.autoSyncSchedule || 'none';
				if (schedule === 'none') return;

				const lastSyncAt = settings.lastSyncAt?.toDate?.() || (settings.lastSyncAt ? new Date(settings.lastSyncAt.seconds * 1000) : null);
				const now = new Date();

				let shouldSync = false;
				let rangeStart = new Date();
				let rangeEnd = new Date();

				if (schedule === 'weekly') {
					if (!lastSyncAt || (now.getTime() - lastSyncAt.getTime() > 7 * 24 * 60 * 60 * 1000)) {
						shouldSync = true;
						rangeStart.setDate(rangeStart.getDate() - 7);
					}
				} else if (schedule === 'monthly') {
					if (!lastSyncAt || now.getMonth() !== lastSyncAt.getMonth()) {
						if (now.getDate() >= 1) {
							shouldSync = true;
							rangeStart.setMonth(rangeStart.getMonth() - 1);
							rangeStart.setDate(1);
							rangeStart.setHours(0, 0, 0, 0);
							rangeEnd.setDate(0);
							rangeEnd.setHours(23, 59, 59, 999);
						}
					}
				} else if (schedule === 'quarterly') {
					const currentMonth = now.getMonth();
					const currentQuarter = Math.floor(currentMonth / 3);
					const lastSyncMonth = lastSyncAt ? lastSyncAt.getMonth() : -1;
					const lastSyncQuarter = lastSyncAt ? Math.floor(lastSyncMonth / 3) : -1;

					if (currentQuarter !== lastSyncQuarter) {
						shouldSync = true;
						const prevQuarter = (currentQuarter - 1 + 4) % 4;
						const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
						rangeStart = new Date(year, prevQuarter * 3, 1, 0, 0, 0, 0);
						rangeEnd = new Date(year, (prevQuarter + 1) * 3, 0, 23, 59, 59, 999);
					}
				}

				if (shouldSync && settings.spreadsheetId) {
					const [prodSnap, custSnap, orderSnap] = await Promise.all([
						getDocs(query(collection(db, 'products'), where('ownerId', '==', owner.ownerId))),
						getDocs(query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId))),
						getDocs(query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId)))
					]);

					const syncOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((o: any) => {
						if (!o.createdAt) return false;
						const createdDate = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
						return createdDate >= rangeStart && createdDate <= rangeEnd;
					});

					const orderDetails: any[] = [];
					syncOrders.forEach((order: any) => {
						if (Array.isArray(order.items)) {
							order.items.forEach((item: any) => {
								orderDetails.push({
									orderId: order.id,
									orderDate: order.orderDate,
									customerName: order.customerName,
									productName: item.name,
									qty: item.qty,
									price: item.price,
									unit: item.unit,
									total: (item.qty || 0) * (item.price || 0),
									category: item.category,
									packaging: item.packaging
								});
							});
						}
					});

					const dataToSync = {
						products: prodSnap.docs.map(d => ({ id: d.id, ...d.data() })),
						customers: custSnap.docs.map(d => ({ id: d.id, ...d.data() })),
						orders: syncOrders,
						orderDetails: orderDetails
					};

					const stats = syncOrders.reduce((acc: any, order: any) => {
						const email = order.createdByEmail || 'N/A';
						const name = order.createdByEmail?.split('@')[0] || 'Nhân viên';
						if (!acc[email]) acc[email] = { name, email, newCust: 0, orders: 0, revenue: 0 };
						acc[email].orders += 1;
						acc[email].revenue += (order.finalTotal || 0);
						return acc;
					}, {});

					custSnap.docs.forEach(d => {
						const c = d.data();
						if (!c.createdAt) return;
						const createdDate = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
						if (createdDate >= rangeStart && createdDate <= rangeEnd) {
							const email = c.createdByEmail || 'N/A';
							if (stats[email]) stats[email].newCust += 1;
						}
					});

					const response = await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
						method: 'POST',
						body: JSON.stringify({
							action: 'sync_to_sheets',
							ownerEmail: owner.ownerEmail,
							spreadsheetId: settings.spreadsheetId,
							data: dataToSync,
							syncRange: {
								start: rangeStart.toISOString().split('T')[0],
								end: rangeEnd.toISOString().split('T')[0]
							},
							stats: Object.values(stats)
						})
					});

					if (response.ok) {
						await updateDoc(settingsRef, {
							lastSyncAt: serverTimestamp()
						});

						const aiNotif = await generateAiNotification('auto_sync', { schedule });

						await addDoc(collection(db, 'notifications'), {
							userId: auth.currentUser?.uid,
							title: aiNotif?.title || '📊 Tự động đồng bộ',
							message: aiNotif?.body || `Dữ liệu đã được tự động đồng bộ vào Google Sheets theo lịch (${schedule}).`,
							body: aiNotif?.body || `Dữ liệu đã được tự động đồng bộ vào Google Sheets theo lịch (${schedule}).`,
							type: 'auto_sync',
							read: false,
							createdAt: serverTimestamp()
						});
					}
				}
			} catch (error) {
				console.error("SystemAlertManager (AutoSync) Error:", error);
			}
		};

		const generateAiNotification = async (type: string, details: any) => {
			const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
			if (!apiKey) return null;

			try {
				const response = await fetch("https://api.deepseek.com/chat/completions", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Authorization": `Bearer ${apiKey}`
					},
					body: JSON.stringify({
						model: "deepseek-chat",
						messages: [
							{
								role: "system",
								content: "Bạn là Nexus AI chuyên gia quản trị Dunvex Build. Hãy viết tiêu đề và nội dung thông báo hệ thống bằng NGÔN NGỮ TỰ NHIÊN, chuyên nghiệp nhưng thân thiện như một trợ lý thông minh. TRÌNH BÀY: Trả về JSON duy nhất với 2 trường 'title' và 'body'. KHÔNG dùng markdown. Ngôn ngữ: Tiếng Việt."
							},
							{
								role: "user",
								content: `Hãy viết thông báo cho loại: ${type}. Chi tiết sự kiện: ${JSON.stringify(details)}`
							}
						],
						response_format: { type: 'json_object' }
					})
				});

				const data = await response.json();
				return JSON.parse(data.choices[0].message.content);
			} catch (err) {
				return null;
			}
		};

		const createNotificationIfNew = async (type: 'low_stock' | 'debt_warning', refId: string, name: string, daysVal: number, velocity: number, unit: string, currentVal: number, isStatic = false) => {
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const existingSnap = await getDocs(query(
				collection(db, 'notifications'),
				where('userId', '==', auth.currentUser?.uid)
			));

			const isAlreadyAlertedToday = existingSnap.docs.some(d => {
				const data = d.data();
				if (data.type !== type) return false;
				if ((type === 'low_stock' ? data.productId : data.orderId) !== refId) return false;
				const created = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
				return created >= today;
			});

			if (!isAlreadyAlertedToday) {
				const aiNotif = await generateAiNotification(type, { name, daysVal, velocity, unit, currentVal, isStatic });

				let title = aiNotif?.title || (type === 'low_stock' ? '⚡ Cảnh báo hết kho' : '💰 Nhắc thu công nợ');
				let body = aiNotif?.body || "";

				if (!body) {
					if (type === 'low_stock') {
						if (isStatic) {
							body = `Sản phẩm ${name} đang ở mức báo động (${currentVal} ${unit}). Vui lòng nhập thêm hàng.`;
						} else {
							const daysStr = Math.ceil(daysVal) === 0 ? "hết ngay hôm nay" : `đủ dùng trong khoảng ${Math.ceil(daysVal)} ngày`;
							body = `Tốc độ bán (${velocity.toFixed(1)} ${unit}/ngày) cho thấy ${name} chỉ còn ${daysStr}. Hiện còn ${currentVal} ${unit}.`;
						}
					} else {
						body = `Đơn hàng của khách ${name} đã lên được 3 ngày. Tổng dư nợ hiện tại của khách là ${currentVal.toLocaleString('vi-VN')} đ. Đã đến lúc nhắc nợ!`;
					}
				}

				await addDoc(collection(db, 'notifications'), {
					userId: auth.currentUser?.uid,
					title,
					message: body,
					body: body,
					type,
					[type === 'low_stock' ? 'productId' : 'orderId']: refId,
					read: false,
					createdAt: serverTimestamp()
				});
			}
		};

		runSystemChecks();
	}, [owner.loading, owner.ownerId]);

	return null;
};

export default SystemAlertManager;
