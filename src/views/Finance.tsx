import React, { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, writeBatch, limit, orderBy, deleteDoc, setDoc } from 'firebase/firestore';
import { Wallet, TrendingUp, TrendingDown, Receipt, Clock, BarChart3, Plus, ArrowUpRight, ArrowDownLeft, Filter, Search, Calendar, ChevronRight, Trash2, Settings2, Target, Award } from 'lucide-react';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';

import { useSearchParams } from 'react-router-dom';

const Finance = () => {
	const owner = useOwner();
	const { showToast } = useToast();
	const isAdmin = owner.role === 'admin' || owner.accessRights?.finance_view === true;
	const currentUserId = auth.currentUser?.uid;
	const [searchParams, setSearchParams] = useSearchParams();
	const tabParam = searchParams.get('tab') as 'cashbook' | 'aging' | 'profit' | 'performance' | null;
	const [activeTab, setActiveTab] = useState<'cashbook' | 'aging' | 'profit' | 'performance'>(tabParam || 'cashbook');
	const [cashLogs, setCashLogs] = useState<any[]>([]);
	const [orders, setOrders] = useState<any[]>([]);
	const [payments, setPayments] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [staffs, setStaffs] = useState<any[]>([]);
	const [checkins, setCheckins] = useState<any[]>([]);
	const [products, setProducts] = useState<any[]>([]);
	const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
	const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
	const [kpiPlans, setKpiPlans] = useState<any[]>([]);
	const [commissionRate, setCommissionRate] = useState(5); // Default 5%
	const [loading, setLoading] = useState(true);
	const [currentPage, setCurrentPage] = useState(1);
	const ITEMS_PER_PAGE = 10;

	// KPI Plan Management
	const [showPlanForm, setShowPlanForm] = useState(false);
	const [selectedStaffForPlan, setSelectedStaffForPlan] = useState<any>(null);
	const [planData, setPlanData] = useState({
		baseSalary: 10000000,
		checkinTarget: 20,
		attendanceTarget: 22,
		newCustomerTarget: 5,
		productTargets: [] as { sku: string, name: string, targetQty: number }[],
		productCommissions: {} as Record<string, number> // { sku: %rate }
	});

	// Filters
	const [fromDate, setFromDate] = useState(() => {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
	});
	const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

	// Cashbook Form
	const [showLogForm, setShowLogForm] = useState(searchParams.get('new') === 'true');
	const [logData, setLogData] = useState({
		type: 'chi' as 'thu' | 'chi',
		amount: 0,
		category: 'Vận hành',
		note: '',
		date: new Date().toISOString().split('T')[0]
	});

	// Sync tab with URL
	useEffect(() => {
		if (tabParam && tabParam !== activeTab) {
			setActiveTab(tabParam);
		}
	}, [tabParam]);

	// Redirect non-admins to performance tab
	useEffect(() => {
		if (!owner.loading && !isAdmin && activeTab !== 'performance') {
			setActiveTab('performance');
		}
	}, [owner.loading, isAdmin, activeTab]);

	// Sync modal with URL
	useEffect(() => {
		const isNew = searchParams.get('new') === 'true';
		if (isNew !== showLogForm) {
			setShowLogForm(isNew);
		}
	}, [searchParams]);
	useEffect(() => {
		setCurrentPage(1);
	}, [activeTab, fromDate, toDate]);

	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		console.log("Finance View: Fetching data for ownerId:", owner.ownerId);

		const qLogs = query(collection(db, 'cash_book'), where('ownerId', '==', owner.ownerId), limit(500));
		const unsubLogs = onSnapshot(qLogs, (snap) => {
			console.log("Finance: Received cash_book snapshot, count:", snap.size);
			const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			const sortedLogs = logs.sort((a: any, b: any) => {
				const dateA = a.date || '';
				const dateB = b.date || '';
				return dateB.localeCompare(dateA);
			});
			setCashLogs(sortedLogs);
		}, (err) => {
			console.error("Finance: Firestore CashBook Error:", err);
		});

		const qOrders = query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId));
		const unsubOrders = onSnapshot(qOrders, (snap) => {
			console.log("Finance: Received orders snapshot, count:", snap.size);
			setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		}, (err) => {
			console.error("Finance: Firestore Orders Error:", err);
		});

		const qPayments = query(collection(db, 'payments'), where('ownerId', '==', owner.ownerId));
		const unsubPayments = onSnapshot(qPayments, (snap) => {
			console.log("Finance: Received payments snapshot, count:", snap.size);
			setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		}, (err) => {
			console.error("Finance: Firestore Payments Error:", err);
		});

		const qCustomers = query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId));
		const unsubCustomers = onSnapshot(qCustomers, (snap) => {
			console.log("Finance: Received customers snapshot, count:", snap.size);
			setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
			setLoading(false);
		}, (err) => {
			console.error("Finance: Firestore Customers Error:", err);
			setLoading(false);
		});

		const qStaffs = query(collection(db, 'users'), where('ownerId', '==', owner.ownerId));
		const unsubStaffs = onSnapshot(qStaffs, (snap) => {
			console.log("Finance: Received staffs snapshot, count:", snap.size);
			setStaffs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		const qCheckins = query(collection(db, 'checkins'), where('ownerId', '==', owner.ownerId));
		const unsubCheckins = onSnapshot(qCheckins, (snap) => {
			setCheckins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		const qAttendance = query(collection(db, 'attendance_logs'), where('ownerId', '==', owner.ownerId));
		const unsubAttendance = onSnapshot(qAttendance, (snap) => {
			setAttendanceLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		const qProducts = query(collection(db, 'products'), where('ownerId', '==', owner.ownerId));
		const unsubProducts = onSnapshot(qProducts, (snap) => {
			setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		const qInvLogs = query(collection(db, 'inventory_logs'), where('ownerId', '==', owner.ownerId));
		const unsubInvLogs = onSnapshot(qInvLogs, (snap) => {
			setInventoryLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		const qPlans = query(collection(db, 'kpi_plans'), where('ownerId', '==', owner.ownerId));
		const unsubPlans = onSnapshot(qPlans, (snap) => {
			setKpiPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		return () => {
			unsubLogs();
			unsubOrders();
			unsubPayments();
			unsubCustomers();
			unsubStaffs();
			unsubCheckins();
			unsubAttendance();
			unsubProducts();
			unsubInvLogs();
			unsubPlans();
		};
	}, [owner.loading, owner.ownerId]);

	const handleAddLog = async (e: React.FormEvent) => {
		e.preventDefault();
		if (logData.amount <= 0) return;

		try {
			await addDoc(collection(db, 'cash_book'), {
				...logData,
				ownerId: owner.ownerId,
				createdBy: auth.currentUser?.uid,
				createdAt: serverTimestamp()
			});
			console.log("Cash log added successfully:", logData);
			setShowLogForm(false);
			setLogData({ type: 'chi', amount: 0, category: 'Vận hành', note: '', date: new Date().toISOString().split('T')[0] });
			showToast("Ghi sổ quỹ thành công", "success");
		} catch (error) {
			console.error("Error adding cash log:", error);
			showToast("Lỗi khi ghi sổ quỹ", "error");
		}
	};

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
	};

	const getPageNumbers = (totalPages: number) => {
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



	const openKPIDialog = (staff: any) => {
		setSelectedStaffForPlan(staff);
		const existingPlan = kpiPlans.find(p => p.userId === staff.id && p.month === fromDate.slice(0, 7));
		if (existingPlan) {
			setPlanData({
				baseSalary: existingPlan.baseSalary || 10000000,
				checkinTarget: existingPlan.checkinTarget || 20,
				attendanceTarget: existingPlan.attendanceTarget || 22,
				newCustomerTarget: existingPlan.newCustomerTarget || 5,
				productTargets: existingPlan.productTargets || [],
				productCommissions: existingPlan.productCommissions || {}
			});
		} else {
			setPlanData({
				baseSalary: 10000000,
				checkinTarget: 20,
				attendanceTarget: 22,
				newCustomerTarget: 5,
				productTargets: [],
				productCommissions: {}
			});
		}
		setShowPlanForm(true);
	};

	const handleSaveKPIPlan = async () => {
		if (!selectedStaffForPlan) return;
		try {
			const planId = `${selectedStaffForPlan.id}_${fromDate.slice(0, 7)}`;
			await setDoc(doc(db, 'kpi_plans', planId), {
				...planData,
				userId: selectedStaffForPlan.id,
				userEmail: selectedStaffForPlan.email,
				month: fromDate.slice(0, 7),
				ownerId: owner.ownerId,
				updatedAt: serverTimestamp()
			});
			showToast("Đã lưu kế hoạch KPI", "success");
			setShowPlanForm(false);
		} catch (error) {
			console.error("Error saving KPI plan:", error);
			showToast("Lỗi khi lưu kế hoạch", "error");
		}
	};

	if (owner.loading) return null;

	// No longer returning restricted access here, will handle tab-level permissions
	// --- CALCULATIONS ---

	const handleDeleteLog = async (id: string, log: any) => {
		if (!window.confirm(`Bạn có chắc muốn xóa ghi chép: "${log.note}" ? `)) return;

		try {
			await deleteDoc(doc(db, 'cash_book', id));
			// Log action
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Xóa ghi chép thu chi',
				user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã xóa: ${log.type === 'thu' ? '+' : '-'}${formatPrice(log.amount)} - Nội dung: ${log.note} `,
				createdAt: serverTimestamp()
			});
			showToast("Đã xóa ghi chép", "success");
		} catch (error) {
			console.error("Finance: Delete Log Error:", error);
			showToast("Lỗi khi xóa ghi chép", "error");
		}
	};

	const filterByDate = (date: any) => {
		if (!date) return false;
		const d = date.seconds ? new Date(date.seconds * 1000).toISOString().split('T')[0] : date;
		return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
	};

	const filteredLogs = cashLogs.filter(l => filterByDate(l.date));
	const filteredOrders = orders.filter(o => filterByDate(o.orderDate || o.createdAt));
	const filteredPayments = payments.filter(p => filterByDate(p.date || p.createdAt));

	const paginatedLogs = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
	const totalLogsPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);

	// 1. Funds calculation
	const totalIncome = filteredLogs.filter(l => l.type === 'thu').reduce((sum, l) => sum + (l.amount || 0), 0) +
		filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
	const totalExpense = filteredLogs.filter(l => l.type === 'chi').reduce((sum, l) => sum + (l.amount || 0), 0);
	const currentBalance = totalIncome - totalExpense;

	// 2. Debt Aging
	const getAgingData = () => {
		const now = toDate ? new Date(toDate) : new Date();
		const agingGroups = {
			under30: [] as any[],
			between30_60: [] as any[],
			between60_90: [] as any[],
			over90: [] as any[]
		};

		customers.forEach(cust => {
			const custOrders = orders.filter(o => o.customerId === cust.id && o.status === 'Đơn chốt');
			const custPayments = payments.filter(p => p.customerId === cust.id);

			const totalBought = custOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
			const totalPaid = custPayments.reduce((s, p) => s + (p.amount || 0), 0);
			let debt = totalBought - totalPaid;

			if (debt > 0) {
				const sortedOrders = [...custOrders].sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
				let runningTotal = 0;
				let oldestUnpaidOrder = null;

				for (const o of sortedOrders) {
					runningTotal += (o.totalAmount || 0);
					if (runningTotal > totalPaid) {
						oldestUnpaidOrder = o;
						break;
					}
				}

				if (oldestUnpaidOrder) {
					const orderDate = new Date(oldestUnpaidOrder.orderDate);
					const diffDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24));

					if (diffDays >= 0) {
						const entry = { ...cust, debt, days: diffDays };
						if (diffDays < 30) agingGroups.under30.push(entry);
						else if (diffDays < 60) agingGroups.between30_60.push(entry);
						else if (diffDays < 90) agingGroups.between60_90.push(entry);
						else agingGroups.over90.push(entry);
					}
				}
			}
		});

		return agingGroups;
	};

	const agingData = getAgingData();

	// 3. Profit breakdown
	const orderProfits = filteredOrders.filter(o => o.status === 'Đơn chốt').map(o => {
		const revenue = o.totalAmount || 0;
		const cost = (o.items || []).reduce((sum: number, item: any) => sum + ((Number(item.buyPrice) || 0) * (Number(item.qty) || 0)), 0);
		const profit = revenue - cost - (o.discountValue || 0);
		return { ...o, revenue, cost, profit };
	}).sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

	const paginatedProfits = orderProfits.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
	const totalProfitsPages = Math.ceil(orderProfits.length / ITEMS_PER_PAGE);

	return (
		<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 transition-colors duration-300">
			{/* HEADER */}
			<header className="md:h-20 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-30">
				<div className="h-16 md:h-20 flex items-center justify-between px-4 md:px-8 border-b border-slate-50 dark:border-slate-800/50">
					<div className="flex items-center gap-3">
						<div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/20">
							<Wallet size={20} />
						</div>
						<h2 className="text-lg md:text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">Quản Lý Tài Chính</h2>
					</div>

					<div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 overflow-x-auto no-scrollbar touch-pan-x shrink-0 max-w-[calc(100vw-180px)] md:max-w-none">
						{isAdmin && (
							<>
								<button
									onClick={() => setActiveTab('cashbook')}
									className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'cashbook' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
									Sổ Quỹ
								</button>
								<button
									onClick={() => setActiveTab('aging')}
									className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'aging' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
									Tuổi Nợ
								</button>
								<button
									onClick={() => setActiveTab('profit')}
									className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'profit' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
									Lợi Nhuận
								</button>
							</>
						)}
						<button
							onClick={() => setActiveTab('performance')}
							className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'performance' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
							{isAdmin ? 'KPI Đội Ngũ' : 'KPI Cá Nhân'}
						</button>
					</div>
				</div>

				{/* Filter Bar */}
				<div className="px-4 md:px-8 py-3 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md flex flex-wrap items-center gap-4">
					<div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
						<Calendar size={16} className="text-indigo-500" />
						<div className="flex items-center gap-2">
							<input
								type="date"
								className="bg-transparent border-none p-0 text-xs font-black uppercase text-slate-700 dark:text-slate-200 focus:ring-0"
								value={fromDate}
								onChange={(e) => setFromDate(e.target.value)}
							/>
							<span className="text-slate-300 font-bold">→</span>
							<input
								type="date"
								className="bg-transparent border-none p-0 text-xs font-black uppercase text-slate-700 dark:text-slate-200 focus:ring-0"
								value={toDate}
								onChange={(e) => setToDate(e.target.value)}
							/>
						</div>
					</div>
					<div className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] hidden lg:block opacity-60">
						Lọc dữ liệu theo thời gian
					</div>
				</div>
			</header>

			<main className="p-4 md:p-8 max-w-[1400px] mx-auto">

				{activeTab === 'cashbook' && (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
						{/* Overview Cards */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
								<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tổng thu trong kỳ</p>
								<div className="flex items-center justify-between">
									<h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{formatPrice(totalIncome)}</h3>
									<div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg text-emerald-600"><ArrowUpRight size={20} /></div>
								</div>
							</div>
							<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
								<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tổng chi trong kỳ</p>
								<div className="flex items-center justify-between">
									<h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tighter">{formatPrice(totalExpense)}</h3>
									<div className="bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg text-rose-600"><ArrowDownLeft size={20} /></div>
								</div>
							</div>
							<div className="bg-indigo-600 dark:bg-indigo-900 p-6 rounded-[2rem] shadow-xl shadow-indigo-500/20 text-white relative overflow-hidden">
								<div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
								<p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2">Biến động ròng</p>
								<div className="flex items-center justify-between">
									<h3 className="text-2xl font-black tracking-tighter">{formatPrice(currentBalance)}</h3>
									<Wallet size={24} className="text-white/40" />
								</div>
							</div>
						</div>

						{/* Log List */}
						<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden text-sm">
							<div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
								<h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Nhật ký thu chi nội bộ</h3>
								<button
									onClick={() => setShowLogForm(true)}
									className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95"
								>
									<Plus size={18} /> Ghi chú Thu/Chi
								</button>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left">
									<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
										<tr>
											<th className="px-6 py-4">Ngày</th>
											<th className="px-6 py-4">Phân loại</th>
											<th className="px-6 py-4">Nội dung</th>
											<th className="px-6 py-4 text-right">Số tiền</th>
											<th className="px-6 py-4 text-right">Hành động</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
										{paginatedLogs.length === 0 ? (
											<tr>
												<td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">
													Chưa có ghi chép thu chi nào cho kỳ này.
												</td>
											</tr>
										) : (
											paginatedLogs.map(log => (
												<tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
													<td className="px-6 py-4 font-bold text-slate-500">{log.date}</td>
													<td className="px-6 py-4">
														<span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${log.category === 'Vận hành' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'bg-orange-50 text-orange-600 dark:bg-orange-900/20'}`}>
															{log.category}
														</span>
													</td>
													<td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{log.note}</td>
													<td className={`px-6 py-4 text-right font-black ${log.type === 'thu' ? 'text-emerald-600' : 'text-rose-600'}`}>
														{log.type === 'thu' ? '+' : '-'}{formatPrice(log.amount)}
													</td>
													<td className="px-6 py-4 text-right">
														<button
															onClick={() => handleDeleteLog(log.id, log)}
															className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
															title="Xóa"
														>
															<Trash2 size={16} />
														</button>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>

						{/* Pagination UI - Cash Logs */}
						{totalLogsPages > 1 && (
							<div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
								<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
									Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} của {filteredLogs.length} ghi chép
								</p>
								<div className="flex items-center gap-2">
									<button
										disabled={currentPage === 1}
										onClick={() => { setCurrentPage(prev => prev - 1); window.scrollTo(0, 0); }}
										className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
									>
										<ChevronRight className="rotate-180" size={18} />
									</button>
									<div className="flex items-center gap-1">
										{getPageNumbers(totalLogsPages).map((page, idx) => (
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
										disabled={currentPage === totalLogsPages}
										onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo(0, 0); }}
										className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
									>
										<ChevronRight size={18} />
									</button>
								</div>
							</div>
						)}
					</div>
				)}

				{activeTab === 'aging' && (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
							{[
								{ label: '< 30 Ngày', data: agingData.under30, color: 'emerald' },
								{ label: '30 - 60 Ngày', data: agingData.between30_60, color: 'blue' },
								{ label: '60 - 90 Ngày', data: agingData.between60_90, color: 'orange' },
								{ label: '> 90 Ngày', data: agingData.over90, color: 'rose' }
							].map((group, i) => (
								<div key={i} className={`bg-white dark:bg-slate-900 p-6 rounded-[2rem] border-l-4 border-${group.color}-500 shadow-sm`}>
									<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{group.label}</p>
									<h4 className="text-2xl font-black text-slate-800 dark:text-white">{group.data.length} <span className="text-xs text-slate-400">Khách hàng</span></h4>
									<p className={`text-xs font-bold text-${group.color}-600 mt-2`}>
										Nợ: {formatPrice(group.data.reduce((s, c) => s + c.debt, 0))}
									</p>
								</div>
							))}
						</div>

						<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
							<div className="p-6 border-b border-slate-50 dark:border-slate-800">
								<h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Chi tiết nợ quá hạn</h3>
							</div>
							<div className="divide-y divide-slate-50 dark:divide-slate-800">
								{Object.entries(agingData).flatMap(([key, list]) => list).sort((a, b) => b.days - a.days).map((item, i) => (
									<div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
										<div className="flex items-center gap-4">
											<div className={`size-12 rounded-2xl flex items-center justify-center font-black text-white shadow-lg ${item.days > 90 ? 'bg-rose-500' : item.days > 60 ? 'bg-orange-500' : 'bg-indigo-500'}`}>
												{item.name?.[0] || 'K'}
											</div>
											<div>
												<h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{item.name}</h4>
												<p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
													<Clock size={10} /> Quá hạn {item.days} ngày
												</p>
											</div>
										</div>
										<div className="text-right">
											<p className="text-sm font-black text-rose-600 tracking-tight">{formatPrice(item.debt)}</p>
											<button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1 hover:underline">Nhắc nợ ngay</button>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				)}

				{activeTab === 'profit' && (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-500/20 text-white relative overflow-hidden">
							<div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
								<div>
									<p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">Tổng doanh thu chốt</p>
									<p className="text-3xl font-black tracking-tighter">{formatPrice(orderProfits.reduce((s, o) => s + o.revenue, 0))}</p>
								</div>
								<div>
									<p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">Tổng giá vốn nhập</p>
									<p className="text-3xl font-black tracking-tighter text-white/40">{formatPrice(orderProfits.reduce((s, o) => s + o.cost, 0))}</p>
								</div>
								<div>
									<p className="text-orange-400 text-[10px] font-black uppercase tracking-widest mb-2">Lợi nhuận gộp</p>
									<div className="flex items-center gap-3">
										<p className="text-3xl font-black text-white tracking-tighter">{formatPrice(orderProfits.reduce((s, o) => s + o.profit, 0))}</p>
										<div className="bg-white/10 px-2 py-1 rounded text-[10px] font-black">
											{((orderProfits.reduce((s, o) => s + o.profit, 0) / (orderProfits.reduce((s, o) => s + o.revenue, 0) || 1)) * 100).toFixed(1)}%
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
							<div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
								<h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Chi tiết lợi nhuận từng đơn</h3>
								<div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl text-xs font-black text-slate-500">
									<BarChart3 size={16} /> Xếp hạng lợi nhuận
								</div>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
										<tr>
											<th className="px-6 py-4">Đơn hàng</th>
											<th className="px-6 py-4">Khách hàng</th>
											<th className="px-6 py-4 text-right">Doanh thu</th>
											<th className="px-6 py-4 text-right">Giá vốn</th>
											<th className="px-6 py-4 text-right">Lợi nhuận</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
										{paginatedProfits.map((order, i) => (
											<tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
												<td className="px-6 py-4 font-black text-slate-900 dark:text-indigo-400">{order.invoiceId || order.id.slice(-6).toUpperCase()}</td>
												<td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400">{order.customerName}</td>
												<td className="px-6 py-4 text-right font-bold text-slate-700 dark:text-slate-300">{formatPrice(order.revenue)}</td>
												<td className="px-6 py-4 text-right text-slate-400 italic">{formatPrice(order.cost)}</td>
												<td className="px-6 py-4 text-right">
													<span className={`px-2 py-1 rounded-lg font-black ${order.profit > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
														{formatPrice(order.profit)}
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>

						{/* Pagination UI - Profits */}
						{totalProfitsPages > 1 && (
							<div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
								<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
									Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, orderProfits.length)} của {orderProfits.length} đơn
								</p>
								<div className="flex items-center gap-2">
									<button
										disabled={currentPage === 1}
										onClick={() => { setCurrentPage(prev => prev - 1); window.scrollTo(0, 0); }}
										className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
									>
										<ChevronRight className="rotate-180" size={18} />
									</button>
									<div className="flex items-center gap-1">
										{getPageNumbers(totalProfitsPages).map((page, idx) => (
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
										disabled={currentPage === totalProfitsPages}
										onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo(0, 0); }}
										className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
									>
										<ChevronRight size={18} />
									</button>
								</div>
							</div>
						)}
					</div>
				)}

				{activeTab === 'performance' && (
					<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
						{/* Enhanced Header Cards */}
						<div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-8 mb-8">
							<div className="flex items-center gap-6 mb-8">
								<div className="size-12 md:size-16 bg-indigo-50 dark:bg-indigo-900/40 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-indigo-600 shadow-inner">
									<TrendingUp size={24} className="md:w-8 md:h-8" />
								</div>
								<div>
									<h3 className="text-lg md:text-2xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">
										{isAdmin ? 'Thống kê hiệu suất đội ngũ' : 'Hiệu suất cá nhân của bạn'}
									</h3>
									<p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[2px] mt-1">Sơ đồ hoa hồng & Hoạt động thực tế</p>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
								<div className="bg-[#f8f9ff] dark:bg-slate-800/40 p-6 rounded-[2rem] border border-indigo-50/50 dark:border-slate-700/30">
									<p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3">
										{isAdmin ? 'Top Sales' : 'Cấp bậc'}
									</p>
									<p className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none">
										{isAdmin ? (
											staffs.map(s => {
												const userOrders = filteredOrders.filter(o => o.createdBy === s.id && o.status === 'Đơn chốt');
												return { name: s.displayName || s.email, total: userOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) };
											}).sort((a, b) => b.total - a.total)[0]?.name || '--'
										) : 'Nhân viên kinh doanh'}
									</p>
								</div>
								<div className="bg-[#f8f9ff] dark:bg-slate-800/40 p-6 rounded-[2rem] border border-indigo-50/50 dark:border-slate-700/30">
									<p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Tổng hoạt động</p>
									<p className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none">
										{isAdmin ? checkins.filter(c => filterByDate(c.createdAt)).length : checkins.filter(c => c.userId === currentUserId && filterByDate(c.createdAt)).length}
										<span className="text-[10px] text-slate-400 font-bold ml-1">Lượt</span>
									</p>
								</div>
								<div className="bg-[#f8f9ff] dark:bg-slate-800/40 p-6 rounded-[2rem] border border-indigo-50/50 dark:border-slate-700/30">
									<p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Đơn chốt</p>
									<p className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none">
										{isAdmin ? filteredOrders.filter(o => o.status === 'Đơn chốt').length : filteredOrders.filter(o => o.createdBy === currentUserId && o.status === 'Đơn chốt').length}
										<span className="text-[10px] text-slate-400 font-bold ml-1">Đơn</span>
									</p>
								</div>
								<div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-[2rem] border border-amber-100/50 dark:border-amber-900/20">
									<p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-3">Hoa hồng dự kiến</p>
									<p className="text-lg font-black text-amber-600 leading-none">
										{(() => {
											let totalCom = 0;
											const targetStaffs = staffs.filter(s => isAdmin || s.id === currentUserId);
											targetStaffs.forEach(s => {
												const staffOrders = filteredOrders.filter(o => o.createdBy === s.id && o.status === 'Đơn chốt');
												const plan = kpiPlans.find(p => p.userId === s.id && p.month === fromDate.slice(0, 7));
												staffOrders.forEach(o => {
													(o.items || []).forEach((item: any) => {
														const sku = item.sku || products.find(p => p.id === item.id)?.sku || 'N/A';
														const key = sku !== 'N/A' ? sku : item.name;
														const pData = products.find(p => (sku && p.sku === sku) || (item.id && p.id === item.id));
														const buyPrice = Number(item.buyPrice || pData?.buyPrice || 0);
														const avgPrice = Number(item.price) || 0;
														const profit = (avgPrice - buyPrice) * (Number(item.qty) || 0);
														const rate = plan?.productCommissions?.[key] || 0;
														totalCom += profit * (rate / 100);
													});
												});
											});
											return formatPrice(totalCom);
										})()}
									</p>
								</div>
							</div>
						</div>

						{/* Table 1: Bảng tính hoa hồng theo sản phẩm */}
						<div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden mb-8">
							<div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
								<div>
									<h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Chi tiết hoa hồng theo sản phẩm</h3>
									<p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest opacity-60">* Dựa trên lợi nhuận gộp danh sách đơn hàng đã chốt</p>
								</div>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead className="bg-[#FFFCEB] dark:bg-slate-800/80 text-[9px] font-black text-slate-500 uppercase tracking-[2px] text-center">
										<tr>
											<th className="px-8 py-5 text-left w-[25%] font-black uppercase">Nhân viên & Sản phẩm</th>
											<th className="px-6 py-5 font-black uppercase">Thực bán</th>
											<th className="px-6 py-5 font-black uppercase">Giá Bán TB</th>
											<th className="px-6 py-5 font-black uppercase">LN Gộp / SP</th>
											<th className="px-6 py-5 font-black uppercase">Tổng LN</th>
											<th className="px-6 py-5 font-black uppercase">Chiết khấu</th>
											<th className="px-8 py-5 text-right font-black uppercase">Hoa hồng</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
										{staffs.filter(s => isAdmin || s.id === currentUserId).map(s => {
											const staffOrders = filteredOrders.filter(o => o.createdBy === s.id && o.status === 'Đơn chốt');
											const plan = kpiPlans.find(p => p.userId === s.id && p.month === fromDate.slice(0, 7));

											const productSummary: any = {};
											staffOrders.forEach(o => {
												(o.items || []).forEach((item: any) => {
													// Robust SKU/Key resolution for historical data
													const sku = item.sku || products.find(p => p.id === item.id)?.sku;
													const key = sku || item.id || item.name || 'OTHER';

													if (!productSummary[key]) {
														const pData = products.find(p => (sku && p.sku === sku) || (item.id && p.id === item.id));
														productSummary[key] = {
															key: key,
															name: item.name || pData?.name || 'Sản phẩm khác',
															sku: sku || 'N/A',
															qty: 0,
															totalRevenue: 0,
															buyPrice: Number(item.buyPrice || pData?.buyPrice || 0)
														};
													}
													productSummary[key].qty += Number(item.qty) || 0;
													productSummary[key].totalRevenue += (Number(item.price) || 0) * (Number(item.qty) || 0);
												});
											});

											const items = Object.values(productSummary);
											if (items.length === 0) return null;

											return (
												<React.Fragment key={s.id}>
													<tr className="bg-slate-50/40 dark:bg-slate-800/20">
														<td colSpan={7} className="px-8 py-4">
															<div className="flex items-center gap-3">
																<div className="size-8 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center font-black text-xs shadow-sm">
																	{s.displayName?.[0].toUpperCase()}
																</div>
																<span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{s.displayName}</span>
															</div>
														</td>
													</tr>
													{items.map((item: any) => {
														const avgPrice = item.qty > 0 ? item.totalRevenue / item.qty : 0;
														const profitPerUnit = avgPrice - item.buyPrice;
														const totalProfit = profitPerUnit * item.qty;
														// Use the same robust key resolution as defined in productSummary
														const commissionKey = item.sku !== 'N/A' ? item.sku : item.name;
														const discountRate = plan?.productCommissions?.[commissionKey] || 0;
														const commissionAmount = totalProfit * (discountRate / 100);

														return (
															<tr key={item.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all group">
																<td className="px-10 py-4">
																	<p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase leading-snug group-hover:text-indigo-600 transition-colors">{item.name}</p>
																	<p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{item.sku}</p>
																</td>
																<td className="px-6 py-4 text-center">
																	<span className="text-xs font-black text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-lg">
																		{item.qty}
																	</span>
																</td>
																<td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-400">{formatPrice(avgPrice)}</td>
																<td className={`px-6 py-4 text-center font-bold ${profitPerUnit > 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
																	{formatPrice(profitPerUnit)}
																</td>
																<td className="px-6 py-4 text-center font-black text-slate-900 dark:text-white">{formatPrice(totalProfit)}</td>
																<td className="px-6 py-4 text-center">
																	<span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-full text-[10px] font-black border border-amber-100/50 dark:border-amber-900/20">
																		{discountRate}%
																	</span>
																</td>
																<td className="px-8 py-4 text-right font-black text-orange-500 text-sm">{formatPrice(commissionAmount)}</td>
															</tr>
														);
													})}
												</React.Fragment>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>

						{/* Table 2: Bảng theo dõi KPI nhân sự */}
						<div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden mt-8">
							<div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/20">
								<div>
									<h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Theo dõi chỉ tiêu (KPI)</h3>
									<p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest opacity-60">* Tự động đánh giá hiệu quả dựa trên hoạt động trực tế</p>
								</div>
								<div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
									<Calendar size={12} className="text-slate-400" />
									<span className="text-[10px] font-black text-slate-500 uppercase">{fromDate} - {toDate}</span>
								</div>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead className="bg-[#EEF1FF] dark:bg-slate-800/80 text-[9px] font-black text-indigo-500 uppercase tracking-[2px] text-center">
										<tr>
											<th className="px-8 py-5 text-left font-black">Nhân viên</th>
											<th className="px-6 py-5 font-black">Check-in</th>
											<th className="px-6 py-5 font-black">Chấm công</th>
											<th className="px-6 py-5 font-black">Khách mới</th>
											<th className="px-6 py-5 font-black whitespace-nowrap">Tổng thực hiện</th>
											<th className="px-6 py-5 font-black">% Hoàn thành</th>
											<th className="px-8 py-5 font-black uppercase">Hành động</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
										{staffs.filter(s => isAdmin || s.id === currentUserId).map(s => {
											const plan = kpiPlans.find(p => p.userId === s.id && p.month === fromDate.slice(0, 7));

											const actualCheckins = checkins.filter(c => c.userId === s.id && filterByDate(c.createdAt)).length;
											const actualAttendance = attendanceLogs.filter(a => a.userId === s.id && a.date >= fromDate && a.date <= toDate && a.checkInAt).length;
											const actualNewCustomers = customers.filter(c => c.createdBy === s.id && c.createdAt && filterByDate(c.createdAt)).length;

											const targets = {
												checkin: plan?.checkinTarget || 1,
												attendance: plan?.attendanceTarget || 1,
												newCustomer: plan?.newCustomerTarget || 1
											};

											const rates = {
												checkin: (actualCheckins / targets.checkin) * 100,
												attendance: (actualAttendance / targets.attendance) * 100,
												newCustomer: (actualNewCustomers / targets.newCustomer) * 100
											};

											const avgCompletion = (Math.min(100, rates.checkin) + Math.min(100, rates.attendance) + Math.min(100, rates.newCustomer)) / 3;

											return (
												<tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300">
													<td className="px-8 py-5">
														<p className="text-xs font-black text-slate-900 dark:text-white uppercase leading-snug tracking-tight">{s.displayName}</p>
														<p className="text-[9px] font-bold text-slate-400 opacity-60">{s.email}</p>
													</td>
													<td className="px-6 py-5 text-center">
														<div className="flex flex-col items-center gap-1.5">
															<p className="text-xs font-black text-indigo-600">{actualCheckins} / {targets.checkin}</p>
															<div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
																<div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, rates.checkin)}%` }}></div>
															</div>
														</div>
													</td>
													<td className="px-6 py-5 text-center">
														<div className="flex flex-col items-center gap-1.5">
															<p className="text-xs font-black text-emerald-600">{actualAttendance} / {targets.attendance}</p>
															<div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
																<div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, rates.attendance)}%` }}></div>
															</div>
														</div>
													</td>
													<td className="px-6 py-5 text-center">
														<div className="flex flex-col items-center gap-1.5">
															<p className="text-xs font-black text-orange-600">{actualNewCustomers} / {targets.newCustomer}</p>
															<div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
																<div className="h-full bg-orange-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, rates.newCustomer)}%` }}></div>
															</div>
														</div>
													</td>
													<td className="px-6 py-5 text-center">
														<span className="inline-flex size-8 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700">
															{(actualCheckins + actualAttendance + actualNewCustomers)}
														</span>
													</td>
													<td className="px-6 py-5 text-center">
														<div className="flex flex-col items-center gap-2">
															<div className="relative size-12 flex items-center justify-center">
																<svg className="size-full -rotate-90" viewBox="0 0 36 36">
																	<circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="3"></circle>
																	<circle cx="18" cy="18" r="16" fill="none" className={`transition-all duration-1000 ${avgCompletion >= 100 ? 'stroke-emerald-500' : 'stroke-indigo-500'}`} strokeWidth="3" strokeDasharray="100" strokeDashoffset={100 - Math.min(100, avgCompletion)} strokeLinecap="round"></circle>
																</svg>
																<span className={`absolute text-[9px] font-black ${avgCompletion >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>{avgCompletion.toFixed(0)}%</span>
															</div>
														</div>
													</td>
													<td className="px-8 py-5 text-center">
														{isAdmin ? (
															<button
																onClick={() => openKPIDialog(s)}
																className="size-9 bg-white dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 rounded-xl transition-all border border-slate-50 dark:border-slate-700 shadow-sm flex items-center justify-center"
															>
																<Settings2 size={16} />
															</button>
														) : (
															<span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Cá nhân</span>
														)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}
			</main>

			{/* MODAL GHI CHÚ THU CHI */}
			{
				showLogForm && (
					<div className="fixed inset-0 z-50 bg-[#1A237E]/80 backdrop-blur-sm flex items-center justify-center p-4">
						<div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
							<div className="px-8 py-6 bg-indigo-600 text-white flex items-center justify-between">
								<h3 className="text-xl font-black uppercase tracking-tight">Ghi chú Thu / Chi</h3>
								<button onClick={() => {
									setShowLogForm(false);
									setSearchParams(prev => {
										prev.delete('new');
										return prev;
									});
								}} className="text-white/60 hover:text-white transition-colors text-3xl font-light">&times;</button>
							</div>
							<form onSubmit={handleAddLog} className="p-8 space-y-5">
								<div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl">
									<button
										type="button"
										onClick={() => setLogData({ ...logData, type: 'thu' })}
										className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${logData.type === 'thu' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
									>
										Thu vào (+)
									</button>
									<button
										type="button"
										onClick={() => setLogData({ ...logData, type: 'chi' })}
										className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${logData.type === 'chi' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-400'}`}
									>
										Chi ra (-)
									</button>
								</div>

								<div>
									<label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Số tiền (VNĐ)</label>
									<input
										type="number"
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-indigo-600 text-lg focus:ring-2 focus:ring-indigo-500/20"
										placeholder="0"
										value={logData.amount === 0 ? '' : logData.amount}
										onChange={(e) => setLogData({ ...logData, amount: parseFloat(e.target.value) || 0 })}
										required
									/>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Hạng mục</label>
										<select
											className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 appearance-none"
											value={logData.category}
											onChange={(e) => setLogData({ ...logData, category: e.target.value })}
										>
											<option value="Vận hành">Vận hành</option>
											<option value="Nhập hàng">Nhập hàng</option>
											<option value="Lương">Lương</option>
											<option value="Khác">Khác</option>
										</select>
									</div>
									<div>
										<label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Ngày tháng</label>
										<input
											type="date"
											className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
											value={logData.date}
											onChange={(e) => setLogData({ ...logData, date: e.target.value })}
										/>
									</div>
								</div>

								<div>
									<label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Ghi chú chi tiết</label>
									<textarea
										className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 resize-none h-24"
										placeholder="VD: Chi tiền điện nước tháng 1..."
										value={logData.note}
										onChange={(e) => setLogData({ ...logData, note: e.target.value })}
									/>
								</div>

								<button
									type="submit"
									className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
								>
									Xác nhận ghi sổ
								</button>
							</form>
						</div>
					</div>
				)
			}
			{/* MODAL LẬP KẾ HOẠCH KPI */}
			{
				showPlanForm && selectedStaffForPlan && (
					<div className="fixed inset-0 z-[60] bg-[#1A237E]/80 backdrop-blur-sm flex items-center justify-center p-4">
						<div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
							<div className="px-8 py-6 bg-indigo-600 text-white flex items-center justify-between">
								<div className="flex items-center gap-3">
									<Target size={24} />
									<div>
										<h3 className="text-xl font-black uppercase tracking-tight">Kế hoạch KPI Tháng {fromDate.slice(0, 7)}</h3>
										<p className="text-xs font-bold opacity-60 uppercase">{selectedStaffForPlan.displayName}</p>
									</div>
								</div>
								<button onClick={() => setShowPlanForm(false)} className="text-white/60 hover:text-white transition-colors text-3xl font-light">&times;</button>
							</div>
							<div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Lương cứng cơ bản (VNĐ)</label>
										<input
											type="number"
											className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
											value={planData.baseSalary}
											onChange={(e) => setPlanData({ ...planData, baseSalary: parseFloat(e.target.value) || 0 })}
										/>
									</div>
									<div>
										<label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Chỉ tiêu Check-in (Lượt)</label>
										<input
											type="number"
											className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-purple-600 focus:ring-2 focus:ring-indigo-500/20"
											value={planData.checkinTarget}
											onChange={(e) => setPlanData({ ...planData, checkinTarget: parseInt(e.target.value) || 0 })}
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Chỉ tiêu Chấm công (Ngày)</label>
										<input
											type="number"
											className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-emerald-600 focus:ring-2 focus:ring-indigo-500/20"
											value={planData.attendanceTarget}
											onChange={(e) => setPlanData({ ...planData, attendanceTarget: parseInt(e.target.value) || 0 })}
										/>
									</div>
									<div>
										<label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Chỉ tiêu Khách mới</label>
										<input
											type="number"
											className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-black text-orange-600 focus:ring-2 focus:ring-indigo-500/20"
											value={planData.newCustomerTarget}
											onChange={(e) => setPlanData({ ...planData, newCustomerTarget: parseInt(e.target.value) || 0 })}
										/>
									</div>
								</div>

								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<label className="block text-[10px] font-black text-slate-400 uppercase ml-1">Chiết khấu theo Sản phẩm (%)</label>
										<p className="text-[9px] font-bold text-slate-400 italic">* % Hoa hồng tính trên Lợi nhuận gộp</p>
									</div>

									<div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-[2rem]">
										{(() => {
											const staffOrders = orders.filter(o => o.createdBy === selectedStaffForPlan.id && o.status === 'Đơn chốt');

											// Generate a unique list of sold products with their best available key (SKU or Name)
											const soldProductMap: Record<string, { name: string, sku: string }> = {};
											staffOrders.forEach(o => {
												(o.items || []).forEach((item: any) => {
													const sku = item.sku || products.find(p => p.id === item.id)?.sku || 'N/A';
													const key = sku !== 'N/A' ? sku : item.name;
													if (!soldProductMap[key]) {
														soldProductMap[key] = { name: item.name, sku: sku };
													}
												});
											});

											const soldProductList = Object.entries(soldProductMap);

											if (soldProductList.length === 0) return <p className="text-[10px] text-slate-400 italic text-center py-4">Nhân viên chưa bán sản phẩm nào trong kỳ.</p>;

											return soldProductList.map(([key, data]) => {
												return (
													<div key={key} className="flex items-center justify-between gap-4 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-50 dark:border-slate-700">
														<div className="flex-1 overflow-hidden">
															<p className="text-[10px] font-black text-slate-800 dark:text-white truncate uppercase leading-tight">{data.name}</p>
															<p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{data.sku}</p>
														</div>
														<div className="w-24">
															<div className="relative">
																<input
																	type="number"
																	step="0.1"
																	className="w-full bg-slate-50 dark:bg-slate-700 border-none rounded-lg px-3 py-2 text-xs font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 pr-6"
																	placeholder="0"
																	value={planData.productCommissions[key] ?? ''}
																	onChange={(e) => {
																		const val = e.target.value;
																		const rate = val === '' ? 0 : parseFloat(val);
																		setPlanData({
																			...planData,
																			productCommissions: { ...planData.productCommissions, [key]: rate }
																		});
																	}}
																/>
																<span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">%</span>
															</div>
														</div>
													</div>
												);
											});
										})()}
									</div>
								</div>
							</div>
							<div className="p-8 bg-slate-50 dark:bg-slate-800/50 flex gap-4">
								<button
									onClick={() => setShowPlanForm(false)}
									className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
								>
									Hủy bỏ
								</button>
								<button
									onClick={handleSaveKPIPlan}
									className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
								>
									Lưu kế hoạch tháng
								</button>
							</div>
						</div>
					</div>
				)
			}
		</div >
	);
};

export default Finance;
