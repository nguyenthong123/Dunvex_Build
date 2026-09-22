import React, { useState, useEffect, useRef } from 'react';
import { Tag, Copy, Check, Ticket, Clock, Info, Search, ChevronRight, Gift, Percent, Filter, Plus, Trash2, Edit3, X, Calendar, Truck, DollarSign, RotateCcw, Package } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from '../services/firebase';
import { db, auth } from '../services/firebase';
import { useOwner } from '../hooks/useOwner';
import { useCoupons } from '../hooks/useCoupons';
import { useProducts } from '../hooks/useProducts';
import { smartSearchMatch } from '../utils/searchUtils';
import { useToast } from '../components/shared/Toast';
import RebatePanel from '../components/RebatePanel';
import { useLocation, useNavigate } from 'react-router-dom';

const Coupons = () => {
	const owner = useOwner();
	const { showToast, showConfirm } = useToast();
	const location = useLocation();
	const navigate = useNavigate();
	const { coupons, loading } = useCoupons({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId });
	const [searchTerm, setSearchTerm] = useState('');
	const [copiedCode, setCopiedCode] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState('all');
	const [mainTab, setMainTab] = useState<'coupons' | 'rebate'>('coupons');
	const [detailCoupon, setDetailCoupon] = useState<any>(null);

	// CRUD State
	const [showModal, setShowModal] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [currentId, setCurrentId] = useState<string | null>(null);
	const [productSearch, setProductSearch] = useState('');
	const [showProductDropdown, setShowProductDropdown] = useState(false);
	const { products } = useProducts({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId });

	const [formData, setFormData] = useState({
		code: '',
		title: '',
		description: '',
		discount: '',
		expiry: '',
		type: 'percentage',
		scope: 'order',
		targetProductIds: [] as string[],
		targetProductNames: [] as string[],
		targetProductSkus: [] as string[],
		status: 'active',
		usageLimit: 0,
		usageCount: 0
	});

	const isAdmin = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee;

	const handleAddProduct = (p: any) => {
		const currentIds = Array.isArray(formData.targetProductIds) ? formData.targetProductIds : [];
		if (!currentIds.includes(p.id)) {
			setFormData(prev => ({
				...prev,
				targetProductIds: [...(Array.isArray(prev.targetProductIds) ? prev.targetProductIds : []), p.id],
				targetProductNames: [...(Array.isArray(prev.targetProductNames) ? prev.targetProductNames : []), p.name || ''],
				targetProductSkus: [...(Array.isArray(prev.targetProductSkus) ? prev.targetProductSkus : []), p.sku || '']
			}));
		}
		setProductSearch('');
		setShowProductDropdown(false);
	};

	const handleRemoveProduct = (productId: string) => {
		setFormData(prev => {
			const currentIds = Array.isArray(prev.targetProductIds) ? prev.targetProductIds : [];
			const currentNames = Array.isArray(prev.targetProductNames) ? prev.targetProductNames : [];
			const currentSkus = Array.isArray(prev.targetProductSkus) ? prev.targetProductSkus : [];

			const index = currentIds.indexOf(productId);
			if (index === -1) return prev;
			const newIds = [...currentIds];
			const newNames = [...currentNames];
			const newSkus = [...currentSkus];
			newIds.splice(index, 1);
			newNames.splice(index, 1);
			newSkus.splice(index, 1);
			return {
				...prev,
				targetProductIds: newIds,
				targetProductNames: newNames,
				targetProductSkus: newSkus
			};
		});
	};

	const generateRandomCode = () => {
		const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let result = '';
		for (let i = 0; i < 8; i++) {
			result += characters.charAt(Math.floor(Math.random() * characters.length));
		}
		return result;
	};

	const handleOpenModal = (coupon: any = null) => {
		setProductSearch('');
		setShowProductDropdown(false);

		if (coupon && !coupon.isDemo) {
			setIsEditing(true);
			setCurrentId(coupon.id);
			setFormData({
				code: coupon.code || '',
				title: coupon.title || '',
				description: coupon.description || '',
				discount: coupon.discount || '',
				expiry: coupon.expiry || '',
				type: coupon.type || 'percentage',
				scope: coupon.scope || 'order',
				targetProductIds: Array.isArray(coupon.targetProductIds) ? coupon.targetProductIds : [],
				targetProductNames: Array.isArray(coupon.targetProductNames) ? coupon.targetProductNames : [],
				targetProductSkus: Array.isArray(coupon.targetProductSkus) ? coupon.targetProductSkus : [],
				status: coupon.status || 'active',
				usageLimit: Number(coupon.usageLimit) || 0,
				usageCount: Number(coupon.usageCount) || 0
			});
		} else {
			setIsEditing(false);
			setCurrentId(null);
			setFormData({
				code: generateRandomCode(),
				title: '',
				description: '',
				discount: '',
				expiry: '',
				type: 'percentage',
				scope: 'order',
				targetProductIds: [],
				targetProductNames: [],
				targetProductSkus: [],
				status: 'active',
				usageLimit: 10,
				usageCount: 0
			});
		}
		setShowModal(true);
		navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
	};

	const handleOpenProductCouponModal = () => {
		handleOpenModal();
		setFormData(prev => ({
			...prev,
			scope: 'product',
			title: 'Chiết khấu sản phẩm bán chậm',
			discount: '10'
		}));
	};

	const openModal = () => {
		handleOpenModal();
	};

	// Track modal state for back button
	const showModalRef = useRef(showModal);
	useEffect(() => { showModalRef.current = showModal; }, [showModal]);

	// Handle browser back button — close modal
	useEffect(() => {
		const handlePopState = () => {
			if (showModalRef.current) {
				setShowModal(false);
			}
		};
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	// Handle center button action from URL
	useEffect(() => {
		const params = new URLSearchParams(location.search);
		if (params.get('action') === 'new' && isAdmin) {
			handleOpenModal();
			navigate(location.pathname, { replace: true });
		}
	}, [location.search, isAdmin, navigate]);

	// Automatic Expiration Management
	useEffect(() => {
		if (owner.loading || !owner.ownerId || (coupons || []).length === 0 || !isAdmin) return;

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const checkExpirations = async () => {
			const expiredCoupons = (coupons || []).filter(c => c && !c.isDemo && c.expiry && new Date(c.expiry) < today);
			const nearlyExpiredCoupons = (coupons || []).filter(c => {
				if (!c || c.isDemo || !c.expiry) return false;
				const expDate = new Date(c.expiry);
				const diffTime = expDate.getTime() - today.getTime();
				const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
				return diffDays >= 0 && diffDays <= 3;
			});

			// Auto-delete expired
			if (expiredCoupons.length > 0) {
				let deletedCount = 0;
				for (const coupon of expiredCoupons) {
					try {
						await deleteDoc(doc(db, 'coupons', coupon.id));
						deletedCount++;
					} catch (err) {
						console.error("Error auto-deleting coupon:", err);
					}
				}
				if (deletedCount > 0) {
					showToast(`Đã tự động xoá ${deletedCount} mã giảm giá hết hạn`, "info");
				}
			}

			// Notify nearly expired (throttled to once every 12h)
			const notifiedKey = `last_notified_expiring_${owner.ownerId}`;
			const lastNotified = localStorage.getItem(notifiedKey);
			const now = Date.now();

			if (nearlyExpiredCoupons.length > 0 && (!lastNotified || now - parseInt(lastNotified) > 12 * 60 * 60 * 1000)) {
				nearlyExpiredCoupons.forEach(c => {
					showToast(`Mã "${c.code}" sắp hết hạn (còn dưới 3 ngày) và sẽ bị xóa theo quy định`, "warning");
				});
				localStorage.setItem(notifiedKey, now.toString());
			}
		};

		checkExpirations();
	}, [coupons, isAdmin, owner.ownerId]);

	const handleCopy = (code: string) => {
		navigator.clipboard.writeText(code);
		setCopiedCode(code);
		showToast(`Đã sao chép mã: ${code}`, "success");
		setTimeout(() => setCopiedCode(null), 2000);
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const data = {
				...formData,
				code: formData.code.toUpperCase().trim(),
				ownerId: owner.ownerId,
				ownerEmail: owner.ownerEmail || auth.currentUser?.email || '',
				createdByEmail: auth.currentUser?.email || '',
				createdByUid: auth.currentUser?.uid || '',
				updatedAt: serverTimestamp()
			};

			if (isEditing && currentId) {
				await updateDoc(doc(db, 'coupons', currentId), data);
				showToast("Đã cập nhật mã giảm giá", "success");
			} else {
				await addDoc(collection(db, 'coupons'), {
					...data,
					createdAt: serverTimestamp()
				});
				showToast("Đã tạo mã giảm giá mới", "success");
			}
			setShowModal(false);
		} catch (error) {
			showToast("Lỗi khi lưu: " + error, "error");
		}
	};

	const handleDelete = async (id: string, isDemo: boolean) => {
		if (isDemo) {
			showToast("Không thể xoá mã mẫu", "warning");
			return;
		}
		showConfirm(
			"Xóa mã giảm giá",
			"Bạn có chắc chắn muốn xóa mã giảm giá này?",
			async () => {
				try {
					await deleteDoc(doc(db, 'coupons', id));
					showToast("Đã xoá mã giảm giá", "success");
				} catch (error) {
					showToast("Lỗi khi xoá: " + error, "error");
				}
			}
		);
	};

	const formatCurrency = (val: string | number) => {
		const num = Number(val);
		if (isNaN(num)) return val;
		if (num >= 1000000) {
			return (num / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'Tr';
		}
		if (num >= 1000) {
			return (num / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'K';
		}
		return num.toLocaleString('vi-VN');
	};

	const formatFullCurrency = (val: string | number) => {
		const num = Number(val);
		if (isNaN(num)) return val;
		return num.toLocaleString('vi-VN') + 'đ';
	};

	const filteredCoupons = (coupons || []).filter(c => {
		if (!c) return false;
		const codeStr = String(c.code || '').toLowerCase();
		const titleStr = String(c.title || '').toLowerCase();
		const searchStr = (searchTerm || '').toLowerCase();
		const matchesSearch = codeStr.includes(searchStr) || titleStr.includes(searchStr);
		if (!matchesSearch) return false;
		if (activeTab === 'all') return true;
		if (activeTab === 'product') return c.scope === 'product' || (Array.isArray(c.targetProductIds) && c.targetProductIds.length > 0);
		if (activeTab === 'order') return !c.scope || c.scope === 'order';
		if (activeTab === 'active') return c.status === 'active';
		if (activeTab === 'expired') return c.status === 'expired' || (c.expiry && new Date(c.expiry) < new Date());
		return true;
	});

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="w-10 h-10 border-4 border-[#f27121] border-t-transparent rounded-full animate-spin"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 p-4 md:p-8 pb-32 transition-colors duration-300">
			<div className="max-w-3xl mx-auto">

				{/* MAIN TAB SWITCHER */}
				<div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6">
					<button
						onClick={() => setMainTab('coupons')}
						className={mainTab === 'coupons'
							? 'flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-white dark:bg-slate-900 text-[#1A237E] dark:text-indigo-400 shadow-sm'
							: 'flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-slate-400 hover:text-slate-600'}
					>
						<Gift size={14} className="inline mr-1.5" /> Mã giảm giá & Ưu đãi
					</button>
					<button
						onClick={() => setMainTab('rebate')}
						className={mainTab === 'rebate'
							? 'flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-white dark:bg-slate-900 text-[#1A237E] dark:text-indigo-400 shadow-sm'
							: 'flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-slate-400 hover:text-slate-600'}
					>
						<Percent size={14} className="inline mr-1.5" /> Chiết khấu trả sau
					</button>
				</div>

				{/* REBATE PANEL — shows only on rebate tab */}
				{mainTab === 'rebate' && (
					<RebatePanel ownerId={owner.ownerId} isAdmin={isAdmin} />
				)}

				{/* COUPONS CONTENT — hidden on rebate tab via CSS */}
				<div className={mainTab === 'rebate' ? 'hidden' : ''}>

				{/* HEADER */}
				<div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
					<div>
						<h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
							<Gift className="text-[#f27121]" size={28} />
							Mã Giảm Giá & Ưu Đãi
						</h1>
						<p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Quản lý mã ưu đãi toàn đơn & chiết khấu sản phẩm bán chậm</p>
					</div>
					{isAdmin && (
						<div className="flex flex-wrap items-center gap-2.5 shrink-0">
							<button
								onClick={handleOpenProductCouponModal}
								className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
							>
								<Package size={16} />
								+ Chiết khấu theo SP
							</button>
							<button
								onClick={() => handleOpenModal()}
								className="bg-[#1A237E] text-white px-4 py-3 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-900 shadow-xl shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
							>
								<Plus size={16} />
								Tạo mã toàn đơn
							</button>
						</div>
					)}
				</div>

				{/* SEARCH & FILTERS */}
				<div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 mb-6 flex flex-col gap-4 transition-all overflow-hidden">
					<div className="relative">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
						<input
							type="text"
							placeholder="Tìm kiếm ưu đãi..."
							className="w-full pl-12 pr-4 h-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-[#f27121]/20 transition-all"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					<div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
						{[
							{ id: 'all', label: 'Tất cả' },
							{ id: 'product', label: '📦 Chiết khấu theo sản phẩm' },
							{ id: 'order', label: '🏷️ Mã toàn đơn' },
							{ id: 'active', label: 'Đang chạy' },
							{ id: 'expired', label: 'Đã hết hạn' }
						].map((tab) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === tab.id
									? 'bg-[#1A237E] text-white shadow-lg shadow-indigo-200 dark:shadow-none'
									: 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
									}`}
							>
								{tab.label}
							</button>
						))}
					</div>
				</div>

				{/* COUPON LIST */}
				<div className="space-y-4">
					{filteredCoupons.map((coupon) => (
						<div
							key={coupon.id}
							onClick={() => setDetailCoupon(coupon)}
							className="group bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-orange-500/5 transition-all relative cursor-pointer"
						>
							<div className="flex">
								{/* Left Side - Brand/Discount */}
								<div className={`w-28 md:w-40 flex flex-col items-center justify-center p-4 text-white shrink-0 relative overflow-hidden transition-colors ${coupon.type === 'percentage' ? 'bg-gradient-to-br from-[#f27121] to-[#ffc107]' :
									coupon.type === 'fixed' ? 'bg-gradient-to-br from-[#1A237E] to-[#4facfe]' :
										'bg-gradient-to-br from-[#00c853] to-[#b2ff59]'
									}`}>
									<div className="absolute top-0 bottom-0 -right-2 w-4 flex flex-col justify-around py-1">
										{[...Array(8)].map((_, i) => (
											<div key={i} className="w-2 h-2 bg-[#f8f9fb] dark:bg-slate-950 rounded-full"></div>
										))}
									</div>
									<div className="bg-white/20 p-2 rounded-xl mb-1">
										{coupon.type === 'percentage' ? <Percent size={20} /> :
											coupon.type === 'fixed' ? <DollarSign size={20} /> : <Truck size={20} />}
									</div>
									<div className="flex flex-col items-center text-center">
										{coupon.type === 'fixed' ? (
											<>
												<span className="text-xl md:text-2xl font-black leading-tight tracking-tighter">{formatCurrency(coupon.discount)}</span>
												<span className="text-[8px] opacity-70 font-bold whitespace-nowrap">{formatFullCurrency(coupon.discount)}</span>
											</>
										) : (
											<span className="text-xl md:text-2xl font-black">{coupon.discount}%</span>
										)}
									</div>
									<span className="text-[10px] mt-1 font-black uppercase tracking-tighter opacity-80">
										{coupon.type === 'percentage' ? 'GIẢM GIÁ' : coupon.type === 'fixed' ? 'TRỪ TIỀN' : 'VẬN CHUYỂN'}
									</span>
								</div>

								{/* Right Side - Content */}
								<div className="flex-1 p-5 md:p-6 flex flex-col justify-between overflow-hidden">
									{isAdmin && !coupon.isDemo && (
										<div className="absolute top-4 right-4 flex gap-2 md:opacity-0 group-hover:opacity-100 transition-all z-10">
											<button
												onClick={(e) => { e.stopPropagation(); handleOpenModal(coupon); }}
												className="size-9 bg-white dark:bg-slate-800 text-slate-400 hover:text-indigo-500 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-all active:scale-90"
											>
												<Edit3 size={16} />
											</button>
											<button
												onClick={(e) => { e.stopPropagation(); handleDelete(coupon.id, !!coupon.isDemo); }}
												className="size-9 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-all active:scale-90"
											>
												<Trash2 size={16} />
											</button>
										</div>
									)}

									<div className="pr-12 md:pr-0">
										<div className="flex items-start justify-between mb-1 gap-2">
											<h3 className="text-sm md:text-base font-black text-slate-800 dark:text-white uppercase leading-tight line-clamp-1">{coupon.title}</h3>
											{coupon.scope === 'product' ? (
												<span className="shrink-0 text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-0.5 rounded-md uppercase tracking-tight">
													Theo SP ({coupon.targetProductNames?.length || coupon.targetProductIds?.length || 0})
												</span>
											) : (
												<span className="shrink-0 text-[9px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md uppercase tracking-tight">
													Toàn đơn
												</span>
											)}
										</div>
										<p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2">{coupon.description}</p>
									</div>

									<div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
										<div className="flex items-center gap-4">
											<div className="flex items-center gap-1.5 text-slate-400">
												<Clock size={14} />
												<span className="text-[10px] font-bold uppercase tracking-tight">Hết: {coupon.expiry || 'Vô thời hạn'}</span>
											</div>
											{coupon.usageLimit > 0 && (
												<div className="flex items-center gap-1.5 text-slate-400">
													<Info size={14} />
													<span className="text-[10px] font-bold uppercase tracking-tight">Dùng: {coupon.usageCount}/{coupon.usageLimit}</span>
												</div>
											)}
										</div>

										<div className="flex items-center gap-2">
											<div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-3 w-full md:w-auto justify-between">
												<span className="text-[14px] font-black text-[#1A237E] dark:text-indigo-400 font-mono tracking-wider">{coupon.code}</span>
												<button
													onClick={(e) => { e.stopPropagation(); handleCopy(coupon.code); }}
													className="size-8 rounded-lg bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-slate-400 hover:text-[#f27121] active:scale-90 transition-all border border-slate-50 dark:border-slate-600"
												>
													{copiedCode === coupon.code ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
												</button>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					))}

					{filteredCoupons.length === 0 && (
						<div className="flex flex-col items-center justify-center py-16 text-center">
							<div className="size-20 bg-indigo-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-indigo-500 mb-4 shadow-inner">
								<Ticket size={36} />
							</div>
							<h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Chưa có mã ưu đãi nào</h3>
							<p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-md">Bắt đầu tạo mã giảm giá toàn đơn hoặc chiết khấu trực tiếp trên sản phẩm bán chậm!</p>

							{isAdmin && (
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 w-full max-w-lg">
									<div
										onClick={handleOpenProductCouponModal}
										className="p-5 bg-white dark:bg-slate-900 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl cursor-pointer text-left transition-all group hover:shadow-lg"
									>
										<div className="size-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
											<Package size={20} />
										</div>
										<h4 className="text-sm font-black text-slate-800 dark:text-white uppercase">Chiết khấu theo SP</h4>
										<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Giảm 10%, 20% hoặc bớt 5k, 10k trực tiếp trên các SP bán chậm</p>
									</div>

									<div
										onClick={() => handleOpenModal()}
										className="p-5 bg-white dark:bg-slate-900 border-2 border-dashed border-amber-200 dark:border-amber-900/50 hover:border-amber-500 dark:hover:border-amber-500 rounded-2xl cursor-pointer text-left transition-all group hover:shadow-lg"
									>
										<div className="size-10 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
											<Gift size={20} />
										</div>
										<h4 className="text-sm font-black text-slate-800 dark:text-white uppercase">Mã giảm toàn đơn</h4>
										<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Giảm theo % tổng hóa đơn hoặc miễn phí vận chuyển</p>
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				{/* BOTTOM TIP */}
				<div className="mt-10 p-6 bg-[#f27121]/5 dark:bg-[#f27121]/10 rounded-[2rem] border border-dashed border-[#f27121]/20">
					<div className="flex gap-4">
						<div className="size-10 rounded-full bg-[#f27121] flex items-center justify-center text-white shrink-0">
							<Info size={20} />
						</div>
						<div>
							<h4 className="text-sm font-black text-slate-800 dark:text-white uppercase">Mẹo nhỏ</h4>
							<p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-1">
								Sao chép mã và dán vào phần "Mã giảm giá" tại trang Quick Order để áp dụng chiết khấu tự động cho đơn hàng!
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* CREATE/EDIT MODAL */}
			{showModal && (
				<div className="fixed inset-0 z-[1000] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
					<div className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] md:rounded-[2.5rem] w-full max-w-lg max-h-[92vh] flex flex-col relative shadow-2xl animate-in slide-in-from-bottom-5 md:zoom-in-95 duration-300">
						{/* Modal Header (Fixed) */}
						<div className="p-6 md:p-10 pb-0 shrink-0">
							<button
								onClick={() => { setShowModal(false); }}
								className="absolute top-6 right-6 size-10 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors z-10"
							>
								<X size={20} />
							</button>

							<div className="mb-6">
								<h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-2">
									{isEditing ? 'Chỉnh Sửa Mã' : 'Tạo Mã Ưu Đãi'}
								</h3>
								<p className="text-sm text-slate-500 font-medium">Cung cấp các thông số giảm giá cho hệ thống</p>
							</div>
						</div>

						{/* Modal Content (Scrollable) */}
						<div className="p-6 md:p-10 pt-0 overflow-y-auto no-scrollbar flex-1">
							<form id="couponForm" onSubmit={handleSave} className="space-y-6">
								<div>
									<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">MÃ CODE (IN HOA)</label>
									<div className="relative">
										<input
											required
											className="w-full h-14 pl-4 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 uppercase transition-all"
											value={formData.code}
											onChange={e => setFormData({ ...formData, code: e.target.value })}
											placeholder="VD: GIAMGIA10"
										/>
										<button
											type="button"
											onClick={() => setFormData({ ...formData, code: generateRandomCode() })}
											className="absolute right-2 top-1/2 -translate-y-1/2 size-10 bg-white dark:bg-slate-700 text-slate-400 hover:text-indigo-500 rounded-xl shadow-sm flex items-center justify-center transition-all active:rotate-180 border border-slate-50 dark:border-slate-600"
											title="Tạo mã ngẫu nhiên"
										>
											<RotateCcw size={18} />
										</button>
									</div>
								</div>

								<div>
									<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">PHẠM VI ÁP DỤNG</label>
									<select
										className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 transition-all appearance-none"
										value={formData.scope}
										onChange={e => setFormData({ ...formData, scope: e.target.value })}
									>
										<option value="order">TOÀN ĐƠN HÀNG</option>
										<option value="product">THEO SẢN PHẨM CHỈ ĐỊNH (SẢN PHẨM BÁN CHẬM)</option>
									</select>
								</div>

								{formData.scope === 'product' && (
									<div className="space-y-3 p-4 bg-indigo-50/50 dark:bg-slate-800/60 border border-indigo-100 dark:border-slate-700 rounded-2xl animate-in fade-in duration-200">
										<label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">DANH SÁCH SẢN PHẨM ĐƯỢC CHIẾT KHẤU</label>
										
										{(formData.targetProductIds || []).length > 0 ? (
											<div className="flex flex-wrap gap-2 mb-2 max-h-36 overflow-y-auto custom-scrollbar">
												{(formData.targetProductIds || []).map((id, i) => (
													<span key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 shadow-sm">
														<Package size={14} className="text-indigo-500 shrink-0" />
														{(formData.targetProductNames && formData.targetProductNames[i]) || id}
														<button
															type="button"
															onClick={() => handleRemoveProduct(id)}
															className="text-slate-400 hover:text-red-500 transition-colors ml-1 shrink-0"
														>
															<X size={14} />
														</button>
													</span>
												))}
											</div>
										) : (
											<p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Chưa chọn sản phẩm nào. Gõ tên sản phẩm để thêm vào danh sách:</p>
										)}

										<div className="relative">
											<input
												type="text"
												placeholder="Gõ tên hoặc SKU sản phẩm để tìm & thêm..."
												className="w-full h-11 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
												value={productSearch}
												onChange={e => {
													setProductSearch(e.target.value);
													setShowProductDropdown(true);
												}}
												onFocus={() => setShowProductDropdown(true)}
											/>
											{showProductDropdown && productSearch.trim() && (
												<div className="absolute z-[1100] top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
													{(products || [])
														.filter(p => smartSearchMatch([p?.name || '', p?.sku || '', p?.category || ''], productSearch))
														.slice(0, 20)
														.map(p => {
															const isSelected = (formData.targetProductIds || []).includes(p.id);
															return (
																<div
																	key={p.id}
																	onClick={() => handleAddProduct(p)}
																	className={`px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors ${isSelected ? 'opacity-50 pointer-events-none' : ''}`}
																>
																	<div>
																		<p className="text-xs font-bold text-slate-800 dark:text-white">{p.name}</p>
																		<p className="text-[10px] text-slate-400">{p.sku ? `SKU: ${p.sku} • ` : ''}{p.priceSell ? `${Number(p.priceSell).toLocaleString('vi-VN')} đ` : ''}</p>
																	</div>
																	{isSelected ? <Check size={16} className="text-emerald-500 shrink-0" /> : <Plus size={16} className="text-indigo-500 shrink-0" />}
																</div>
															);
														})}
												</div>
											)}
										</div>
									</div>
								)}

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div>
										<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">LOẠI CHIẾT KHẤU</label>
										<select
											className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 transition-all appearance-none"
											value={formData.type}
											onChange={e => setFormData({ ...formData, type: e.target.value })}
										>
											<option value="percentage">Theo % (VD: 10%)</option>
											<option value="fixed">Số tiền cố định (VD: 5.000đ)</option>
											{formData.scope === 'order' && <option value="shipping">Miễn phí Vận chuyển</option>}
										</select>
									</div>
									<div>
										<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">GIÁ TRỊ CHIẾT KHẤU</label>
										<input
											required
											autoComplete="off"
											className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 transition-all"
											value={formData.discount}
											onChange={e => setFormData({ ...formData, discount: e.target.value })}
											placeholder={formData.type === 'percentage' ? 'VD: 10 (% giảm giá)' : 'VD: 5000 (Số tiền giảm)'}
										/>
									</div>
								</div>

								<div>
									<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">TIÊU ĐỀ KHUYẾN MÃI</label>
									<input
										required
										autoComplete="off"
										className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 transition-all"
										value={formData.title}
										onChange={e => setFormData({ ...formData, title: e.target.value })}
										placeholder="VD: Giảm 10% đơn hàng sỉ"
									/>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div>
										<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">NGÀY HẾT HẠN</label>
										<input
											type="date"
											required
											className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 transition-all"
											value={formData.expiry}
											onChange={e => setFormData({ ...formData, expiry: e.target.value })}
										/>
									</div>
									<div>
										<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">GIỚI HẠN LƯỢT DÙNG</label>
										<input
											type="number"
											required
											className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 transition-all"
											value={formData.usageLimit || ''}
											onChange={e => {
												const val = e.target.value === '' ? 0 : Number(e.target.value);
												setFormData({ ...formData, usageLimit: isNaN(val) ? 0 : val });
											}}
											placeholder="VD: 100"
										/>
									</div>
								</div>

								<div>
									<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">TRẠNG THÁI</label>
									<select
										className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 transition-all appearance-none"
										value={formData.status}
										onChange={e => setFormData({ ...formData, status: e.target.value })}
									>
										<option value="active">ĐANG CHẠY</option>
										<option value="inactive">TẠM NGƯNG</option>
									</select>
								</div>

								<div>
									<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">MÔ TẢ CHI TIẾT</label>
									<textarea
										className="w-full p-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 min-h-[120px] resize-none"
										value={formData.description}
										onChange={e => setFormData({ ...formData, description: e.target.value })}
										placeholder="Các điều kiện áp dụng mã..."
									/>
								</div>
							</form>
						</div>

						{/* Modal Footer (Fixed) */}
						<div className="p-6 md:p-10 pt-4 shrink-0 bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800 md:rounded-b-[2.5rem]">
							<button
								type="submit"
								form="couponForm"
								className="w-full h-16 bg-[#1A237E] text-white rounded-2xl font-black text-sm uppercase tracking-[2px] shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-slate-900 transition-all active:scale-[0.98]"
							>
								{isEditing ? 'LƯU THAY ĐỔI' : 'TẠO MÃ NGAY'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* VOUCHER DETAIL MODAL */}
			{detailCoupon && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
					<div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
						{/* Header */}
						<div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
							<div className="flex items-center gap-3">
								<div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
									<Ticket size={24} />
								</div>
								<div>
									<h3 className="text-base md:text-lg font-black text-slate-800 dark:text-white uppercase leading-tight">{detailCoupon.title}</h3>
									<span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">MÃ: {detailCoupon.code}</span>
								</div>
							</div>
							<button onClick={() => setDetailCoupon(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
								<X size={20} />
							</button>
						</div>

						{/* Info Card */}
						<div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-3">
							<div className="flex justify-between items-center text-sm">
								<span className="text-slate-500 dark:text-slate-400 font-medium">Mức giảm chiết khấu:</span>
								<span className="font-black text-emerald-600 dark:text-emerald-400 text-base">
									{detailCoupon.type === 'percentage'
										? `Giảm ${detailCoupon.discount}%`
										: `Bớt ${Number(detailCoupon.discount).toLocaleString('vi-VN')}đ / SP`}
								</span>
							</div>
							<div className="flex justify-between items-center text-sm">
								<span className="text-slate-500 dark:text-slate-400 font-medium">Phạm vi áp dụng:</span>
								<span className="font-bold text-slate-800 dark:text-white">
									{detailCoupon.scope === 'product' ? '📦 Chiết khấu theo sản phẩm' : '🏷️ Mã giảm giá toàn đơn'}
								</span>
							</div>
							<div className="flex justify-between items-center text-sm">
								<span className="text-slate-500 dark:text-slate-400 font-medium">Hạn sử dụng:</span>
								<span className="font-bold text-slate-800 dark:text-white">{detailCoupon.expiry || 'Vô thời hạn'}</span>
							</div>
							{detailCoupon.usageLimit > 0 && (
								<div className="flex justify-between items-center text-sm">
									<span className="text-slate-500 dark:text-slate-400 font-medium">Lượt đã dùng:</span>
									<span className="font-bold text-slate-800 dark:text-white">{detailCoupon.usageCount || 0} / {detailCoupon.usageLimit}</span>
								</div>
							)}
						</div>

						{/* Target Products (If product scope) */}
						{detailCoupon.scope === 'product' && (
							<div className="space-y-3">
								<h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
									Danh sách sản phẩm được chiết khấu ({detailCoupon.targetProductNames?.length || detailCoupon.targetProductIds?.length || 0} SP)
								</h4>
								<div className="max-h-48 overflow-y-auto space-y-2 pr-1">
									{detailCoupon.targetProductNames && detailCoupon.targetProductNames.length > 0 ? (
										detailCoupon.targetProductNames.map((name: string, idx: number) => {
											const sku = detailCoupon.targetProductSkus?.[idx] || '';
											const pid = detailCoupon.targetProductIds?.[idx] || '';
											const matchedProd = products.find(p => p.id === pid || (sku && p.sku === sku));
											return (
												<div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 rounded-2xl">
													<div className="flex items-center gap-2 overflow-hidden pr-2">
														<Package size={16} className="text-indigo-500 shrink-0" />
														<div className="truncate">
															<p className="text-xs font-bold text-slate-800 dark:text-white truncate">{name}</p>
															{sku && <p className="text-[10px] font-mono text-slate-400">SKU: {sku}</p>}
														</div>
													</div>
													{matchedProd && (
														<span className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">
															{Number(matchedProd.priceSell || matchedProd.priceSell1 || 0).toLocaleString('vi-VN')}đ
														</span>
													)}
												</div>
											);
										})
									) : (
										<p className="text-xs text-slate-400 italic text-center py-4">Chưa chọn danh sách sản phẩm cụ thể</p>
									)}
								</div>
							</div>
						)}

						{detailCoupon.description && (
							<div className="space-y-1">
								<h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Mô tả / Điều kiện</h4>
								<p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{detailCoupon.description}</p>
							</div>
						)}

						{/* Footer Actions */}
						<div className="flex gap-3 pt-2">
							<button
								onClick={() => {
									handleCopy(detailCoupon.code);
								}}
								className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-200"
							>
								<Copy size={16} /> Sao chép mã
							</button>
							<button
								onClick={() => {
									const code = detailCoupon.code;
									setDetailCoupon(null);
									navigate(`/quick-order?coupon=${code}`);
								}}
								className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none"
							>
								Lên đơn ngay <ChevronRight size={16} />
							</button>
						</div>
					</div>
				</div>
			)}

				</div>

			<style dangerouslySetInnerHTML={{
				__html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            ` }} />
		</div>
	);
};

export default Coupons;
