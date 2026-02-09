import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import OrderTicket from '../components/OrderTicket';

const OrderList = () => {
	const navigate = useNavigate();
	const [orders, setOrders] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState('');
	const [showDetail, setShowDetail] = useState(false);
	const [selectedOrder, setSelectedOrder] = useState<any>(null);

	useEffect(() => {
		if (!auth.currentUser) return;

		const q = query(
			collection(db, 'orders'),
			where('createdBy', '==', auth.currentUser.uid)
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
	}, [auth.currentUser]);

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
		} catch (error) {
			console.error("Error updating status:", error);
			alert("Lỗi khi cập nhật trạng thái");
		}
	};

	const deleteOrder = async (id: string) => {
		if (window.confirm("Bạn có chắc chắn muốn xóa đơn hàng này?")) {
			try {
				await deleteDoc(doc(db, 'orders', id));
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
		<div className="flex h-screen w-full relative bg-slate-50 overflow-hidden font-['Inter']">
			{/* SIDEBAR - Desktop */}
			<aside className="hidden lg:flex flex-col bg-[#1A237E] text-white h-full w-64 flex-shrink-0 shadow-xl">
				<div className="h-16 flex items-center px-6 border-b border-white/10">
					<div className="size-8 bg-[#FF6D00] rounded-lg flex items-center justify-center shrink-0">
						<span className="material-symbols-outlined text-white text-xl">shopping_cart</span>
					</div>
					<h1 className="ml-3 font-bold text-lg tracking-wide uppercase">Dunvex <span className="text-[#FF6D00]">Build</span></h1>
				</div>
				<nav className="flex-1 py-4 px-2 space-y-1">
					<button onClick={() => navigate('/')} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors">
						<span className="material-symbols-outlined">dashboard</span>
						<span className="text-sm font-medium tracking-wide">Command Center</span>
					</button>
					<button onClick={() => navigate('/orders')} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#FF6D00] text-white shadow-lg shadow-[#FF6D00]/30 font-bold transition-all">
						<span className="material-symbols-outlined">shopping_cart</span>
						<span className="text-sm">Đơn Hàng</span>
					</button>
					<button onClick={() => navigate('/inventory')} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors">
						<span className="material-symbols-outlined">inventory_2</span>
						<span className="text-sm font-medium">Sản Phẩm</span>
					</button>
					<button onClick={() => navigate('/customers')} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors">
						<span className="material-symbols-outlined">group</span>
						<span className="text-sm font-medium tracking-wide">Khách Hàng</span>
					</button>
				</nav>
			</aside>

			<main className="flex-1 flex flex-col h-full overflow-hidden relative">
				{/* HEADER */}
				<header className="bg-white border-b border-gray-200 h-16 md:h-20 flex items-center justify-between px-4 md:px-8 shrink-0">
					<div className="flex items-center gap-4">
						<button onClick={() => navigate('/')} className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
							<span className="material-symbols-outlined">arrow_back</span>
						</button>
						<h2 className="text-lg md:text-2xl font-bold text-[#1A237E]">Danh Sách Đơn Hàng</h2>
					</div>
					<div className="flex items-center gap-4">
						<div className="hidden md:relative md:block">
							<span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400">search</span>
							<input
								type="text"
								placeholder="Tìm đơn hàng, khách..."
								className="pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#FF6D00]/30 w-64 transition-all"
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
				<div className="flex-1 overflow-y-auto p-4 md:p-8">
					{/* Stats Cards */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
						<StatCard icon="receipt_long" label="Tổng đơn" value={totalOrders.toString()} color="bg-blue-50 text-blue-600" />
						<StatCard icon="pending" label="Chờ xử lý" value={pendingOrders.toString()} color="bg-orange-50 text-orange-600" />
						<StatCard icon="check_circle" label="Hoàn tất" value={completedOrders.toString()} color="bg-green-50 text-green-600" />
						<StatCard icon="payments" label="Doanh thu" value={formatPrice(totalRevenue)} color="bg-purple-50 text-purple-600" />
					</div>

					{/* Desktop Table */}
					<div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
						<table className="w-full text-left">
							<thead>
								<tr className="bg-gray-50 border-b border-gray-100">
									<th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Đơn hàng</th>
									<th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Khách hàng</th>
									<th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Trạng thái</th>
									<th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Tổng tiền</th>
									<th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Hành động</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{loading ? (
									<tr><td colSpan={5} className="py-8 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
								) : filteredOrders.length === 0 ? (
									<tr><td colSpan={5} className="py-12 text-center">
										<div className="flex flex-col items-center gap-2">
											<span className="material-symbols-outlined text-4xl text-slate-200">inventory_2</span>
											<p className="text-slate-400 font-medium">Không tìm thấy đơn hàng nào</p>
										</div>
									</td></tr>
								) : filteredOrders.map((order) => (
									<tr key={order.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => { setSelectedOrder(order); setShowDetail(true); }}>
										<td className="py-4 px-6">
											<div className="font-bold text-[#1A237E]">#{order.id.slice(0, 8).toUpperCase()}</div>
											<div className="text-[10px] text-gray-400 font-bold">{new Date(order.createdAt?.seconds * 1000).toLocaleString('vi-VN')}</div>
										</td>
										<td className="py-4 px-6">
											<div className="flex items-center gap-3">
												<div className="size-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-[#1A237E]">
													{order.customerName?.[0] || 'K'}
												</div>
												<div>
													<div className="font-bold text-slate-700">{order.customerName || 'Khách vãng lai'}</div>
													<div className="text-[10px] text-gray-400">{order.customerPhone || '---'}</div>
												</div>
											</div>
										</td>
										<td className="py-4 px-6 text-center">
											<span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
												{order.status}
											</span>
										</td>
										<td className="py-4 px-6 text-right font-black text-[#1A237E]">
											{formatPrice(order.totalAmount || 0)}
										</td>
										<td className="py-4 px-6 text-right">
											<div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
												<button onClick={() => navigate(`/quick-order/${order.id}`)} className="p-2 text-slate-300 hover:text-orange-500 transition-colors">
													<span className="material-symbols-outlined text-[20px]">edit</span>
												</button>
												<button onClick={() => deleteOrder(order.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
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
							<div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-all" onClick={() => { setSelectedOrder(order); setShowDetail(true); }}>
								<div className="flex justify-between items-start mb-3">
									<div className="flex items-center gap-3">
										<div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center text-[#1A237E]">
											<span className="material-symbols-outlined">receipt_long</span>
										</div>
										<div>
											<div className="flex items-center gap-2">
												<button
													onClick={(e) => { e.stopPropagation(); navigate(`/quick-order/${order.id}`); }}
													className="p-2 text-slate-300 active:text-orange-500 transition-colors"
												>
													<span className="material-symbols-outlined text-[20px]">edit</span>
												</button>
												<div className="font-bold text-[#1A237E]">#{order.id.slice(0, 8).toUpperCase()}</div>
											</div>
											<div className="text-xs text-slate-500 font-medium">{order.customerName || 'Khách vãng lai'}</div>
										</div>
									</div>
									<span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${getStatusColor(order.status)}`}>
										{order.status}
									</span>
								</div>
								<div className="flex justify-between items-baseline pt-2 border-t border-gray-50">
									<span className="text-[10px] text-gray-400 font-medium">{new Date(order.createdAt?.seconds * 1000).toLocaleDateString('vi-VN')}</span>
									<span className="font-black text-[#FF6D00] text-lg">{formatPrice(order.totalAmount || 0)}</span>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Mobile Bottom Nav */}
				<div className="lg:hidden fixed bottom-6 left-4 right-4 bg-[#1A237E] rounded-3xl p-3 shadow-2xl flex justify-between items-center z-50">
					<NavButton icon="inventory_2" label="Kho" onClick={() => navigate('/inventory')} />
					<NavButton icon="shopping_cart" label="Đơn hàng" active />
					<button onClick={() => navigate('/quick-order')} className="size-14 bg-[#FF6D00] rounded-2xl shadow-lg flex items-center justify-center text-white relative -top-6 border-4 border-slate-50">
						<span className="material-symbols-outlined text-3xl">add</span>
					</button>
					<NavButton icon="group" label="Khách" onClick={() => navigate('/customers')} />
					<NavButton icon="dashboard" label="Center" onClick={() => navigate('/')} />
				</div>
			</main>

			{/* DETAIL MODAL (Ticket View) */}
			{showDetail && selectedOrder && (
				<OrderTicket
					order={selectedOrder}
					onClose={() => setShowDetail(false)}
				/>
			)}
		</div>
	);
};

const StatCard = ({ icon, label, value, color }: any) => (
	<div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
		<div className={`p-2 ${color} w-fit rounded-lg mb-2`}>
			<span className="material-symbols-outlined text-lg">{icon}</span>
		</div>
		<p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{label}</p>
		<h3 className="text-xl font-black text-[#1A237E] leading-none mt-1">{value}</h3>
	</div>
);

const NavButton = ({ icon, label, active, onClick }: any) => (
	<button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-[#FF6D00]' : 'text-white/50'}`}>
		<span className="material-symbols-outlined text-2xl" style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
		<span className="text-[9px] font-bold">{label}</span>
	</button>
);

export default OrderList;
