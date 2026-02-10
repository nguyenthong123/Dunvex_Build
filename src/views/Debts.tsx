import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, writeBatch, getDocs } from 'firebase/firestore';
import { Filter, Download, PlusCircle, Printer, X, History, FileText, Edit2, Trash2, MapPin, Phone, Camera, Image } from 'lucide-react';






interface DataRow {
	id: string;
	initials: string;
	avatarBg: string;
	avatarText: string;
	name: string;
	invoiceId: string;
	amount: string;
	lastTransaction: string;
	dueDate: string;
	riskLevel: string;
	riskColor: string;
	riskBg: string;
}

const Debts: React.FC = () => {
	const navigate = useNavigate();
	const [currentTime, setCurrentTime] = useState(new Date());

	const handleLogout = async () => {
		if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
			await signOut(auth);
			navigate('/login');
		}
	};

	const [orders, setOrders] = useState<any[]>([]);
	const [payments, setPayments] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	// Filters
	const [searchTerm, setSearchTerm] = useState('');
	const [fromDate, setFromDate] = useState('');
	const [toDate, setToDate] = useState('');
	const [statusFilter, setStatusFilter] = useState('Đơn chốt');
	const [showFilterOptions, setShowFilterOptions] = useState(false);

	// Modals/Editing
	const [showPaymentForm, setShowPaymentForm] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);

	useEffect(() => {
		if (!auth.currentUser) return;
		const q = query(
			collection(db, 'notifications'),
			where('userId', '==', auth.currentUser.uid),
			where('read', '==', false)
		);
		const unsubscribe = onSnapshot(q, (snapshot) => {
			setUnreadCount(snapshot.size);
		});
		return () => unsubscribe();
	}, []);

	const { search } = useLocation();
	useEffect(() => {
		const params = new URLSearchParams(search);
		if (params.get('payment') === 'true') {
			setShowPaymentForm(true);
			// Optional: clean up URL
			navigate('/', { replace: true });
		}
	}, [search, navigate]);

	const markAllAsRead = async () => {
		if (!auth.currentUser) return;
		const q = query(
			collection(db, 'notifications'),
			where('userId', '==', auth.currentUser.uid),
			where('read', '==', false)
		);
		const snapshot = await getDocs(q);
		const batch = writeBatch(db);
		snapshot.docs.forEach((d) => {
			batch.update(d.ref, { read: true });
		});
		await batch.commit();
	};
	const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

	const [showStatement, setShowStatement] = useState(false);
	const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

	// Form state for payment
	const [paymentData, setPaymentData] = useState({
		customerId: '',
		customerName: '',
		amount: 0,
		date: new Date().toISOString().split('T')[0],
		note: '',
		paymentMethod: 'Tiền mặt',
		proofImage: ''
	});

	const [uploadingPaymentImage, setUploadingPaymentImage] = useState(false);


	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 60000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		if (!auth.currentUser) return;

		const qOrders = query(
			collection(db, 'orders'),
			where('createdBy', '==', auth.currentUser.uid)
		);

		const unsubOrders = onSnapshot(qOrders, (snapshot) => {
			const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			setOrders(docs);
		});

		const qPayments = query(
			collection(db, 'payments'),
			where('createdBy', '==', auth.currentUser.uid)
		);

		const unsubPayments = onSnapshot(qPayments, (snapshot) => {
			const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			setPayments(docs);
		});

		const qCustomers = query(
			collection(db, 'customers'),
			where('createdBy', '==', auth.currentUser.uid)
		);

		const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
			const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			setCustomers(docs);
			setLoading(false);
		});

		return () => {
			unsubOrders();
			unsubPayments();
			unsubCustomers();
		};
	}, [auth.currentUser]);

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('vi-VN').format(price || 0) + ' đ';
	};

	const formatDate = (date: any) => {
		if (!date) return '---';
		if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString('vi-VN');
		return new Date(date).toLocaleDateString('vi-VN');
	};

	// 1. Identify all unique customer entities (Registered + Guest)
	const registeredMap = new Map();
	customers.forEach(c => registeredMap.set(c.id, c));

	const guestEntities: any[] = [];
	const seenGuestNames = new Set();

	// Collect unique guests from orders
	orders.forEach(o => {
		if (!o.customerId || !registeredMap.has(o.customerId)) {
			const gName = o.customerName || 'Khách vãng lai';
			if (!seenGuestNames.has(gName)) {
				seenGuestNames.add(gName);
				guestEntities.push({
					id: `guest_${gName}`,
					name: gName,
					isGuest: true,
					address: o.deliveryAddress || '',
					phone: o.customerPhone || ''
				});
			}
		}
	});

	// Collect unique guests from payments (unlikely but possible)
	payments.forEach(p => {
		if (!p.customerId || !registeredMap.has(p.customerId)) {
			const gName = p.customerName || 'Khách vãng lai';
			if (!seenGuestNames.has(gName)) {
				seenGuestNames.add(gName);
				guestEntities.push({
					id: `guest_${gName}`,
					name: gName,
					isGuest: true,
					address: '',
					phone: ''
				});
			}
		}
	});

	const allEntities = [...customers, ...guestEntities];

	// 2. Aggregate data by entity
	const aggregatedData = allEntities.map((customer: any) => {
		const customerOrders = orders.filter((o: any) => {
			if (customer.isGuest) {
				return (!o.customerId || !registeredMap.has(o.customerId)) && (o.customerName === customer.name || (!o.customerName && customer.name === 'Khách vãng lai'));
			}
			return o.customerId === customer.id;
		});

		const customerPayments = payments.filter((p: any) => {
			if (customer.isGuest) {
				return (!p.customerId || !registeredMap.has(p.customerId)) && (p.customerName === customer.name || (!p.customerName && customer.name === 'Khách vãng lai'));
			}
			return p.customerId === customer.id;
		});

		// Always calculate currentDebt from 'Đơn chốt' only as per user rule
		const confirmedOrders = customerOrders.filter(o => o.status === 'Đơn chốt');
		const totalWaited = confirmedOrders.reduce((sum: any, o: any) => sum + (o.totalAmount || 0), 0);
		const totalPaid = customerPayments.reduce((sum: any, p: any) => sum + (p.amount || 0), 0);
		const currentDebt = totalWaited - totalPaid;

		// Column display values based on status filter
		let displayTotalOrders = 0;
		if (statusFilter === 'Tất cả') {
			displayTotalOrders = customerOrders.reduce((sum: any, o: any) => sum + (o.totalAmount || 0), 0);
		} else {
			displayTotalOrders = customerOrders
				.filter(o => o.status === statusFilter)
				.reduce((sum: any, o: any) => sum + (o.totalAmount || 0), 0);
		}

		// Get last transaction
		const allTx = [
			...customerOrders.filter((o: any) => o.status === 'Đơn chốt').map((o: any) => ({ date: o.createdAt || o.orderDate, type: 'order' })),
			...customerPayments.map((p: any) => ({ date: p.createdAt || p.date, type: 'payment' }))
		].sort((a: any, b: any) => {
			const da = a.date?.seconds ? a.date.seconds * 1000 : (a.date ? new Date(a.date).getTime() : 0);
			const db = b.date?.seconds ? b.date.seconds * 1000 : (b.date ? new Date(b.date).getTime() : 0);
			return db - da;
		});


		return {
			...customer,
			totalOrdersAmount: displayTotalOrders,
			totalPaymentsAmount: totalPaid,
			currentDebt,
			lastTx: allTx[0]?.date || null,
			hasStatusOrders: statusFilter === 'Tất cả' ? (customerOrders.length > 0 || customerPayments.length > 0) : customerOrders.some(o => o.status === statusFilter),
			initials: customer.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'KH'
		};
	}).filter((item: any) => {
		const matchesName = !searchTerm || item.name?.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesStatus = item.hasStatusOrders;

		if (!matchesStatus) return false;

		// Date filtering logic
		if (fromDate || toDate) {
			const start = fromDate || '0000-00-00';
			const end = toDate || '9999-99-99';

			const hasTxInRange = [
				...orders.filter((o: any) => {
					const matchCust = item.isGuest
						? (!o.customerId || !registeredMap.has(o.customerId)) && (o.customerName === item.name || (!o.customerName && item.name === 'Khách vãng lai'))
						: o.customerId === item.id;
					return matchCust && (statusFilter === 'Tất cả' || o.status === statusFilter);
				}),
				...payments.filter((p: any) => {
					return item.isGuest
						? (!p.customerId || !registeredMap.has(p.customerId)) && (p.customerName === item.name || (!p.customerName && item.name === 'Khách vãng lai'))
						: p.customerId === item.id;
				})
			].some((tx: any) => {
				const txDate = tx.orderDate || tx.date || (tx.createdAt?.seconds ? new Date(tx.createdAt.seconds * 1000).toISOString().split('T')[0] : '');
				return txDate >= start && txDate <= end;
			});
			return matchesName && hasTxInRange;
		}

		return matchesName;
	}).sort((a: any, b: any) => b.currentDebt - a.currentDebt);

	// Totals for KPIs
	const totalReceivable = aggregatedData.reduce((sum: any, item: any) => sum + (item.currentDebt > 0 ? item.currentDebt : 0), 0);
	const totalPayable = aggregatedData.reduce((sum: any, item: any) => sum + (item.currentDebt < 0 ? Math.abs(item.currentDebt) : 0), 0);
	const overdueCount = aggregatedData.filter((item: any) => item.currentDebt > 100000000).length; // Dummy threshold for overdue count


	const handlePaymentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setUploadingPaymentImage(true);
		try {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = async () => {
				const base64Data = (reader.result as string).split(',')[1];
				try {
					const response = await fetch('https://script.google.com/macros/s/AKfycby6Bm4e2rkzn7y6Skkl9eYKqclc927iJo1as-fBP7lsnvG1eC7sSh8Albak4fmy59w2FA/exec', {
						method: 'POST',
						body: JSON.stringify({
							filename: `payment_${Date.now()}_${file.name}`,
							mimeType: file.type,
							base64Data: base64Data
						})
					});
					const data = await response.json();
					if (data.status === 'success') {
						setPaymentData(prev => ({ ...prev, proofImage: data.fileUrl }));
					} else {
						alert("Lỗi upload: " + (data.message || "Không xác định"));
					}
				} catch (err) {
					console.error(err);
					alert("Lỗi kết nối Drive.");
				} finally {
					setUploadingPaymentImage(false);
				}
			};
		} catch (error) {
			console.error(error);
			alert("Lỗi xử lý tệp.");
			setUploadingPaymentImage(false);
		}
	};

	const handleRecordPayment = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!paymentData.customerId || !paymentData.amount) {
			alert("Vui lòng nhập đầy đủ thông tin");
			return;
		}

		try {
			if (editingPaymentId) {
				await updateDoc(doc(db, 'payments', editingPaymentId), {
					...paymentData,
					updatedAt: serverTimestamp()
				});
				alert("Cập nhật phiếu thu thành công");
			} else {
				await addDoc(collection(db, 'payments'), {
					...paymentData,
					createdAt: serverTimestamp(),
					createdBy: auth.currentUser?.uid,
					createdByEmail: auth.currentUser?.email
				});
				alert("Ghi nhận thu nợ thành công");
			}
			setShowPaymentForm(false);
			setEditingPaymentId(null);
			setPaymentData({
				customerId: '',
				customerName: '',
				amount: 0,
				date: new Date().toISOString().split('T')[0],
				note: '',
				paymentMethod: 'Tiền mặt',
				proofImage: ''
			});
		} catch (error) {
			console.error("Error saving payment:", error);
			alert("Lỗi khi lưu phiếu thu");
		}
	};


	const handleDeletePayment = async (id: string) => {
		if (!window.confirm("Bạn có chắc chắn muốn xóa phiếu thu này? Hành động này sẽ cập nhật lại dư nợ của khách hàng.")) return;
		try {
			await deleteDoc(doc(db, 'payments', id));
			alert("Đã xóa phiếu thu");
		} catch (error) {
			console.error("Error deleting payment:", error);
			alert("Lỗi khi xóa phiếu thu");
		}
	};



	return (
		<>
			{/* Header */}
			{/* Header */}
			<header className="h-16 md:h-20 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 shrink-0">
				<div className="flex items-center gap-4">
					<div className="flex flex-col">
						<h2 className="text-[#1A237E] text-lg md:text-2xl font-black uppercase tracking-tight">Quản Lý Công Nợ</h2>
						<p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden md:block">
							Cập nhật lúc: {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — {currentTime.toLocaleDateString('vi-VN')}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3 md:gap-6">
					<div className="hidden md:flex items-center bg-slate-50 rounded-xl px-4 py-2 w-64 lg:w-96 border border-transparent focus-within:border-[#FF6D00]/50 transition-all shadow-inner">
						<span className="material-symbols-outlined text-slate-400">search</span>
						<input
							className="bg-transparent border-none focus:ring-0 text-sm w-full text-slate-700 ml-2 font-bold"
							placeholder="Tìm kiếm đối tác..."
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={markAllAsRead}
							className="p-2 relative text-slate-400 hover:bg-slate-50 rounded-xl transition-colors group"
						>
							<span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">notifications</span>
							{unreadCount > 0 && (
								<span className="absolute top-2 right-2 size-4 bg-[#FF6D00] text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce">
									{unreadCount}
								</span>
							)}
						</button>
						<button
							onClick={() => setShowPaymentForm(true)}
							className="hidden md:flex items-center justify-center gap-2 bg-[#1A237E] hover:bg-[#0D47A1] text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-900/20 transition-all active:scale-95"
						>
							<span className="material-symbols-outlined text-xl">add_card</span>
							<span>Ghi nhận thu nợ</span>
						</button>
					</div>
				</div>
			</header>

			{/* Scrollable Content */}
			<div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 bg-[#f8f9fa]">
				<div className="max-w-7xl mx-auto flex flex-col gap-6 md:gap-8">
					{/* KPI Cards Section */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
						{/* KPI Card 1 */}
						<div className="bg-white rounded-3xl p-6 shadow-sm border-l-[6px] border-[#10b981] relative overflow-hidden group">
							<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
								<span className="material-symbols-outlined text-7xl text-[#10b981]">download</span>
							</div>
							<div className="relative z-10 flex flex-col">
								<p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Tổng Phải thu</p>
								<p className="text-[#1A237E] text-2xl lg:text-3xl font-black tracking-tighter">{formatPrice(totalReceivable)}</p>
								<p className="text-[10px] font-black text-[#10b981] mt-2 flex items-center gap-1 uppercase">
									<span className="material-symbols-outlined text-xs">arrow_upward</span> {aggregatedData.length} KHÁCH HÀNG
								</p>
							</div>
						</div>

						{/* KPI Card 2 */}
						<div className="bg-white rounded-3xl p-6 shadow-sm border-l-[6px] border-[#3b82f6] relative overflow-hidden group">
							<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
								<span className="material-symbols-outlined text-7xl text-[#3b82f6]">upload</span>
							</div>
							<div className="relative z-10 flex flex-col">
								<p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Tổng Phải trả</p>
								<p className="text-[#1A237E] text-2xl lg:text-3xl font-black tracking-tighter">{formatPrice(totalPayable)}</p>
								<p className="text-[10px] font-black text-rose-500 mt-2 flex items-center gap-1 uppercase">
									<span className="material-symbols-outlined text-xs">arrow_downward</span> CHIẾM {((totalPayable / (totalReceivable || 1)) * 100).toFixed(0)}% PHẢI THU
								</p>
							</div>
						</div>

						{/* KPI Card 3 */}
						<div className="bg-white rounded-3xl p-6 shadow-sm border-l-[6px] border-rose-500 relative overflow-hidden group">
							<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
								<span className="material-symbols-outlined text-7xl text-rose-500">warning</span>
							</div>
							<div className="relative z-10 flex flex-col">
								<p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Nợ Quá hạn</p>
								<p className="text-rose-600 text-2xl lg:text-3xl font-black tracking-tighter">{overdueCount}</p>
								<div className="bg-rose-50 text-rose-600 text-[8px] font-black uppercase px-2 py-1 rounded-full w-fit mt-2 animate-pulse">
									KHOẢN NỢ LỚN
								</div>
							</div>
						</div>
					</div>

					{/* Filters */}
					<div className="flex flex-col gap-4">
						<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
							<div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
								{['Tất cả', 'Đơn chốt', 'Đơn nháp'].map((status) => (
									<button
										key={status}
										onClick={() => setStatusFilter(status)}
										className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === status
											? 'bg-[#1A237E] text-white shadow-lg shadow-blue-900/20'
											: 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
											}`}
									>
										{status}
									</button>
								))}
							</div>
							<div className="flex items-center gap-2 w-full md:w-auto">
								<button
									onClick={() => setShowFilterOptions(!showFilterOptions)}
									className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showFilterOptions ? 'bg-[#1A237E] text-white' : 'bg-white text-slate-500 border border-slate-100'}`}
								>
									<Filter size={16} /> Lọc thời gian
								</button>
								<button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF6D00] rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20">
									<Download size={16} /> Xuất File
								</button>
							</div>
						</div>

						{showFilterOptions && (
							<div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
								<div>
									<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Từ ngày</label>
									<input
										type="date"
										className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#1A237E]/20"
										value={fromDate}
										onChange={(e) => setFromDate(e.target.value)}
									/>
								</div>
								<div>
									<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Đến ngày</label>
									<input
										type="date"
										className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#1A237E]/20"
										value={toDate}
										onChange={(e) => setToDate(e.target.value)}
									/>
								</div>
							</div>
						)}
					</div>

					{/* Table */}
					<div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full text-left">
								<thead>
									<tr className="bg-slate-50/50 border-b border-slate-100">
										<th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Đối tác / Mã KH</th>
										<th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tổng Mua</th>
										<th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Đã Trả</th>
										<th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Dư nợ hiện tại</th>
										<th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Hành động</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{loading ? (
										<tr><td colSpan={5} className="py-20 text-center text-slate-400 uppercase font-black text-xs tracking-[4px]">Đang tải dữ liệu...</td></tr>
									) : aggregatedData.length === 0 ? (
										<tr><td colSpan={5} className="py-20 text-center text-slate-400 uppercase font-black text-xs tracking-[4px]">Không tìm thấy đối tác nào</td></tr>
									) : aggregatedData.map((row) => (
										<tr key={row.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => { setSelectedCustomer(row); setShowStatement(true); }}>
											<td className="px-8 py-5">
												<div className="flex items-center gap-4">
													<div className={`size-12 rounded-2xl bg-[#1A237E]/5 flex items-center justify-center text-[#1A237E] font-black text-sm shrink-0 shadow-sm border border-slate-100`}>{row.initials}</div>
													<div>
														<p className="text-sm font-black text-[#1A237E] uppercase tracking-tight leading-tight">{row.name}</p>
														<p className="text-[10px] text-slate-400 font-bold mt-1 tracking-wider uppercase">{row.phone || row.id.slice(-6)}</p>
													</div>
												</div>
											</td>
											<td className="px-8 py-5 text-right">
												<span className="text-xs font-bold text-slate-500">{formatPrice(row.totalOrdersAmount)}</span>
											</td>
											<td className="px-8 py-5 text-right">
												<span className="text-xs font-bold text-green-600">{formatPrice(row.totalPaymentsAmount)}</span>
											</td>
											<td className="px-8 py-5 text-right">
												<span className={`text-sm font-black tracking-tight ${row.currentDebt > 0 ? 'text-rose-600' : 'text-[#10b981]'}`}>
													{formatPrice(row.currentDebt)}
												</span>
											</td>
											<td className="px-6 py-5 text-right">
												<div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
													<button
														onClick={() => { setSelectedCustomer(row); setShowStatement(true); }}
														className="bg-white border border-slate-100 p-2.5 rounded-xl text-slate-400 hover:text-[#1A237E] hover:border-[#1A237E] transition-all shadow-sm"
														title="Xem chi tiết"
													>
														<FileText size={20} />
													</button>
													<button
														onClick={() => {
															setPaymentData({ ...paymentData, customerId: row.id, customerName: row.name });
															setShowPaymentForm(true);
														}}
														className="bg-white border border-slate-100 p-2.5 rounded-xl text-slate-400 hover:text-[#FF6D00] hover:border-[#FF6D00] transition-all shadow-sm"
														title="Thu nợ"
													>
														<PlusCircle size={20} />
													</button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>

			{/* PAYMENT FORM MODAL */}
			{showPaymentForm && (
				<div className="fixed inset-0 z-[100] bg-[#1A237E]/80 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
						<div className="px-8 py-6 bg-[#1A237E] text-white flex items-center justify-between">
							<div className="flex items-center gap-3">
								<PlusCircle size={24} className="text-[#FF6D00]" />
								<h3 className="text-xl font-black uppercase tracking-tight">{editingPaymentId ? 'Chỉnh sửa phiếu thu' : 'Ghi nhận thu nợ'}</h3>
							</div>
							<button onClick={() => { setShowPaymentForm(false); setEditingPaymentId(null); }} className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
								<X size={20} />
							</button>
						</div>
						<form onSubmit={handleRecordPayment} className="p-8 space-y-6">
							<div>
								<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Chọn khách hàng</label>
								<select
									className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[#FF6D00]/20 appearance-none"
									value={paymentData.customerId}
									onChange={(e) => {
										const cust = customers.find((c: any) => c.id === e.target.value);
										setPaymentData({ ...paymentData, customerId: e.target.value, customerName: cust?.name || '' });
									}}
								>
									<option value="">-- Chọn khách hàng --</option>
									{customers.map((c: any) => (
										<option key={c.id} value={c.id}>{c.name}</option>
									))}
								</select>
							</div>


							<div>
								<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Ngày thu nợ</label>
								<input
									type="date"
									className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[#FF6D00]/20"
									value={paymentData.date}
									onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Số tiền thu</label>
									<input
										type="number"
										className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-black text-[#FF6D00] focus:ring-2 focus:ring-[#FF6D00]/20"
										placeholder="0"
										value={paymentData.amount === 0 ? '' : paymentData.amount}
										onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
									/>
								</div>
								<div>
									<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Hình thức</label>
									<select
										className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[#FF6D00]/20 appearance-none"
										value={paymentData.paymentMethod}
										onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
									>
										<option value="Tiền mặt">Tiền mặt</option>
										<option value="Chuyển khoản">Chuyển khoản</option>
									</select>
								</div>
							</div>

							<div>
								<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Ghi chú</label>
								<textarea
									rows={3}
									className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-[#FF6D00]/20 resize-none"
									placeholder="VD: Thu nợ đơn hàng tháng 10..."
									value={paymentData.note}
									onChange={(e) => setPaymentData({ ...paymentData, note: e.target.value })}
								/>
							</div>

							<div>
								<label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-2">Bằng chứng thanh toán (Lệnh chuyển tiền)</label>
								<div className="flex gap-4">
									<button
										type="button"
										onClick={() => document.getElementById('payment-proof-upload')?.click()}
										disabled={uploadingPaymentImage}
										className="flex-1 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-slate-100 transition-all disabled:opacity-50"
									>
										{uploadingPaymentImage ? (
											<div className="size-5 border-2 border-[#1A237E] border-t-transparent rounded-full animate-spin"></div>
										) : (
											<>
												<Camera size={24} className="text-slate-400" />
												<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{paymentData.proofImage ? 'Chụp lại ảnh' : 'Chụp/Tải ảnh'}</span>
											</>
										)}
									</button>
									<input
										id="payment-proof-upload"
										type="file"
										accept="image/*"
										className="hidden"
										onChange={handlePaymentImageUpload}
									/>
									{paymentData.proofImage && (
										<div className="size-20 bg-slate-100 rounded-2xl overflow-hidden border-2 border-white shadow-lg shrink-0">
											<img src={paymentData.proofImage.includes('drive.google.com') ? `https://drive.google.com/thumbnail?id=${paymentData.proofImage.split('id=')[1]}&sz=w200` : paymentData.proofImage} alt="Proof" className="w-full h-full object-cover" />
										</div>
									)}
								</div>
							</div>

							<button
								type="submit"
								disabled={uploadingPaymentImage}
								className="w-full h-16 bg-[#FF6D00] text-white rounded-2xl font-black uppercase tracking-[3px] shadow-xl shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
							>
								{editingPaymentId ? 'CẬP NHẬT PHIẾU THU' : 'XÁC NHẬN PHIẾU THU'}
							</button>


						</form>
					</div>
				</div>
			)}

			{/* DEBT STATEMENT MODAL */}
			{showStatement && selectedCustomer && (
				<div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-0 md:p-8">
					<div className="bg-white w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] md:rounded-[3rem] shadow-2xl relative flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
						{/* MODAL HEADER - STICKY FOR UI BUT HIDDEN FOR SCREENSHOT ONCE SCROLLED */}
						<div className="flex-none bg-white px-8 py-5 border-b border-slate-100 flex items-center justify-between z-20 md:rounded-t-[3rem] print:hidden">
							<div className="flex items-center gap-3">
								<div className="size-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
									<History size={20} />
								</div>
								<div>
									<h3 className="text-lg font-black uppercase tracking-tight">Chi tiết công nợ</h3>
									<p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{selectedCustomer.name}</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<button onClick={() => window.print()} className="h-10 px-4 rounded-xl bg-slate-100 text-slate-600 flex items-center gap-2 font-bold text-xs uppercase hover:bg-slate-200 transition-all">
									<Printer size={16} /> In phiếu
								</button>
								<button onClick={() => setShowStatement(false)} className="size-10 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 flex items-center justify-center transition-colors">
									<X size={20} />
								</button>
							</div>
						</div>

						{/* SCROLLABLE DOCUMENT AREA */}
						<div className="flex-1 overflow-y-auto bg-slate-100 md:p-8 p-1 flex justify-center scroll-smooth">

							{/* THE PAPER SHEET - Fixed look for all devices */}
							<div className="bg-white w-full max-w-[800px] shadow-2xl min-h-[1100px] p-8 md:p-12 mb-20 flex flex-col font-['Inter', sans-serif]">

								{/* 1. Header with Logo */}
								<div className="flex justify-between items-start mb-10">
									<div className="flex items-start gap-4">
										<div className="size-16 bg-[#1A237E] rounded-full flex items-center justify-center text-white text-3xl font-black shrink-0 shadow-lg">D</div>
										<div className="flex flex-col">
											<h1 className="text-[#1A237E] text-2xl font-black uppercase tracking-tight mb-1">CÔNG TY CP DUNVEX BUILD</h1>
											<p className="text-[11px] text-slate-500 font-medium">Số 58, Đường Tố Hữu, Nam Từ Liêm, Hà Nội</p>
											<p className="text-[11px] text-slate-500 font-medium">Hotline: 1900 888 999 - Website: dunvex.vn</p>
										</div>
									</div>
									<div className="flex flex-col items-end text-right">
										<h2 className="text-[#1A237E] text-3xl font-black uppercase tracking-tighter mb-2 italic">PHIẾU ĐỐI SOÁT</h2>
										<p className="text-[10px] text-slate-400 font-bold uppercase tracking-[1px]">Số: DS-{new Date().toISOString().slice(0, 7).replace('-', '')}-{selectedCustomer.id.slice(-5).toUpperCase()}</p>
										<p className="text-[10px] text-slate-400 italic">Ngày xuất: {formatDate(new Date())}</p>
									</div>
								</div>

								<div className="w-full h-[1px] bg-slate-200 mb-10"></div>

								{/* 2. Customer & Cycle Info Grid */}
								{(() => {
									const startVal = fromDate || '0000-00-00';
									const endVal = toDate || '9999-99-99';

									// Normalized date extraction for grouping
									const getNormDate = (tx: any) => {
										if (tx.orderDate) return tx.orderDate; // "2026-02-10"
										if (tx.date) return tx.date; // "2026-02-10"
										if (tx.createdAt?.seconds) {
											// Convert UTC timestamp to Local Date string YYYY-MM-DD
											const d = new Date(tx.createdAt.seconds * 1000);
											const year = d.getFullYear();
											const month = String(d.getMonth() + 1).padStart(2, '0');
											const day = String(d.getDate()).padStart(2, '0');
											return `${year}-${month}-${day}`;
										}
										return '';
									};

									const allPossibleTx = [
										...orders.filter(o => {
											if (selectedCustomer.isGuest) {
												return (!o.customerId || !registeredMap.has(o.customerId)) && (o.customerName === selectedCustomer.name || (!o.customerName && selectedCustomer.name === 'Khách vãng lai'));
											}
											return o.customerId === selectedCustomer.id;
										}).filter(o => o.status === 'Đơn chốt').map(o => ({ ...o, txType: 'order' })),
										...payments.filter(p => {
											if (selectedCustomer.isGuest) {
												return (!p.customerId || !registeredMap.has(p.customerId)) && (p.customerName === selectedCustomer.name || (!p.customerName && selectedCustomer.name === 'Khách vãng lai'));
											}
											return p.customerId === selectedCustomer.id;
										}).map(p => ({ ...p, txType: 'payment' }))
									];

									// Calculate Opening Balance (all tx before 'startVal')
									const openingBalance = allPossibleTx.reduce((sum, tx) => {
										const txDate = getNormDate(tx);
										if (txDate !== '' && txDate < startVal) {
											return sum + (tx.totalAmount || 0) - (tx.amount || 0);
										}
										return sum;
									}, 0);

									// Current Transactions in cycle
									const cycleTx = allPossibleTx.filter(tx => {
										const txDate = getNormDate(tx);
										return txDate >= startVal && txDate <= endVal;
									}).sort((a, b) => {
										const da = getNormDate(a);
										const db = getNormDate(b);
										if (da !== db) return da.localeCompare(db);
										const ta = a.createdAt?.seconds || 0;
										const tb = b.createdAt?.seconds || 0;
										return ta - tb;
									});

									const debitIncrease = cycleTx.filter(t => t.txType === 'order').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
									const creditDecrease = cycleTx.filter(t => t.txType === 'payment').reduce((sum, p) => sum + (p.amount || 0), 0);
									const closingBalance = openingBalance + debitIncrease - creditDecrease;

									return (
										<>
											<div className="grid grid-cols-2 gap-12 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 mb-8">
												<div className="space-y-4">
													<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">KHÁCH HÀNG</p>
													<div className="space-y-1">
														<p className="font-black text-[#1A237E] text-lg uppercase tracking-tight leading-none mb-1">{selectedCustomer.name}</p>
														{selectedCustomer.businessName && (
															<p className="font-bold text-slate-700 text-xs italic mb-2 tracking-tight">🏢 {selectedCustomer.businessName}</p>
														)}
														<p className="text-[11px] text-slate-500 font-bold">Địa chỉ: {selectedCustomer.address || 'Chưa cập nhật'}</p>
														<p className="text-[11px] text-slate-500 font-bold">SĐT: {selectedCustomer.phone || '-'}</p>
													</div>
												</div>
												<div className="space-y-4">
													<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">THÔNG TIN KỲ ĐỐI SOÁT</p>
													<div className="space-y-3">
														<div className="flex justify-between items-center text-[11px] font-bold">
															<span className="text-slate-500">Thời gian:</span>
															<span className="text-[#1A237E]">{fromDate ? formatDate(fromDate) : '---'} - {toDate ? formatDate(toDate) : formatDate(new Date())}</span>
														</div>
														<div className="flex justify-between items-center text-[11px] font-bold">
															<span className="text-slate-500">Dư nợ đầu kỳ:</span>
															<span className="text-[#1A237E]">{formatPrice(openingBalance)}</span>
														</div>
														<div className="flex justify-between items-start pt-2 border-t border-slate-200">
															<span className="text-[11px] font-black text-[#1A237E] uppercase mt-1">Dư nợ phải thanh toán:</span>
															<span className="text-2xl font-black text-[#FF6D00] tracking-tighter leading-none">{formatPrice(closingBalance)}</span>
														</div>
													</div>
												</div>
											</div>

											{/* 3. Status Badges */}
											<div className="grid grid-cols-4 gap-4 mb-10">
												<div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex flex-col justify-center gap-1">
													<p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Dư đầu kỳ</p>
													<p className="text-sm font-black text-[#1A237E]">{formatPrice(openingBalance).replace(' đ', '')}</p>
												</div>
												<div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex flex-col justify-center gap-1">
													<p className="text-[8px] font-black text-orange-600 uppercase tracking-widest">Phát sinh tăng</p>
													<p className="text-sm font-black text-[#FF6D00]">{formatPrice(debitIncrease).replace(' đ', '')}</p>
												</div>
												<div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col justify-center gap-1">
													<p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Đã thanh toán</p>
													<p className="text-sm font-black text-emerald-600">{formatPrice(creditDecrease).replace(' đ', '')}</p>
												</div>
												<div className="bg-[#1A237E] p-4 rounded-2xl flex flex-col justify-center gap-1 shadow-lg shadow-blue-900/20">
													<p className="text-[8px] font-black text-white/60 uppercase tracking-widest">Dư cuối kỳ</p>
													<p className="text-sm font-black text-white">{formatPrice(closingBalance).replace(' đ', '')}</p>
												</div>
											</div>

											{/* 4. Main Transaction Table */}
											<div className="border border-slate-200 rounded-2xl overflow-hidden mb-16 shadow-sm">
												<table className="w-full text-left table-fixed">
													<thead>
														<tr className="bg-[#1A237E] text-white">
															<th className="w-[15%] py-4 px-4 text-[10px] font-black uppercase tracking-widest text-center">Ngày</th>
															<th className="w-[15%] py-4 px-4 text-[10px] font-black uppercase tracking-widest text-center">Số CT</th>
															<th className="w-[40%] py-4 px-4 text-[10px] font-black uppercase tracking-widest">Diễn giải</th>
															<th className="w-[15%] py-4 px-4 text-[10px] font-black uppercase tracking-widest text-right">Tiền nợ</th>
															<th className="w-[15%] py-4 px-4 text-[10px] font-black uppercase tracking-widest text-right">Tiền trả</th>
														</tr>
													</thead>
													<tbody className="divide-y divide-slate-100 text-[11px] font-bold text-slate-600">
														{cycleTx.map((tx, idx) => (
															<tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
																<td className="py-5 px-4 text-center">{formatDate(tx.orderDate || tx.date || tx.createdAt)}</td>
																<td className="py-5 px-4 text-center text-[#1A237E] font-black uppercase">{tx.txType === 'order' ? 'BH' : 'TT'}{(tx.id || '').toUpperCase().slice(0, 8)}</td>
																<td className="py-5 px-4 leading-relaxed italic">{tx.note || (tx.txType === 'order' ? 'Xuất bán hàng theo đơn' : 'Thanh toán công nợ')}</td>
																<td className="py-5 px-4 text-right text-rose-600 font-black">{tx.txType === 'order' ? formatPrice(tx.totalAmount).replace(' đ', '') : '-'}</td>
																<td className="py-5 px-4 text-right text-emerald-600 font-black">{tx.txType === 'payment' ? formatPrice(tx.amount).replace(' đ', '') : '-'}</td>
															</tr>
														))}
														{cycleTx.length === 0 && (
															<tr>
																<td colSpan={5} className="py-10 text-center text-slate-300 uppercase tracking-widest">Không có giao dịch trong kỳ</td>
															</tr>
														)}
														<tr className="bg-slate-50 border-t-2 border-slate-200">
															<td colSpan={3} className="py-5 px-4 text-right text-[#1A237E] font-black uppercase tracking-widest">Tổng cộng</td>
															<td className="py-5 px-4 text-right text-rose-600 font-black text-sm">{formatPrice(debitIncrease).replace(' đ', '')}</td>
															<td className="py-5 px-4 text-right text-emerald-600 font-black text-sm">{formatPrice(creditDecrease).replace(' đ', '')}</td>
														</tr>
													</tbody>
												</table>
											</div>

											{/* 5. Signatures Content */}
											<div className="mt-auto grid grid-cols-2 gap-20 px-10 pb-20">
												<div className="flex flex-col items-center gap-24">
													<div className="text-center">
														<p className="font-black text-[#1A237E] uppercase text-sm tracking-tight mb-1">Người lập phiếu</p>
														<p className="text-[10px] text-slate-400 italic">(Ký, ghi rõ họ tên)</p>
													</div>
													<p className="font-black text-[#1A237E] text-lg uppercase tracking-tight">{auth.currentUser?.displayName || 'Admin'}</p>
												</div>
												<div className="flex flex-col items-center gap-24">
													<div className="text-center">
														<p className="font-black text-[#1A237E] uppercase text-sm tracking-tight mb-1">Khách hàng xác nhận</p>
														<p className="text-[10px] text-slate-400 italic">(Ký, ghi rõ họ tên)</p>
													</div>
													<div className="w-40 h-[1px] bg-transparent"></div> {/* Spacer */}
												</div>
											</div>
										</>
									);
								})()}
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default Debts;
