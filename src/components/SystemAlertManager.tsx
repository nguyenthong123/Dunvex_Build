import React, { useEffect } from 'react';
import { db, auth } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';

/**
 * SystemAlertManager
 * Background component that monitors Business Intelligence:
 * 1. Inventory Sales Velocity -> Low Stock warnings.
 * 2. Debt Aging -> Collection reminders (6-day threshold).
 */
const SystemAlertManager: React.FC = () => {
	const owner = useOwner();

	useEffect(() => {
		if (owner.loading || !owner.ownerId || !auth.currentUser) return;

		const runSystemChecks = async () => {
			await checkInventory();
			await checkDebts();
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
				// Fetch confirmed orders (Đơn chốt)
				const orderSnap = await getDocs(query(
					collection(db, 'orders'),
					where('ownerId', '==', owner.ownerId),
					where('status', '==', 'Đơn chốt')
				));
				const orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));

				// Fetch all payments
				const paymentSnap = await getDocs(query(
					collection(db, 'payments'),
					where('ownerId', '==', owner.ownerId)
				));
				const payments = paymentSnap.docs.map(d => d.data());

				// Calculate balances per customer
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

				// Check for orders reaching the 6-day threshold
				const sixDaysAgo = new Date();
				sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
				const compareDateStr = sixDaysAgo.toISOString().split('T')[0];

				for (const order of orders as any[]) {
					if (!order.customerId) continue;
					const customerDebt = balances.get(order.customerId) || 0;

					if (customerDebt > 10000) { // Only alert if debt > 10k VND
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
