import { useNavigate } from 'react-router-dom';
import { shouldExcludeFromProfit } from '../utils/profitUtils';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where } from '../services/firebase';
import { useNavigationConfig } from '../hooks/useNavigationConfig';
import { Eye, EyeOff, TrendingUp, TrendingDown, AlertTriangle, Wallet, Gift, Trophy, User as UserIcon } from 'lucide-react';

import { useOwner } from '../hooks/useOwner';
// 🔧 REFACTOR: Dùng hooks mới thay vì Firestore trực tiếp
import { useProducts } from '../hooks/useProducts';
import { useOrders } from '../hooks/useOrders';
import { useCustomers } from '../hooks/useCustomers';
import { usePayments } from '../hooks/usePayments';
import QRScanner from '../components/shared/QRScanner';
import { QrCode } from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import TopSellers from '../components/profile/TopSellers';
import { DashboardSkeleton } from '../components/shared/UISkeleton';

const Home = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const isAdmin = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee;
	const { showToast } = useToast();
	const { sidebarItems } = useNavigationConfig();

	// 🔧 REFACTOR: Data từ hooks tập trung — KHÔNG còn Firestore queries rải rác
	const { products, loading: productsLoading } = useProducts({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
	});
	const { orders } = useOrders({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
		maxResults: 500,
	});
	const { customers } = useCustomers({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
	});
	const { payments } = usePayments({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
		maxResults: 500,
	});

	const [showProfit, setShowProfit] = useState(false);
	const [chartFilter, setChartFilter] = useState('7days');
	const [showScanner, setShowScanner] = useState(false);

	// ─── FIX: Fetch tất cả đơn chốt (không limit 500) để tính tổng doanh số chính xác ───
	const [allTimeStats, setAllTimeStats] = useState({ revenue: 0, count: 0, loading: true });

	useEffect(() => {
		if (!owner.ownerId) return;
		const fetchAll = async () => {
			try {
				const q = query(
					collection(db, 'orders'),
					where('ownerId', '==', owner.ownerId),
					where('status', '==', 'Đơn chốt')
				);
				const snap = await getDocs(q);
				const userEmail = auth.currentUser?.email || '';
				let total = 0;
				let count = 0;
				snap.forEach(doc => {
					const data = doc.data();
					if (data.createdByEmail === userEmail) {
						total += Number(data.totalAmount) || 0;
						count++;
					}
				});
				setAllTimeStats({ revenue: total, count, loading: false });
			} catch (e) {
				console.error('Failed to fetch all orders:', e);
				setAllTimeStats(prev => ({ ...prev, loading: false }));
			}
		};
		fetchAll();
	}, [owner.ownerId]);

	// Format tiền rút gọn cho số lớn
	const formatCompactPrice = (price: number) => {
		if (price >= 1_000_000_000) return (price / 1_000_000_000).toFixed(1).replace('.0', '') + ' Tỷ';
		if (price >= 1_000_000) return (price / 1_000_000).toFixed(1).replace('.0', '') + ' Triệu';
		return price.toLocaleString('vi-VN') + 'đ';
	};

	// 🔧 REFACTOR: useEffect Firestore queries đã chuyển vào hooks — xoá 65 dòng code
	// Các hook useProducts/useOrders/useCustomers/usePayments
	// tự động subscribe/unsubscribe realtime qua dataAccess layer

	// --- Removed redundant notification handlers ---

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
		const d = o.orderDate || (o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : '');
		return d === today && o.status === 'Đơn chốt';
	});

	const revenueToday = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

	const profitToday = todayOrders.reduce((sum, o) => {
		const itemsProfit = (o.items || []).reduce((pSum: number, item: any) => {
			const sell = Number(item.price) || 0;
			const currentProd = products.find(p => p.id === (item.productId || item.id));
			// 🔧 Bỏ qua sản phẩm đặc thù không tính lợi nhuận (thợ ứng tiền, ứng tiền, ...)
			if (shouldExcludeFromProfit(currentProd?.name || '', currentProd?.excludeProfit)) return pSum;
			const activeBuyPrice = (Number(item.buyPrice) || 0) > 0 ? Number(item.buyPrice) : (currentProd ? (Number(currentProd.priceImport) || 0) : 0);
			const qty = Number(item.qty) || 0;
			return pSum + ((sell - activeBuyPrice) * qty);
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
		const d = o.orderDate ? new Date(o.orderDate) : (o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date());
		return d >= startOfMonth && o.status === 'Đơn chốt';
	});

	const revenueThisMonth = thisMonthOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
	const profitThisMonth = thisMonthOrders.reduce((sum, o) => {
		const itemsProfit = (o.items || []).reduce((pSum: number, item: any) => {
			const sell = Number(item.price) || 0;
			const currentProd = products.find(p => p.id === (item.productId || item.id));
			// 🔧 Bỏ qua sản phẩm đặc thù không tính lợi nhuận (thợ ứng tiền, ứng tiền, ...)
			if (shouldExcludeFromProfit(currentProd?.name || '', currentProd?.excludeProfit)) return pSum;
			const activeBuyPrice = (Number(item.buyPrice) || 0) > 0 ? Number(item.buyPrice) : (currentProd ? (Number(currentProd.priceImport) || 0) : 0);
			const qty = Number(item.qty) || 0;
			return pSum + ((sell - activeBuyPrice) * qty);
		}, 0);
		return sum + (itemsProfit - (o.discountValue || 0));
	}, 0);

	// 1.2 Chart Data (Daily Sales Trend for the last 7 days - Global/Admin or Local/Sale)
	const getDailyChartData = (targetOrders: any[]) => {
		const data = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const dateStr = d.toISOString().split('T')[0];

			const dayRevenue = targetOrders.filter(o => {
				const od = o.orderDate || (o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : '');
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

	const chartData = getDailyChartData(orders);
	const maxRevenue = Math.max(...chartData.map(d => d.value), 1000000);

	// Calculate Today's Growth (comparison with yesterday)
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	const yesterdayStr = yesterday.toISOString().split('T')[0];
	const revenueYesterday = orders.filter(o => {
		const od = o.orderDate || (o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : '');
		return od === yesterdayStr && o.status === 'Đơn chốt';
	}).reduce((s, o) => s + (o.totalAmount || 0), 0);

	const growthPct = revenueYesterday === 0 ? 100 : Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100);

	// 1.5 Company Performance — doanh số theo ngày trong tháng
	const companyDailySales = useMemo(() => {
		const now = new Date();
		const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
		const today = now.getDate();
		const data = [];
		let runningTotal = 0;

		for (let d = 1; d <= today; d++) {
			const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			const dayRevenue = thisMonthOrders.filter(o => {
				const od = o.orderDate || (o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : '');
				return od === dateStr && o.status === 'Đơn chốt';
			}).reduce((s, o) => s + (o.totalAmount || 0), 0);
			runningTotal += dayRevenue;
			data.push({ label: `${d}/${now.getMonth() + 1}`, value: dayRevenue, cumulative: runningTotal, isToday: d === today });
		}
		return data;
	}, [thisMonthOrders]);
	const maxDailyRevenue = Math.max(...companyDailySales.map(d => d.value), 1000000);
	const maxCumulative = Math.max(...companyDailySales.map(d => d.cumulative), 1000000);

	// Trend line points (SVG)
	const trendPoints = useMemo(() => {
		if (companyDailySales.length < 2) return '';
		const w = 100; // percentage width
		const h = 100;
		const points = companyDailySales.map((d, i) => {
			const x = (i / (companyDailySales.length - 1)) * w;
			const y = h - ((d.value / maxDailyRevenue) * h);
			return `${x},${y}`;
		});
		return points.join(' ');
	}, [companyDailySales, maxDailyRevenue]);

	// 1.4 Recent Customer Sales Data (Display 6 customers with most recent 'Đơn chốt' orders)
	const getOrderTime = (o: any) => {
		if (o.createdAt?.seconds) return o.createdAt.seconds;
		// Fallback for very new orders (optimistic UI) where serverTimestamp is still null
		return o.orderDate ? new Date(o.orderDate).getTime() / 1000 : (o.createdAt?.seconds || 0);
	};

	const recentClosedOrders = [...orders]
		.filter(o => o.status === 'Đơn chốt')
		.sort((a, b) => getOrderTime(b) - getOrderTime(a));

	// Group by customer to find the 6 most recent unique customers
	const uniqueRecentCustomers: { id: string | null, name: string, time: number }[] = [];
	const seenCustomers = new Set<string>();

	for (const o of recentClosedOrders) {
		const customerId = o.customerId || null;
		const customerName = o.customerBusinessName || o.customerName || 'Khách lẻ';
		// We group by ID if available, otherwise by name
		const groupKey = customerId ? `id:${customerId}` : `name:${customerName}`;

		if (!seenCustomers.has(groupKey)) {
			seenCustomers.add(groupKey);
			uniqueRecentCustomers.push({
				id: customerId,
				name: customerName,
				time: getOrderTime(o)
			});
		}
		if (uniqueRecentCustomers.length >= 6) break;
	}

	const customerSalesData = uniqueRecentCustomers.map(cust => {
		const totalSales = orders
			.filter(o => o.status === 'Đơn chốt' && (
				(cust.id && o.customerId === cust.id) ||
				(!cust.id && (o.customerBusinessName || o.customerName || 'Khách lẻ') === cust.name)
			))
			.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

		return {
			label: cust.name,
			value: totalSales
		};
	});

	const maxCustRevenue = Math.max(...customerSalesData.map(d => d.value), 1);

	// 2. Stock Warnings
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

				{/* 🏆 TOP 10 NHÂN VIÊN BÁN HÀNG THÁNG */}
				<div className="mb-8 bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
					<TopSellers ownerId={owner.ownerId || ''} />
				</div>

				{/* 🏆 BẢNG DOANH SỐ NHÂN VIÊN HÔM NAY */}
				<StaffLeaderboard orders={orders} todayStr={today} formatPrice={formatPrice} />

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
							<button onClick={() => navigate('/inventory?filter=low_stock')} className="text-xs font-bold text-[#FF6D00] px-3 py-1 bg-orange-50 dark:bg-orange-900/20 rounded-lg">Xem</button>
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
									<p className={`text-lg font-bold flex items-center gap-1 ${growthPct >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
										{growthPct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
										{growthPct}%
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
						<div className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 lg:p-8 shadow-sm border border-slate-200 dark:border-slate-800 flex-1">
							<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 lg:mb-8 gap-4">
								<div>
									<h3 className="font-black text-base lg:text-lg text-slate-900 dark:text-white uppercase tracking-tight leading-tight">Doanh số khách hàng gần nhất</h3>
									<p className="text-[10px] lg:text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">6 đối tác lên đơn chốt gần đây</p>
								</div>
								<div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-700">
									<div className="size-2.5 rounded-full bg-[#1A237E] shadow-[0_0_8px_rgba(26,35,126,0.3)]"></div>
									<span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tổng doanh số</span>
								</div>
							</div>

							{/* Universal Horizontal Bars View - Better for readability on all devices */}
							<div className="flex flex-col gap-4 lg:gap-6 py-2">
								{customerSalesData.length > 0 ? customerSalesData.map((cust, i) => (
									<div key={i} className="flex flex-col gap-2 group">
										<div className="flex justify-between items-end px-1">
											<span className="text-[10px] lg:text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight truncate max-w-[70%] lg:max-w-[80%]">
												{cust.label}
											</span>
											<span className="text-[10px] lg:text-xs font-black text-[#1A237E] dark:text-indigo-400">
												{formatPrice(cust.value)}
											</span>
										</div>
										<div className="h-4 lg:h-5 w-full bg-slate-50 dark:bg-slate-800/50 rounded-full overflow-hidden p-0.5 border border-slate-100 dark:border-slate-800">
											<div 
												className="h-full rounded-full bg-gradient-to-r from-[#1A237E]/40 to-[#1A237E] dark:from-indigo-600/40 dark:to-indigo-500 shadow-sm transition-all duration-1000 ease-out group-hover:shadow-[0_0_15px_rgba(26,35,126,0.3)]"
												style={{ width: `${Math.max((cust.value / maxCustRevenue) * 100, 5)}%` }}
											></div>
										</div>
									</div>
								)) : (
									<div className="w-full h-32 flex items-center justify-center text-slate-400 text-[10px] lg:text-xs font-bold uppercase tracking-widest">
										Chưa có dữ liệu đơn chốt
									</div>
								)}
							</div>
						</div>

																																				{/* Company Performance — Doanh số theo ngày + trend + axes */}
				<div className="bg-white dark:bg-slate-900 rounded-[2rem] p-4 lg:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
					<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 lg:mb-6 gap-3">
						<div>
							<h3 className="font-black text-sm lg:text-lg text-slate-900 dark:text-white uppercase tracking-tight leading-tight">🏢 Doanh số toàn công ty</h3>
							<p className="text-[9px] lg:text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Cột ngày + đường xu hướng — tháng này</p>
						</div>
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-1">
								<div className="size-1.5 rounded-full bg-[#FF6D00]"></div>
								<span className="text-[7px] lg:text-[8px] font-bold text-slate-400 uppercase">Doanh số</span>
							</div>
							<div className="flex items-center gap-1">
								<svg width="12" height="2"><line x1="0" y1="1" x2="12" y2="1" stroke="#1A237E" strokeWidth="1" strokeDasharray="2,2"/></svg>
								<span className="text-[7px] lg:text-[8px] font-bold text-slate-400 uppercase">Xu hướng</span>
							</div>
						</div>
					</div>

					{companyDailySales.length > 0 ? (
						<div className="flex">
							{/* Trục Y */}
							<div className="flex flex-col justify-between items-end pr-1.5 lg:pr-2 pb-3 lg:pb-4 h-24 lg:h-40 shrink-0">
								<span className="text-[7px] lg:text-[8px] text-slate-400 font-bold leading-none">{formatPrice(maxDailyRevenue)}</span>
								<span className="text-[7px] lg:text-[8px] text-slate-400 font-bold leading-none">{formatPrice(maxDailyRevenue / 2)}</span>
								<span className="text-[7px] lg:text-[8px] text-slate-400 font-bold leading-none">0</span>
							</div>
							{/* Chart area — scroll ngang trên mobile */}
							<div className="flex-1 relative overflow-x-auto">
								<div style={{ minWidth: companyDailySales.length * 18 + 'px' }} className="lg:min-w-0">
									{/* Grid ngang */}
									<div className="absolute inset-0 h-24 lg:h-40 flex flex-col justify-between pointer-events-none">
										<div className="border-t border-slate-100 dark:border-slate-800/50"></div>
										<div className="border-t border-slate-100 dark:border-slate-800/50"></div>
										<div className="border-t border-slate-200 dark:border-slate-700"></div>
									</div>
									{/* Bars */}
									<div className="flex items-end h-24 lg:h-40 relative z-10">
										{companyDailySales.map((day, i) => (
											<div key={i} className="flex-1 flex flex-col items-center justify-end group cursor-pointer" style={{ height: '100%', minWidth: '14px' }}>
												{/* Tooltip — hidden on mobile, hover on desktop */}
												<div className="hidden lg:block text-[9px] font-black text-[#FF6D00] dark:text-orange-400 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
													{day.value > 0 ? formatPrice(day.value) : ''}
												</div>
												<div
													className={`w-[85%] rounded-t-[2px] transition-all duration-500 ${
														day.isToday 
															? 'bg-gradient-to-t from-[#FF6D00] to-[#FF6D00]/70 shadow-[0_0_6px_rgba(255,109,0,0.3)]'
															: 'bg-[#1A237E]/30 dark:bg-indigo-500/30'
													}`}
													style={{ height: `${Math.max((day.value / maxDailyRevenue) * 100, 1)}%` }}
												></div>
											</div>
										))}
									</div>
									{/* X-axis labels — mobile: mỗi ~7 ngày, desktop: mỗi 5 ngày */}
									<div className="flex mt-0.5 lg:mt-1">
										{companyDailySales.map((day, i) => (
											<div key={i} className="flex-1 text-center" style={{ minWidth: '14px' }}>
												<span className="text-[6px] lg:text-[7px] text-slate-400 font-bold whitespace-nowrap">
													{(() => {
														const step = typeof window !== 'undefined' && window.innerWidth < 768 ? 7 : 5;
														return (i % step === 0 || i === companyDailySales.length - 1) ? day.label : '';
													})()}
												</span>
											</div>
										))}
									</div>
									{/* Trend line */}
									{trendPoints && (
										<svg className="absolute top-0 left-0 w-full h-24 lg:h-40 pointer-events-none z-20" preserveAspectRatio="none" viewBox="0 0 100 100">
											<polyline
												points={trendPoints}
												fill="none"
												stroke="#1A237E"
												strokeWidth="0.6"
												strokeDasharray="2,3"
												className="dark:stroke-indigo-400"
											/>
										</svg>
									)}
								</div>
							</div>
						</div>
					) : (
						<div className="w-full h-24 lg:h-32 flex items-center justify-center text-slate-400 text-[10px] lg:text-xs font-bold uppercase tracking-widest">
							Chưa có đơn hàng trong tháng
						</div>
					)}
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

const StaffLeaderboard = ({ orders, todayStr, formatPrice }: { orders: any[], todayStr: string, formatPrice: (n: number) => string }) => {
	const staffSales = orders
		.filter(o => {
			const d = o.orderDate || (o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : '');
			return d === todayStr && o.status === 'Đơn chốt';
		})
		.reduce((acc: any, o) => {
			const email = o.createdByEmail || 'unknown';
			const name = o.createdByEmail?.split('@')[0] || 'Nhân viên';
			if (!acc[email]) acc[email] = { name, email, orders: 0, revenue: 0 };
			acc[email].orders += 1;
			acc[email].revenue += Number(o.totalAmount) || 0;
			return acc;
		}, {});

	const sorted = Object.values(staffSales).sort((a: any, b: any) => b.revenue - a.revenue);
	if (sorted.length === 0) return null;

	const maxRev = Math.max(...sorted.map((s: any) => s.revenue), 1);
	const trophyColors = ['text-amber-400', 'text-slate-400', 'text-orange-600'];

	return (
		<div className="mb-6 bg-white dark:bg-slate-900 rounded-[2rem] p-5 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-black uppercase text-slate-800 dark:text-white flex items-center gap-2">
					<Trophy size={18} className="text-[#FF6D00]" /> Chốt đơn hôm nay
				</h3>
				<span className="text-[10px] font-bold text-slate-400 uppercase">{sorted.length} nhân viên có đơn</span>
			</div>
			<div className="space-y-3">
				{sorted.map((s: any, i: number) => (
					<div key={s.email} className="flex items-center gap-3 group">
						<div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
							i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
							i === 1 ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' :
							i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' :
							'bg-slate-50 dark:bg-slate-800/50 text-slate-400'
						}`}>
							{i < 3 ? <Trophy size={14} className={trophyColors[i]} /> : i + 1}
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<UserIcon size={12} className="text-slate-400 shrink-0" />
								<span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{s.name}</span>
								<span className="text-[10px] text-slate-400">{s.orders} đơn</span>
							</div>
							<div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
								<div
									className={`h-full rounded-full transition-all duration-700 ${
										i === 0 ? 'bg-gradient-to-r from-amber-400 to-[#FF6D00]' :
										i === 1 ? 'bg-gradient-to-r from-slate-400 to-slate-500' :
										i === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
										'bg-[#1A237E]/30 dark:bg-indigo-500/30'
									}`}
									style={{ width: `${Math.max((s.revenue / maxRev) * 100, 8)}%` }}
								></div>
							</div>
						</div>
						<div className="text-right shrink-0">
							<span className="text-sm font-black text-[#1A237E] dark:text-indigo-400">
								{formatPrice(s.revenue)}
							</span>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default Home;