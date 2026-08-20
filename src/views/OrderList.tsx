import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
// 🔧 REFACTOR: Chỉ giữ Firestore write ops — read ops đã chuyển qua hooks
import { doc, getDoc, getDocs, writeBatch, increment, collection, query, where, serverTimestamp } from '../services/firebase';
// 🔧 REFACTOR: Dùng hooks mới thay vì onSnapshot trực tiếp
import { useOrders } from '../hooks/useOrders';
import { useProducts } from '../hooks/useProducts';
import { sendTelegramNotification } from '../utils/telegramNotify';
import { filterOrders, formatPrice, formatCompactPrice } from '../utils/orderFilter';
import OrderTicket from '../components/OrderTicket';
import UpgradeModal from '../components/UpgradeModal';
import { Lock, Crown } from 'lucide-react';

import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';
const formatOrderDate = (createdAt: any) => {
	if (!createdAt) return '---';
	if (typeof createdAt === 'object' && createdAt.seconds) {
		return new Date(createdAt.seconds * 1000).toLocaleString('vi-VN');
	}
	const d = new Date(createdAt);
	return isNaN(d.getTime()) ? '---' : d.toLocaleString('vi-VN');
};

const formatOrderDateOnly = (createdAt: any) => {
	if (!createdAt) return '---';
	if (typeof createdAt === 'object' && createdAt.seconds) {
		return new Date(createdAt.seconds * 1000).toLocaleDateString('vi-VN');
	}
	const d = new Date(createdAt);
	return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('vi-VN');
};

