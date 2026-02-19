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
			await checkAutoSync();
		};

		const checkInventory = async () => {
			const lastChecked = localStorage.getItem(`lastInvCheck_${owner.ownerId}`);
			const now = Date.now();
			if (lastChecked && now - parseInt(lastChecked) < 6 * 60 * 60 * 1000) return;

			try {
				const productSnap = await getDocs(query(
					collection(db, 'products'),
					where('ownerId', '==', owner.ownerId),
					where('status', '==', 'Kinh doanh')
				));
				const products = productSnap.docs.map(d => ({ id: d.id, ...d.data() }));

				const thirtyDaysAgo = new Date();
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

				const logSnap = await getDocs(query(
					collection(db, 'inventory_logs'),
					where('ownerId', '==', owner.ownerId),
					where('type', '==', 'out'),
					where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
				));
				const logs = logSnap.docs.map(d => d.data());

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
					where('ownerId', '==', owner.ownerId),
					where('status', '==', 'Đơn chốt')
				));
				const orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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

				const sixDaysAgo = new Date();
				sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
				const compareDateStr = sixDaysAgo.toISOString().split('T')[0];

				for (const order of orders as any[]) {
					if (!order.customerId) continue;
					const customerDebt = balances.get(order.customerId) || 0;

					if (customerDebt > 10000) {
						const dateString = order.createdAt?.toDate ?
							order.createdAt.toDate().toISOString().split('T')[0] :
							(order.orderDate || '');

						if (dateString === compareDateStr) {
							await createNotificationIfNew('debt_warning', order.id, order.customerName, 6, 0, '', customerDebt);
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

					const response = await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
						method: 'POST',
						body: JSON.stringify({
							action: 'sync_to_sheets',
							ownerEmail: owner.ownerEmail,
							spreadsheetId: settings.spreadsheetId,
							data: dataToSync
						})
					});

					if (response.ok) {
						await updateDoc(settingsRef, {
							lastSyncAt: serverTimestamp()
						});

						await addDoc(collection(db, 'notifications'), {
							userId: auth.currentUser?.uid,
							title: '📊 Tự động đồng bộ',
							message: `Dữ liệu đã được tự động đồng bộ vào Google Sheets theo lịch (${schedule}).`,
							body: `Dữ liệu đã được tự động đồng bộ vào Google Sheets theo lịch (${schedule}).`,
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

		const createNotificationIfNew = async (type: 'low_stock' | 'debt_warning', refId: string, name: string, daysVal: number, velocity: number, unit: string, currentVal: number, isStatic = false) => {
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const existingSnap = await getDocs(query(
				collection(db, 'notifications'),
				where('userId', '==', auth.currentUser?.uid),
				where('type', '==', type),
				where(type === 'low_stock' ? 'productId' : 'orderId', '==', refId),
				where('createdAt', '>=', Timestamp.fromDate(today))
			));

			if (existingSnap.empty) {
				let title = "";
				let body = "";

				if (type === 'low_stock') {
					title = '⚡ Cảnh báo hết kho';
					if (isStatic) {
						body = `Sản phẩm ${name} đang ở mức báo động (${currentVal} ${unit}). Vui lòng nhập thêm hàng.`;
					} else {
						const daysStr = Math.ceil(daysVal) === 0 ? "hết ngay hôm nay" : `đủ dùng trong khoảng ${Math.ceil(daysVal)} ngày`;
						body = `Tốc độ bán (${velocity.toFixed(1)} ${unit}/ngày) cho thấy ${name} chỉ còn ${daysStr}. Hiện còn ${currentVal} ${unit}.`;
					}
				} else {
					title = '💰 Nhắc thu công nợ';
					body = `Đơn hàng của khách ${name} đã lên được 6 ngày. Tổng dư nợ hiện tại của khách là ${currentVal.toLocaleString('vi-VN')} đ. Đã đến lúc nhắc nợ!`;
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
