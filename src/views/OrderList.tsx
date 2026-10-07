import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { doc, writeBatch, increment, collection, serverTimestamp } from '../services/firebase';
import { useOrders } from '../hooks/useOrders';
import { useProducts } from '../hooks/useProducts';
import { customerRebateService } from '../services/dataAccess';
import { sendTelegramNotification } from '../utils/telegramNotify';
import {
	filterOrders,
	formatPrice,
	formatCompactPrice,
	formatOrderDate,
	formatOrderDateOnly,
	type OrderSortOption
} from '../utils/orderFilter';
import OrderTicket from '../components/OrderTicket';
import UpgradeModal from '../components/UpgradeModal';
import { Lock, Crown } from 'lucide-react';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';
import { syncEngine } from '../services/syncEngine';
import { refreshCollection } from '../services/firebase';
import { isNativeApp } from '../utils/platform';

const OrderList = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const { showToast } = useToast();
	const [isRefreshing, setIsRefreshing] = useState(false);

	// 🔧 Data hooks
	const { orders, loading } = useOrders({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
		maxResults: 9999,
	});
	const isAdmin = !owner.loading && (owner.role?.toLowerCase() === 'admin' || !owner.isEmployee);

	// State filters & pagination
	const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('orders_searchTerm') || '');
	const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem('orders_statusFilter') || 'all');
	const [timeRange, setTimeRange] = useState<string>(() => sessionStorage.getItem('orders_timeRange') || 'all');
	const [sortBy, setSortBy] = useState<OrderSortOption>(() => (sessionStorage.getItem('orders_sortBy') as OrderSortOption) || 'newest');
	const [fromDate, setFromDate] = useState('');
	const [toDate, setToDate] = useState('');
	const [showFilterOptions, setShowFilterOptions] = useState(false);
	const [currentPage, setCurrentPage] = useState(() => Number(sessionStorage.getItem('orders_currentPage')) || 1);

	// Modal & Actions state
	const [showDetail, setShowDetail] = useState(false);
	const [selectedOrder, setSelectedOrder] = useState<any>(null);
	const [showMobileSearch, setShowMobileSearch] = useState(false);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [deleteSuccessMsg, setDeleteSuccessMsg] = useState('');

	useEffect(() => {
		sessionStorage.setItem('orders_searchTerm', searchTerm);
		sessionStorage.setItem('orders_statusFilter', statusFilter);
		sessionStorage.setItem('orders_timeRange', timeRange);
		sessionStorage.setItem('orders_sortBy', sortBy);
		sessionStorage.setItem('orders_currentPage', currentPage.toString());
	}, [searchTerm, statusFilter, timeRange, sortBy, currentPage]);

	const itemsPerPage = 10;
	const searchRef = useRef<HTMLInputElement>(null);
	const { search } = useLocation();

	useEffect(() => {
		const params = new URLSearchParams(search);
		if (params.get('search') === 'focus') {
			setShowMobileSearch(true);
			setTimeout(() => searchRef.current?.focus(), 200);
			navigate('/orders', { replace: true });
		}
	}, [search, navigate]);

	// Xử lý chuyển đổi mốc thời gian (Tháng này, 2 tháng, 3 tháng...)
	const handleTimeRangeChange = (val: string) => {
		setTimeRange(val);
		const now = new Date();
		const pad = (n: number) => n.toString().padStart(2, '0');
		const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

		if (val === 'this_month') {
			const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
			const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			setFromDate(toYmd(firstDay));
			setToDate(toYmd(lastDay));
			setSortBy('newest');
		} else if (val === '2_months') {
			const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			setFromDate(toYmd(firstDay));
			setToDate(toYmd(lastDay));
			setSortBy('newest');
		} else if (val === '3_months') {
			const firstDay = new Date(now.getFullYear(), now.getMonth() - 2, 1);
			const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			setFromDate(toYmd(firstDay));
			setToDate(toYmd(lastDay));
			setSortBy('newest');
		} else if (val === 'oldest') {
			setFromDate('');
			setToDate('');
			setSortBy('oldest');
		} else {
			// 'all'
			setFromDate('');
			setToDate('');
			setSortBy('newest');
		}
	};

	// 🗓️ Phím tắt chọn khoảng thời gian nhanh trong panel lọc
	const setDatePreset = (preset: 'today' | 'yesterday' | '7days' | 'thisMonth' | 'lastMonth' | 'all') => {
		const now = new Date();
		const pad = (n: number) => n.toString().padStart(2, '0');
		const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

		if (preset === 'today') {
			const todayStr = toYmd(now);
			setFromDate(todayStr);
			setToDate(todayStr);
			setTimeRange('custom');
		} else if (preset === 'yesterday') {
			const y = new Date(now);
			y.setDate(y.getDate() - 1);
			const yStr = toYmd(y);
			setFromDate(yStr);
			setToDate(yStr);
			setTimeRange('custom');
		} else if (preset === '7days') {
			const d7 = new Date(now);
			d7.setDate(d7.getDate() - 6);
			setFromDate(toYmd(d7));
			setToDate(toYmd(now));
			setTimeRange('custom');
		} else if (preset === 'thisMonth') {
			handleTimeRangeChange('this_month');
		} else if (preset === 'lastMonth') {
			const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
			setFromDate(toYmd(firstDay));
			setToDate(toYmd(lastDay));
			setTimeRange('custom');
		} else if (preset === 'all') {
			handleTimeRangeChange('all');
		}
	};

	// Filtered & Sorted orders
	const filteredOrders = useMemo(() => {
		return filterOrders(
			orders as any,
			searchTerm,
			fromDate,
			toDate,
			statusFilter,
			sortBy
		);
	}, [orders, searchTerm, fromDate, toDate, statusFilter, sortBy]);

	// Reset page on filter change
	const isInitialMount = useRef(true);
	useEffect(() => {
		if (isInitialMount.current) {
			isInitialMount.current = false;
		} else {
			setCurrentPage(1);
		}
	}, [searchTerm, statusFilter, sortBy, fromDate, toDate]);

	useEffect(() => {
		const handleOpenSearch = () => {
			setShowMobileSearch(true);
			setTimeout(() => {
				const mobileInput = document.getElementById('mobile-search-input') as HTMLInputElement;
				if (mobileInput) {
					mobileInput.focus();
				} else {
					searchRef.current?.focus();
				}
			}, 200);
		};
		window.addEventListener('open-mobile-search', handleOpenSearch);
		return () => window.removeEventListener('open-mobile-search', handleOpenSearch);
	}, []);

	// Modal back-button navigation
	const showDetailRef = useRef(showDetail);
	useEffect(() => { showDetailRef.current = showDetail; }, [showDetail]);

	useEffect(() => {
		const handlePopState = () => {
			if (showDetailRef.current) {
				setShowDetail(false);
			}
		};
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

	useEffect(() => {
		if (currentPage > 1 && (totalPages === 0 || currentPage > totalPages)) {
			setCurrentPage(1);
		}
	}, [filteredOrders.length, totalPages, currentPage]);

	const paginatedOrders = filteredOrders.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	const openDetail = (order: any) => {
		setSelectedOrder(order);
		setShowDetail(true);
		navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
	};

	const getPageNumbers = () => {
		const pages: (number | string)[] = [];
		const radius = 1;

		for (let i = 1; i <= totalPages; i++) {
			if (
				i === 1 ||
				i === totalPages ||
				(i >= currentPage - radius && i <= currentPage + radius) ||
				i <= 3 ||
				i >= totalPages - 2
			) {
				pages.push(i);
			}
		}

		const uniquePages = [...new Set(pages)].sort((a, b) => (a as number) - (b as number));
		const withEllipsis: (number | string)[] = [];

		for (let i = 0; i < uniquePages.length; i++) {
			if (i > 0 && (uniquePages[i] as number) - (uniquePages[i - 1] as number) > 1) {
				withEllipsis.push('...');
			}
			withEllipsis.push(uniquePages[i]);
		}
		return withEllipsis;
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'Mới': return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
			case 'Đang xử lý': return 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800';
			case 'Đơn chốt': return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
			case 'Đã giao': return 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800';
			case 'Đã hủy': return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800';
			default: return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700';
		}
	};

	// 📦 Tóm tắt sản phẩm trong đơn
	const getItemsSummary = (order: any) => {
		const items = order.items || order.products || [];
		if (!Array.isArray(items) || items.length === 0) return null;
		const totalQty = items.reduce((sum: number, it: any) => sum + (Number(it.qty) || 0), 0);
		const names = items.map((it: any) => `${it.name || 'SP'}${it.qty ? ` (x${it.qty})` : ''}`).join(', ');
		return `${items.length} món (${totalQty} SP): ${names}`;
	};

	// 🔧 Products hook
	const { products: allProducts } = useProducts({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
	});

	const handleDeleteClick = (id: string) => {
		setConfirmDeleteId(id);
	};

	const handleDeleteCancel = () => {
		setConfirmDeleteId(null);
	};

	const deleteOrder = async (id: string) => {
		try {
			const order = orders.find(o => o.id === id);
			const batch = writeBatch(db);

			// 1. Phục hồi tồn kho nếu đơn đã chốt
			if (order?.status === 'Đơn chốt') {
				for (const item of (order?.products || order?.items || [])) {
					const qty = Number(item.qty) || 0;
					if (item.productId && qty > 0) {
						const prodRef = doc(db, 'products', item.productId);
						batch.update(prodRef, { stock: increment(qty) });

						const invLogRef = doc(collection(db, 'inventory_logs'));
						batch.set(invLogRef, {
							productId: item.productId,
							orderId: id,
							customerName: order?.customerName || 'Khách',
							productName: item.name || 'Sản phẩm',
							type: 'in',
							qty: qty,
							note: `Hoàn kho do xóa đơn hàng #${id.slice(0, 8)}`,
							ownerId: owner.ownerId || '',
							user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
							createdAt: serverTimestamp()
						});
					}
				}
			}

			// 2. Xóa đơn hàng
			batch.delete(doc(db, 'orders', id));

			// 2.5 Hoàn nợ khách hàng nếu đơn chốt
			if (order?.customerId && order?.status === 'Đơn chốt') {
				batch.update(doc(db, 'customers', order.customerId), {
					debt: increment(-Number(order.totalAmount || 0)),
					totalDebt: increment(-Number(order.totalAmount || 0)),
					totalOrdersAmount: increment(-Number(order.totalAmount || 0)),
					updatedAt: serverTimestamp()
				});
				const debtRef = doc(collection(db, 'debts'));
				batch.set(debtRef, {
					customerId: order.customerId,
					customerName: order.customerName || '',
					type: 'payment',
					amount: Number(order.totalAmount || 0),
					orderId: id,
					note: 'Xóa đơn hàng - hoàn nợ',
					ownerId: owner.ownerId || '',
					createdBy: auth.currentUser?.uid || '',
					createdAt: serverTimestamp()
				});
			}

			// 2.8 Hoàn chiết khấu
			if (order?.status === 'Đơn chốt' && order?.rebateId) {
				try {
					await customerRebateService.refundRebate(order.rebateId, id);
				} catch (err) {
					console.error("Lỗi hoàn chiết khấu:", err);
				}
			}

			// 3. Log Audit
			const auditRef = doc(collection(db, 'audit_logs'));
			batch.set(auditRef, {
				action: 'Xóa đơn hàng',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid || '',
				ownerId: owner.ownerId || '',
				details: `Đã xóa đơn hàng của ${order?.customerName || 'Khách'} - Trị giá: ${formatPrice(order?.totalAmount || 0)}`,
				createdAt: serverTimestamp()
			});

			await batch.commit();

			setShowDetail(false);
			const msg = `🗑️ Đã xóa đơn của ${order?.customerName || 'Khách'}`;
			setDeleteSuccessMsg(msg);
			setConfirmDeleteId(null);
			setTimeout(() => { setDeleteSuccessMsg(''); }, 3000);
			showToast("Đã xóa đơn hàng thành công", "success");

			if (order?.status === 'Đơn chốt') {
				sendTelegramNotification(owner.ownerId, `🗑️ <b>ĐƠN CHỐT ĐÃ BỊ XÓA</b>\n- Khách hàng: <b>${order?.customerName}</b>\n- Tổng tiền: <b>${formatPrice(order?.totalAmount || 0)}</b>\n- Người thao tác: ${auth.currentUser?.displayName || 'Admin'}`);
			}
		} catch (error) {
			showToast("Lỗi khi xóa đơn hàng", "error");
			console.error(error);
		}
	};

	// 📊 Status tab counts
	const countsByStatus = useMemo(() => {
		const res: Record<string, number> = { all: orders.length, 'Mới': 0, 'Đơn chốt': 0 };
		orders.forEach(o => {
			const s = o.status || 'Mới';
			if (res[s] !== undefined) res[s]++;
		});
		return res;
	}, [orders]);

	const statusTabs = [
		{ id: 'all', label: 'Tất cả', count: countsByStatus.all },
		{ id: 'Mới', label: 'Mới', count: countsByStatus['Mới'], badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
		{ id: 'Đơn chốt', label: 'Đơn chốt', count: countsByStatus['Đơn chốt'], badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
	];

	// Stats - Only count "Đơn chốt" orders in current filtered list
	const confirmedOrders = filteredOrders.filter(o => o.status === 'Đơn chốt');
	const totalConfirmedCount = confirmedOrders.length;
	const totalProfit = isAdmin ? confirmedOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0) : 0;
	const totalRevenue = confirmedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

	// Tiêu đề phụ cho thẻ thống kê theo khoảng thời gian
	const periodLabel = timeRange === 'this_month' ? 'Tháng này' : timeRange === '2_months' ? '2 tháng' : timeRange === '3_months' ? '3 tháng' : (fromDate || toDate) ? 'Theo lọc' : 'Toàn thời gian';

	if (owner.manualLockOrders) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 items-center justify-center p-8">
				<div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-6 border border-red-500/20">
					<Lock size={64} />
				</div>
				<h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mb-4 text-[#1A237E] dark:text-indigo-400 text-center">Tính Năng Bị Khóa</h1>
				<p className="text-slate-500 dark:text-slate-400 text-center max-w-md font-medium text-sm md:text-base leading-relaxed mb-8">
					Tài khoản của bạn đã bị khóa tính năng Đơn Hàng. Vui lòng nâng cấp gói hoặc liên hệ Quản trị viên để mở khóa.
				</p>
				<button onClick={() => navigate('/pricing')} className="bg-[#1A237E] dark:bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest shadow-xl shadow-blue-900/20 md:hover:bg-blue-800 transition-all flex items-center gap-2">
					<Crown size={20} />
					Nâng Cấp Ngay
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 transition-colors duration-300">
			{/* HEADER */}
			<header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 h-16 md:h-20 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300 print:hidden">
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
				<div className="flex items-center gap-3">
					{/* Search Bar Desktop */}
					<div className="hidden md:relative md:block">
						<span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">search</span>
						<input
							ref={searchRef}
							type="text"
							placeholder="Tìm mã đơn, khách hàng, hàng hóa..."
							className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-transparent rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#FF6D00]/30 w-64 transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					{/* 🔄 Nút Làm mới / Đồng bộ tức thì */}
					<button
						onClick={async () => {
							setIsRefreshing(true);
							try {
								if (isNativeApp()) {
									await syncEngine.syncNow(true);
								} else {
									await refreshCollection('orders');
								}
								showToast('Đã làm mới dữ liệu đơn hàng!', 'success');
							} catch {
								showToast('Không thể kết nối máy chủ để làm mới', 'error');
							} finally {
								setIsRefreshing(false);
							}
						}}
						disabled={isRefreshing}
						className="flex items-center gap-1.5 text-xs md:text-sm font-bold px-2.5 md:px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-50"
						title="Làm mới dữ liệu từ máy chủ"
					>
						<span className={`material-symbols-outlined text-base md:text-lg ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`}>sync</span>
						<span className="hidden sm:inline">Làm mới</span>
					</button>

					{/* 🗓️ Nút Lọc thời gian */}
					<button
						onClick={() => setShowFilterOptions(!showFilterOptions)}
						className={`flex items-center gap-1.5 text-xs md:text-sm font-bold px-3 md:px-4 py-2 rounded-xl shadow-sm border transition-all ${
							fromDate || toDate || showFilterOptions
								? 'bg-blue-50 dark:bg-blue-900/30 text-[#1A237E] dark:text-indigo-300 border-blue-200 dark:border-blue-800'
								: 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
						}`}
					>
						<span className="material-symbols-outlined text-base md:text-lg">filter_alt</span>
						<span>Lọc ngày</span>
						{(fromDate || toDate) && (
							<span className="size-2 rounded-full bg-blue-600 animate-pulse ml-0.5" />
						)}
					</button>

					{/* ➕ Nút Tạo đơn */}
					<button
						onClick={() => navigate('/quick-order')}
						className="bg-[#1A237E] hover:bg-[#121858] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 md:px-5 py-2 rounded-xl font-bold text-xs md:text-sm shadow-md shadow-indigo-900/10 hover:shadow-lg transition-all duration-200 flex items-center gap-1.5 active:scale-95"
					>
						<span className="material-symbols-outlined text-base md:text-lg">add_shopping_cart</span>
						<span>Lên đơn</span>
					</button>
				</div>
			</header>

			{/* 🗓️ FILTER PANEL WITH DATE PRESETS */}
			{showFilterOptions && (
				<div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 md:px-8 py-4 animate-in slide-in-from-top-2 duration-200">
					{/* Quick Date Presets */}
					<div className="flex flex-wrap items-center gap-1.5 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
						<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Chọn nhanh:</span>
						{[
							{ id: 'today', label: 'Hôm nay' },
							{ id: 'yesterday', label: 'Hôm qua' },
							{ id: '7days', label: '7 ngày qua' },
							{ id: 'thisMonth', label: 'Tháng này' },
							{ id: 'lastMonth', label: 'Tháng trước' },
						].map((p) => (
							<button
								key={p.id}
								onClick={() => setDatePreset(p.id as any)}
								className="px-2.5 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all"
							>
								{p.label}
							</button>
						))}
						{(fromDate || toDate) && (
							<button
								onClick={() => setDatePreset('all')}
								className="px-2.5 py-1 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all ml-auto"
							>
								✕ Xóa lọc ngày
							</button>
						)}
					</div>

					<div className="flex flex-wrap items-center gap-4">
						<div className="flex-1 min-w-[140px] max-w-xs">
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Từ ngày</label>
							<input
								type="date"
								className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1A237E]/20"
								value={fromDate}
								onChange={(e) => { setFromDate(e.target.value); setTimeRange('custom'); }}
							/>
						</div>
						<div className="flex-1 min-w-[140px] max-w-xs">
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Đến ngày</label>
							<input
								type="date"
								className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#1A237E]/20"
								value={toDate}
								onChange={(e) => { setToDate(e.target.value); setTimeRange('custom'); }}
							/>
						</div>
					</div>
				</div>
			)}

			{/* CONTENT */}
			<div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar print:hidden">
				{/* Mobile Search Bar */}
				{showMobileSearch && (
					<div className="md:hidden mb-4 animate-in slide-in-from-top duration-300">
						<div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-3.5 shadow-sm border border-slate-200 dark:border-slate-800">
							<span className="material-symbols-outlined text-slate-400">search</span>
							<input
								id="mobile-search-input"
								ref={searchRef}
								type="text"
								placeholder="Mã đơn, tên khách, số điện thoại..."
								className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-900 dark:text-white"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
							{searchTerm && (
								<button onClick={() => setSearchTerm('')} className="text-slate-300">
									<span className="material-symbols-outlined text-lg">cancel</span>
								</button>
							)}
							<button onClick={() => setShowMobileSearch(false)} className="text-blue-500 font-bold text-xs">
								Đóng
							</button>
						</div>
					</div>
				)}

				{/* Inline Notification Banner */}
				{deleteSuccessMsg && (
					<div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2 text-green-700 dark:text-green-300 text-sm font-semibold animate-in slide-in-from-top-2">
						<span className="material-symbols-outlined text-lg">check_circle</span>
						{deleteSuccessMsg}
					</div>
				)}

				{/* Stats Cards */}
				<div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-2 md:gap-4 mb-6`}>
					<StatCard
						icon="receipt_long"
						label={`Đơn chốt (${periodLabel})`}
						value={totalConfirmedCount.toString()}
						color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
					/>
					<StatCard
						icon="payments"
						label={`Doanh thu (${periodLabel})`}
						value={formatCompactPrice(totalRevenue)}
						color="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
					/>
					{isAdmin && (
						<StatCard
							icon="trending_up"
							label={`Lợi nhuận (${periodLabel})`}
							value={formatCompactPrice(totalProfit)}
							color="bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400"
						/>
					)}
				</div>

				{/* 🗂️ STATUS TABS BAR & TIME RANGE / SORT CONTROLS */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
					{/* Status Filter Tabs */}
					<div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
						{statusTabs.map((tab) => {
							const isActive = statusFilter === tab.id;
							return (
								<button
									key={tab.id}
									onClick={() => setStatusFilter(tab.id)}
									className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
										isActive
											? 'bg-[#1A237E] text-white shadow-md shadow-indigo-900/20 dark:bg-indigo-600'
											: 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
									}`}
								>
									<span>{tab.label}</span>
									<span className={`text-[10px] px-1.5 py-0.2 rounded-md font-black ${
										isActive
											? 'bg-white/20 text-white'
											: tab.badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-500'
									}`}>
										{tab.count}
									</span>
								</button>
							);
						})}
					</div>

					{/* 🔄 Time Range Dropdown (Tháng này, 2 tháng, 3 tháng...) */}
					<div className="flex items-center gap-2 self-end md:self-auto">
						<span className="text-xs font-bold text-slate-400 hidden sm:inline">Thời gian:</span>
						<select
							value={timeRange}
							onChange={(e) => handleTimeRangeChange(e.target.value)}
							aria-label="Chọn khoảng thời gian hiển thị"
							className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer hover:border-slate-300 transition-colors"
						>
							<option value="all">🌐 Toàn bộ (Mới nhất)</option>
							<option value="this_month">📅 Tháng này</option>
							<option value="2_months">📊 2 tháng gần đây</option>
							<option value="3_months">🗓️ 3 tháng gần đây</option>
							{timeRange === 'custom' && <option value="custom">🔍 Tùy chỉnh ngày...</option>}
							<option value="oldest">⌛ Cũ nhất trước</option>
						</select>
					</div>
				</div>

				{/* DESKTOP TABLE */}
				<div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
					<table className="w-full text-left table-fixed">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
								<th className="py-3 px-4 w-[16%] min-w-[120px] text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em]">Đơn hàng</th>
								<th className="py-3 px-4 w-[38%] min-w-[200px] text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em]">Khách hàng & Hàng hóa</th>
								<th className="py-3 px-3 w-[12%] min-w-[90px] text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em] text-center">Trạng thái</th>
								{isAdmin && <th className="py-3 px-4 w-[13%] min-w-[100px] text-[10px] font-black text-pink-500 dark:text-pink-400 uppercase tracking-[0.1em] text-right">Lợi nhuận</th>}
								<th className="py-3 px-4 w-[13%] min-w-[105px] text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em] text-right">Tổng tiền</th>
								<th className="py-3 px-3 w-[8%] min-w-[65px] text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em] text-right"></th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 dark:divide-slate-800">
							{loading ? (
								[1, 2, 3, 4, 5].map(i => (
									<tr key={i} className="animate-pulse">
										<td className="py-3 px-4"><div className="w-20 h-4 skeleton mb-1.5" /><div className="w-24 h-3 skeleton opacity-50" /></td>
										<td className="py-3 px-4"><div className="w-36 h-4 skeleton mb-1.5" /><div className="w-48 h-3 skeleton opacity-50" /></td>
										<td className="py-3 px-3"><div className="w-16 h-5 skeleton mx-auto rounded-full" /></td>
										{isAdmin && <td className="py-3 px-4"><div className="w-16 h-4 skeleton ml-auto" /></td>}
										<td className="py-3 px-4"><div className="w-20 h-4 skeleton ml-auto" /></td>
										<td className="py-3 px-3"><div className="w-10 h-6 skeleton ml-auto rounded-lg" /></td>
									</tr>
								))
							) : paginatedOrders.length === 0 ? (
								<tr>
									<td colSpan={isAdmin ? 6 : 5} className="py-12 text-center">
										<div className="flex flex-col items-center gap-2">
											<span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">receipt_long</span>
											<p className="text-slate-400 dark:text-slate-500 font-medium">Không tìm thấy đơn hàng nào phù hợp</p>
										</div>
									</td>
								</tr>
							) : paginatedOrders.map((order) => (
								<tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => openDetail(order)}>
									{/* Cột Mã & Ngày */}
									<td className="py-3 px-4 align-top">
										<div className="font-black text-slate-900 dark:text-indigo-400 text-xs">#{order.id.slice(0, 8).toUpperCase()}</div>
										<div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 whitespace-nowrap">
											{formatOrderDate(order.createdAt, order.orderDate)}
										</div>
									</td>

									{/* Cột Khách hàng & Tóm tắt hàng hóa */}
									<td className="py-3 px-4 align-top">
										<div className="flex items-start gap-2.5">
											<div className="size-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-[11px] text-slate-700 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5">
												{(order.customerBusinessName || order.customerName || 'K')[0].toUpperCase()}
											</div>
											<div className="min-w-0 flex-1">
												<div className="font-black text-slate-800 dark:text-slate-200 text-xs truncate">
													{order.customerName || order.customerBusinessName || 'Khách vãng lai'}
													{order.customerBusinessName && order.customerBusinessName !== order.customerName && (
														<span className="text-[11px] font-normal text-slate-500 ml-1">({order.customerBusinessName})</span>
													)}
												</div>
												<div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{order.customerPhone || '--'}</div>
												{/* 📦 Tóm tắt sản phẩm: font nhỏ hơn, cho phép xuống tối đa 2 dòng */}
												{getItemsSummary(order) && (
													<div className="mt-1 flex items-start gap-1 text-[9.5px] leading-snug text-slate-500 dark:text-slate-400 bg-slate-50/90 dark:bg-slate-800/80 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-800/80 line-clamp-2 break-words">
														<span className="material-symbols-outlined text-[11px] text-slate-400 shrink-0 mt-0.5">inventory_2</span>
														<span className="line-clamp-2 break-words">{getItemsSummary(order)}</span>
													</div>
												)}
											</div>
										</div>
									</td>

									{/* Trạng thái */}
									<td className="py-3 px-3 text-center align-top whitespace-nowrap">
										<span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusColor(order.status ?? '')}`}>
											{order.status || 'Mới'}
										</span>
									</td>

									{/* Lợi nhuận Admin */}
									{isAdmin && (
										<td className="py-3 px-4 text-right font-black text-pink-500 dark:text-pink-400 text-xs align-top whitespace-nowrap">
											{formatPrice(order.totalProfit || 0)}
										</td>
									)}

									{/* Tổng tiền */}
									<td className="py-3 px-4 text-right font-black text-slate-900 dark:text-indigo-400 text-xs align-top whitespace-nowrap">
										{formatPrice(order.totalAmount || 0)}
									</td>

									{/* Hành động */}
									<td className="py-3 px-3 text-right align-top">
										<div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
											<button
												onClick={() => navigate(`/quick-order/${order.id}`)}
												className="p-1 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-all"
												title="Sửa đơn"
											>
												<span className="material-symbols-outlined text-base">edit</span>
											</button>
											{confirmDeleteId === order.id ? (
												<div className="flex items-center gap-0.5 bg-red-50 dark:bg-red-950/40 p-0.5 rounded-lg border border-red-200 dark:border-red-900">
													<button
														onClick={() => deleteOrder(order.id)}
														className="p-1 rounded text-white bg-red-500 hover:bg-red-600 transition-colors"
														title="Xác nhận xóa"
													>
														<span className="material-symbols-outlined text-xs">check</span>
													</button>
													<button
														onClick={handleDeleteCancel}
														className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
														title="Hủy"
													>
														<span className="material-symbols-outlined text-xs">close</span>
													</button>
												</div>
											) : (
												<button
													onClick={() => handleDeleteClick(order.id)}
													className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
													title="Xóa đơn"
												>
													<span className="material-symbols-outlined text-base">delete</span>
												</button>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* MOBILE LIST */}
				<div className="md:hidden space-y-3 pb-12">
					{loading ? (
						[1, 2, 3, 4, 5].map(i => (
							<div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800 animate-pulse space-y-3">
								<div className="flex justify-between items-start">
									<div className="size-10 rounded-xl skeleton" />
									<div className="w-16 h-5 skeleton rounded-lg" />
								</div>
								<div className="w-32 h-4 skeleton" />
							</div>
						))
					) : paginatedOrders.length === 0 ? (
						<div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
							<span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">receipt_long</span>
							<p className="text-slate-400 dark:text-slate-500 font-medium text-xs mt-1">Không tìm thấy đơn hàng nào</p>
						</div>
					) : paginatedOrders.map((order) => (
						<div
							key={order.id}
							className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800 active:scale-[0.99] transition-all"
							onClick={() => openDetail(order)}
						>
							<div className="flex justify-between items-start mb-2.5">
								<div className="flex items-center gap-3">
									<div className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#1A237E] dark:text-indigo-400 shrink-0 font-black text-xs">
										{(order.customerBusinessName || order.customerName || 'K')[0].toUpperCase()}
									</div>
									<div>
										<div className="font-black text-[#1A237E] dark:text-indigo-400 text-sm line-clamp-1">
											{order.customerName || order.customerBusinessName || 'Khách vãng lai'}
										</div>
										<div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
											#{order.id.slice(0, 8).toUpperCase()} • {formatOrderDateOnly(order.createdAt, order.orderDate)}
										</div>
									</div>
								</div>
								<div className="flex flex-col items-end gap-1.5">
									<span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase ${getStatusColor(order.status ?? '')}`}>
										{order.status || 'Mới'}
									</span>
								</div>
							</div>

							{/* 📦 Tóm tắt sản phẩm mobile */}
							{getItemsSummary(order) && (
								<div className="mb-2 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg line-clamp-1 border border-slate-100 dark:border-slate-800">
									📦 {getItemsSummary(order)}
								</div>
							)}

							{isAdmin && (
								<div className="flex justify-between items-center mb-1.5 px-1">
									<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lợi nhuận:</span>
									<span className="text-xs font-black text-pink-500">{formatPrice(order.totalProfit || 0)}</span>
								</div>
							)}

							<div className="flex justify-between items-center pt-2.5 border-t border-gray-50 dark:border-slate-800">
								<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
									<button onClick={() => navigate(`/quick-order/${order.id}`)} className="p-1.5 text-orange-500 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/30">
										<span className="material-symbols-outlined text-base">edit</span>
									</button>
									{confirmDeleteId === order.id ? (
										<div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/40 p-1 rounded-lg">
											<button onClick={() => deleteOrder(order.id)} className="p-1 text-white bg-red-500 rounded"><span className="material-symbols-outlined text-xs">check</span></button>
											<button onClick={handleDeleteCancel} className="p-1 text-slate-400"><span className="material-symbols-outlined text-xs">close</span></button>
										</div>
									) : (
										<button onClick={() => handleDeleteClick(order.id)} className="p-1.5 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">
											<span className="material-symbols-outlined text-base">delete</span>
										</button>
									)}
								</div>
								<span className="font-black text-[#FF6D00] text-base">{formatPrice(order.totalAmount || 0)}</span>
							</div>
						</div>
					))}
				</div>

				{/* PAGINATION */}
				{totalPages > 1 && (
					<div className="mt-6 mb-20 flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
						<p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">
							Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredOrders.length)} trên {filteredOrders.length} đơn
						</p>
						<div className="flex items-center gap-2">
							<button
								onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo(0, 0); }}
								disabled={currentPage === 1}
								className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
							>
								<span className="material-symbols-outlined">chevron_left</span>
							</button>
							<div className="flex items-center gap-1">
								{getPageNumbers().map((page, idx) => (
									<button
										key={idx}
										onClick={() => typeof page === 'number' && setCurrentPage(page)}
										disabled={page === '...'}
										className={`size-10 rounded-xl font-black text-xs transition-all ${page === currentPage
											? 'bg-[#1A237E] text-white shadow-lg shadow-blue-500/20'
											: page === '...'
												? 'text-slate-400 cursor-default'
												: 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
											}`}
									>
										{page}
									</button>
								))}
							</div>
							<button
								onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); window.scrollTo(0, 0); }}
								disabled={currentPage === totalPages}
								className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
							>
								<span className="material-symbols-outlined">chevron_right</span>
							</button>
						</div>
					</div>
				)}
			</div>

			{/* DETAIL MODAL (Ticket View) */}
			{showDetail && selectedOrder && (
				(owner.isPro || !owner.systemConfig.lock_free_orders) && !owner.manualLockOrders ? (
					<OrderTicket
						order={selectedOrder}
						products={allProducts}
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
	<div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
		<div className={`p-1.5 ${color} w-fit rounded-lg mb-1.5`}>
			<span className="material-symbols-outlined text-base">{icon}</span>
		</div>
		<p className="text-slate-500 dark:text-slate-500 text-[9px] font-black uppercase tracking-widest truncate">{label}</p>
		<h3 className="text-base font-black text-slate-900 dark:text-indigo-400 leading-none mt-0.5">{value}</h3>
	</div>
);

export default OrderList;
