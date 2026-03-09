import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, updateDoc, doc, writeBatch, getDocs, limit, orderBy } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { useNavigationConfig } from '../hooks/useNavigationConfig';
import { Eye, EyeOff, TrendingUp, TrendingDown, AlertTriangle, Wallet, Gift } from 'lucide-react';

import { useOwner } from '../hooks/useOwner';
import QRScanner from '../components/shared/QRScanner';
import { QrCode } from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import { maskSensitiveData } from '../utils/validation';

const Home = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const isAdmin = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee;
	const { showToast } = useToast();
	const { sidebarItems } = useNavigationConfig();
	const [unreadCount, setUnreadCount] = useState(0);
	const [showNotifications, setShowNotifications] = useState(false);
	const [notifications, setNotifications] = useState<any[]>([]);

	// Real Data State
	const [orders, setOrders] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [payments, setPayments] = useState<any[]>([]);
	const [products, setProducts] = useState<any[]>([]);
	const [auditLogs, setAuditLogs] = useState<any[]>([]);
	const [showProfit, setShowProfit] = useState(false);
	const [chartFilter, setChartFilter] = useState('7days');
	const [showScanner, setShowScanner] = useState(false);

	useEffect(() => {
		if (!auth.currentUser || owner.loading || !owner.ownerId) return;

		const qNotif = query(
			collection(db, 'notifications'),
			where('userId', '==', auth.currentUser.uid)
		);

		const unsubscribeNotif = onSnapshot(qNotif, (snapshot) => {
			const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

			// Unread count (Client-side)
			const unread = list.filter((n: any) => !n.read).length;
			setUnreadCount(unread);

			// Sorted list (Client-side)
			const sorted = [...list].sort((a: any, b: any) => {
				const timeA = a.createdAt?.seconds || 0;
				const timeB = b.createdAt?.seconds || 0;
				return timeB - timeA;
			});
			setNotifications(sorted.slice(0, 20));
		});

		// 3. Fetch Data for Dashboard Calculations (Owner specific)
		const isAdmin = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee;

		let qOrders, qAudit, qCust, qPay;

		if (isAdmin) {
			qOrders = query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId));
			qAudit = query(collection(db, 'audit_logs'), where('ownerId', '==', owner.ownerId), limit(50));
			qCust = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
			qPay = query(collection(db, 'payments'), where('ownerId', '==', owner.ownerId));
		} else {
			// For employees, we still query by ownerId but filter by user email/id client-side 
			// to avoid needing composite indexes (Firestore requires indexes for multiple equality filters sometimes)
			qOrders = query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId));
			qAudit = query(collection(db, 'audit_logs'), where('ownerId', '==', owner.ownerId), limit(50));
			qCust = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
			qPay = query(collection(db, 'payments'), where('ownerId', '==', owner.ownerId));
		}

		// ... inside onSnapshot or effects, apply filtering if not admin
		const unsubAudit = onSnapshot(qAudit, (snap) => {
			const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			// Apply client-side filter for employees
			const filteredLogs = isAdmin ? logs : logs.filter((l: any) => l.userId === auth.currentUser?.uid);

			const sorted = filteredLogs.sort((a: any, b: any) => {
				const timeA = a.createdAt?.seconds || 0;
				const timeB = b.createdAt?.seconds || 0;
				return timeB - timeA;
			});
			setAuditLogs(sorted.slice(0, 10));
		}, (err) => console.error("Home: Audit Logs Error:", err));

		const qProd = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));

		const unsubOrders = onSnapshot(qOrders, (snap) => {
			const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			const filtered = isAdmin ? docs : docs.filter((o: any) => o.createdByEmail === auth.currentUser?.email);
			setOrders(filtered);
		}, (err: any) => console.error("Home: Orders Error:", err));

		const unsubCust = onSnapshot(qCust, (snap) => {
			const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			const filtered = isAdmin ? docs : docs.filter((c: any) => c.createdByEmail === auth.currentUser?.email);
			setCustomers(filtered);
		}, (err: any) => console.error("Home: Customers Error:", err));

		const unsubPay = onSnapshot(qPay, (snap) => {
			const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			const filtered = isAdmin ? docs : docs.filter((p: any) => p.createdByEmail === auth.currentUser?.email);
			setPayments(filtered);
		}, (err: any) => console.error("Home: Payments Error:", err));

		const unsubProd = onSnapshot(qProd, (snap) => {
			setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		}, (err: any) => console.error("Home: Products Error:", err));

		return () => {
			unsubscribeNotif();
			unsubOrders();
			unsubCust();
			unsubPay();
			unsubProd();
			unsubAudit();
		};
	}, [owner.loading, owner.ownerId, owner.role, owner.isEmployee]);

	const markAllAsRead = async () => {
		if (!auth.currentUser) return;
		const q = query(
			collection(db, 'notifications'),
			where('userId', '==', auth.currentUser.uid)
		);
		const snapshot = await getDocs(q);
		const batch = writeBatch(db);
		snapshot.docs.forEach((d) => {
			if (!d.data().read) {
				batch.update(d.ref, { read: true });
			}
		});
		await batch.commit();
	};

	const handleNotificationClick = async (notification: any) => {
		if (!notification.read) {
			await updateDoc(doc(db, 'notifications', notification.id), { read: true });
		}
	};

	const formatTimeAgo = (timestamp: any) => {
		if (!timestamp) return '';
		const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
		const now = new Date();
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (diffInSeconds < 60) return 'Vừa xong';
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
		return `${date.getDate()}/${date.getMonth() + 1}`;
	};

	const handleLogout = async () => {
		if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
			try {
				await signOut(auth);
				navigate('/login');
			} catch (error) {
				showToast("Lỗi khi đăng xuất", "error");
			}
		}
	};

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
	};

	const handleQRScan = (productId: string) => {
		// Just navigate to inventory with ID param, ProductList will handle opening detail
		navigate(`/inventory?id=${productId}`);
	};

	// --- CALCULATIONS ---

	// 1. Revenue & Profit Today
	const today = new Date().toISOString().split('T')[0];
	const todayOrders = orders.filter(o => {
		const d = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : o.orderDate;
		return d === today && o.status === 'Đơn chốt';
	});

	const revenueToday = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

	const profitToday = todayOrders.reduce((sum, o) => {
		const orderCost = (o.items || []).reduce((iSum: number, item: any) => {
			return iSum + ((Number(item.buyPrice) || 0) * (Number(item.qty) || 0));
		}, 0);
		// Minimal profit calc: Revenue - (Product Cost) - (Shipping Fee if covered by shop?)
		// Allowing simple logic: Profit = (Sell Price - Buy Price) * Qty - Discount. 
		// Assuming Adjustment is shipping fee collected, usually pass-through or income.
		// Let's stick to Gross Profit from Goods:
		const itemsProfit = (o.items || []).reduce((pSum: number, item: any) => {
			const sell = Number(item.price) || 0;
			const buy = Number(item.buyPrice) || 0;
			const qty = Number(item.qty) || 0;
			return pSum + ((sell - buy) * qty);
		}, 0);

		// Subtract Order Discount
		const finalProfit = itemsProfit - (o.discountValue || 0);
		return sum + finalProfit;
	}, 0);

	// 1.1 Revenue & Profit This Month
	const startOfMonth = new Date();
	startOfMonth.setDate(1);
	startOfMonth.setHours(0, 0, 0, 0);

	const thisMonthOrders = orders.filter(o => {
		const d = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date(o.orderDate);
		return d >= startOfMonth && o.status === 'Đơn chốt';
	});

	const revenueThisMonth = thisMonthOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
	const profitThisMonth = thisMonthOrders.reduce((sum, o) => {
		const itemsProfit = (o.items || []).reduce((pSum: number, item: any) => {
			const sell = Number(item.price) || 0;
			const buy = Number(item.buyPrice) || 0;
			const qty = Number(item.qty) || 0;
			return pSum + ((sell - buy) * qty);
		}, 0);
		return sum + (itemsProfit - (o.discountValue || 0));
	}, 0);

	// 1.2 Chart Data (Last 7 Days)
	const getChartData = () => {
		const data = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const dateStr = d.toISOString().split('T')[0];

			const dayRevenue = orders.filter(o => {
				const od = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : o.orderDate;
				return od === dateStr && o.status === 'Đơn chốt';
			}).reduce((s, o) => s + (o.totalAmount || 0), 0);

			data.push({
				label: i === 0 ? 'Hôm nay' : `${d.getDate()}/${d.getMonth() + 1}`,
				value: dayRevenue,
				isToday: i === 0
			});
		}
		return data;
	};

	const chartData = getChartData();
	const maxRevenue = Math.max(...chartData.map(d => d.value), 1000000);

	// 2. Debt Warnings
	// Calculate debt for each customer
	const debtList = customers.map(c => {
		const custOrders = orders.filter(o => o.customerId === c.id && o.status === 'Đơn chốt');
		const custPayments = payments.filter(p => p.customerId === c.id);
		const totalBuy = custOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
		const totalPay = custPayments.reduce((s, p) => s + (p.amount || 0), 0);
		const debt = totalBuy - totalPay;

		// Check last payment/order date for "Aging"
		// If debt > 0 and last transaction > 30 days
		return { ...c, debt };
	}).filter(c => c.debt > 0);

	const highRiskDebts = debtList.filter(c => c.debt > 50000000); // Example threshold 50M

	// 3. Stock Warnings
	const lowStockProducts = products.filter(p => p.stock !== undefined && p.stock <= 10); // Warning threshold

	// --- PERMISSION CHECK ---
	const hasDashboardAccess = owner.role === 'admin' || (owner.accessRights?.dashboard ?? true);

	if (owner.loading) return <DashboardSkeleton />;

	if (!hasDashboardAccess) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center text-center p-8 min-h-screen">
				<div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-full text-orange-500 mb-4">
					<span className="material-symbols-outlined text-5xl">lock</span>
				</div>
				<h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">Không có quyền truy cập</h2>
				<p className="text-slate-500 dark:text-slate-400 max-w-md">
					Bạn không có quyền xem bảng điều khiển tổng quan. Vui lòng liên hệ quản trị viên để cấp quyền `dashboard`.
				</p>
				<button
					onClick={() => navigate('/orders')}
					className="mt-6 bg-[#1A237E] text-white px-6 py-2 rounded-xl font-bold"
				>
					Đến trang Đơn hàng
				</button>
			</div>
		);
	}

	return (
		<div className="bg-[#f8f9fb] dark:bg-slate-950 transition-colors duration-300">
			{/* HEADER */}
			{/* HEADER - Hidden on Mobile to use MainLayout Header */}
			<header className="hidden md:flex h-16 md:h-20 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 items-center justify-between px-4 md:px-8 shrink-0 relative z-20 transition-colors duration-300">
				<h2 className="text-lg md:text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">Tổng Quan Hệ Thống</h2>
				<div className="flex items-center gap-4">
					{/* Global Scanner Button */}
					<button
						onClick={() => setShowScanner(true)}
						className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group flex items-center gap-2"
						title="Quét mã tra cứu"
					>
						<QrCode size={24} className="group-hover:scale-110 transition-transform" />
						<span className="hidden md:inline text-xs font-bold uppercase tracking-widest">Quét Mã</span>
					</button>

					{/* Notification Bell */}
					<div className="relative">
						<button
							onClick={() => setShowNotifications(!showNotifications)}
							className="p-2 relative text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group"
							title="Thông báo"
						>
							<span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">notifications</span>
							{unreadCount > 0 && (
								<span className="absolute top-2 right-2 size-4 bg-[#FF6D00] text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 animate-bounce">
									{unreadCount}
								</span>
							)}
						</button>

						{/* Notification Dropdown */}
						{showNotifications && (
							<>
								<div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)}></div>
								<div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
									<div className="p-4 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
										<h3 className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300 tracking-wider">Thông báo</h3>
										<button onClick={markAllAsRead} className="text-[10px] font-bold text-[#1A237E] dark:text-indigo-400 hover:underline cursor-pointer">
											Đánh dấu đã đọc tất cả
										</button>
									</div>
									<div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
										{notifications.length === 0 ? (
											<div className="p-8 text-center flex flex-col items-center">
												<span className="material-symbols-outlined text-4xl text-slate-200 dark:text-slate-700 mb-2">notifications_off</span>
												<p className="text-xs text-slate-400 font-medium">Không có thông báo nào</p>
											</div>
										) : (
											<div className="divide-y divide-slate-50 dark:divide-slate-800">
												{notifications.map((n) => (
													<div
														key={n.id}
														onClick={() => handleNotificationClick(n)}
														className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors flex gap-3 ${!n.read ? 'bg-blue-50/30 dark:bg-indigo-900/20' : ''}`}
													>
														<div className={`mt-1.5 size-2 rounded-full shrink-0 ${!n.read ? 'bg-[#FF6D00] ring-4 ring-orange-50 dark:ring-orange-900/20' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
														<div>
															<h4 className={`text-sm ${!n.read ? 'font-bold text-slate-800 dark:text-slate-200' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
																{n.title || 'Thông báo hệ thống'}
															</h4>
															<p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
																{n.message}
															</p>
															<p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
																{formatTimeAgo(n.createdAt)}
															</p>
														</div>
													</div>
												))}
											</div>
										)}
									</div>
									<div className="p-2 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 text-center">
										<button className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-[#1A237E] dark:hover:text-indigo-400">Xem tất cả</button>
									</div>
								</div>
							</>
						)}
					</div>

					<div className="h-8 w-px bg-slate-100 dark:bg-slate-800 mx-2"></div>

					<div
						onClick={() => navigate('/admin')}
						className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-xl transition-all group"
						title="Quản trị doanh nghiệp"
					>
						<div className="text-right hidden sm:block">
							<p className="text-xs font-black leading-none text-slate-900 dark:text-white group-hover:text-[#1A237E] dark:group-hover:text-indigo-400 transition-colors">
								{auth.currentUser?.displayName || 'Người dùng'}
							</p>
							<p className="text-[10px] text-slate-500 dark:text-slate-500 uppercase font-black tracking-widest mt-1 group-hover:text-[#FF6D00] transition-colors">
								{owner.loading ? '...' :
									owner.role === 'admin' ? 'Quản Trị Viên' :
										owner.role === 'sale' ? 'Nhân Viên Sale' :
											owner.role === 'warehouse' ? 'Thủ Kho' :
												owner.role === 'accountant' ? 'Kế Toán' : 'Nhân Viên'}
							</p>
						</div>
						<img
							alt="Profile"
							className="size-10 rounded-full object-cover border-2 border-[#1A237E]/10 dark:border-indigo-400/20 group-hover:border-[#1A237E] dark:group-hover:border-indigo-400 transition-colors"
							src={auth.currentUser?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100"}
						/>
					</div>
				</div>
			</header>

			<main className="p-4 md:p-8 max-w-[1600px] mx-auto pb-32">
				{/* Mobile Only Title */}
				<div className="md:hidden flex items-center justify-between mb-6">
					<div>
						<h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Tổng Quan</h2>
						<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Hệ thống DunvexBuild</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={() => setShowScanner(true)}
							className="size-11 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center text-[#FF6D00] active:scale-90 transition-transform"
						>
							<QrCode size={22} />
						</button>
					</div>
				</div>

				{/* PROMO BANNER */}
				<div
					onClick={() => navigate('/coupons')}
					className="mb-8 relative overflow-hidden bg-gradient-to-r from-[#1A237E] via-[#283593] to-[#1A237E] rounded-[2.5rem] p-6 md:p-10 shadow-xl shadow-indigo-500/10 cursor-pointer group active:scale-[0.99] transition-all"
				>
					<div className="absolute top-0 right-0 bottom-0 w-1/3 bg-gradient-to-l from-[#FF6D00]/20 to-transparent skew-x-12 translate-x-10 group-hover:translate-x-0 transition-transform duration-700"></div>
					<div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
						<div className="flex items-center gap-6">
							<div className="size-16 md:size-20 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center text-[#ffcc00] shadow-inner">
								<Gift size={36} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
							</div>
							<div>
								<h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-tight leading-none mb-2">Ưu đãi độc quyền</h2>
								<p className="text-white/60 text-xs md:text-sm font-medium max-w-md leading-relaxed">Khám phá danh sách mã giảm giá và khuyến mãi mới nhất dành riêng cho doanh nghiệp của bạn.</p>
							</div>
						</div>
						<button className="h-12 md:h-14 px-8 bg-[#ffcc00] text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-yellow-500/20">
							Xem Ưu Đãi
						</button>
					</div>
				</div>

				{/* Alerts Section */}
				<div className="mb-6 flex flex-col md:flex-row gap-4">
					{lowStockProducts.length > 0 && (
						<div className="flex-1 bg-white dark:bg-slate-900 border-l-4 border-[#FF6D00] p-4 rounded-r-xl shadow-sm flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg text-[#FF6D00]">
									<AlertTriangle size={24} />
								</div>
								<div>
									<h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Tồn kho thấp</h4>
									<p className="text-[11px] text-slate-500 font-bold">{lowStockProducts.length} mặt hàng</p>
								</div>
							</div>
							<button onClick={() => navigate('/products')} className="text-xs font-bold text-[#FF6D00] px-3 py-1 bg-orange-50 dark:bg-orange-900/20 rounded-lg">Xem</button>
						</div>
					)}
				</div>

				<div className="grid grid-cols-12 gap-6">
					{/* Revenue and Profit Card */}
					<div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
						<div className="bg-[#1A237E] text-white rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden group">
							<div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-[#FF6D00]/20 transition-all duration-700"></div>

							<div className="flex justify-between items-start mb-1">
								<p className="text-white/60 text-sm font-medium">Doanh thu hôm nay</p>
								<button onClick={() => setShowProfit(!showProfit)} className="text-white/40 hover:text-white transition-colors" title={showProfit ? "Ẩn lợi nhuận" : "Hiện lợi nhuận"}>
									{showProfit ? <EyeOff size={16} /> : <Eye size={16} />}
								</button>
							</div>

							<div className="flex items-baseline gap-2 mb-6">
								<h2 className="text-4xl font-black tracking-tighter">
									{(revenueToday / 1000000).toFixed(1)}M
								</h2>
								<span className="text-sm font-bold text-[#FF6D00]">VND</span>
							</div>

							{showProfit && (
								<div className="mb-6 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/5 animate-in fade-in slide-in-from-bottom-2">
									<p className="text-[10px] text-white/50 uppercase font-bold mb-1">Lợi nhuận ước tính</p>
									<div className="flex items-center gap-2">
										<p className="text-2xl font-black text-green-400">
											+{(profitToday / 1000000).toFixed(1)}M
										</p>
										{revenueToday > 0 && (
											<span className="text-[10px] font-bold bg-green-400/20 text-green-400 px-2 py-0.5 rounded">
												{((profitToday / revenueToday) * 100).toFixed(1)}%
											</span>
										)}
									</div>
								</div>
							)}

							<div className="flex gap-4">
								<div className="bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl flex-1 border border-white/5">
									<p className="text-[10px] text-white/50 uppercase font-bold">Đơn hàng</p>
									<p className="text-lg font-bold">{todayOrders.length}</p>
								</div>
								<div className="bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl flex-1 border border-white/5">
									<p className="text-[10px] text-white/50 uppercase font-bold">Tăng trưởng</p>
									<p className="text-lg font-bold text-green-400 flex items-center gap-1">
										<TrendingUp size={14} /> 12%
									</p>
								</div>
							</div>
						</div>

						{/* Shortcuts */}
						<div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
							<h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
								Phím tắt nhanh
								<span className="material-symbols-outlined text-slate-300">apps</span>
							</h3>
							<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
								{sidebarItems
									.filter(item => item.path !== '/')
									.map((item) => (
										<button
											key={item.path}
											onClick={() => navigate(item.path)}
											className="aspect-square bg-slate-50 dark:bg-slate-800/50 hover:bg-[#1A237E] dark:hover:bg-indigo-600 hover:text-white transition-all rounded-3xl flex flex-col items-center justify-center gap-2 group p-2 border border-slate-100 dark:border-slate-800"
										>
											<div className="p-3 bg-white dark:bg-slate-900 rounded-full text-[#1A237E] dark:text-indigo-400 group-hover:bg-[#FF6D00] group-hover:text-white shadow-sm transition-colors">
												<span className="material-symbols-outlined">{item.icon}</span>
											</div>
											<span className="text-[11px] font-bold text-center leading-tight dark:text-slate-300 group-hover:text-white">{item.label}</span>
										</button>
									))}
							</div>
						</div>
					</div>

					{/* Chart and Recent Activity */}
					<div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
						{/* Simplified Chart (Visual Only) */}
						<div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 flex-1">
							<div className="flex justify-between items-center mb-8">
								<div>
									<h3 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-tight">Biểu đồ tăng trưởng</h3>
									<p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Doanh thu 7 ngày gần nhất</p>
								</div>
								<div className="flex items-center gap-2">
									<div className="size-3 rounded-full bg-[#FF6D00]"></div>
									<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hôm nay</span>
								</div>
							</div>
							<div className="h-48 w-full flex items-end justify-between gap-2 lg:gap-4 px-2">
								{chartData.map((day, i) => (
									<div key={i} className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-t-xl relative group" style={{ height: `${Math.max((day.value / maxRevenue) * 100, 5)}%` }}>
										<div className={`absolute bottom-0 w-full rounded-t-xl transition-all ${day.isToday ? 'bg-[#FF6D00] shadow-lg shadow-orange-500/20' : 'bg-[#1A237E] opacity-20 group-hover:opacity-40'}`} style={{ height: '100%' }}></div>
										<div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1.5 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-10 pointer-events-none">
											{day.label}: {formatPrice(day.value)}
										</div>
										<div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-400 uppercase truncate w-full text-center">
											{day.label}
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Recent Activity List */}
						<div className="bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
							<div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
								<h3 className="font-bold text-slate-900 dark:text-white">Hoạt động mới nhất</h3>
								<button onClick={() => navigate('/admin?tab=audit')} className="text-xs font-bold text-[#1A237E] dark:text-indigo-400 flex items-center gap-1">Xem tất cả <span className="material-symbols-outlined text-xs">arrow_forward</span></button>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left font-['Inter']">
									<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-500 dark:text-slate-500 tracking-widest">
										<tr>
											<th className="px-6 py-4">Nhân viên / Khách</th>
											<th className="px-6 py-4 hidden md:table-cell">Nội dung</th>
											<th className="px-6 py-4">Giá trị</th>
											<th className="px-6 py-4 text-right">Thời gian</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
										{auditLogs.length === 0 ? (
											<tr>
												<td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-xs font-medium">Chưa có hoạt động nào được ghi nhận</td>
											</tr>
										) : auditLogs.slice(0, 5).map((log) => (
											<ActivityRow
												key={log.id}
												icon={log.user?.[0] || 'NV'}
												color="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300"
												name={log.user}
												task={maskSensitiveData(log.action, isAdmin)}
												value={maskSensitiveData(log.details, isAdmin)}
												time={log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '...'}
											/>
										))}
									</tbody>
								</table>
							</div>
						</div>

						{/* Profit Report */}
						<div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-200 dark:border-slate-800">
							<div className="flex justify-between items-start mb-6">
								<div>
									<h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight uppercase tracking-tight">Lợi Nhuận Gộp (Ước Tính)</h3>
									<p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Tự động tính dựa trên giá nhập & giá bán</p>
								</div>
								<div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
									<TrendingUp size={14} /> +8.5%
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
									<p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mb-1.5">Hôm nay</p>
									<p className="text-xl font-black text-slate-800 dark:text-white tracking-tighter">
										{formatPrice(profitToday)}
									</p>
								</div>
								<div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
									<p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mb-1.5">Tháng này</p>
									<p className="text-xl font-black text-slate-800 dark:text-white tracking-tighter">
										{formatPrice(profitThisMonth)}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>

			{showScanner && (
				<QRScanner
					onScan={handleQRScan}
					onClose={() => setShowScanner(false)}
					title="Tra cứu sản phẩm"
				/>
			)}
		</div>
	);
};

const ActivityRow = ({ icon, color, name, task, value, time }: any) => (
	<tr className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
		<td className="px-6 py-4">
			<div className="flex items-center gap-3">
				<div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center font-black text-[10px] shadow-sm`}>{icon}</div>
				<span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{name}</span>
			</div>
		</td>
		<td className="px-6 py-4 hidden md:table-cell">
			<span className="text-sm text-slate-600 dark:text-slate-400 font-bold">{task}</span>
		</td>
		<td className="px-6 py-4">
			<span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{value}</span>
		</td>
		<td className="px-6 py-4 text-right">
			<span className="text-[10px] text-slate-500 dark:text-slate-500 font-black uppercase tracking-tighter">{time}</span>
		</td>
	</tr>
);


const DashboardSkeleton = () => (
	<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 p-4 md:p-8 space-y-8 animate-pulse transition-colors duration-300">
		<div className="max-w-[1400px] mx-auto">
			{/* Header Skeleton */}
			<div className="flex justify-between items-center mb-10">
				<div className="flex items-center gap-4">
					<div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 skeleton" />
					<div>
						<div className="w-48 h-6 skeleton mb-2" />
						<div className="w-32 h-4 skeleton opacity-50" />
					</div>
				</div>
				<div className="flex gap-3">
					<div className="w-10 h-10 rounded-full skeleton" />
					<div className="w-10 h-10 rounded-full skeleton" />
				</div>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
				{[1, 2, 3, 4].map(i => (
					<div key={i} className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 shadow-sm border border-slate-100 dark:border-slate-800">
						<div className="w-10 h-10 rounded-2xl skeleton mb-5" />
						<div className="w-24 h-3 skeleton mb-3 opacity-50" />
						<div className="w-32 h-8 skeleton" />
					</div>
				))}
			</div>

			{/* Middle Row */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				<div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-800">
					<div className="flex justify-between mb-10">
						<div className="w-64 h-8 skeleton" />
						<div className="w-32 h-10 rounded-xl skeleton" />
					</div>
					<div className="w-full h-80 skeleton rounded-[2rem] opacity-30" />
				</div>
				<div className="space-y-6">
					<div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-800">
						<div className="w-40 h-6 skeleton mb-8" />
						<div className="space-y-4">
							{[1, 2, 3, 4, 5].map(i => (
								<div key={i} className="flex items-center gap-4">
									<div className="w-10 h-10 rounded-full skeleton shrink-0" />
									<div className="flex-1 space-y-2">
										<div className="w-3/4 h-3 skeleton" />
										<div className="w-1/2 h-2 skeleton opacity-50" />
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
);

export default Home;
