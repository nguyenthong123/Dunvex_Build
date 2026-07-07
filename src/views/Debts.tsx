import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, writeBatch, getDocs, limit, orderBy, increment, Timestamp } from 'firebase/firestore';
import { useOrders } from '../hooks/useOrders';
import { usePayments } from '../hooks/usePayments';
import { useCustomers } from '../hooks/useCustomers';
import { Filter, Download, PlusCircle, Printer, X, History, FileText, Edit2, Trash2, MapPin, Phone, Camera, Image, Lock, Crown } from 'lucide-react';
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

	const [activeTab, setActiveTab] = useState<'customers' | 'history'>('customers');
	const [currentTime, setCurrentTime] = useState(new Date());
	const { orders } = useOrders({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId, maxResults: 500 });
	const { payments } = usePayments({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId });
	const { customers, loading } = useCustomers({ ownerId: owner.ownerId, enabled: !owner.loading && !!owner.ownerId });
	// 🔧 REFACTOR: Trên là hooks thay cho useState + 3 onSnapshot

	// Filters
	const [searchTerm, setSearchTerm] = useState('');
	const [showMobileSearch, setShowMobileSearch] = useState(false);
	const searchRef = React.useRef<HTMLInputElement>(null);

	useEffect(() => {
		const handleOpenSearch = () => {
			setShowMobileSearch(true);
			setTimeout(() => searchRef.current?.focus(), 200);
		};
		window.addEventListener('open-mobile-search', handleOpenSearch);
		return () => window.removeEventListener('open-mobile-search', handleOpenSearch);
	}, []);

	useEffect(() => {
		const handleOpenAdd = () => {
			setSelectedCustomer(null);
			setShowPaymentForm(true);
		};
		window.addEventListener('open-mobile-add', handleOpenAdd);
		return () => window.removeEventListener('open-mobile-add', handleOpenAdd);
	}, []);
	const [fromDate, setFromDate] = useState('');
	const [toDate, setToDate] = useState('');
	const [statusFilter, setStatusFilter] = useState('Đơn chốt');
	const [showFilterOptions, setShowFilterOptions] = useState(false);

	// Modals/Editing
	const [showPaymentForm, setShowPaymentForm] = useState(false);
	const [showPaymentCustomerResults, setShowPaymentCustomerResults] = useState(false);
	const [paymentCustomerSearchQuery, setPaymentCustomerSearchQuery] = useState('');
	const paymentCustomerRef = React.useRef<HTMLDivElement>(null);
	

	const normalizeText = (text: any) => text ? String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() : '';
	const removeAccents = (str: any) => {
		return String(str || '').normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/đ/g, 'd')
			.replace(/Đ/g, 'D');
	};
	const isMatch = (target: string, query: string) => {
		if (!query) return true;
		const t = normalizeText(target);
		const q = normalizeText(query);
		return t.includes(q) || removeAccents(t).includes(removeAccents(q));
	};

	const [unreadCount, setUnreadCount] = useState(0);
	const [currentPage, setCurrentPage] = useState(1);
	const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
	const ITEMS_PER_PAGE = 10;

	const [showPaymentDetail, setShowPaymentDetail] = useState(false);
	const [selectedPayment, setSelectedPayment] = useState<any>(null);


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

	const location = useLocation();

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
	const [statementZoom, setStatementZoom] = useState(1);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (paymentCustomerRef.current && !paymentCustomerRef.current.contains(event.target as Node)) {
				setShowPaymentCustomerResults(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

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
		// Follow the main screen's filter if it exists
		setStatementFromDate(fromDate || '');
		setStatementToDate(toDate || '');
		setShowStatement(true);
	};

	const handlePrintStatement = () => {
		const printContent = document.getElementById('debt-statement-container');
		if (!printContent) return;

		const printWindow = window.open('', '_blank', 'width=1000,height=1000');
		if (!printWindow) {
			alert("Vui lòng cho phép trình duyệt mở popup để in!");
			return;
		}

		// Compile active CSS rules directly to prevent black & white styling due to lazy-loaded CSS
		let styles = '';
		try {
			for (const sheet of document.styleSheets) {
				try {
					if (sheet.cssRules) {
						for (const rule of sheet.cssRules) {
							styles += rule.cssText + '\n';
						}
					}
				} catch (e) {
					// Fallback for cross-origin styles
					if (sheet.href) {
						styles += `@import url("${sheet.href}");\n`;
					}
				}
			}
		} catch (err) {
			console.warn("Could not inline all styles directly", err);
		}

		// Also collect current HTML style/link nodes as a fallback
		let fallbackTags = '';
		document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
			fallbackTags += node.outerHTML;
		});

		printWindow.document.write(`
			<html>
				<head>
					<base href="${window.location.origin}/">
					<title>In Công Nợ - ${selectedCustomer?.name || ''}</title>
					<link rel="preconnect" href="https://fonts.googleapis.com">
					<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
					<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
					<style>${styles}</style>
					${fallbackTags}
					<style>
						body { 
							background: #f1f5f9; 
							padding: 0; margin: 0; 
							display: flex; justify-content: center;
							font-family: 'Inter', 'Manrope', sans-serif !important;
						}
						#debt-statement-container {
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
							#debt-statement-container { margin: 0 !important; }
							@page { size: A4; margin: 0; }
						}
					</style>
				</head>
				<body>
					<div class="print-container">
						${printContent.outerHTML}
					</div>
					<script>
						function checkStylesAndPrint() {
							const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
							let loadedCount = 0;
							
							const printAndClose = () => {
								if (window.hasPrinted) return;
								window.hasPrinted = true;
								
								if (document.fonts && document.fonts.ready) {
									document.fonts.ready.then(() => {
										setTimeout(() => {
											window.print();
											if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
												window.close();
											}
										}, 250);
									}).catch(() => {
										setTimeout(() => {
											window.print();
											if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
												window.close();
											}
										}, 250);
									});
								} else {
									setTimeout(() => {
										window.print();
										if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
											window.close();
										}
									}, 250);
								}
							};

							if (links.length === 0) {
								printAndClose();
								return;
							}
							
							links.forEach(link => {
								if (link.sheet) {
									loadedCount++;
									if (loadedCount === links.length) {
										printAndClose();
									}
								} else {
									link.onload = () => {
										loadedCount++;
										if (loadedCount === links.length) {
											printAndClose();
										}
									};
									link.onerror = () => {
										loadedCount++;
										if (loadedCount === links.length) {
											printAndClose();
										}
									};
								}
							});
							
							// Backup timeout to make sure it prints even if a resource is blocked
							setTimeout(printAndClose, 1200);
						}
						
						if (document.readyState === 'complete') {
							checkStylesAndPrint();
						} else {
							window.onload = checkStylesAndPrint;
						}
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
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		const { search, state } = location;
		const params = new URLSearchParams(search);
		if (params.get('payment') === 'true' || state?.payment) {
			setShowPaymentForm(true);
			if (state?.prefillData) {
				setPaymentData(prev => ({
					...prev,
					...state.prefillData
				}));
			}
			// Xóa state để tránh mở lại modal khi reload
			if (state) {
				window.history.replaceState({}, document.title);
			}
		}
		const tabParam = params.get('tab');
		if (tabParam === 'history') {
			setActiveTab('history');
		} else if (tabParam === 'customers') {
			setActiveTab('customers');
		}
	}, [location]);
	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 60000);
		return () => clearInterval(timer);
	}, []);

	// 🔧 REFACTOR: 3 onSnapshot (orders/payments/customers) → hooks useOrders/usePayments/useCustomers

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
	const aggregatedData = allEntities.map((c: any) => {
		const customerOrders = orders.filter((o: any) => {
			if (c.isGuest) {
				return (!o.customerId || !registeredMap.has(o.customerId)) && (o.customerName === c.name || (!o.customerName && c.name === 'Khách vãng lai'));
			}
			return o.customerId === c.id;
		});

		const customerPayments = payments.filter((p: any) => {
			if (c.isGuest) {
				return (!p.customerId || !registeredMap.has(p.customerId)) && (p.customerName === c.name || (!p.customerName && c.name === 'Khách vãng lai'));
			}
			return p.customerId === c.id;
		});

		const hasDateFilter = !!(fromDate || toDate);
		let periodOrders = customerOrders;
		let periodPayments = customerPayments;

		if (hasDateFilter) {
			const start = fromDate || '0000-00-00';
			const end = toDate || '9999-99-99';
			periodOrders = customerOrders.filter(o => {
				const txDate = o.orderDate || (o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : '');
				return txDate >= start && txDate <= end;
			});
			periodPayments = customerPayments.filter(p => {
				const txDate = p.date || (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toISOString().split('T')[0] : '');
				return txDate >= start && txDate <= end;
			});
		}

		// Inclusion of 'Đơn chốt' as current debt
		const confirmedStatuses = ['Đơn chốt'];
		const debtOrders = customerOrders.filter(o => confirmedStatuses.includes(o.status));
		const lifetimeTotalWaited = debtOrders.reduce((sum: any, o: any) => sum + (o.totalAmount || 0), 0);
		const lifetimeTotalPaid = customerPayments.reduce((sum: any, p: any) => sum + (p.amount || 0), 0);
		
		// Use actual debt from database for registered customers
		const calcDebt = lifetimeTotalWaited - lifetimeTotalPaid;
		const currentDebt = c.isGuest ? calcDebt : (Number(c.debt) || 0);

		// Column display values based on status filter and date filter
		let displayTotalOrders = 0;
		if (statusFilter === 'Tất cả') {
			displayTotalOrders = periodOrders.reduce((sum: any, o: any) => sum + (o.totalAmount || 0), 0);
		} else {
			displayTotalOrders = periodOrders
				.filter(o => o.status === statusFilter)
				.reduce((sum: any, o: any) => sum + (o.totalAmount || 0), 0);
		}

		// If no date filter is applied, we adjust displayTotalOrders to match currentDebt for accuracy 
		// (since orders might be missing due to 500 limit).
		if (!hasDateFilter && (statusFilter === 'Tất cả' || statusFilter === 'Đơn chốt')) {
			displayTotalOrders = (currentDebt > 0 ? currentDebt : 0) + lifetimeTotalPaid;
		}

		const totalPaid = hasDateFilter ? periodPayments.reduce((sum: any, p: any) => sum + (p.amount || 0), 0) : lifetimeTotalPaid;

		// Get last transaction (unfiltered for accurate sorting and health)
		const allTx = [
			...customerOrders.filter((o: any) => o.status === 'Đơn chốt').map((o: any) => ({ date: o.createdAt || o.orderDate, type: 'order' })),
			...customerPayments.map((p: any) => ({ date: p.createdAt || p.date, type: 'payment' }))
		].sort((a: any, b: any) => {
			const da = a.date?.seconds ? a.date.seconds * 1000 : (a.date ? new Date(a.date).getTime() : 0);
			const db = b.date?.seconds ? b.date.seconds * 1000 : (b.date ? new Date(b.date).getTime() : 0);
			return db - da;
		});

		// Final AI Risk Analysis for each customer
		const turnoverDays = allTx[0]?.date ? Math.floor((new Date().getTime() - (allTx[0].date?.seconds ? allTx[0].date.seconds * 1000 : new Date(allTx[0].date).getTime())) / (1000 * 60 * 60 * 24)) : 999;
		
		let debtHealth: 'healthy' | 'slow' | 'risk' | 'critical' = 'healthy';
		if (currentDebt > 200000000 || (currentDebt > 50000000 && turnoverDays > 60)) debtHealth = 'critical';
		else if (currentDebt > 100000000 || turnoverDays > 30) debtHealth = 'risk';
		else if (currentDebt > 10000000 || turnoverDays > 15) debtHealth = 'slow';

		return {
			...c,
			totalOrdersAmount: displayTotalOrders,
			totalPaymentsAmount: totalPaid,
			currentDebt,
			lastTx: allTx[0]?.date || null,
			debtHealth,
			turnoverDays,
			hasStatusOrders: statusFilter === 'Tất cả' ? (periodOrders.length > 0 || periodPayments.length > 0 || currentDebt > 0) : (periodOrders.some(o => o.status === statusFilter) || currentDebt > 0),
			initials: String(c.name || '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'KH'
		};
	}).filter((item: any) => {
		const matchesName = !searchTerm ||
			String(item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
			String(item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
		
		// When filtering by date, we only show customers who actually had transactions in that period
		if (fromDate || toDate) {
			const hasTxInRange = item.totalOrdersAmount > 0 || item.totalPaymentsAmount > 0;
			return matchesName && hasTxInRange;
		}

		const matchesStatus = item.hasStatusOrders;
		return matchesName && matchesStatus;
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

	const filteredHistory = [...payments].sort((a, b) => {
		const da = a.date ? new Date(a.date).getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
		const db = b.date ? new Date(b.date).getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
		if (db === da) {
			const ca = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
			const cb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
			return cb - ca;
		}
		return db - da;
	}).filter(p => {
		const matchesName = !searchTerm ||
			String(p.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());

		if (fromDate || toDate) {
			const start = fromDate || '0000-00-00';
			const end = toDate || '9999-99-99';
			const pDate = p.date || (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toISOString().split('T')[0] : '');
			return matchesName && pDate >= start && pDate <= end;
		}
		return matchesName;
	});

	const historyTotalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
	const paginatedHistory = filteredHistory.slice(
		(historyCurrentPage - 1) * ITEMS_PER_PAGE,
		historyCurrentPage * ITEMS_PER_PAGE
	);

	const getHistoryPageNumbers = () => {
		const pages: (number | string)[] = [];
		const radius = 1;

		for (let i = 1; i <= historyTotalPages; i++) {
			if (
				i === 1 ||
				i === historyTotalPages ||
				(i >= historyCurrentPage - radius && i <= historyCurrentPage + radius) ||
				i <= 3 ||
				i >= historyTotalPages - 2
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

	// Totals for KPIs (perfectly aligned with displayed table columns)
	const totalWaitedAll = aggregatedData.reduce((sum: any, item: any) => sum + (item.totalOrdersAmount || 0), 0);
	const totalPaidAll = aggregatedData.reduce((sum: any, item: any) => sum + (item.totalPaymentsAmount || 0), 0);
	const totalUnpaidAll = aggregatedData.reduce((sum: any, item: any) => sum + (item.currentDebt > 0 ? item.currentDebt : 0), 0);


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

		setIsSubmitting(true);
		try {
			const batch = writeBatch(db);
			const diffAmount = editingPaymentId 
				? Number(paymentData.amount) - (Number(payments.find(p => p.id === editingPaymentId)?.amount) || 0)
				: Number(paymentData.amount);

			let newPaymentId = editingPaymentId;

			if (editingPaymentId) {
				batch.update(doc(db, 'payments', editingPaymentId), {
					...paymentData,
					updatedAt: Timestamp.now()
				});
				
				// Log Update Payment
				const auditRef = doc(collection(db, 'audit_logs'));
				batch.set(auditRef, {
					action: 'Cập nhật phiếu thu',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					userId: auth.currentUser?.uid || "",
					ownerId: owner.ownerId,
					details: `Đã cập nhật thu ${paymentData.amount.toLocaleString('vi-VN')} đ từ ${paymentData.customerName}`,
					createdAt: serverTimestamp()
				});
			} else {
				const paymentRef = doc(collection(db, 'payments'));
				newPaymentId = paymentRef.id;
				batch.set(paymentRef, {
					...paymentData,
					createdAt: Timestamp.now(), // Fixed optimistic drop
					ownerId: owner.ownerId,
					ownerEmail: owner.ownerEmail,
					createdBy: auth.currentUser?.uid,
					createdByEmail: auth.currentUser?.email
				});
				
				// Log New Payment
				const auditRef = doc(collection(db, 'audit_logs'));
				batch.set(auditRef, {
					action: 'Ghi nhận thu nợ',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					userId: auth.currentUser?.uid || "",
					ownerId: owner.ownerId,
					details: `Đã thu ${paymentData.amount.toLocaleString('vi-VN')} đ từ ${paymentData.customerName}`,
					createdAt: serverTimestamp()
				});
			}

			// Update Debt (chỉ cho khách có thật, bỏ qua "Khách vãng lai")
			if (paymentData.customerId && diffAmount !== 0 && !paymentData.customerId.startsWith('guest_')) {
				batch.update(doc(db, 'customers', paymentData.customerId), {
					debt: increment(-diffAmount)
				});
			}

			await batch.commit();
			
			// Optimistic local state update for immediate feedback
			const updatedPayment = {
				id: newPaymentId as string,
				...paymentData,
				createdAt: editingPaymentId ? (payments.find(p => p.id === editingPaymentId)?.createdAt || Timestamp.now()) : Timestamp.now(),
				updatedAt: Timestamp.now(),
				ownerId: owner.ownerId,
				ownerEmail: owner.ownerEmail,
				createdBy: auth.currentUser?.uid,
				createdByEmail: auth.currentUser?.email
			};
			// 🔧 REFACTOR: Hook tự cập nhật qua Firestore listener

			showToast(editingPaymentId ? "Cập nhật phiếu thu thành công" : "Ghi nhận thu nợ thành công", "success");
			setShowPaymentForm(false);
			setEditingPaymentId(null);
			setHistoryCurrentPage(1);
			setPaymentData({
				customerId: '',
				customerName: '',
				amount: 0,
				date: new Date().toISOString().split('T')[0],
				note: '',
				paymentMethod: 'Tiền mặt',
				proofImage: ''
			});
			
			// Reload trang sau 800ms để data hiển thị mới nhất theo yêu cầu
			setTimeout(() => {
				window.location.reload();
			}, 800);
		} catch (error) {
			showToast("Lỗi khi lưu phiếu thu", "error");
		} finally {
			setIsSubmitting(false);
		}
	};


	const handleDeletePayment = async (id: string) => {
		if (!window.confirm("Bạn có chắc chắn muốn xóa phiếu thu này? Hành động này sẽ cập nhật lại dư nợ của khách hàng.")) return;
		try {
			const paymentToDelete = payments.find(p => p.id === id);
			
			// Optimistic local state update for immediate feedback
			// 🔧 REFACTOR: Hook tự cập nhật

			if (paymentToDelete && paymentToDelete.customerId && !String(paymentToDelete.customerId).startsWith('guest_')) {
				const batch = writeBatch(db);
				batch.delete(doc(db, 'payments', id));
				batch.update(doc(db, 'customers', paymentToDelete.customerId), {
					debt: increment(paymentToDelete.amount)
				});
				// Log Delete Payment
				const auditRef = doc(collection(db, 'audit_logs'));
				batch.set(auditRef, {
					action: 'Xóa phiếu thu',
					user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
					userId: auth.currentUser?.uid || "",
					ownerId: owner.ownerId,
					details: `Đã xóa phiếu thu ${paymentToDelete.amount.toLocaleString('vi-VN')} đ của ${paymentToDelete.customerName}`,
					createdAt: serverTimestamp()
				});
				await batch.commit();
			} else {
				await deleteDoc(doc(db, 'payments', id));
			}
			
			showToast("Đã xóa phiếu thu", "success");
		} catch (error) {
			showToast("Lỗi khi xóa phiếu thu", "error");
			// Optional: revert optimistic update on error by fetching again or re-adding
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
				<button onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/')} className="mt-6 bg-[#1A237E] text-white px-6 py-2 rounded-xl font-bold">Quay lại</button>
			</div>
		);
	}

	if (owner.manualLockDebts) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 items-center justify-center p-8 min-h-screen">
				<div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-6 border border-red-500/20">
					<Lock size={64} />
				</div>
				<h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mb-4 text-[#1A237E] dark:text-indigo-400 text-center">Tính Năng Bị Khóa</h1>
				<p className="text-slate-500 dark:text-slate-400 text-center max-w-md font-medium text-sm md:text-base leading-relaxed mb-8">
					Tài khoản của bạn đã bị khóa tính năng Công Nợ. Vui lòng nâng cấp gói hoặc liên hệ Quản trị viên để mở khóa.
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
				{showMobileSearch && (
					<div className="md:hidden mb-6 animate-in slide-in-from-top duration-300">
						<div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
							<span className="material-symbols-outlined text-slate-400">search</span>
							<input
								ref={searchRef}
								type="text"
								placeholder="Tìm kiếm đối tác..."
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
				<div className="max-w-7xl mx-auto flex flex-col gap-6 md:gap-8">
					{/* KPI Cards Section */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-0 transition-colors duration-300">
						{/* KPI Card 1: Tổng tiền nợ */}
						<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border-l-[6px] border-[#3b82f6] relative overflow-hidden group transition-colors duration-300">
							<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
								<span className="material-symbols-outlined text-7xl text-[#3b82f6]">receipt_long</span>
							</div>
							<div className="relative z-10 flex flex-col">
								<p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Tổng tiền nợ</p>
								<p className="text-[#1A237E] dark:text-indigo-400 text-2xl lg:text-3xl font-black tracking-tighter">{formatPrice(totalWaitedAll)}</p>
							</div>
						</div>

						{/* KPI Card 2: Tổng tiền đã trả */}
						<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border-l-[6px] border-[#10b981] relative overflow-hidden group transition-colors duration-300">
							<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
								<span className="material-symbols-outlined text-7xl text-[#10b981]">payments</span>
							</div>
							<div className="relative z-10 flex flex-col">
								<p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Tổng tiền đã trả</p>
								<p className="text-[#1A237E] dark:text-indigo-400 text-2xl lg:text-3xl font-black tracking-tighter">{formatPrice(totalPaidAll)}</p>
							</div>
						</div>

						{/* KPI Card 3: Tổng dư nợ chưa trả */}
						<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border-l-[6px] border-rose-500 relative overflow-hidden group transition-colors duration-300">
							<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
								<span className="material-symbols-outlined text-7xl text-rose-500">warning</span>
							</div>
							<div className="relative z-10 flex flex-col">
								<p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Tổng dư nợ chưa trả</p>
								<p className="text-rose-600 text-2xl lg:text-3xl font-black tracking-tighter">{formatPrice(totalUnpaidAll)}</p>
								<div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[8px] font-black uppercase px-2 py-1 rounded-full w-fit mt-2 animate-pulse">
									{aggregatedData.filter(i => i.currentDebt > 0).length} KH ĐANG NỢ
								</div>
							</div>
						</div>
					</div>

					{/* View Toggle Tabs */}
					<div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit mb-2">
						<button
							onClick={() => setActiveTab('customers')}
							className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'customers'
								? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-indigo-400 shadow-sm'
								: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
								}`}
						>
							Bảng công nợ
						</button>
						<button
							onClick={() => setActiveTab('history')}
							className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history'
								? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-indigo-400 shadow-sm'
								: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
								}`}
						>
							Lịch sử thu nợ
						</button>
					</div>

					{activeTab === 'customers' ? (
						<>
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

							{/* Table & Cards */}
							<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-blue-900/5 dark:shadow-indigo-900/5 border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
								{/* Desktop Table */}
								<div className="overflow-x-auto hidden md:block">
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
															<div className={`size-12 rounded-2xl bg-[#1A237E]/10 dark:bg-indigo-500/10 flex items-center justify-center text-[#1A237E] dark:text-indigo-400 font-black text-sm shrink-0 shadow-sm border border-slate-200 dark:border-slate-800`}>
																{(row.name || 'KH').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
															</div>
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

								{/* Mobile Cards */}
								<div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
									{loading ? (
										[1, 2, 3].map(i => (
											<div key={i} className="p-5 animate-pulse">
												<div className="flex items-center gap-4 mb-4">
													<div className="size-12 rounded-2xl skeleton" />
													<div className="space-y-2 flex-1">
														<div className="w-32 h-4 skeleton" />
														<div className="w-20 h-3 skeleton opacity-50" />
													</div>
												</div>
												<div className="h-10 skeleton rounded-xl" />
											</div>
										))
									) : paginatedData.length === 0 ? (
										<div className="py-20 text-center text-slate-400 dark:text-slate-500 uppercase font-black text-xs tracking-[4px]">
											Không tìm thấy đối tác nào
										</div>
									) : paginatedData.map((row) => (
										<div key={row.id} className="p-5 active:bg-slate-50 dark:active:bg-slate-800 transition-colors" onClick={() => openStatement(row)}>
											<div className="flex items-center gap-4 mb-4">
												<div className={`size-12 rounded-2xl bg-[#1A237E]/10 dark:bg-indigo-500/10 flex items-center justify-center text-[#1A237E] dark:text-indigo-400 font-black text-sm shrink-0 border border-slate-200 dark:border-slate-800 transition-colors`}>
													{(row.name || 'KH').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
												</div>
												<div className="flex-1 min-w-0">
													<p className="text-sm font-black text-slate-900 dark:text-indigo-400 uppercase tracking-tight leading-tight truncate">{row.name}</p>
													<p className="text-[10px] text-slate-500 dark:text-slate-500 font-bold mt-1 tracking-wider uppercase">{row.phone || '#' + row.id.slice(-6).toUpperCase()}</p>
												</div>
												<div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
													row.debtHealth === 'critical' ? 'bg-rose-100 text-rose-600' :
													row.debtHealth === 'risk' ? 'bg-orange-100 text-orange-600' :
													row.debtHealth === 'slow' ? 'bg-amber-100 text-amber-600' :
													'bg-emerald-100 text-emerald-600'
												}`}>
													{row.debtHealth === 'critical' ? 'Rủi ro cao' :
													 row.debtHealth === 'risk' ? 'Chậm trả' :
													 row.debtHealth === 'slow' ? 'Theo dõi' : 'An toàn'}
												</div>
											</div>

											<div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-50 dark:border-slate-800/50">
												<div className="flex flex-col">
													<span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Tổng mua</span>
													<span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{formatPrice(row.totalOrdersAmount)}</span>
												</div>
												<div className="flex flex-col">
													<span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Đã trả</span>
													<span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">{formatPrice(row.totalPaymentsAmount)}</span>
												</div>
												<div className="flex flex-col text-right">
													<span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Dư nợ</span>
													<span className={`text-[11px] font-black ${row.currentDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
														{formatPrice(row.currentDebt)}
													</span>
												</div>
											</div>

											<div className="flex items-center justify-between mt-4" onClick={(e) => e.stopPropagation()}>
												<div className="flex flex-col">
													<span className="text-[9px] font-bold text-slate-400 uppercase">GD cuối</span>
													<span className="text-[10px] font-black text-slate-600 dark:text-slate-400">{row.lastTx ? formatDate(row.lastTx) : '---'}</span>
												</div>
												<div className="flex items-center gap-2">
													<button
														onClick={() => openStatement(row)}
														className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-[#1A237E] transition-all"
													>
														<FileText size={18} />
													</button>
													<button
														onClick={() => {
															setPaymentData({ ...paymentData, customerId: row.id, customerName: row.name });
															setShowPaymentForm(true);
														}}
														className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 hover:bg-orange-100 transition-all"
													>
														<PlusCircle size={18} />
													</button>
												</div>
											</div>
										</div>
									))}
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
						</>
					) : (
						<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-blue-900/5 dark:shadow-indigo-900/5 border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
							<div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
								<h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Danh sách phiếu thu gần đây</h3>
							</div>
							<div className="overflow-x-auto custom-scrollbar">
								{/* Desktop Table */}
								<table className="w-full text-left hidden md:table min-w-[800px]">
									<thead>
										<tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
											<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-left">Khách hàng</th>
											<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Số tiền</th>
											<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-center">Phương thức</th>
											<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Ngày thu</th>
											<th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Hành động</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
										{paginatedHistory.map((pay) => (
											<tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
												<td className="px-8 py-5">
													<div>
														<p className="text-sm font-black text-slate-900 dark:text-indigo-400 tracking-tight leading-tight uppercase">{pay.customerName}</p>
														<p className="text-[10px] text-slate-500 dark:text-slate-500 font-bold mt-1 tracking-wider uppercase truncate max-w-[200px]">{pay.note || '---'}</p>
													</div>
												</td>
												<td className="px-8 py-5 text-right">
													<span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatPrice(pay.amount)}</span>
												</td>
												<td className="px-8 py-5 text-center">
													<span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${pay.paymentMethod === 'Tiền mặt' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
														{pay.paymentMethod}
													</span>
												</td>
												<td className="px-8 py-5 text-right text-xs font-bold text-slate-500 dark:text-slate-400">
													{formatDate(pay.date || pay.createdAt)}
												</td>
												<td className="px-6 py-5 text-right">
													<div className="flex items-center justify-end gap-2">
														<button
															onClick={() => {
																setSelectedPayment(pay);
																setShowPaymentDetail(true);
															}}
															className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
															title="Chi tiết lệnh thu"
														>
															<FileText size={16} />
														</button>
														<button
															onClick={() => {
																setEditingPaymentId(pay.id);
																setPaymentData({
																	customerId: pay.customerId,
																	customerName: pay.customerName,
																	amount: pay.amount,
																	date: pay.date || (pay.createdAt?.seconds ? new Date(pay.createdAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
																	note: pay.note || '',
																	paymentMethod: pay.paymentMethod || 'Tiền mặt',
																	proofImage: pay.proofImage || ''
																});
																setShowPaymentForm(true);
															}}
															className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
															title="Sửa"
														>
															<Edit2 size={16} />
														</button>
														<button
															onClick={() => handleDeletePayment(pay.id)}
															className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
															title="Xóa"
														>
															<Trash2 size={16} />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>

								{/* Mobile Cards */}
								<div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
									{paginatedHistory.map((pay) => (
										<div key={pay.id} className="p-4 bg-white dark:bg-slate-900">
											<div className="flex justify-between items-start mb-3">
												<div className="flex flex-col gap-1">
													<p className="text-sm font-black text-slate-900 dark:text-indigo-400 uppercase leading-tight">{pay.customerName}</p>
													<div className="flex items-center gap-2">
														<span className="text-[10px] font-bold text-slate-400">{formatDate(pay.date || pay.createdAt)}</span>
														<span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${pay.paymentMethod === 'Tiền mặt' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
															{pay.paymentMethod}
														</span>
													</div>
												</div>
												<div className="text-right">
													<p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatPrice(pay.amount)}</p>
												</div>
											</div>

											{pay.note && (
												<p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg mb-3 italic">
													{pay.note}
												</p>
											)}

											<div className="flex justify-end gap-3 pt-2">
												<button
													onClick={() => {
														setSelectedPayment(pay);
														setShowPaymentDetail(true);
													}}
													className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 text-[10px] font-black uppercase transition-colors"
												>
													<FileText size={12} /> Chi tiết
												</button>
												<button
													onClick={() => {
														setEditingPaymentId(pay.id);
														setPaymentData({
															customerId: pay.customerId,
															customerName: pay.customerName,
															amount: pay.amount,
															date: pay.date || (pay.createdAt?.seconds ? new Date(pay.createdAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
															note: pay.note || '',
															paymentMethod: pay.paymentMethod || 'Tiền mặt',
															proofImage: pay.proofImage || ''
														});
														setShowPaymentForm(true);
													}}
													className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 text-[10px] font-black uppercase transition-colors"
												>
													<Edit2 size={12} /> Sửa
												</button>
												<button
													onClick={() => handleDeletePayment(pay.id)}
													className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-50 dark:border-rose-900/20 text-rose-500 text-[10px] font-black uppercase transition-colors"
												>
													<Trash2 size={12} /> Xóa
												</button>
											</div>
										</div>
									))}
								</div>

								{filteredHistory.length === 0 && (
									<div className="py-20 text-center text-slate-400 dark:text-slate-500 uppercase font-black text-xs tracking-widest">
										Chưa có dữ liệu phiếu thu
									</div>
								)}
							</div>

							{/* History Pagination Controls */}
							{!loading && historyTotalPages > 1 && (
								<div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30 p-4 border-t border-slate-100 dark:border-slate-800">
									<p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">
										Hiển thị {(historyCurrentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(historyCurrentPage * ITEMS_PER_PAGE, filteredHistory.length)} của {filteredHistory.length} phiếu thu
									</p>
									<div className="flex items-center gap-2">
										<button
											onClick={() => { setHistoryCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo(0, 0); }}
											disabled={historyCurrentPage === 1}
											className="size-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all shadow-sm"
										>
											<span className="material-symbols-outlined text-sm">chevron_left</span>
										</button>
										<div className="flex items-center gap-1">
											{getHistoryPageNumbers().map((page, idx) => (
												<button
													key={idx}
													onClick={() => typeof page === 'number' && setHistoryCurrentPage(page)}
													disabled={page === '...'}
													className={`size-10 rounded-xl font-black text-xs transition-all ${page === historyCurrentPage
														? 'bg-[#1A237E] text-white shadow-lg shadow-blue-500/20'
														: page === '...'
															? 'text-slate-400 cursor-default'
															: 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 shadow-sm'
														}`}
												>
													{page}
												</button>
											))}
										</div>
										<button
											onClick={() => { setHistoryCurrentPage(prev => Math.min(prev + 1, historyTotalPages)); window.scrollTo(0, 0); }}
											disabled={historyCurrentPage === historyTotalPages}
											className="size-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all shadow-sm"
										>
											<span className="material-symbols-outlined text-sm">chevron_right</span>
										</button>
									</div>
								</div>
							)}
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
							<div ref={paymentCustomerRef} className="relative">
								<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Tìm khách hàng / Cơ sở</label>
								<div className="relative">
									<History size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
									<input
										type="text"
										placeholder="Nhập tên khách hoặc tên cơ sở..."
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-base font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6D00]/20"
										value={paymentData.customerName || paymentCustomerSearchQuery}
										onFocus={() => {
											setShowPaymentCustomerResults(true);
											if (paymentData.customerName) {
												setPaymentCustomerSearchQuery('');
												setPaymentData(prev => ({ ...prev, customerId: '', customerName: '' }));
											}
										}}
										onChange={(e) => {
											setPaymentCustomerSearchQuery(e.target.value);
											setPaymentData(prev => ({ ...prev, customerId: '', customerName: e.target.value }));
										}}
									/>
									{showPaymentCustomerResults && (
										<div className="absolute z-[200] top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
											{aggregatedData
												.filter(c => (c.totalOrdersAmount > 0 || c.totalPaymentsAmount > 0) && isMatch(c.name || '', paymentCustomerSearchQuery))
												.slice(0, 50)
												.map(c => (
													<div
														key={c.id}
														className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors border-b border-slate-50 dark:border-slate-700 last:border-none"
														onClick={() => {
															setPaymentData({ ...paymentData, customerId: c.id, customerName: c.name });
															setPaymentCustomerSearchQuery(c.name);
															setShowPaymentCustomerResults(false);
														}}
													>
														<div className="flex flex-col">
															<span className="text-sm font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">
																{c.name}
															</span>
															<div className="flex items-center gap-3 mt-1">
																<span className="text-[10px] text-slate-400 font-bold uppercase">{c.phone || '#' + c.id.slice(-6).toUpperCase()}</span>
																{c.currentDebt > 0 && (
																	<span className="text-[10px] text-rose-500 font-black uppercase">Nợ: {formatPrice(c.currentDebt)}</span>
																)}
															</div>
														</div>
													</div>
												))}
											{aggregatedData.filter(c => isMatch(c.name || '', paymentCustomerSearchQuery)).length === 0 && (
												<div className="px-5 py-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
													Không tìm thấy khách hàng
												</div>
											)}
										</div>
									)}
								</div>
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
								disabled={uploadingPaymentImage || isSubmitting}
								className="w-full h-16 bg-[#FF6D00] text-white rounded-2xl font-black uppercase tracking-[3px] shadow-xl shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
							>
								{isSubmitting ? 'ĐANG XỬ LÝ...' : (editingPaymentId ? 'CẬP NHẬT PHIẾU THU' : 'XÁC NHẬN PHIẾU THU')}
							</button>


						</form>
					</div>
				</div>
			)}

			{/* DEBT STATEMENT MODAL */}
			{showStatement && selectedCustomer && (
				((owner.isPro || !owner.systemConfig.lock_free_debts) && !owner.manualLockDebts) ? (
					<div id="debt-statement-modal" className="fixed inset-0 z-[160] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-0 md:p-4">
						<div className="bg-transparent w-full max-w-5xl max-h-screen md:max-h-[95vh] relative flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
							{/* Floating close button */}
							<button onClick={() => setShowStatement(false)} className="absolute top-3 right-3 z-30 size-10 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-800 shadow-sm flex items-center justify-center transition-all print:hidden">
								<X size={18} />
							</button>

							{/* DATE FILTER BAR FOR STATEMENT - REMOVED AS PER USER REQUEST */}

							{/* SCROLLABLE DOCUMENT AREA */}
							<div id="debt-statement-container" className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar">
								<div className="w-full max-w-full px-3 sm:px-4 py-3 sm:py-4 sm:w-fit sm:mx-auto" style={{ zoom: statementZoom, transformOrigin: 'top center' }}>

										{/* 2. Customer Info */}
										{(() => {
											const startVal = statementFromDate || '0000-00-00';
											const endVal = statementToDate || '9999-99-99';

											// Normalized date extraction for grouping
											const getNormDate = (tx: any) => {
												if (tx.orderDate && typeof tx.orderDate === 'string') return tx.orderDate; // "2026-02-10"
												if (tx.date && typeof tx.date === 'string') return tx.date; // "2026-02-10"

												let d;
												if (tx.orderDate?.seconds) {
													d = new Date(tx.orderDate.seconds * 1000);
												} else if (tx.date?.seconds) {
													d = new Date(tx.date.seconds * 1000);
												} else if (tx.createdAt?.seconds) {
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
													{/* 1. Paper Header */}
													<header className="mb-8 text-center">
														<h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-[3px] mb-3">Chi tiết Công Nợ</h1>
														<div className="flex justify-center items-center gap-2 sm:gap-6 text-[10px] sm:text-xs flex-wrap px-1">
															<div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg">
																<span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Mã</span>
																<span className="font-mono font-bold text-[#1A237E] text-sm">#{selectedCustomer.id?.slice(-6).toUpperCase()}</span>
															</div>
															<div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg">
																<span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Ngày lập</span>
																<span className="font-bold text-slate-700">{new Date().toLocaleDateString('vi-VN')}</span>
															</div>
															<div>
																<span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${closingBalance > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
																	{closingBalance > 0 ? 'Còn nợ' : 'Đã tất toán'}
																</span>
															</div>
														</div>
													</header>

													<section className="mb-6 sm:mb-8">
								<div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
									{/* Top: Name + Badge */}
									<div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
										<div>
											<span className="font-black text-slate-900 text-base sm:text-lg uppercase tracking-tight">
												{selectedCustomer.name}
											</span>
											<p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
												Mã đối tác: #{selectedCustomer.id?.slice(-6).toUpperCase()}
											</p>
										</div>
										<span className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${											closingBalance > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'										}`}>
											{closingBalance > 0 ? 'Còn nợ' : 'Đã tất toán'}
										</span>
									</div>
									{/* Bottom: Details in gray box */}
									<div className="bg-slate-50 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap gap-x-6 sm:gap-x-8 gap-y-2 border-t border-slate-100">
										<div className="flex items-center gap-2 text-xs text-slate-600">
											<span className="material-symbols-outlined text-base text-slate-400">calendar_today</span>
											<span className="font-medium">{new Date().toLocaleDateString('vi-VN')}</span>
										</div>
										{selectedCustomer.phone && (
											<div className="flex items-center gap-2 text-xs text-slate-600">
												<span className="material-symbols-outlined text-base text-slate-400">call</span>
												<span className="font-bold text-slate-800">{selectedCustomer.phone}</span>
											</div>
										)}
										{selectedCustomer.address && (
											<div className="flex items-center gap-2 text-xs text-slate-600">
												<span className="material-symbols-outlined text-base text-slate-400">location_on</span>
												<span className="break-words leading-relaxed">{selectedCustomer.address}</span>
											</div>
										)}
									</div>
								</div>
							</section>


{/* 3. Summary Card — Stitch style: big centered number + breakdown below */}
													<div className="rounded-2xl bg-white border border-slate-200 shadow-sm mb-6 sm:mb-8 overflow-hidden">
														<div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 text-center">
															<p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-2">Tổng công nợ hiện tại</p>
															<div className="flex items-center justify-center gap-3">
																<span className="material-symbols-outlined text-3xl sm:text-4xl text-[#FF6D00]">account_balance_wallet</span>
																<p className="font-black text-[#FF6D00] text-2xl sm:text-4xl tracking-tight tabular-nums break-all">{formatPrice(closingBalance)}</p>
															</div>
														</div>
														<div className="bg-slate-50 px-4 sm:px-6 py-3 flex justify-center gap-8 sm:gap-12 text-xs border-t border-slate-100">
															<div>
																<span className="text-slate-400 uppercase tracking-wider text-[9px] font-black">Phát sinh</span>
																<p className="font-bold text-slate-700 tabular-nums">{formatPrice(debitIncrease)}</p>
															</div>
															<div className="w-px bg-slate-200"></div>
															<div>
																<span className="text-slate-400 uppercase tracking-wider text-[9px] font-black">Đã trả</span>
																<p className="font-bold text-emerald-600 tabular-nums">-{formatPrice(creditDecrease)}</p>
															</div>
														</div>
													</div>

													{/* 4. List of Orders (Includes Opening Balance) */}
													<div className="mb-10">
														<div className="bg-[#1A237E] rounded-t-2xl px-4 sm:px-6 py-3 sm:py-3.5 flex items-center gap-2 sm:gap-3">
															<span className="material-symbols-outlined text-white text-base sm:text-lg">receipt_long</span>
															<h3 className="text-white font-black text-xs sm:text-sm uppercase tracking-[2px]">Danh sách đơn hàng</h3>
														</div>
														<div className="border-x border-b border-slate-200 rounded-b-2xl overflow-x-auto custom-scrollbar -mx-3 sm:mx-0">
															<div className="min-w-[360px] sm:min-w-[600px]">
															<table className="w-full text-xs sm:text-sm border-collapse">
																<thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[9px] sm:text-[10px]">
																	<tr>
																		<th className="py-3 sm:py-4 px-3 sm:px-6 text-left w-1/4 border-r border-white/10">Ngày</th>
																		<th className="py-3 sm:py-4 px-3 sm:px-6 text-left w-1/4 border-r border-white/10">Mã đơn</th>
																		<th className="py-3 sm:py-4 px-3 sm:px-6 text-right w-1/2">Giá trị giao dịch</th>
																	</tr>
																</thead>
																<tbody className="text-slate-900 divide-y-2 divide-slate-200">
																	{/* Opening Balance Row */}
																	<tr className="bg-amber-50/50 font-black text-slate-900">
																		<td className="py-3 sm:py-4 px-3 sm:px-6 border-r border-slate-100 italic text-slate-400">---</td>
																		<td className="py-3 sm:py-4 px-3 sm:px-6 uppercase text-[#d97706] tracking-widest text-[9px] sm:text-[10px] border-r border-slate-100">DƯ NỢ ĐẦU KỲ</td>
																		<td className="py-3 sm:py-4 px-3 sm:px-6 text-right text-base sm:text-lg">{formatPrice(openingBalance)}</td>
																	</tr>
																	{/* Order Rows */}
																	{cycleTx.filter(t => t.txType === 'order').map((order, idx) => (
																		<tr key={`ord-${idx}`} className="hover:bg-slate-50 font-black">
																			<td className="py-3 sm:py-4 px-3 sm:px-6 border-r border-slate-200 text-xs sm:text-sm">{formatDate(order.orderDate || order.createdAt)}</td>
																			<td className="py-3 sm:py-4 px-3 sm:px-6 font-bold text-[#1A237E] border-r border-slate-200 tracking-tight text-xs sm:text-sm">#{order.id?.slice(0, 8).toUpperCase()}</td>
																			<td className="py-3 sm:py-4 px-3 sm:px-6 text-right text-sm sm:text-base">{formatPrice(order.totalAmount)}</td>
																		</tr>
																	))}
																	{cycleTx.filter(t => t.txType === 'order').length === 0 && (
																		<tr>
																			<td colSpan={3} className="py-3 text-center text-slate-400 italic text-xs">Không có đơn hàng mới trong kỳ</td>
																		</tr>
																	)}
																	{/* Total Row */}
																	<tr className="bg-[#1A237E] font-black">
																			<td colSpan={2} className="py-3 sm:py-4 px-3 sm:px-6 uppercase text-white text-[10px] sm:text-xs tracking-[2px] border-r border-white/10">Tổng cộng</td>
																			<td className="py-3 sm:py-4 px-3 sm:px-6 text-right text-lg sm:text-xl text-white leading-none">{formatPrice(openingBalance + debitIncrease)}</td>
																	</tr>
																</tbody>
															</table>
														</div>
														</div>
													</div>

													{/* 5. Payment History */}
													<div className="mb-12">
														<div className="bg-slate-700 rounded-t-2xl px-4 sm:px-6 py-3 sm:py-3.5 flex items-center gap-2 sm:gap-3">
															<span className="material-symbols-outlined text-emerald-400 text-base sm:text-lg">schedule</span>
															<h3 className="text-white font-black text-xs sm:text-sm uppercase tracking-[2px]">Lịch sử thanh toán</h3>
														</div>
														<div className="border-x border-b border-slate-200 rounded-b-2xl overflow-x-auto custom-scrollbar -mx-3 sm:mx-0">
															<div className="min-w-[360px] sm:min-w-[600px]">
															<table className="w-full text-xs sm:text-sm border-collapse">
																<thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[9px] sm:text-[10px]">
																	<tr>
																		<th className="py-3 sm:py-4 px-3 sm:px-6 text-left w-1/4 border-r border-white/10">Ngày</th>
																		<th className="py-3 sm:py-4 px-3 sm:px-6 text-left w-1/2 border-r border-white/10">Nội dung</th>
																		<th className="py-3 sm:py-4 px-3 sm:px-6 text-right w-1/4">Số tiền thu</th>
																	</tr>
																</thead>
																<tbody className="text-slate-900 divide-y-2 divide-slate-200">
																	{/* Payment Rows */}
																	{cycleTx.filter(t => t.txType === 'payment').map((pay, idx) => (
																		<tr key={`pay-${idx}`} className="hover:bg-slate-50 font-black">
																			<td className="py-3 sm:py-4 px-3 sm:px-6 border-r border-slate-200 text-xs sm:text-sm">{formatDate(pay.date || pay.createdAt)}</td>
																			<td className="py-3 sm:py-4 px-2 sm:px-6 border-r border-slate-200 uppercase tracking-tighter text-[10px] sm:text-xs">{pay.note || 'Thanh toán công nợ'}</td>
																			<td className="py-3 sm:py-4 px-2 sm:px-6 text-right text-base sm:text-lg text-emerald-700">{formatPrice(pay.amount)}</td>
																		</tr>
																	))}
																	{cycleTx.filter(t => t.txType === 'payment').length === 0 && (
																		<tr>
																			<td colSpan={3} className="py-3 text-center text-slate-400 italic text-xs">Chưa có thanh toán nào trong kỳ</td>
																		</tr>
																	)}
																	{/* Total Payment Row */}
																	<tr className="bg-emerald-50 font-black">
																			<td colSpan={2} className="py-3 sm:py-4 px-3 sm:px-6 uppercase text-emerald-800 text-[10px] sm:text-xs tracking-[2px] border-r border-emerald-100">Tổng đã thanh toán</td>
																			<td className="py-3 sm:py-4 px-3 sm:px-6 text-right text-lg sm:text-xl text-emerald-700 leading-none">{formatPrice(creditDecrease)}</td>
																	</tr>
																</tbody>
															</table>
														</div>
														</div>
													</div>

													{/* 5. Signatures */}
													<div className="flex flex-col sm:flex-row justify-between px-4 sm:px-10 mb-8 items-center sm:items-end gap-8">
														<div className="text-center">
															<div className="w-40 mx-auto mb-16 border-t-2 border-dashed border-slate-300 pt-1"></div>
															<p className="font-black text-slate-600 text-xs uppercase tracking-widest">Đại diện khách hàng</p>
															<p className="text-slate-400 text-[10px] italic mt-1">(Ký và ghi rõ họ tên)</p>
														</div>
														<div className="text-center">
															<div className="flex items-center justify-center gap-1.5 mb-16"><span className="text-emerald-500 text-lg">✓</span><p className="font-black text-slate-900 uppercase text-base tracking-wider">{auth.currentUser?.displayName || 'Admin'}</p></div>
															<p className="font-black text-slate-600 text-xs uppercase tracking-widest">Người lập phiếu</p>
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
							{/* Bottom Floating Toolbar */}
							<div className="flex-none bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 sm:px-4 py-2.5 sm:py-3 border-t border-slate-200/50 flex items-center justify-center gap-2 sm:gap-3 z-20 print:hidden">
								<div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-1.5 sm:px-2 py-1 sm:py-1.5">
									<button onClick={() => setStatementZoom(prev => Math.max(0.5, prev - 0.05))} className="size-7 sm:size-8 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 transition-all flex items-center justify-center" title="Thu nhỏ">
										<span className="material-symbols-outlined text-base sm:text-lg">zoom_out</span>
									</button>
									<span className="text-[10px] sm:text-[11px] font-black w-10 sm:w-12 text-center text-slate-600 tabular-nums">{Math.round(statementZoom * 100)}%</span>
									<button onClick={() => setStatementZoom(prev => Math.min(2, prev + 0.05))} className="size-7 sm:size-8 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 transition-all flex items-center justify-center" title="Phóng to">
										<span className="material-symbols-outlined text-base sm:text-lg">zoom_in</span>
									</button>
									<div className="w-px h-3 sm:h-4 bg-slate-300 dark:bg-slate-700 mx-0.5"></div>
									<button onClick={() => setStatementZoom(1)} className="px-1.5 sm:px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 text-[9px] sm:text-[10px] font-black uppercase transition-all">100%</button>
								</div>
								<button onClick={handlePrintStatement} className="flex-1 sm:flex-none h-10 sm:h-10 px-4 sm:px-5 rounded-xl bg-[#FF6D00] text-white flex items-center gap-1.5 sm:gap-2 font-bold text-[10px] sm:text-xs uppercase hover:bg-orange-600 transition-all shadow-sm active:scale-95">
									<Printer size={14} /> In phiếu
								</button>
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
			{/* PAYMENT DETAIL MODAL */}
			{showPaymentDetail && selectedPayment && (
				<div className="fixed inset-0 z-[170] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
					<div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
						<div className="px-8 py-6 bg-[#1A237E] text-white flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="size-10 bg-white/10 rounded-xl flex items-center justify-center">
									<FileText size={20} />
								</div>
								<h3 className="text-lg font-black uppercase tracking-tight">Chi tiết lệnh thu</h3>
							</div>
							<button onClick={() => { setShowPaymentDetail(false); setSelectedPayment(null); }} className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
								<X size={20} />
							</button>
						</div>
						<div className="p-8 space-y-6">
							<div className="space-y-4">
								<div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
									<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Khách hàng</span>
									<span className="text-base font-black text-slate-900 dark:text-indigo-400 uppercase">{selectedPayment.customerName}</span>
								</div>
								<div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
									<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày thu</span>
									<span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatDate(selectedPayment.date || selectedPayment.createdAt)}</span>
								</div>
								<div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
									<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số tiền</span>
									<span className="text-xl font-black text-emerald-600 tracking-tight">{formatPrice(selectedPayment.amount)}</span>
								</div>
								<div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
									<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hình thức</span>
									<span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-black text-[#1A237E] dark:text-indigo-400 uppercase">{selectedPayment.paymentMethod}</span>
								</div>
							</div>

							{selectedPayment.note && (
								<div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 italic text-slate-600 dark:text-slate-400 text-sm">
									"{selectedPayment.note}"
								</div>
							)}

							{selectedPayment.proofImage && (
								<div className="space-y-3">
									<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Bằng chứng thanh toán</span>
									<div className="rounded-3xl overflow-hidden border-4 border-slate-50 dark:border-slate-800 shadow-xl group relative">
										<img src={getImageUrl(selectedPayment.proofImage)} alt="Proof" className="w-full aspect-[4/3] object-cover transition-transform duration-500 group-hover:scale-110" />
										<a
											href={getImageUrl(selectedPayment.proofImage)}
											target="_blank"
											rel="noopener noreferrer"
											className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-xs uppercase tracking-[2px]"
										>
											<Image size={24} className="mr-2" /> Xem ảnh gốc
										</a>
									</div>
								</div>
							)}

							<button
								onClick={() => { setShowPaymentDetail(false); setSelectedPayment(null); }}
								className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
							>
								Đóng chi tiết
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default Debts;{/* 5. Signatures */}