const OrderList = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const { showToast } = useToast();
	// 🔧 REFACTOR: Dùng useOrders hook thay vì useState + onSnapshot
	const { orders, loading } = useOrders({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
		maxResults: 9999,
	});
	const isAdmin = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee;
	const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('orders_searchTerm') || '');
	const [showDetail, setShowDetail] = useState(false);
	const [selectedOrder, setSelectedOrder] = useState<any>(null);
	const [showMobileSearch, setShowMobileSearch] = useState(false);
	const [currentPage, setCurrentPage] = useState(() => Number(sessionStorage.getItem('orders_currentPage')) || 1);
	const [fromDate, setFromDate] = useState('');
	const [toDate, setToDate] = useState('');
	const [showFilterOptions, setShowFilterOptions] = useState(false);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [deleteSuccessId, setDeleteSuccessId] = useState<string | null>(null);
	const [deleteSuccessMsg, setDeleteSuccessMsg] = useState('');

	useEffect(() => {
		sessionStorage.setItem('orders_searchTerm', searchTerm);
		sessionStorage.setItem('orders_currentPage', currentPage.toString());
	}, [searchTerm, currentPage]);
	const itemsPerPage = 10;
	const searchRef = useRef<HTMLInputElement>(null);
	const { search } = useLocation();

	// 🔧 REFACTOR: Orders onSnapshot + products one-time fetch đã chuyển qua hooks

	useEffect(() => {
		const params = new URLSearchParams(search);
		if (params.get('search') === 'focus') {
			setShowMobileSearch(true);
			setTimeout(() => searchRef.current?.focus(), 200);
			navigate('/orders', { replace: true });
		}
	}, [search, navigate]);

	const filteredOrders = filterOrders(
		orders as any,
		searchTerm,
		fromDate,
		toDate
	);

	const isInitialMount = useRef(true);
	useEffect(() => {
		if (isInitialMount.current) {
			isInitialMount.current = false;
		} else {
			setCurrentPage(1);
		}
	}, [searchTerm, fromDate, toDate]);

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

	// Track modal state for back button
	const showDetailRef = useRef(showDetail);
	useEffect(() => { showDetailRef.current = showDetail; }, [showDetail]);

	// Handle browser back button — close modal
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

	// Reset to page 1 if current page is out of bounds (e.g. after switching accounts or filtering)
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
			case 'Mới': return 'bg-blue-50 text-blue-600';
			case 'Đang xử lý': return 'bg-orange-50 text-orange-600';
			case 'Đã giao': return 'bg-green-50 text-green-600';
			case 'Đã hủy': return 'bg-red-50 text-red-600';
			default: return 'bg-gray-50 text-gray-600';
		}
	};

	// 🔧 REFACTOR: Dùng useProducts — thay thế getDocs one-time fetch trong updateStatus
	const { products: allProducts } = useProducts({
		ownerId: owner.ownerId,
		enabled: !owner.loading && !!owner.ownerId,
	});

	const updateStatus = async (id: string, newStatus: string) => {
		try {
			const order = orders.find(o => o.id === id);
			
			// 1. Nếu chuyển sang Đơn chốt, cần kiểm tra và trừ tồn kho
			if (newStatus === 'Đơn chốt') {
				// 🔧 REFACTOR: Dùng dữ liệu từ useProducts hook thay vì getDocs one-time
				const normalizeText = (text: any) => text ? String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() : '';
				
				let isMissing = false;
				const missingSkus: string[] = [];
				const stockDeletions: any[] = [];
				
				for (const item of order?.products || []) {
					let remainingQty = Number(item.qty) || 0;
					const sourceProduct = allProducts.find(p => p.id === item.id);
					const cleanSku = normalizeText(sourceProduct?.sku || item.sku);
					
					let stockCandidates: any[] = [];
					if (sourceProduct?.linkedProductId) {
						const linked = allProducts.find(p => p.id === sourceProduct.linkedProductId);
						if (linked) stockCandidates = [linked];
					} else if (cleanSku) {
						stockCandidates = allProducts
							.filter(p => normalizeText(p.sku) === cleanSku && !p.linkedProductId)
							.sort((a: any, b: any) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
					}
					if (stockCandidates.length === 0 && sourceProduct) {
						stockCandidates = [sourceProduct];
					}
					
					for (const cand of stockCandidates) {
						if (remainingQty <= 0) break;
						const available = Number(cand.stock) || 0;
						if (available <= 0) continue;
						const take = Math.min(remainingQty, available);
						stockDeletions.push({
							productId: cand.id,
							qty: take,
							productName: cand.name
						});
						remainingQty -= take;
					}
					
					if (remainingQty > 0) {
						isMissing = true;
						if (cleanSku) missingSkus.push(sourceProduct?.sku || item.sku);
					}
				}
				
				if (isMissing) {
					showToast("Tồn kho không đủ cho một số mặt hàng! Chuyển đến trang Sản phẩm để nhập kho...", "error");
					setTimeout(() => {
						navigate('/inventory', { state: { missingSkus } });
					}, 1500);
					return;
				}
				
				// Nếu đủ hàng, thực hiện trừ tồn kho
				const batch = writeBatch(db);
				stockDeletions.forEach(del => {
					const prodRef = doc(db, 'products', del.productId);
					batch.update(prodRef, { stock: increment(-del.qty) });
					
					const invLogRef = doc(collection(db, 'inventory_logs'));
					batch.set(invLogRef, {
						productId: del.productId,
						orderId: id,
						customerName: order?.customerName || 'Khách',
						productName: del.productName,
						type: 'out',
						qty: del.qty,
						note: `Xuất đơn hàng (FIFO) (Từ chuyển trạng thái Đơn chốt)`,
						ownerId: owner.ownerId || '',
						user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
						createdAt: serverTimestamp()
					});
				});
				
				// Cập nhật trạng thái đơn và công nợ (nếu cần)
				batch.update(doc(db, 'orders', id), {
					status: newStatus,
					updatedAt: serverTimestamp()
				});

				if (order?.customerId && order?.status !== 'Đơn chốt') {
					batch.update(doc(db, 'customers', order.customerId), {
						debt: increment(Number(order.totalAmount || 0))
					});
					// 📊 Ghi vào debts collection
					const debtRef = doc(collection(db, 'debts'));
					batch.set(debtRef, {
						customerId: order.customerId,
						customerName: order.customerName || '',
						type: 'debt_increase',
						amount: Number(order.totalAmount || 0),
						orderId: id,
						note: 'Chốt đơn hàng',
						ownerId: owner.ownerId || '',
						createdBy: auth.currentUser?.uid || '',
						createdAt: serverTimestamp()
					});
				}
				
				const auditRef = doc(collection(db, 'audit_logs'));
				batch.set(auditRef, {
					action: 'Cập nhật trạng thái đơn',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					userId: auth.currentUser?.uid || "",
					ownerId: owner.ownerId,
					details: `Đã đổi đơn hàng của ${order?.customerName || 'Khách'} sang: ${newStatus}`,
					createdAt: serverTimestamp()
				});
				
				await batch.commit();
				showToast("Đã chốt đơn và xuất kho thành công", "success");

				if (newStatus === 'Đơn chốt') {
					sendTelegramNotification(owner.ownerId, `📦 <b>ĐƠN HÀNG MỚI (CHỐT)</b>\n- Khách hàng: <b>${order?.customerName}</b>\n- Tổng tiền: <b>${formatPrice(order?.totalAmount || 0)}</b>\n- Người thao tác: ${auth.currentUser?.displayName || 'Admin'}`);
				}
				return;
			}

			// 2. Chuyển các trạng thái khác (Không trừ tồn kho)
			const batch = writeBatch(db);
			batch.update(doc(db, 'orders', id), {
				status: newStatus,
				updatedAt: serverTimestamp()
			});

			if (order?.customerId && order?.status === 'Đơn chốt') {
				batch.update(doc(db, 'customers', order.customerId), {
					debt: increment(-Number(order.totalAmount || 0))
				});
				// 📊 Ghi vào debts collection
				const debtRef = doc(collection(db, 'debts'));
				batch.set(debtRef, {
					customerId: order.customerId,
					customerName: order.customerName || '',
					type: 'payment',
					amount: Number(order.totalAmount || 0),
					orderId: id,
					note: newStatus === 'Đã hủy' ? 'Hủy đơn hàng' : 'Bỏ chốt đơn hàng',
					ownerId: owner.ownerId || '',
					createdBy: auth.currentUser?.uid || '',
					createdAt: serverTimestamp()
				});
			}

			// Log Status Update
			batch.set(doc(collection(db, 'audit_logs')), {
				action: 'Cập nhật trạng thái đơn',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid || "",
				ownerId: owner.ownerId,
				details: `Đã đổi đơn hàng của ${order?.customerName || 'Khách'} sang: ${newStatus}`,
				createdAt: serverTimestamp()
			});

			await batch.commit();
			showToast("Đã cập nhật trạng thái", "success");

			if (newStatus === 'Đã hủy') {
				sendTelegramNotification(owner.ownerId, `❌ <b>ĐƠN HÀNG ĐÃ HỦY</b>\n- Khách hàng: <b>${order?.customerName}</b>\n- Tổng tiền: <b>${formatPrice(order?.totalAmount || 0)}</b>\n- Người thao tác: ${auth.currentUser?.displayName || 'Admin'}`);
			}
		} catch (error) {
			console.error("Lỗi cập nhật trạng thái:", error);
			showToast("Lỗi khi cập nhật trạng thái", "error");
		}
	};

	const handleDeleteClick = (id: string) => {
		setConfirmDeleteId(id);
	};

	const handleDeleteCancel = () => {
		setConfirmDeleteId(null);
	};

	const deleteOrder = async (id: string) => {
		setConfirmDeleteId(null);
		try {
				const order = orders.find(o => o.id === id);
				const batch = writeBatch(db);

				// 1. Revert Inventory
				const logsQ = query(
					collection(db, 'inventory_logs'), 
					where('ownerId', '==', owner.ownerId),
					where('orderId', '==', id)
				);
				const logsSnap = await getDocs(logsQ);

				for (const logDoc of logsSnap.docs) {
					const logData = logDoc.data();
					if (logData.productId && logData.qty) {
						const prodRef = doc(db, 'products', logData.productId);
						// Safety check: only update if product still exists
						const prodSnap = await getDoc(prodRef);
						if (prodSnap.exists()) {
							batch.update(prodRef, {
								stock: increment(logData.qty)
							});
						}
					}
					batch.delete(logDoc.ref);
				}

				// 2. Delete Order
				batch.delete(doc(db, 'orders', id));

				// 2.5 Revert Debt
				if (order?.status === 'Đơn chốt' && order?.customerId) {
					const custRef = doc(db, 'customers', order.customerId);
					const custSnap = await getDoc(custRef);
					if (custSnap.exists()) {
						batch.update(custRef, {
							debt: increment(-Number(order.totalAmount || 0))
						});
					}
					// 📊 Ghi vào debts collection
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
				setDeleteSuccessId(id);
				setDeleteSuccessMsg(msg);
				setTimeout(() => { setDeleteSuccessId(null); setDeleteSuccessMsg(''); }, 3000);

				if (order?.status === 'Đơn chốt') {
					sendTelegramNotification(owner.ownerId, `🗑️ <b>ĐƠN CHỐT ĐÃ BỊ XÓA</b>\n- Khách hàng: <b>${order?.customerName}</b>\n- Tổng tiền: <b>${formatPrice(order?.totalAmount || 0)}</b>\n- Người thao tác: ${auth.currentUser?.displayName || 'Admin'}`);
				}
			} catch (error) {
				showToast("Lỗi khi xóa đơn hàng", "error");
				console.error(error);
			}
	};

	// Stats - Only count "Đơn chốt" orders that match filters
	const confirmedOrders = filteredOrders.filter(o => o.status === 'Đơn chốt');
	const totalConfirmedCount = confirmedOrders.length;
	const totalProfit = isAdmin ? confirmedOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0) : 0;
	const totalDiscount = confirmedOrders.reduce((sum, o) => sum + (o.discountValue || 0), 0);
	const totalRevenue = confirmedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

	// Hiển thị thông báo xóa thành công inline (thay vì toast)
	const renderDeleteSuccess = () => deleteSuccessMsg ? (
		<div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2 text-green-700 dark:text-green-300 text-sm font-semibold animate-in slide-in-from-top-2">
			<span className="material-symbols-outlined text-lg">check_circle</span>
			{deleteSuccessMsg}
		</div>
	) : null;

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
				<div className="flex items-center gap-4">
					<div className="hidden md:relative md:block">
						<span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">search</span>
						<input
							ref={searchRef}
							type="text"
							placeholder="Tìm đơn hàng, khách..."
							className="pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-transparent rounded-xl text-sm font-black focus:ring-2 focus:ring-[#FF6D00]/30 w-64 transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-500"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>
					{/* 🗓️ Desktop: Lọc thời gian cạnh ô tìm kiếm */}
					<button
						onClick={() => setShowFilterOptions(!showFilterOptions)}
						className="hidden md:flex items-center gap-2 text-sm font-bold text-[#1A237E] dark:text-indigo-400 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
					>
						<span className="material-symbols-outlined text-lg">filter_alt</span>
						Lọc thời gian
					</button>
					{/* 🗓️ Mobile: Lọc thời gian */}
					<button
						onClick={() => setShowFilterOptions(!showFilterOptions)}
						className="md:hidden flex items-center gap-2 text-sm font-bold text-[#1A237E] dark:text-indigo-400 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-all"
					>
						<span className="material-symbols-outlined text-lg">filter_alt</span>
						Lọc
					</button>
					<button
						onClick={() => navigate('/quick-order')}
						className="hidden md:flex bg-[#1A237E] hover:bg-[#121858] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-900/10 hover:shadow-lg transition-all duration-200 items-center gap-2 active:scale-95"
					>
						<span className="material-symbols-outlined text-lg">add_shopping_cart</span>
						<span>Lên đơn nhanh</span>
					</button>
				</div>
			</header>

			{/* 🗓️ Filter Panel — hiện khi bấm nút Lọc (mobile + desktop) */}
			{showFilterOptions && (
				<div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-4 animate-in slide-in-from-top-2 duration-200">
					<div className="flex flex-wrap items-center gap-3">
						<div>
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Từ ngày</label>
							<input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#1A237E]/20" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
						</div>
						<div>
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Đến ngày</label>
							<input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#1A237E]/20" value={toDate} onChange={(e) => setToDate(e.target.value)} />
						</div>
						{(fromDate || toDate) && (
							<button
								onClick={() => { setFromDate(''); setToDate(''); }}
								className="self-end text-xs font-bold text-red-400 hover:text-red-500 mt-1"
							>
								✕ Xoá lọc
							</button>
						)}
					</div>
				</div>
			)}

			{/* CONTENT */}
			<div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar print:hidden">

				{/* Mobile Search Bar - Conditional */}
				{showMobileSearch && (
					<div className="md:hidden mb-6 animate-in slide-in-from-top duration-300">
						<div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
							<span className="material-symbols-outlined text-slate-400">search</span>
							<input
								id="mobile-search-input"
								ref={searchRef}
								type="text"
								placeholder="Nhập mã đơn, tên khách..."
								className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-900 dark:text-white"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
							{searchTerm && (
								<button onClick={() => setSearchTerm('')} className="text-slate-300">
									<span className="material-symbols-outlined text-lg">cancel</span>
								</button>
							)}
							<button
								onClick={() => setShowMobileSearch(false)}
								className="text-blue-500 font-bold text-xs"
							>
								Đóng
							</button>
						</div>
					</div>
				)}

{/* Stats Cards */}
				<div className="grid grid-cols-3 gap-2 mb-8">
					<StatCard icon="receipt_long" label="Tổng đơn chốt" value={totalConfirmedCount.toString()} color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" />
					<StatCard icon="payments" label="Doanh thu" value={formatCompactPrice(totalRevenue)} color="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" />
					<StatCard icon="trending_up" label="Lợi nhuận" value={formatCompactPrice(totalProfit)} color="bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400" />
				</div>

				{/* Desktop Table */}
				<div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-x-auto custom-scrollbar overflow-y-hidden transition-colors duration-300">
					<table className="w-full text-left min-w-[800px]">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em]">Đơn hàng</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em]">Khách hàng</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em] text-center">Trạng thái</th>
								{isAdmin && <th className="py-4 px-6 text-[10px] font-black text-pink-500 dark:text-pink-400 uppercase tracking-[0.1em] text-right">Lợi nhuận</th>}
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em] text-right">Tổng tiền</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em] text-right">Hành động</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 dark:divide-slate-800">
							{loading ? (
								[1, 2, 3, 4, 5].map(i => (
									<tr key={i} className="animate-pulse">
										<td className="py-4 px-6 border-b border-slate-50 dark:border-slate-800">
											<div className="w-20 h-4 skeleton mb-2" />
											<div className="w-32 h-3 skeleton opacity-50" />
										</td>
										<td className="py-4 px-6 border-b border-slate-50 dark:border-slate-800">
											<div className="flex items-center gap-3">
												<div className="size-8 rounded-full skeleton" />
												<div className="space-y-2">
													<div className="w-32 h-4 skeleton" />
													<div className="w-20 h-3 skeleton opacity-50" />
												</div>
											</div>
										</td>
										<td className="py-4 px-6 border-b border-slate-50 dark:border-slate-800"><div className="w-20 h-6 skeleton mx-auto rounded-full" /></td>
										{isAdmin && <td className="py-4 px-6 border-b border-slate-50 dark:border-slate-800"><div className="w-20 h-5 skeleton ml-auto" /></td>}
										<td className="py-4 px-6 border-b border-slate-50 dark:border-slate-800"><div className="w-24 h-5 skeleton ml-auto" /></td>
										<td className="py-4 px-6 border-b border-slate-50 dark:border-slate-800"><div className="w-16 h-8 skeleton ml-auto rounded-lg" /></td>
									</tr>
								))
							) : paginatedOrders.length === 0 ? (
								<tr><td colSpan={isAdmin ? 6 : 5} className="py-12 text-center">
									<div className="flex flex-col items-center gap-2">
										<span className="material-symbols-outlined text-4xl text-slate-200 dark:text-slate-700">inventory_2</span>
										<p className="text-slate-400 dark:text-slate-500 font-medium">Không tìm thấy đơn hàng nào</p>
									</div>
								</td></tr>
							) : paginatedOrders.map((order) => (
								<tr key={order.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => openDetail(order)}>
									<td className="py-4 px-6">
										<div className="font-black text-slate-900 dark:text-indigo-400">#{order.id.slice(0, 8).toUpperCase()}</div>
										<div className="text-[10px] text-slate-500 dark:text-slate-500 font-black uppercase tracking-tighter">{formatOrderDate(order.createdAt)}</div>
									</td>
									<td className="py-4 px-6">
										<div className="flex items-center gap-3">
											<div className="size-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-black text-xs text-slate-700 dark:text-indigo-400 border border-slate-300 dark:border-slate-700">
												{(order.customerBusinessName || order.customerName || 'K')[0].toUpperCase()}
											</div>
											<div>
												<div className="font-black text-slate-800 dark:text-slate-200">{order.customerBusinessName || order.customerName || 'Khách vãng lai'}</div>
												<div className="text-[10px] text-slate-500 dark:text-slate-500 font-bold">{order.customerPhone || '---'}</div>
											</div>
										</div>
									</td>
									<td className="py-4 px-6 text-center">
										<span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(order.status ?? '')}`}>
											{order.status}
										</span>
									</td>
									{isAdmin && (
										<td className="py-4 px-6 text-right font-black text-pink-500 dark:text-pink-400">
											{formatPrice(order.totalProfit || 0)}
										</td>
									)}
									<td className="py-4 px-6 text-right font-black text-slate-900 dark:text-indigo-400">
										{formatPrice(order.totalAmount || 0)}
									</td>
									<td className="py-4 px-6 text-right">
										<div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
											<button onClick={() => navigate(`/quick-order/${order.id}`)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-orange-500 dark:hover:text-orange-400 transition-colors">
												<span className="material-symbols-outlined text-[20px]">edit</span>
											</button>
											{confirmDeleteId === order.id ? (
													<>
														<button onClick={() => deleteOrder(order.id)} className="p-2 text-green-500 hover:text-green-600 transition-colors">
															<span className="material-symbols-outlined text-[20px]">check</span>
														</button>
														<button onClick={handleDeleteCancel} className="p-2 text-slate-400 hover:text-slate-500 transition-colors">
															<span className="material-symbols-outlined text-[20px]">close</span>
														</button>
													</>
												) : (
													<button onClick={() => handleDeleteClick(order.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
														<span className="material-symbols-outlined text-[20px]">delete</span>
													</button>
												)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Mobile List */}
				<div className="md:hidden space-y-4 pb-12">
					{loading ? (
						[1, 2, 3, 4, 5].map(i => (
							<div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800 animate-pulse space-y-4">
								<div className="flex justify-between items-start">
									<div className="flex items-center gap-3">
										<div className="size-10 rounded-xl skeleton" />
										<div className="space-y-2">
											<div className="w-24 h-4 skeleton" />
											<div className="w-32 h-3 skeleton" />
										</div>
									</div>
									<div className="w-16 h-6 skeleton rounded-lg" />
								</div>
								<div className="flex justify-between items-center pt-2 border-t border-gray-50 dark:border-slate-800">
									<div className="w-20 h-3 skeleton" />
									<div className="w-24 h-6 skeleton" />
								</div>
							</div>
						))
					) : paginatedOrders.map((order) => (
						<div key={order.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800 active:scale-[0.98] transition-all" onClick={() => openDetail(order)}>
							<div className="flex justify-between items-start mb-3">
								<div className="flex items-center gap-3">
									<div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#1A237E] dark:text-indigo-400">
										<span className="material-symbols-outlined">receipt_long</span>
									</div>
									<div>
										<div className="flex items-center gap-2">
											<div className="font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight line-clamp-2 break-words">{order.customerBusinessName || order.customerName || 'Khách vãng lai'}</div>
										</div>
										<div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">#{order.id.slice(0, 8).toUpperCase()}</div>
									</div>
								</div>
								<div className="flex flex-col items-end gap-2">
									<span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${getStatusColor(order.status ?? '')}`}>
										{order.status}
									</span>
									<div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
										<button onClick={() => navigate(`/quick-order/${order.id}`)} className="p-1 text-orange-500"><span className="material-symbols-outlined text-sm">edit</span></button>
										{confirmDeleteId === order.id ? (
											<>
												<button onClick={() => deleteOrder(order.id)} className="p-1 text-green-500"><span className="material-symbols-outlined text-sm">check</span></button>
												<button onClick={handleDeleteCancel} className="p-1 text-slate-400"><span className="material-symbols-outlined text-sm">close</span></button>
											</>
										) : (
											<button onClick={() => handleDeleteClick(order.id)} className="p-1 text-red-500"><span className="material-symbols-outlined text-sm">delete</span></button>
										)}
									</div>
								</div>
							</div>
							{isAdmin && (
								<div className="flex justify-between items-center mb-2 px-1">
									<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lợi nhuận:</span>
									<span className="text-xs font-black text-pink-500">{formatPrice(order.totalProfit || 0)}</span>
								</div>
							)}
							<div className="flex justify-between items-baseline pt-2 border-t border-gray-50 dark:border-slate-800">
								<span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">{formatOrderDateOnly(order.createdAt)}</span>
								<span className="font-black text-[#FF6D00] text-lg">{formatPrice(order.totalAmount || 0)}</span>
							</div>
						</div>
					))}
				</div>

				{/* Pagination Controls */}
				{totalPages > 1 && (
					<div className="mt-8 mb-24 flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
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
