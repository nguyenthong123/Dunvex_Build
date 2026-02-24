import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, writeBatch, getDocs } from 'firebase/firestore';
import { Filter, Download, PlusCircle, Printer, X, History, FileText, Edit2, Trash2, MapPin, Phone, Camera, Image } from 'lucide-react';
import UpgradeModal from '../components/UpgradeModal';






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

import { useOwner } from '../hooks/useOwner';
import { useScroll } from '../context/ScrollContext';
import { useToast } from '../components/shared/Toast';

const Debts: React.FC = () => {
	const navigate = useNavigate();
	const owner = useOwner();
	const { isNavVisible } = useScroll();
	const { showToast } = useToast();

	const [currentTime, setCurrentTime] = useState(new Date());
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
	const [currentPage, setCurrentPage] = useState(1);
	const ITEMS_PER_PAGE = 10;


	useEffect(() => {
		if (!auth.currentUser) return;
		const q = query(
			collection(db, 'notifications'),
			where('userId', '==', auth.currentUser.uid)
		);
		const unsubscribe = onSnapshot(q, (snapshot) => {
			const unread = snapshot.docs.filter(d => !d.data().read).length;
			setUnreadCount(unread);
		});
		return () => unsubscribe();
	}, []);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, statusFilter, fromDate, toDate]);

	const { search } = useLocation();
	useEffect(() => {
		const params = new URLSearchParams(search);
		if (params.get('payment') === 'true') {
			setShowPaymentForm(true);
			// Optional: clean up URL
			navigate('/debts', { replace: true });
		}
	}, [search, navigate]);

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
	const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

	const [showStatement, setShowStatement] = useState(false);
	const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
	const [statementFromDate, setStatementFromDate] = useState('');
	const [statementToDate, setStatementToDate] = useState('');
	const [statementScale, setStatementScale] = useState(1);
	const [statementZoom, setStatementZoom] = useState(0.85);

	useEffect(() => {
		if (showStatement) {
			const handleResize = () => {
				if (window.innerWidth < 840) {
					setStatementScale((window.innerWidth - 32) / 800);
				} else {
					setStatementScale(1);
				}
			};
			handleResize();
			window.addEventListener('resize', handleResize);
			return () => window.removeEventListener('resize', handleResize);
		}
	}, [showStatement]);

	const openStatement = (customer: any) => {
		setSelectedCustomer(customer);
		// Default to current month
		const now = new Date();
		const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
		setStatementFromDate(firstDay.toISOString().split('T')[0]);
		setStatementToDate(now.toISOString().split('T')[0]);
		setShowStatement(true);
	};

	const handlePrintStatement = () => {
		const printContent = document.getElementById('debt-statement-paper');
		if (!printContent) return;

		const printWindow = window.open('', '_blank', 'width=1000,height=1000');
		if (!printWindow) {
			alert("Vui lòng cho phép trình duyệt mở popup để in!");
			return;
		}

		// Collect current styles
		let styles = '';
		document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
			styles += node.outerHTML;
		});

		printWindow.document.write(`
			<html>
				<head>
					<base href="${window.location.origin}/">
					<title>In Công Nợ - ${selectedCustomer?.name || ''}</title>
					${styles}
					<style>
						body { 
							background: #f1f5f9; 
							padding: 0; margin: 0; 
							display: flex; justify-content: center;
						}
						#debt-statement-paper {
							margin: 0 !important;
							box-shadow: none !important;
							border: none !important;
							width: 210mm !important;
							min-height: 297mm !important;
							padding: 15mm !important;
							background: white !important;
							visibility: visible !important;
							display: block !important;
						}
						/* Force high fidelity colors */
						* {
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
						}
						@media print {
							body { background: white; margin: 0; padding: 0; }
							#debt-statement-paper { margin: 0 !important; }
							@page { size: A4; margin: 0; }
						}
					</style>
				</head>
				<body>
					<div class="print-container">
						${printContent.outerHTML}
					</div>
					<script>
						window.onload = () => {
							setTimeout(() => {
								window.print();
								if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
									window.close();
								}
							}, 800);
						};
					</script>
				</body>
			</html>
		`);
		printWindow.document.close();
	};

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
		if (owner.loading || !owner.ownerId) return;

		const isAdmin = owner.role?.toLowerCase() === 'admin' || !owner.isEmployee;

		let qOrders, qPayments, qCustomers;
		qOrders = query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId));
		qPayments = query(collection(db, 'payments'), where('ownerId', '==', owner.ownerId));
		qCustomers = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));

		const unsubOrders = onSnapshot(qOrders, (snapshot) => {
			const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			const filtered = isAdmin ? docs : docs.filter((o: any) => o.createdByEmail === auth.currentUser?.email);
			setOrders(filtered);
		});

		const unsubPayments = onSnapshot(qPayments, (snapshot) => {
			const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			const filtered = isAdmin ? docs : docs.filter((p: any) => p.createdByEmail === auth.currentUser?.email);
			setPayments(filtered);
		});

		const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
			const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			const filtered = isAdmin ? docs : docs.filter((c: any) => c.createdByEmail === auth.currentUser?.email);
			setCustomers(filtered);
			setLoading(false);
		});

		return () => {
			unsubOrders();
			unsubPayments();
			unsubCustomers();
		};
	}, [owner.loading, owner.ownerId, owner.role, owner.isEmployee]);

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('vi-VN').format(price || 0) + ' đ';
	};

	const formatDate = (date: any) => {
		if (!date) return '---';
		if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString('vi-VN');
		return new Date(date).toLocaleDateString('vi-VN');
	};

	const getImageUrl = (url: string) => {
		if (!url) return '';
		if (url.includes('drive.google.com')) {
			const match = url.match(/[-\w]{25,}/);
			if (match) {
				return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w1000`;
			}
		}
		return url;
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
			initials: String(customer.name || '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'KH'
		};
	}).filter((item: any) => {
		const matchesName = !searchTerm ||
			String(item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
			String(item.businessName || '').toLowerCase().includes(searchTerm.toLowerCase());
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

	const totalPages = Math.ceil(aggregatedData.length / ITEMS_PER_PAGE);
	const paginatedData = aggregatedData.slice(
		(currentPage - 1) * ITEMS_PER_PAGE,
		currentPage * ITEMS_PER_PAGE
	);

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

	// Totals for KPIs
	const totalReceivable = aggregatedData.reduce((sum: any, item: any) => sum + (item.currentDebt > 0 ? item.currentDebt : 0), 0);
	const totalPayable = aggregatedData.reduce((sum: any, item: any) => sum + (item.currentDebt < 0 ? Math.abs(item.currentDebt) : 0), 0);
	const overdueCount = aggregatedData.filter((item: any) => item.currentDebt > 100000000).length; // Dummy threshold for overdue count


	const handlePaymentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setUploadingPaymentImage(true);
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('upload_preset', 'dunvexbuil');
			formData.append('folder', 'dunvex_payments');

			const response = await fetch(
				`https://api.cloudinary.com/v1_1/dtx0uvb4e/image/upload`,
				{
					method: 'POST',
					body: formData,
				}
			);

			const data = await response.json();
			if (data.secure_url) {
				setPaymentData(prev => ({ ...prev, proofImage: data.secure_url }));
			} else {
				showToast("Lỗi upload Cloudinary: " + (data.error?.message || "Không xác định"), "error");
			}
		} catch (error: any) {
			showToast(`Lỗi xử lý tệp: ${error.message}`, "error");
		} finally {
			setUploadingPaymentImage(false);
		}
	};

	const handleRecordPayment = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!paymentData.customerId || !paymentData.amount) {
			showToast("Vui lòng nhập đầy đủ thông tin", "warning");
			return;
		}

		try {
			if (editingPaymentId) {
				await updateDoc(doc(db, 'payments', editingPaymentId), {
					...paymentData,
					updatedAt: serverTimestamp()
				});
				// Log Update Payment
				await addDoc(collection(db, 'audit_logs'), {
					action: 'Cập nhật phiếu thu',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					userId: auth.currentUser?.uid,
					ownerId: owner.ownerId,
					details: `Đã cập nhật thu ${paymentData.amount.toLocaleString('vi-VN')} đ từ ${paymentData.customerName}`,
					createdAt: serverTimestamp()
				});
				showToast("Cập nhật phiếu thu thành công", "success");
			} else {
				await addDoc(collection(db, 'payments'), {
					...paymentData,
					createdAt: serverTimestamp(),
					ownerId: owner.ownerId,
					ownerEmail: owner.ownerEmail,
					createdBy: auth.currentUser?.uid,
					createdByEmail: auth.currentUser?.email
				});
				// Log New Payment
				await addDoc(collection(db, 'audit_logs'), {
					action: 'Ghi nhận thu nợ',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					userId: auth.currentUser?.uid,
					ownerId: owner.ownerId,
					details: `Đã thu ${paymentData.amount.toLocaleString('vi-VN')} đ từ ${paymentData.customerName}`,
					createdAt: serverTimestamp()
				});
				showToast("Ghi nhận thu nợ thành công", "success");
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
			showToast("Lỗi khi lưu phiếu thu", "error");
		}
	};


	const handleDeletePayment = async (id: string) => {
		if (!window.confirm("Bạn có chắc chắn muốn xóa phiếu thu này? Hành động này sẽ cập nhật lại dư nợ của khách hàng.")) return;
		try {
			await deleteDoc(doc(db, 'payments', id));
			showToast("Đã xóa phiếu thu", "success");
		} catch (error) {
			showToast("Lỗi khi xóa phiếu thu", "error");
		}
	};
	const hasPermission = owner.role === 'admin' || (owner.accessRights?.debts_manage ?? true);

	if (owner.loading) return null;

	if (!hasPermission) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center text-center p-8 min-h-screen">
				<div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-full text-orange-500 mb-4">
					<span className="material-symbols-outlined text-5xl">payments</span>
				</div>
				<h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">Quyền hạn hạn chế</h2>
				<p className="text-slate-500 dark:text-slate-400 max-w-md">
					Bạn không có quyền xem hoặc nhập công nợ. Vui lòng liên hệ Admin.
				</p>
				<button onClick={() => navigate('/')} className="mt-6 bg-[#1A237E] text-white px-6 py-2 rounded-xl font-bold">Quay lại</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 transition-colors duration-300">
			{/* Header */}
			<header className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300 print:hidden">
				<div className="flex items-center gap-4">
					<div className="flex flex-col">
						<h2 className="text-slate-900 dark:text-indigo-400 text-lg md:text-2xl font-black uppercase tracking-tight">Quản Lý Công Nợ</h2>
						<p className="text-[10px] text-slate-500 dark:text-slate-500 font-black uppercase tracking-widest hidden md:block">
							Cập nhật lúc: {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — {currentTime.toLocaleDateString('vi-VN')}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3 md:gap-6">
					<div className="hidden md:flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2 w-64 lg:w-96 border border-transparent focus-within:border-[#FF6D00]/50 transition-all shadow-inner">
						<span className="material-symbols-outlined text-slate-400">search</span>
						<input
							className="bg-transparent border-none focus:ring-0 text-sm w-full text-slate-700 dark:text-slate-200 ml-2 font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500"
							placeholder="Tìm kiếm đối tác..."
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={markAllAsRead}
							className="p-2 relative text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group"
						>
							<span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">notifications</span>
							{unreadCount > 0 && (
								<span className="absolute top-2 right-2 size-4 bg-[#FF6D00] text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 animate-bounce">
									{unreadCount}
								</span>
							)}
						</button>
						<button
							onClick={() => setShowPaymentForm(true)}
							className="hidden md:flex items-center justify-center gap-2 bg-[#1A237E] dark:bg-indigo-600 hover:bg-[#0D47A1] dark:hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-900/20 dark:shadow-indigo-900/20 transition-all active:scale-95"
						>
							<span className="material-symbols-outlined text-xl">add_card</span>
							<span>Ghi nhận thu nợ</span>
						</button>
					</div>
				</div>
			</header>

			{/* Content Area */}
			<div className="flex-1 p-4 md:p-8 print:hidden">
				<div className="max-w-7xl mx-auto flex flex-col gap-6 md:gap-8">
					{/* KPI Cards Section */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-0 transition-colors duration-300">
						{/* KPI Card 1 */}
						<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border-l-[6px] border-[#10b981] relative overflow-hidden group transition-colors duration-300">
							<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
								<span className="material-symbols-outlined text-7xl text-[#10b981]">download</span>
							</div>
							<div className="relative z-10 flex flex-col">
								<p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Tổng Phải thu</p>
								<p className="text-[#1A237E] dark:text-indigo-400 text-2xl lg:text-3xl font-black tracking-tighter">{formatPrice(totalReceivable)}</p>
								<p className="text-[10px] font-black text-[#10b981] mt-2 flex items-center gap-1 uppercase">
									<span className="material-symbols-outlined text-xs">arrow_upward</span> {aggregatedData.filter(i => i.currentDebt > 0).length} KH ĐANG NỢ
								</p>
							</div>
						</div>

						{/* KPI Card 2 */}
						<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border-l-[6px] border-[#3b82f6] relative overflow-hidden group transition-colors duration-300">
							<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
								<span className="material-symbols-outlined text-7xl text-[#3b82f6]">upload</span>
							</div>
							<div className="relative z-10 flex flex-col">
								<p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Tổng Phải trả</p>
								<p className="text-[#1A237E] dark:text-indigo-400 text-2xl lg:text-3xl font-black tracking-tighter">{formatPrice(totalPayable)}</p>
								<p className="text-[10px] font-black text-rose-500 mt-2 flex items-center gap-1 uppercase">
									<span className="material-symbols-outlined text-xs">arrow_downward</span> CHIẾM {((totalPayable / (totalReceivable || 1)) * 100).toFixed(0)}% PHẢI THU
								</p>
							</div>
						</div>

						{/* KPI Card 3 */}
						<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border-l-[6px] border-rose-500 relative overflow-hidden group transition-colors duration-300">
							<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
								<span className="material-symbols-outlined text-7xl text-rose-500">warning</span>
							</div>
							<div className="relative z-10 flex flex-col">
								<p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Nợ Quá hạn</p>
								<p className="text-rose-600 text-2xl lg:text-3xl font-black tracking-tighter">{overdueCount}</p>
								<div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[8px] font-black uppercase px-2 py-1 rounded-full w-fit mt-2 animate-pulse">
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
											? 'bg-[#1A237E] dark:bg-indigo-600 text-white shadow-lg shadow-blue-900/20 dark:shadow-indigo-900/20'
											: 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
											}`}
									>
										{status}
									</button>
								))}
							</div>
							<div className="flex items-center gap-2 w-full md:w-auto">
								<button
									onClick={() => setShowFilterOptions(!showFilterOptions)}
									className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showFilterOptions ? 'bg-[#1A237E] dark:bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 shadow-sm'}`}
								>
									<Filter size={16} /> Lọc thời gian
								</button>
								<button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF6D00] rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20">
									<Download size={16} /> Xuất File
								</button>
							</div>
						</div>

						{showFilterOptions && (
							<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 transition-colors duration-300">
								<div>
									<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Từ ngày</label>
									<input
										type="date"
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#1A237E]/20 dark:focus:ring-indigo-500/20"
										value={fromDate}
										onChange={(e) => setFromDate(e.target.value)}
									/>
								</div>
								<div>
									<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Đến ngày</label>
									<input
										type="date"
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#1A237E]/20 dark:focus:ring-indigo-500/20"
										value={toDate}
										onChange={(e) => setToDate(e.target.value)}
									/>
								</div>
							</div>
						)}
					</div>

					{/* Table */}
					<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-blue-900/5 dark:shadow-indigo-900/5 border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
						<div className="overflow-x-auto">
							<table className="w-full text-left">
								<thead>
									<tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
										<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Đối tác / Mã KH</th>
										<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Tổng Mua</th>
										<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Đã Trả</th>
										<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Dư nợ hiện tại</th>
										<th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Hành động</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
									{loading ? (
										[1, 2, 3, 4, 5].map(i => (
											<tr key={i} className="animate-pulse">
												<td className="px-8 py-5 border-b border-slate-50 dark:border-slate-800">
													<div className="flex items-center gap-4">
														<div className="size-12 rounded-2xl skeleton" />
														<div className="space-y-2">
															<div className="w-32 h-4 skeleton" />
															<div className="w-20 h-3 skeleton opacity-50" />
														</div>
													</div>
												</td>
												<td className="px-8 py-5 border-b border-slate-50 dark:border-slate-800"><div className="w-20 h-4 skeleton ml-auto" /></td>
												<td className="px-8 py-5 border-b border-slate-50 dark:border-slate-800"><div className="w-20 h-4 skeleton ml-auto" /></td>
												<td className="px-8 py-5 border-b border-slate-50 dark:border-slate-800"><div className="w-24 h-5 skeleton ml-auto" /></td>
												<td className="px-6 py-5 border-b border-slate-50 dark:border-slate-800">
													<div className="flex justify-end gap-2">
														<div className="size-10 rounded-xl skeleton" />
														<div className="size-10 rounded-xl skeleton" />
													</div>
												</td>
											</tr>
										))
									) : paginatedData.length === 0 ? (
										<tr><td colSpan={5} className="py-20 text-center text-slate-400 dark:text-slate-500 uppercase font-black text-xs tracking-[4px]">Không tìm thấy đối tác nào</td></tr>
									) : paginatedData.map((row) => (
										<tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => openStatement(row)}>
											<td className="px-8 py-5">
												<div className="flex items-center gap-4">
													<div className={`size-12 rounded-2xl bg-[#1A237E]/10 dark:bg-indigo-500/10 flex items-center justify-center text-[#1A237E] dark:text-indigo-400 font-black text-sm shrink-0 shadow-sm border border-slate-200 dark:border-slate-800`}>{row.initials}</div>
													<div>
														<p className="text-sm font-black text-slate-900 dark:text-indigo-400 uppercase tracking-tight leading-tight">{row.name}</p>
														<p className="text-[10px] text-slate-500 dark:text-slate-500 font-black mt-1 tracking-wider uppercase">{row.phone || row.id.slice(-6)}</p>
													</div>
												</div>
											</td>
											<td className="px-8 py-5 text-right">
												<span className="text-xs font-black text-slate-600 dark:text-slate-400">{formatPrice(row.totalOrdersAmount)}</span>
											</td>
											<td className="px-8 py-5 text-right">
												<span className="text-xs font-black text-green-700 dark:text-green-400">{formatPrice(row.totalPaymentsAmount)}</span>
											</td>
											<td className="px-8 py-5 text-right">
												<span className={`text-sm font-black tracking-tight ${row.currentDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#10b981] dark:text-emerald-400'}`}>
													{formatPrice(row.currentDebt)}
												</span>
											</td>
											<td className="px-6 py-5 text-right">
												<div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
													<button
														onClick={() => openStatement(row)}
														className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-[#1A237E] dark:hover:text-indigo-400 hover:border-[#1A237E] dark:hover:border-indigo-400 transition-all shadow-sm"
														title="Xem chi tiết"
													>
														<FileText size={20} />
													</button>
													<button
														onClick={() => {
															setPaymentData({ ...paymentData, customerId: row.id, customerName: row.name });
															setShowPaymentForm(true);
														}}
														className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-[#FF6D00] hover:border-[#FF6D00] transition-all shadow-sm"
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

					{/* Pagination Controls - Desktop & Mobile */}
					{!loading && totalPages > 1 && (
						<div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
							<p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">
								Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, aggregatedData.length)} của {aggregatedData.length} đối tác
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
			</div>

			{/* PAYMENT FORM MODAL */}
			{showPaymentForm && (
				<div className="fixed inset-0 z-[150] bg-[#1A237E]/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 transition-colors duration-300">
						<div className="px-8 py-6 bg-[#1A237E] dark:bg-indigo-900 text-white flex items-center justify-between">
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
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Chọn khách hàng</label>
								<select
									className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6D00]/20 appearance-none"
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
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Ngày thu nợ</label>
								<input
									type="date"
									className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6D00]/20"
									value={paymentData.date}
									onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Số tiền thu</label>
									<input
										type="number"
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-black text-[#FF6D00] focus:ring-2 focus:ring-[#FF6D00]/20"
										placeholder="0"
										value={paymentData.amount === 0 ? '' : paymentData.amount}
										onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
									/>
								</div>
								<div>
									<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Hình thức</label>
									<select
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6D00]/20 appearance-none"
										value={paymentData.paymentMethod}
										onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
									>
										<option value="Tiền mặt">Tiền mặt</option>
										<option value="Chuyển khoản">Chuyển khoản</option>
									</select>
								</div>
							</div>

							<div>
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Ghi chú</label>
								<textarea
									rows={3}
									className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6D00]/20 resize-none"
									placeholder="VD: Thu nợ đơn hàng tháng 10..."
									value={paymentData.note}
									onChange={(e) => setPaymentData({ ...paymentData, note: e.target.value })}
								/>
							</div>

							<div>
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-2">Bằng chứng thanh toán (Lệnh chuyển tiền)</label>
								<div className="flex gap-4">
									<button
										type="button"
										onClick={() => document.getElementById('payment-proof-upload')?.click()}
										disabled={uploadingPaymentImage}
										className="flex-1 h-20 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
									>
										{uploadingPaymentImage ? (
											<div className="size-5 border-2 border-[#1A237E] dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
										) : (
											<>
												<Camera size={24} className="text-slate-400 dark:text-slate-500" />
												<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{paymentData.proofImage ? 'Chụp lại ảnh' : 'Chụp/Tải ảnh'}</span>
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
										<div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-700 shadow-lg shrink-0">
											<img src={getImageUrl(paymentData.proofImage)} alt="Proof" className="w-full h-full object-cover" />
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
				((owner.isPro || !owner.systemConfig.lock_free_debts) && !owner.manualLockDebts) ? (
					<div id="debt-statement-modal" className="fixed inset-0 z-[160] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-0 md:p-8">
						<div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] md:rounded-[3rem] shadow-2xl relative flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 transaction-colors duration-300">
							{/* MODAL HEADER - STICKY FOR UI BUT HIDDEN FOR SCREENSHOT ONCE SCROLLED */}
							<div className="flex-none bg-white dark:bg-slate-900 px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between z-20 md:rounded-t-[3rem] print:hidden transition-colors duration-300">
								<div className="flex items-center gap-3">
									<div className="size-10 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
										<History size={20} />
									</div>
									<div>
										<h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">Chi tiết công nợ</h3>
										<p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">{selectedCustomer.name}</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<button onClick={handlePrintStatement} className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-2 font-bold text-xs uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
										<Printer size={16} /> <span className="hidden md:inline">In phiếu</span>
									</button>
									<button onClick={() => setShowStatement(false)} className="size-10 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors">
										<X size={20} />
									</button>
								</div>
							</div>

							{/* DATE FILTER BAR FOR STATEMENT */}
							<div className="flex-none bg-slate-50 dark:bg-slate-800/50 px-4 md:px-8 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 z-10 print:hidden transition-colors duration-300">
								<div className="flex items-center gap-4 w-full md:w-auto">
									<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">Lọc giao dịch:</span>
									<div className="flex items-center gap-2 w-full">
										<input
											type="date"
											value={statementFromDate}
											onChange={(e) => setStatementFromDate(e.target.value)}
											className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
										/>
										<span className="text-slate-300">-</span>
										<input
											type="date"
											value={statementToDate}
											onChange={(e) => setStatementToDate(e.target.value)}
											className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
										/>
									</div>
								</div>

								{/* ZOOM CONTROLS */}
								<div className="flex bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
									{[0.6, 0.85, 1.0].map((v) => (
										<button
											key={v}
											onClick={() => setStatementZoom(v)}
											className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${statementZoom === v ? 'bg-[#1A237E] dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
										>
											{v * 100}%
										</button>
									))}
								</div>
							</div>

							{/* SCROLLABLE DOCUMENT AREA */}
							<div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950/50 py-8 flex items-start justify-center scroll-smooth custom-scrollbar">

								{/* THE PAPER SHEET - Scalable Wrapper */}
								<div
									style={{
										width: '800px',
										transform: `scale(${statementScale * statementZoom})`,
										transformOrigin: 'top center',
										marginBottom: (statementScale * statementZoom) < 1 ? `-${(1 - (statementScale * statementZoom)) * 1700}px` : '100px'
									}}
									className="flex-shrink-0 print-scale transition-transform duration-200"
								>
									<div
										id="debt-statement-paper"
										className="bg-white w-[800px] shadow-[0_32px_96px_-12px_rgba(0,0,0,0.3)] min-h-[1141px] p-16 mb-20 flex flex-col font-['Inter', sans-serif] relative text-sm text-slate-900 border-2 border-slate-200"
									>

										{/* 2. Customer & Cycle Info Grid */}
										{(() => {
											const startVal = statementFromDate || '0000-00-00';
											const endVal = statementToDate || '9999-99-99';

											// Normalized date extraction for grouping
											const getNormDate = (tx: any) => {
												if (tx.orderDate) return tx.orderDate; // "2026-02-10"
												if (tx.date) return tx.date; // "2026-02-10"

												let d;
												if (tx.createdAt?.seconds) {
													d = new Date(tx.createdAt.seconds * 1000);
												} else if (tx.createdAt) {
													d = new Date(tx.createdAt);
												} else {
													return '';
												}

												if (isNaN(d.getTime())) return '';

												const year = d.getFullYear();
												const month = String(d.getMonth() + 1).padStart(2, '0');
												const day = String(d.getDate()).padStart(2, '0');
												return `${year}-${month}-${day}`;
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
													return sum + Number(tx.totalAmount || 0) - Number(tx.amount || 0);
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

											const debitIncrease = cycleTx.filter(t => t.txType === 'order').reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
											const creditDecrease = cycleTx.filter(t => t.txType === 'payment').reduce((sum, p) => sum + Number(p.amount || 0), 0);
											const closingBalance = openingBalance + debitIncrease - creditDecrease;

											return (
												<>
													{/* 1. Header */}
													<div className="flex justify-between items-start mb-8 border-b-4 border-[#FFD600] pb-6">
														<div>
															<h1 className="text-[#d97706] text-4xl font-black uppercase mb-1 tracking-tighter">PHIẾU BÁO CÔNG NỢ</h1>
															<p className="text-slate-900 text-sm font-black uppercase tracking-[0.2em]">Hệ thống quản lý Dunvex Digital</p>
														</div>
														<div className="text-right">
															<p className="text-slate-900 font-black text-sm uppercase tracking-wider">Ngày báo: {new Date().toLocaleDateString('vi-VN')}</p>
															<p className="text-slate-900 font-black text-sm uppercase tracking-wider mt-1">Mã KH: {selectedCustomer.id?.slice(-6).toUpperCase()}</p>
														</div>
													</div>

													<div className="mb-10">
														<p className="text-slate-900 font-black text-xl leading-none">Kính gửi: <span className="font-black text-[#1A237E] uppercase">{selectedCustomer.businessName || selectedCustomer.name}</span></p>
														<p className="text-slate-900 text-lg mt-3 font-medium">Chúng tôi xin thông báo tình trạng công nợ tính đến hiện tại như sau:</p>
													</div>

													{/* 2. List of Orders (Includes Opening Balance) */}
													<div className="mb-10">
														<h3 className="flex items-center text-slate-900 font-black text-lg mb-4 pl-4 border-l-[6px] border-[#FFD600] uppercase tracking-tight">
															1. Danh sách đơn hàng
														</h3>
														<div className="rounded-xl border-2 border-slate-300 overflow-hidden shadow-sm">
															<table className="w-full text-sm border-collapse">
																<thead className="bg-slate-200 text-slate-900 font-black uppercase tracking-widest text-[10px]">
																	<tr>
																		<th className="py-4 px-6 text-left w-1/4 border-r border-slate-300">Ngày</th>
																		<th className="py-4 px-6 text-left w-1/4 border-r border-slate-300">Mã đơn</th>
																		<th className="py-4 px-6 text-right w-1/2">Giá trị giao dịch</th>
																	</tr>
																</thead>
																<tbody className="text-slate-900 divide-y-2 divide-slate-200">
																	{/* Opening Balance Row */}
																	<tr className="bg-[#FFFCE0] font-black text-slate-900">
																		<td className="py-4 px-6 border-r border-slate-300">{statementFromDate ? formatDate(statementFromDate) : '---'}</td>
																		<td className="py-4 px-6 uppercase text-[#d97706] tracking-widest text-xs border-r border-slate-300">DƯ NỢ ĐẦU KỲ</td>
																		<td className="py-4 px-6 text-right text-lg">{formatPrice(openingBalance)}</td>
																	</tr>
																	{/* Order Rows */}
																	{cycleTx.filter(t => t.txType === 'order').map((order, idx) => (
																		<tr key={`ord-${idx}`} className="hover:bg-slate-50 font-black">
																			<td className="py-4 px-6 border-r border-slate-200">{formatDate(order.orderDate || order.createdAt)}</td>
																			<td className="py-4 px-6 font-black text-[#1A237E] border-r border-slate-200 uppercase tracking-tighter">#{order.id?.slice(0, 8).toUpperCase()}</td>
																			<td className="py-4 px-6 text-right text-base">{formatPrice(order.totalAmount)}</td>
																		</tr>
																	))}
																	{cycleTx.filter(t => t.txType === 'order').length === 0 && (
																		<tr>
																			<td colSpan={3} className="py-4 text-center text-slate-400 italic text-xs">Không có đơn hàng mới trong kỳ</td>
																		</tr>
																	)}
																	{/* Total Row */}
																	<tr className="bg-slate-100 font-black border-t-2 border-slate-800">
																		<td colSpan={2} className="py-5 px-6 uppercase text-slate-900 text-sm tracking-tight border-r border-slate-300">TỔNG CỘNG (ĐẦU KỲ + PHÁT SINH)</td>
																		<td className="py-5 px-6 text-right text-2xl text-rose-700 leading-none">{formatPrice(openingBalance + debitIncrease)}</td>
																	</tr>
																</tbody>
															</table>
														</div>
													</div>

													{/* 3. Payment History */}
													<div className="mb-12">
														<h3 className="flex items-center text-slate-900 font-black text-lg mb-4 pl-4 border-l-[6px] border-emerald-500 uppercase tracking-tight">
															2. Lịch sử đã thanh toán
														</h3>
														<div className="rounded-xl border-2 border-slate-300 overflow-hidden shadow-sm">
															<table className="w-full text-sm border-collapse">
																<thead className="bg-[#E9F5ED] text-slate-900 font-black uppercase tracking-widest text-[10px]">
																	<tr>
																		<th className="py-4 px-6 text-left w-1/4 border-r border-slate-300">Ngày</th>
																		<th className="py-4 px-6 text-left w-1/2 border-r border-slate-300">Nội dung</th>
																		<th className="py-4 px-6 text-right w-1/4">Số tiền thu</th>
																	</tr>
																</thead>
																<tbody className="text-slate-900 divide-y-2 divide-slate-200">
																	{/* Payment Rows */}
																	{cycleTx.filter(t => t.txType === 'payment').map((pay, idx) => (
																		<tr key={`pay-${idx}`} className="hover:bg-slate-50 font-black">
																			<td className="py-4 px-6 border-r border-slate-200">{formatDate(pay.date || pay.createdAt)}</td>
																			<td className="py-4 px-6 border-r border-slate-200 uppercase tracking-tighter text-xs">{pay.note || 'Thanh toán công nợ'}</td>
																			<td className="py-4 px-6 text-right text-lg text-emerald-700">{formatPrice(pay.amount)}</td>
																		</tr>
																	))}
																	{cycleTx.filter(t => t.txType === 'payment').length === 0 && (
																		<tr>
																			<td colSpan={3} className="py-4 text-center text-slate-400 italic text-xs">Chưa có thanh toán nào trong kỳ</td>
																		</tr>
																	)}
																	{/* Total Payment Row */}
																	<tr className="bg-slate-100 font-black border-t-2 border-slate-800">
																		<td colSpan={2} className="py-5 px-6 uppercase text-slate-900 text-sm tracking-tight border-r border-slate-300">TỔNG ĐÃ THANH TOÁN TRONG KỲ</td>
																		<td className="py-5 px-6 text-right text-2xl text-emerald-700 leading-none">{formatPrice(creditDecrease)}</td>
																	</tr>
																</tbody>
															</table>
														</div>
													</div>

													{/* 4. Final Summary Box */}
													<div className="bg-[#FFD600] border-4 border-slate-900 rounded-[2rem] p-8 flex flex-row justify-between items-center mb-20 shadow-2xl">
														<span className="text-slate-900 font-black uppercase text-2xl tracking-tighter">SỐ DƯ CÔNG NỢ CÒN LẠI</span>
														<span className="text-slate-900 font-black text-5xl tracking-tighter">{formatPrice(closingBalance)}</span>
													</div>

													{/* 5. Signatures */}
													<div className="flex justify-between px-10 mb-12 items-end">
														<div className="text-center flex flex-col items-center">
															<p className="font-black text-slate-900 mb-28 text-lg uppercase tracking-widest">Đại diện khách hàng</p>
															<p className="text-slate-500 font-bold italic text-xs">(Ký và ghi rõ họ tên)</p>
														</div>
														<div className="text-center flex flex-col items-center">
															<p className="font-black text-slate-900 mb-28 text-lg uppercase tracking-widest">Người lập phiếu</p>
															<p className="font-black text-slate-900 uppercase text-xl underline decoration-4 decoration-[#FFD600] underline-offset-8">{auth.currentUser?.displayName || 'Admin'}</p>
														</div>
													</div>

													{/* Footer for print */}
													<div className="hidden print:block text-center mt-8 pt-4 border-t border-slate-100">
														<p className="text-[10px] text-slate-400 italic">Cảm ơn quý khách đã tin tưởng và hợp tác cùng Dunvex Build.</p>
													</div>
												</>
											);
										})()}
									</div>
								</div>
							</div>
						</div>
					</div>
				) : (
					<UpgradeModal
						onClose={() => setShowStatement(false)}
						featureName="Chi tiết công nợ khách hàng"
					/>
				)
			)}
		</div>
	);
};

export default Debts;
