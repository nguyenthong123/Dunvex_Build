import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc, serverTimestamp, where, addDoc } from 'firebase/firestore';
import OrderTicket from '../components/OrderTicket';
import UpgradeModal from '../components/UpgradeModal';

import { useOwner } from '../hooks/useOwner';

const OrderList = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const [orders, setOrders] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState('');
	const [showDetail, setShowDetail] = useState(false);
	const [selectedOrder, setSelectedOrder] = useState<any>(null);

	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		const q = query(
			collection(db, 'orders'),
			where('ownerId', '==', owner.ownerId)
		);
		const unsubscribe = onSnapshot(q, (snapshot: any) => {
			const docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
			const sortedDocs = [...docs].sort((a, b) => {
				const dateA = a.createdAt?.seconds || 0;
				const dateB = b.createdAt?.seconds || 0;
				return dateB - dateA;
			});
			setOrders(sortedDocs);
			setLoading(false);
		});
		return unsubscribe;
	}, [owner.loading, owner.ownerId]);

	const filteredOrders = orders.filter(order =>
		(order.customerName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
		(order.id?.toLowerCase().includes(searchTerm.toLowerCase())) ||
		(order.customerPhone?.includes(searchTerm))
	);

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'Mới': return 'bg-blue-50 text-blue-600';
			case 'Đang xử lý': return 'bg-orange-50 text-orange-600';
			case 'Đã giao': return 'bg-green-50 text-green-600';
			case 'Đã hủy': return 'bg-red-50 text-red-600';
			default: return 'bg-gray-50 text-gray-600';
		}
	};

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
	};

	const updateStatus = async (id: string, newStatus: string) => {
		try {
			await updateDoc(doc(db, 'orders', id), {
				status: newStatus,
				updatedAt: serverTimestamp()
			});

			// Log Status Update
			const order = orders.find(o => o.id === id);
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Cập nhật trạng thái đơn',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã đổi đơn hàng của ${order?.customerName || 'Khách'} sang: ${newStatus}`,
				createdAt: serverTimestamp()
			});
		} catch (error) {
			console.error("Error updating status:", error);
			alert("Lỗi khi cập nhật trạng thái");
		}
	};

	const deleteOrder = async (id: string) => {
		if (window.confirm("Bạn có chắc chắn muốn xóa đơn hàng này?")) {
			try {
				const order = orders.find(o => o.id === id);
				await deleteDoc(doc(db, 'orders', id));

				// Log Delete Order
				await addDoc(collection(db, 'audit_logs'), {
					action: 'Xóa đơn hàng',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					userId: auth.currentUser?.uid,
					ownerId: owner.ownerId,
					details: `Đã xóa đơn hàng của ${order?.customerName || 'Khách'} - Trị giá: ${formatPrice(order?.totalAmount || 0)}`,
					createdAt: serverTimestamp()
				});

				setShowDetail(false);
			} catch (error) {
				console.error("Error deleting order:", error);
				alert("Lỗi khi xóa đơn hàng");
			}
		}
	};

	// Stats
	const totalOrders = orders.length;
	const pendingOrders = orders.filter(o => o.status === 'Mới' || o.status === 'Đang xử lý').length;
	const completedOrders = orders.filter(o => o.status === 'Đã giao').length;
	const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

	return (
		<div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 transition-colors duration-300">
			<header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 h-16 md:h-20 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300">
				<div className="flex items-center gap-3">
					<button
						onClick={() => navigate('/')}
						className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-[#1A237E] dark:hover:text-indigo-400 transition-all group"
						title="Về Trang Chủ"
					>
						<span className="material-symbols-outlined text-xl group-hover:rotate-[-45deg] transition-transform">home</span>
					</button>
					<div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
					<h2 className="text-lg md:text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">Đơn Hàng</h2>
				</div>
				<div className="flex items-center gap-4">
					<div className="hidden md:relative md:block">
						<span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">search</span>
						<input
							type="text"
							placeholder="Tìm đơn hàng, khách..."
							className="pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-transparent rounded-xl text-sm font-black focus:ring-2 focus:ring-[#FF6D00]/30 w-64 transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-500"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>
					<button
						onClick={() => navigate('/quick-order')}
						className="bg-[#FF6D00] hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
					>
						<span className="material-symbols-outlined">add_shopping_cart</span>
						<span className="hidden sm:inline">Lên đơn nhanh</span>
					</button>
				</div>
			</header>

			{/* CONTENT */}
			<div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
				{/* Stats Cards */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
					<StatCard icon="receipt_long" label="Tổng đơn" value={totalOrders.toString()} color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" />
					<StatCard icon="pending" label="Chờ xử lý" value={pendingOrders.toString()} color="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" />
					<StatCard icon="check_circle" label="Hoàn tất" value={completedOrders.toString()} color="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" />
					<StatCard icon="payments" label="Doanh thu" value={formatPrice(totalRevenue)} color="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" />
				</div>

				{/* Desktop Table */}
				<div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
					<table className="w-full text-left">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em]">Đơn hàng</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em]">Khách hàng</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em] text-center">Trạng thái</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em] text-right">Tổng tiền</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em] text-right">Hành động</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 dark:divide-slate-800">
							{loading ? (
								<tr><td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500">Đang tải dữ liệu...</td></tr>
							) : filteredOrders.length === 0 ? (
								<tr><td colSpan={5} className="py-12 text-center">
									<div className="flex flex-col items-center gap-2">
										<span className="material-symbols-outlined text-4xl text-slate-200 dark:text-slate-700">inventory_2</span>
										<p className="text-slate-400 dark:text-slate-500 font-medium">Không tìm thấy đơn hàng nào</p>
									</div>
								</td></tr>
							) : filteredOrders.map((order) => (
								<tr key={order.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => { setSelectedOrder(order); setShowDetail(true); }}>
									<td className="py-4 px-6">
										<div className="font-black text-slate-900 dark:text-indigo-400">#{order.id.slice(0, 8).toUpperCase()}</div>
										<div className="text-[10px] text-slate-500 dark:text-slate-500 font-black uppercase tracking-tighter">{new Date(order.createdAt?.seconds * 1000).toLocaleString('vi-VN')}</div>
									</td>
									<td className="py-4 px-6">
										<div className="flex items-center gap-3">
											<div className="size-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-black text-xs text-slate-700 dark:text-indigo-400 border border-slate-300 dark:border-slate-700">
												{order.customerName?.[0] || 'K'}
											</div>
											<div>
												<div className="font-black text-slate-800 dark:text-slate-200">{order.customerName || 'Khách vãng lai'}</div>
												<div className="text-[10px] text-slate-500 dark:text-slate-500 font-bold">{order.customerPhone || '---'}</div>
											</div>
										</div>
									</td>
									<td className="py-4 px-6 text-center">
										<span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
											{order.status}
										</span>
									</td>
									<td className="py-4 px-6 text-right font-black text-slate-900 dark:text-indigo-400">
										{formatPrice(order.totalAmount || 0)}
									</td>
									<td className="py-4 px-6 text-right">
										<div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
											<button onClick={() => navigate(`/quick-order/${order.id}`)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-orange-500 dark:hover:text-orange-400 transition-colors">
												<span className="material-symbols-outlined text-[20px]">edit</span>
											</button>
											<button onClick={() => deleteOrder(order.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
												<span className="material-symbols-outlined text-[20px]">delete</span>
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Mobile List */}
				<div className="md:hidden space-y-4 pb-24">
					{filteredOrders.map((order) => (
						<div key={order.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800 active:scale-[0.98] transition-all" onClick={() => { setSelectedOrder(order); setShowDetail(true); }}>
							<div className="flex justify-between items-start mb-3">
								<div className="flex items-center gap-3">
									<div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#1A237E] dark:text-indigo-400">
										<span className="material-symbols-outlined">receipt_long</span>
									</div>
									<div>
										<div className="flex items-center gap-2">
											<button
												onClick={(e) => { e.stopPropagation(); navigate(`/quick-order/${order.id}`); }}
												className="p-2 text-slate-300 dark:text-slate-600 active:text-orange-500 dark:active:text-orange-400 transition-colors"
											>
												<span className="material-symbols-outlined text-[20px]">edit</span>
											</button>
											<div className="font-bold text-[#1A237E] dark:text-indigo-400">#{order.id.slice(0, 8).toUpperCase()}</div>
										</div>
										<div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{order.customerName || 'Khách vãng lai'}</div>
									</div>
								</div>
								<span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${getStatusColor(order.status)}`}>
									{order.status}
								</span>
							</div>
							<div className="flex justify-between items-baseline pt-2 border-t border-gray-50 dark:border-slate-800">
								<span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">{new Date(order.createdAt?.seconds * 1000).toLocaleDateString('vi-VN')}</span>
								<span className="font-black text-[#FF6D00] text-lg">{formatPrice(order.totalAmount || 0)}</span>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* DETAIL MODAL (Ticket View) */}
			{showDetail && selectedOrder && (
				(owner.isPro || !owner.systemConfig.lock_free_orders) && !owner.manualLockOrders ? (
					<OrderTicket
						order={selectedOrder}
						onClose={() => setShowDetail(false)}
					/>
				) : (
					<UpgradeModal
						onClose={() => setShowDetail(false)}
						featureName="Phiếu chi tiết đơn hàng"
					/>
				)
			)}
		</div>
	);
};

const StatCard = ({ icon, label, value, color }: any) => (
	<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
		<div className={`p-2 ${color} w-fit rounded-lg mb-2`}>
			<span className="material-symbols-outlined text-lg">{icon}</span>
		</div>
		<p className="text-slate-500 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">{label}</p>
		<h3 className="text-xl font-black text-slate-900 dark:text-indigo-400 leading-none mt-1">{value}</h3>
	</div>
);

export default OrderList;
