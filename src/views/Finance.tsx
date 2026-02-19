import React, { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, writeBatch, limit, orderBy, deleteDoc } from 'firebase/firestore';
import { Wallet, TrendingUp, TrendingDown, Receipt, Clock, BarChart3, Plus, ArrowUpRight, ArrowDownLeft, Filter, Search, Calendar, ChevronRight, Trash2 } from 'lucide-react';
import { useOwner } from '../hooks/useOwner';

import { useSearchParams } from 'react-router-dom';

const Finance = () => {
	const owner = useOwner();
	const [searchParams, setSearchParams] = useSearchParams();
	const tabParam = searchParams.get('tab') as 'cashbook' | 'aging' | 'profit' | null;
	const [activeTab, setActiveTab] = useState<'cashbook' | 'aging' | 'profit'>(tabParam || 'cashbook');
	const [cashLogs, setCashLogs] = useState<any[]>([]);
	const [orders, setOrders] = useState<any[]>([]);
	const [payments, setPayments] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

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

	// Sync modal with URL
	useEffect(() => {
		const isNew = searchParams.get('new') === 'true';
		if (isNew !== showLogForm) {
			setShowLogForm(isNew);
		}
	}, [searchParams]);

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

		return () => {
			unsubLogs();
			unsubOrders();
			unsubPayments();
			unsubCustomers();
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
		} catch (error) {
			console.error("Error adding cash log:", error);
			alert("Lỗi khi ghi sổ quỹ");
		}
	};

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
	};

	// --- PERMISSION ---
	const hasPermission = owner.role === 'admin' || (owner.accessRights?.finance_view ?? true);

	if (owner.loading) return null;

	if (!hasPermission) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center text-center p-8 min-h-screen">
				<div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-full text-indigo-500 mb-4">
					<span className="material-symbols-outlined text-5xl">account_balance</span>
				</div>
				<h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">Quyền hạn hạn chế</h2>
				<p className="text-slate-500 dark:text-slate-400 max-w-md">
					Bạn không có quyền truy cập module Tài chính. Vui lòng liên hệ quản trị viên.
				</p>
				<button onClick={() => window.history.back()} className="mt-6 bg-[#1A237E] text-white px-6 py-2 rounded-xl font-bold transition-all active:scale-95">Quay lại</button>
			</div>
		);
	}

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
		} catch (error) {
			console.error("Finance: Delete Log Error:", error);
			alert("Lỗi khi xóa ghi chép");
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

					<div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
						<button
							onClick={() => setActiveTab('cashbook')}
							className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'cashbook' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
						>
							Sổ Quỹ
						</button>
						<button
							onClick={() => setActiveTab('aging')}
							className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'aging' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
						>
							Tuổi Nợ
						</button>
						<button
							onClick={() => setActiveTab('profit')}
							className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'profit' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
						>
							Lợi Nhuận
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
										{cashLogs.length === 0 ? (
											<tr>
												<td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">
													Chưa có ghi chép thu chi nào cho kỳ này.
												</td>
											</tr>
										) : (
											cashLogs.map(log => (
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
										{orderProfits.map((order, i) => (
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
					</div>
				)}
			</main>

			{/* MODAL GHI CHÚ THU CHI */}
			{showLogForm && (
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
			)}
		</div>
	);
};

export default Finance;
