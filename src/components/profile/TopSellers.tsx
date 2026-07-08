import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { Trophy, Medal, TrendingUp, Loader2 } from 'lucide-react';

interface TopSellersProps {
	ownerId: string;
}

interface SellerStat {
	email: string;
	displayName: string;
	totalRevenue: number;
	orderCount: number;
}

const TopSellers: React.FC<TopSellersProps> = ({ ownerId }) => {
	const [sellers, setSellers] = useState<SellerStat[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!ownerId) { setLoading(false); return; }
		loadData();
	}, [ownerId]);

	const loadData = async () => {
		try {
			setLoading(true);

			// Lấy đầu tháng và cuối tháng hiện tại (GMT+7)
			const now = new Date();
			const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Saigon' }));
			const monthStart = new Date(vnNow.getFullYear(), vnNow.getMonth(), 1);
			const monthEnd = new Date(vnNow.getFullYear(), vnNow.getMonth() + 1, 0, 23, 59, 59, 999);

			// Query orders tháng này, status Đơn chốt
			const ordersRef = collection(db, 'orders');
			const q = query(
				ordersRef,
				where('ownerId', '==', ownerId),
				where('status', '==', 'Đơn chốt'),
				where('createdAt', '>=', Timestamp.fromDate(monthStart)),
				where('createdAt', '<=', Timestamp.fromDate(monthEnd))
			);

			const snap = await getDocs(q);

			// Gom nhóm theo email + uid
			const revenueMap: Record<string, { total: number; count: number; uid: string }> = {};
			snap.forEach(doc => {
				const data = doc.data();
				const email = (data.createdByEmail || '').toLowerCase().trim();
				const uid = (data.createdBy || '').trim();
				const key = email || uid || 'unknown';
				const amount = Number(data.totalAmount) || 0;
				if (!revenueMap[key]) {
					revenueMap[key] = { total: 0, count: 0, uid };
				}
				revenueMap[key].total += amount;
				revenueMap[key].count += 1;
				if (!revenueMap[key].uid && uid) revenueMap[key].uid = uid;
			});

			// Lấy displayName từ profiles (dùng uid làm key)
			const nameMap: Record<string, string> = {};
			const uidToKey: Record<string, string> = {};
			for (const [key, stat] of Object.entries(revenueMap)) {
				if (stat.uid) uidToKey[stat.uid] = key;
			}
			await Promise.all(
				Object.entries(uidToKey).map(async ([uid, key]) => {
					try {
						const profileSnap = await getDoc(doc(db, 'profiles', uid));
						if (profileSnap.exists()) {
							nameMap[key] = profileSnap.data().displayName || key.split('@')[0];
						}
					} catch {}
				})
			);

			// Build kết quả
			const result: SellerStat[] = Object.entries(revenueMap).map(([email, stat]) => ({
				email,
				displayName: nameMap[email] || email.split('@')[0],
				totalRevenue: stat.total,
				orderCount: stat.count,
			}));

			// Sắp xếp giảm dần theo doanh thu, lấy top 10
			result.sort((a, b) => b.totalRevenue - a.totalRevenue);
			setSellers(result.slice(0, 10));
		} catch (e) {
			console.error('TopSellers load error:', e);
		} finally {
			setLoading(false);
		}
	};

	const maxRevenue = sellers.length > 0 ? sellers[0].totalRevenue : 1;

	const getMedal = (rank: number) => {
		if (rank === 0) return <Trophy className="w-4 h-4 text-yellow-500" />;
		if (rank === 1) return <Medal className="w-4 h-4 text-slate-400" />;
		if (rank === 2) return <Medal className="w-4 h-4 text-amber-600" />;
		return <span className="w-4 h-4 flex items-center justify-center text-[10px] font-bold text-slate-400">{rank + 1}</span>;
	};

	const monthLabel = new Date().toLocaleString('vi-VN', { month: 'long', year: 'numeric' });

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="w-5 h-5 animate-spin text-slate-400" />
			</div>
		);
	}

	if (sellers.length === 0) {
		return (
			<div className="text-center py-8">
				<TrendingUp className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
				<p className="text-sm text-slate-500">Chưa có dữ liệu doanh thu tháng {monthLabel}</p>
			</div>
		);
	}

	return (
		<div>
			<div className="flex items-center gap-2 mb-4">
				<Trophy className="w-4 h-4 text-amber-500" />
				<h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
					Top 10 Nhân viên bán hàng — {monthLabel}
				</h3>
			</div>

			<div className="space-y-1.5">
				{sellers.map((seller, idx) => {
					const pct = maxRevenue > 0 ? (seller.totalRevenue / maxRevenue) * 100 : 0;
					return (
						<div
							key={seller.email}
							className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
								idx === 0
									? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
									: 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
							}`}
						>
							{/* Rank */}
							<div className="w-6 flex-shrink-0 flex justify-center">
								{getMedal(idx)}
							</div>

							{/* Info */}
							<div className="flex-1 min-w-0">
								<div className="flex items-center justify-between">
									<span className={`text-sm font-semibold truncate ${
										idx === 0 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'
									}`}>
										{seller.displayName}
									</span>
									<span className={`text-sm font-bold ml-2 ${
										idx === 0 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400'
									}`}>
										{seller.totalRevenue.toLocaleString('vi-VN')} đ
									</span>
								</div>

								{/* Progress bar */}
								<div className="mt-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
									<div
										className={`h-full rounded-full transition-all duration-500 ${
											idx === 0
												? 'bg-gradient-to-r from-amber-400 to-yellow-500'
												: idx === 1
												? 'bg-gradient-to-r from-slate-400 to-slate-500'
												: idx === 2
												? 'bg-gradient-to-r from-amber-600 to-orange-600'
												: 'bg-gradient-to-r from-indigo-400 to-indigo-600'
										}`}
										style={{ width: `${pct}%` }}
									/>
								</div>

								{/* Order count */}
								<div className="flex items-center gap-1 mt-0.5">
									<span className="text-[10px] text-slate-400">
										{seller.orderCount} đơn
									</span>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default TopSellers;
