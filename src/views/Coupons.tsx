import React, { useState, useEffect } from 'react';
import { Tag, Copy, Check, Ticket, Clock, Info, Search, ChevronRight, Gift, Percent, Filter, Plus, Trash2, Edit3, X, Calendar, Truck, DollarSign, RotateCcw } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';
import { useLocation, useNavigate } from 'react-router-dom';

const Coupons = () => {
	const owner = useOwner();
	const { showToast } = useToast();
	const location = useLocation();
	const navigate = useNavigate();
	const [coupons, setCoupons] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState('');
	const [copiedCode, setCopiedCode] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState('all');

	// CRUD State
	const [showModal, setShowModal] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [currentId, setCurrentId] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		code: '',
		title: '',
		description: '',
		discount: '',
		expiry: '',
		type: 'percentage',
		status: 'active',
		usageLimit: 0,
		usageCount: 0
	});

	const isAdmin = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee;

	// Handle center button action from URL
	useEffect(() => {
		const params = new URLSearchParams(location.search);
		if (params.get('action') === 'new' && isAdmin) {
			handleOpenModal();
			navigate(location.pathname, { replace: true });
		}
	}, [location.search, isAdmin, navigate]);

	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		const q = query(collection(db, 'coupons'), where('ownerId', '==', owner.ownerId));
		const unsubscribe = onSnapshot(q, (snapshot) => {
			const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

			if (fetched.length === 0) {
				setCoupons([
					{
						id: 'demo-1',
						code: 'DUNVEXPRO2026',
						title: 'Giảm 10% Tất cả đơn hàng',
						description: 'Áp dụng cho đơn hàng từ 5.000.000 đ trở lên',
						discount: '10%',
						expiry: '2026-12-31',
						type: 'percentage',
						status: 'active',
						usageLimit: 100,
						usageCount: 12,
						isDemo: true
					},
					{
						id: 'demo-2',
						code: 'FREESHIP79',
						title: 'Miễn phí vận chuyển',
						description: 'Miễn phí vận chuyển nội thành cho đơn hàng trên 2.000.000 đ',
						discount: '0đ',
						expiry: '2026-06-30',
						type: 'shipping',
						status: 'active',
						usageLimit: 500,
						usageCount: 84,
						isDemo: true
					},
					{
						id: 'demo-3',
						code: 'TANXUAN2026',
						title: 'Lì xì 500k cho khách mới',
						description: 'Giảm thẳng 500.000 đ cho khách hàng lần đầu lên đơn',
						discount: '500k',
						expiry: '2026-03-15',
						type: 'fixed',
						status: 'active',
						usageLimit: 50,
						usageCount: 48,
						isDemo: true
					}
				]);
			} else {
				setCoupons(fetched);
			}
			setLoading(false);
		});

		return () => unsubscribe();
	}, [owner.loading, owner.ownerId]);

	// Automatic Expiration Management
	useEffect(() => {
		if (owner.loading || !owner.ownerId || coupons.length === 0 || !isAdmin) return;

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const checkExpirations = async () => {
			const expiredCoupons = coupons.filter(c => !c.isDemo && c.expiry && new Date(c.expiry) < today);
			const nearlyExpiredCoupons = coupons.filter(c => {
				if (c.isDemo || !c.expiry) return false;
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

	const generateRandomCode = () => {
		const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let result = '';
		const length = 8;
		for (let i = 0; i < length; i++) {
			result += characters.charAt(Math.floor(Math.random() * characters.length));
		}
		return result;
	};

	const handleOpenModal = (coupon: any = null) => {
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
				status: 'active',
				usageLimit: 10,
				usageCount: 0
			});
		}
		setShowModal(true);
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
		if (window.confirm("Bạn có chắc chắn muốn xoá mã giảm giá này?")) {
			try {
				await deleteDoc(doc(db, 'coupons', id));
				showToast("Đã xoá mã giảm giá", "success");
			} catch (error) {
				showToast("Lỗi khi xoá: " + error, "error");
			}
		}
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

	const filteredCoupons = coupons.filter(c =>
		(c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
			c.title.toLowerCase().includes(searchTerm.toLowerCase())) &&
		(activeTab === 'all' || (activeTab === 'active' && c.status === 'active'))
	);

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

				{/* HEADER */}
				<div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
					<div>
						<h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
							<Gift className="text-[#f27121]" size={28} />
							Mã Giảm Giá & Ưu Đãi
						</h1>
						<p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Quản lý và sử dụng các chương trình ưu đãi của bạn</p>
					</div>
					{isAdmin && (
						<button
							onClick={() => handleOpenModal()}
							className="bg-[#1A237E] text-white px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-900 shadow-xl shadow-indigo-100 dark:shadow-none transition-all active:scale-95 shrink-0"
						>
							<Plus size={18} />
							Tạo mã mới
						</button>
					)}
				</div>

				{/* SEARCH & FILTERS */}
				<div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 mb-6 flex flex-col gap-4 transition-all overflow-hidden">
					<div className="relative">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
						<input
							type="text"
							placeholder="Tìm kiếm ưu đãi..."
							className="w-full pl-12 pr-4 h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#f27121]/20 transition-all"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					<div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
						{['all', 'active', 'expired'].map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab)}
								className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === tab
									? 'bg-[#1A237E] text-white shadow-lg shadow-indigo-200 dark:shadow-none'
									: 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
									}`}
							>
								{tab === 'all' ? 'Tất cả' : tab === 'active' ? 'Đang chạy' : 'Đã hết hạn'}
							</button>
						))}
					</div>
				</div>

				{/* COUPON LIST */}
				<div className="space-y-4">
					{filteredCoupons.map((coupon) => (
						<div key={coupon.id} className="group bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-orange-500/5 transition-all relative">
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
											<span className="text-xl md:text-2xl font-black">{coupon.discount}</span>
										)}
									</div>
									<span className="text-[10px] mt-1 font-black uppercase tracking-tighter opacity-80">
										{coupon.type === 'percentage' ? 'GIẢM GIÁ' : coupon.type === 'fixed' ? 'TRỪ TIỀN' : 'VẬN CHUYỂN'}
									</span>
								</div>

								{/* Right Side - Content */}
								<div className="flex-1 p-5 md:p-6 flex flex-col justify-between overflow-hidden">
									{isAdmin && !coupon.isDemo && (
										<div className="absolute top-4 right-4 flex gap-2 md:opacity-0 group-hover:opacity-100 transition-all">
											<button
												onClick={() => handleOpenModal(coupon)}
												className="size-9 bg-white dark:bg-slate-800 text-slate-400 hover:text-indigo-500 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-all active:scale-90"
											>
												<Edit3 size={16} />
											</button>
											<button
												onClick={() => handleDelete(coupon.id, !!coupon.isDemo)}
												className="size-9 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-all active:scale-90"
											>
												<Trash2 size={16} />
											</button>
										</div>
									)}

									<div className="pr-12 md:pr-0">
										<div className="flex items-start justify-between mb-1">
											<h3 className="text-sm md:text-base font-black text-slate-800 dark:text-white uppercase leading-tight line-clamp-1">{coupon.title}</h3>
										</div>
										<p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2">{coupon.description}</p>
									</div>

									<div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
										<div className="flex items-center gap-4">
											<div className="flex items-center gap-1.5 text-slate-400">
												<Clock size={14} />
												<span className="text-[10px] font-bold uppercase tracking-tight">Hết: {coupon.expiry}</span>
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
													onClick={() => handleCopy(coupon.code)}
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
						<div className="flex flex-col items-center justify-center py-20 text-center">
							<div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 mb-4">
								<Ticket size={40} />
							</div>
							<h3 className="text-lg font-black text-slate-800 dark:text-white uppercase">Không tìm thấy mã nào</h3>
							<p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Hệ thống sẵn sàng cho ưu đãi đầu tiên của bạn!</p>
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
								onClick={() => setShowModal(false)}
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
											className="w-full h-14 pl-4 pr-12 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 uppercase transition-all"
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

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div>
										<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">LOẠI ƯU ĐÃI</label>
										<select
											className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-[11px] font-black uppercase tracking-wider focus:ring-2 focus:ring-[#f27121]/20 transition-all appearance-none"
											value={formData.type}
											onChange={e => setFormData({ ...formData, type: e.target.value })}
										>
											<option value="percentage">Theo %</option>
											<option value="fixed">Trừ tiền mặt</option>
											<option value="shipping">Vận chuyển</option>
										</select>
									</div>
									<div>
										<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">GIÁ TRỊ HIỂN THỊ</label>
										<input
											required
											autoComplete="off"
											className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 transition-all"
											value={formData.discount}
											onChange={e => setFormData({ ...formData, discount: e.target.value })}
											placeholder="VD: 10% hoặc 500k"
										/>
									</div>
								</div>

								<div>
									<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">TIÊU ĐỀ KHUYẾN MÃI</label>
									<input
										required
										autoComplete="off"
										className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 transition-all"
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
											className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 transition-all"
											value={formData.expiry}
											onChange={e => setFormData({ ...formData, expiry: e.target.value })}
										/>
									</div>
									<div>
										<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-2">GIỚI HẠN LƯỢT DÙNG</label>
										<input
											type="number"
											required
											className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 transition-all"
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
										className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-[11px] font-black uppercase tracking-wider focus:ring-2 focus:ring-[#f27121]/20 transition-all appearance-none"
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
										className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/20 min-h-[120px] resize-none"
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

			<style dangerouslySetInnerHTML={{
				__html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            ` }} />
		</div>
	);
};

export default Coupons;
