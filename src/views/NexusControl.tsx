import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	LayoutDashboard,
	Users,
	CreditCard,
	Settings,
	ShieldAlert,
	CheckCircle2,
	XCircle,
	Clock,
	Search,
	ExternalLink,
	Filter,
	ArrowUpRight,
	Database,
	Activity,
	Mail,
	Lock,
	Unlock,
	Crown,
	Calendar
} from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import { auth, db } from '../services/firebase';
import {
	collection,
	query,
	onSnapshot,
	doc,
	updateDoc,
	serverTimestamp,
	orderBy,
	limit,
	getDoc,
	setDoc,
	addDoc
} from 'firebase/firestore';

const NEXUS_ADMIN_EMAIL = 'dunvex.green@gmail.com'; // User's email

const NexusControl = () => {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const [activeTab, setActiveTab] = useState('requests');
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState({
		totalUsers: 0,
		activePro: 0,
		pendingPayments: 0,
		totalRevenue: 0
	});

	const [requests, setRequests] = useState<any[]>([]);
	const [customers, setCustomers] = useState<any[]>([]);
	const [systemConfig, setSystemConfig] = useState<any>({
		lock_free_orders: false,
		lock_free_debts: false,
		lock_free_sheets: false,
		maintenance_mode: false
	});
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	useEffect(() => {
		// Security Check
		if (auth.currentUser?.email !== NEXUS_ADMIN_EMAIL) {
			// navigate('/');
			// return;
		}

		// 1. Listen to Payment Requests
		const qRequests = query(collection(db, 'payment_requests'), orderBy('createdAt', 'desc'), limit(50));
		const unsubRequests = onSnapshot(qRequests, (snap) => {
			const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			setRequests(data);
			setStats(prev => ({ ...prev, pendingPayments: data.filter((r: any) => r.status === 'pending').length }));
		});

		// 2. Listen to Users & Settings to merge data
		const unsubUsers = onSnapshot(collection(db, 'users'), (userSnap) => {
			const usersData = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
			const owners = usersData.filter((u: any) => u.uid === u.ownerId || !u.ownerId);

			// Listen to Settings as well for real-time lock updates
			const unsubSettings = onSnapshot(collection(db, 'settings'), (settingsSnap) => {
				const settingsData: Record<string, any> = {};
				settingsSnap.docs.forEach(d => { settingsData[d.id] = d.data(); });

				// Merge Settings into Owners
				const merged = owners.map((u: any) => {
					const s = settingsData[u.uid] || {};
					return {
						...u,
						isPro: s.isPro ?? u.isPro ?? false,
						planId: s.planId || (s.isPro ? 'premium_monthly' : 'free'),
						subscriptionStatus: s.subscriptionStatus || (u.isPro ? 'active' : 'trial'),
						subscriptionExpiresAt: s.subscriptionExpiresAt || null,
						paymentConfirmedAt: s.paymentConfirmedAt || u.createdAt || null,
						manualLockOrders: s.manualLockOrders || false,
						manualLockDebts: s.manualLockDebts || false,
						manualLockSheets: s.manualLockSheets || false
					};
				});

				setCustomers(merged);
				setStats(prev => ({
					...prev,
					totalUsers: merged.length,
					activePro: merged.filter((c: any) => c.isPro).length
				}));
			});

			return () => unsubSettings();
		});

		// 3. System Config
		const fetchConfig = async () => {
			const docRef = doc(db, 'system_config', 'main');
			const docSnap = await getDoc(docRef);
			if (docSnap.exists()) {
				setSystemConfig(docSnap.data());
			}
			setLoading(false);
		};
		fetchConfig();

		return () => {
			unsubRequests();
			unsubUsers();
		};
	}, [navigate]);

	const handleUpdatePlan = async (ownerId: string, newPlan: string) => {
		if (!window.confirm(`Xác nhận đổi gói sang ${newPlan === 'free' ? 'FREE' : newPlan === 'premium_monthly' ? '1 tháng' : '1 năm'}? Ngày hiệu lực sẽ được đặt về hôm nay.`)) return;
		try {
			const isPro = newPlan !== 'free';
			await updateDoc(doc(db, 'settings', ownerId), {
				planId: newPlan,
				isPro: isPro,
				paymentConfirmedAt: serverTimestamp()
			});
			showToast("Cập nhật gói thành công", "success");
		} catch (error) {
			showToast("Lỗi khi cập nhật gói", "error");
		}
	};

	const getEffectiveStatus = (c: any) => {
		const joinedAt = c.paymentConfirmedAt?.toDate ? c.paymentConfirmedAt.toDate() : (c.paymentConfirmedAt?.seconds ? new Date(c.paymentConfirmedAt.seconds * 1000) : null);
		if (!joinedAt) return { isExpired: false, daysUsed: 0, locks: { orders: c.manualLockOrders, debts: c.manualLockDebts, sheets: c.manualLockSheets } };

		const now = new Date();
		const diffDays = Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));

		let isExpired = false;
		const plan = c.planId || (c.isPro ? 'premium_monthly' : 'free');

		if (plan === 'free') {
			if (diffDays > 60) isExpired = true;
		} else if (plan === 'premium_monthly') {
			if (diffDays > 30) isExpired = true;
		} else if (plan === 'premium_yearly') {
			if (diffDays > 365) isExpired = true;
		}

		return {
			isExpired,
			daysUsed: diffDays,
			locks: {
				orders: isExpired || c.manualLockOrders,
				debts: isExpired || c.manualLockDebts,
				sheets: isExpired || c.manualLockSheets
			}
		};
	};

	const handleApprovePayment = async (request: any) => {
		if (!window.confirm(`Xác nhận thanh toán ${request.amount.toLocaleString()}đ cho ${request.userEmail}?`)) return;

		try {
			await updateDoc(doc(db, 'payment_requests', request.id), {
				status: 'approved',
				handledAt: serverTimestamp(),
				handledBy: auth.currentUser?.email
			});

			const isYearly = request.planId === 'premium_yearly';
			const trialDate = new Date();
			trialDate.setMonth(trialDate.getMonth() + (isYearly ? 12 : 1));

			await updateDoc(doc(db, 'settings', request.ownerId), {
				subscriptionStatus: 'active',
				isPro: true,
				planId: request.planId,
				paymentConfirmedAt: serverTimestamp(),
				subscriptionExpiresAt: trialDate
			});

			showToast("Đã duyệt thanh toán và kích hoạt tài khoản!", "success");
		} catch (error) {
			showToast("Lỗi khi duyệt thanh toán.", "error");
		}
	};

	const handleRejectPayment = async (request: any) => {
		const reason = window.prompt("Lý do từ chối hoặc thu hồi:", request.status === 'approved' ? "Thu hồi do nhầm lẫn" : "Không tìm thấy giao dịch");
		if (reason === null) return;

		try {
			await updateDoc(doc(db, 'payment_requests', request.id), {
				status: 'rejected',
				rejectReason: reason,
				handledAt: serverTimestamp(),
				handledBy: auth.currentUser?.email
			});

			await updateDoc(doc(db, 'settings', request.ownerId), {
				subscriptionStatus: 'expired',
				isPro: false,
				revokedAt: serverTimestamp(),
				revokeReason: reason
			});

			showToast("Đã từ chối/thu hồi yêu cầu.", "info");
		} catch (error) {
			showToast("Lỗi khi thực hiện thao tác.", "error");
		}
	};

	const toggleSystemFlag = async (flag: string) => {
		const newVal = !systemConfig[flag];
		try {
			await setDoc(doc(db, 'system_config', 'main'), {
				[flag]: newVal
			}, { merge: true });
			setSystemConfig({ ...systemConfig, [flag]: newVal });
		} catch (error) {
			// Error
		}
	};

	const toggleUserLock = async (ownerId: string, field: string, currentVal: boolean) => {
		try {
			const newVal = !currentVal;
			await setDoc(doc(db, 'settings', ownerId), {
				[field]: newVal
			}, { merge: true });

			const featureMap: Record<string, string> = {
				'manualLockOrders': 'Chi tiết Đơn hàng',
				'manualLockDebts': 'Công nợ Chi tiết',
				'manualLockSheets': 'Tải & Đồng bộ dữ liệu (Export)'
			};
			const featureName = featureMap[field] || 'Chính sách hệ thống';

			await addDoc(collection(db, 'notifications'), {
				userId: ownerId,
				title: newVal ? `Đã khóa ${featureName}` : `Đã mở khóa ${featureName}`,
				body: newVal
					? `Quản trị viên đã tạm thời khóa quyền truy cập của cả doanh nghiệp vào ${featureName}.`
					: `Doanh nghiệp của bạn đã có thể truy cập lại vào ${featureName}.`,
				type: newVal ? 'lock' : 'unlock',
				read: false,
				createdAt: serverTimestamp()
			});
		} catch (error) {
			// Error
		}
	};

	if (auth.currentUser?.email !== NEXUS_ADMIN_EMAIL) {
		return (
			<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8">
				<div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-6 border border-red-500/20">
					<Lock size={64} />
				</div>
				<h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Access Denied</h1>
				<p className="text-slate-400 text-center max-w-md">Nexus Control is restricted to system administrators only.</p>
				<button onClick={() => navigate('/')} className="mt-8 bg-white text-slate-950 px-8 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-200 transition-all">Go Back</button>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500 selection:text-white">
			{/* Mobile Header Overlay */}
			<div className="lg:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-[60]">
				<div className="flex items-center gap-2">
					<Database size={20} className="text-indigo-500" />
					<h2 className="text-sm font-black text-white uppercase tracking-tight">Nexus</h2>
				</div>
				<button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400">
					<Filter size={24} />
				</button>
			</div>

			{/* Sidebar */}
			<aside className={`fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-6 z-[100] transition-transform duration-300 lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
				<div className="flex items-center justify-between lg:justify-start gap-3 mb-10 px-2">
					<div className="flex items-center gap-3">
						<div className="size-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
							<Database size={24} className="text-white" />
						</div>
						<div>
							<h2 className="text-lg font-black tracking-tighter text-white uppercase">Nexus Control</h2>
							<p className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">System Core v1.0</p>
						</div>
					</div>
					<button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 text-slate-500">
						<XCircle size={20} />
					</button>
				</div>

				<nav className="flex-1 space-y-2">
					<SidebarItem icon={<Activity size={20} />} label="Hệ thống" active={activeTab === 'requests'} onClick={() => { setActiveTab('requests'); setIsMobileMenuOpen(false); }} badge={stats.pendingPayments} />
					<SidebarItem icon={<Users size={20} />} label="Khách hàng" active={activeTab === 'customers'} onClick={() => { setActiveTab('customers'); setIsMobileMenuOpen(false); }} />
					<SidebarItem icon={<Settings size={20} />} label="Cấu hình Flag" active={activeTab === 'config'} onClick={() => { setActiveTab('config'); setIsMobileMenuOpen(false); }} />
				</nav>

				<div className="mt-auto p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
					<div className="flex items-center gap-3 mb-3">
						<div className="size-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
							<ShieldAlert size={16} />
						</div>
						<p className="text-xs font-bold text-slate-300">Admin Mode</p>
					</div>
					<p className="text-[10px] text-slate-500 font-medium break-all">{auth.currentUser?.email}</p>
				</div>
			</aside>

			{/* Backdrop */}
			{isMobileMenuOpen && (
				<div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden" />
			)}

			{/* Main Content */}
			<main className="lg:pl-64 min-h-screen flex flex-col">
				<header className="h-16 lg:h-20 border-b border-slate-800 flex items-center justify-between px-6 lg:px-10 bg-slate-950/50 backdrop-blur-xl sticky top-16 lg:top-0 z-40">
					<div>
						<h3 className="text-lg lg:text-2xl font-black text-white uppercase tracking-tight">
							{activeTab === 'requests' ? 'Yêu cầu' : activeTab === 'customers' ? 'Doanh nghiệp' : 'Cấu hình'}
						</h3>
					</div>
				</header>

				<div className="p-4 lg:p-10 flex-1 overflow-y-auto">
					{/* Stats Grid */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10">
						<StatBox label="Doanh Nghiệp" value={stats.totalUsers} icon={<Users />} color="blue" />
						<StatBox label="Tài khoản Pro" value={stats.activePro} icon={<Crown />} color="amber" />
						<StatBox label="Yêu cầu chờ" value={stats.pendingPayments} icon={<Clock />} color="orange" />
						<StatBox label="Chuyển đổi" value={`${Math.round((stats.activePro / (stats.totalUsers || 1)) * 100)}%`} icon={<ArrowUpRight />} color="emerald" />
					</div>

					{activeTab === 'requests' && (
						<div className="space-y-6">
							<div className="bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-800 overflow-x-auto shadow-2xl">
								<table className="w-full text-left min-w-[800px]">
									<thead>
										<tr className="bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
											<th className="px-8 py-5">Khách hàng</th>
											<th className="px-8 py-5">Gói đăng ký</th>
											<th className="px-8 py-5">Ngày gửi</th>
											<th className="px-8 py-5">Coupon</th>
											<th className="px-8 py-5">Nội dung chuyển</th>
											<th className="px-8 py-5">Số tiền</th>
											<th className="px-8 py-5 text-right">Hành động</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-800">
										{requests.map((req) => (
											<tr key={req.id} className="hover:bg-slate-800/30 transition-colors group text-xs">
												<td className="px-8 py-6">
													<div className="flex items-center gap-3">
														<div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-400">
															{req.userEmail?.[0].toUpperCase()}
														</div>
														<div className="max-w-[150px] truncate">
															<p className="font-bold text-white truncate">{req.userEmail}</p>
															<p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-tight">{req.ownerId?.slice(-8)}</p>
														</div>
													</div>
												</td>
												<td className="px-8 py-6">
													<span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${req.planId === 'premium_yearly' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
														{req.planName}
													</span>
												</td>
												<td className="px-8 py-6 text-slate-400 font-medium">
													{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString('vi-VN', {
														hour: '2-digit',
														minute: '2-digit',
														day: '2-digit',
														month: '2-digit'
													}) : '---'}
												</td>
												<td className="px-8 py-6 font-black text-rose-500 uppercase tracking-widest">
													{req.appliedCode || '---'}
												</td>
												<td className="px-8 py-6 text-indigo-400 font-black tracking-widest">{req.transferCode || '---'}</td>
												<td className="px-8 py-6 font-black text-white">{req.amount.toLocaleString()}đ</td>
												<td className="px-8 py-6 text-right">
													<div className="flex justify-end gap-2">
														<button
															onClick={() => handleApprovePayment(req)}
															className={`size-10 rounded-xl flex items-center justify-center transition-all ${req.status === 'approved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
														>
															<CheckCircle2 size={18} />
														</button>
														<button
															onClick={() => handleRejectPayment(req)}
															className={`size-10 rounded-xl flex items-center justify-center transition-all ${req.status === 'rejected' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white'}`}
														>
															<XCircle size={18} />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{activeTab === 'config' && (
						<div className="max-w-4xl space-y-8">
							<div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 lg:p-10">
								<h4 className="text-xs font-black text-slate-400 uppercase tracking-[4px] mb-8">System Configuration</h4>
								<div className="grid grid-cols-1 gap-4">
									<ConfigToggle
										title="Khóa Đơn chi tiết (FREE)"
										description="Yêu cầu PRO để xem chi tiết hóa đơn."
										enabled={systemConfig.lock_free_orders}
										onToggle={() => toggleSystemFlag('lock_free_orders')}
									/>
									<ConfigToggle
										title="Khóa Công nợ chi tiết (FREE)"
										description="Yêu cầu PRO để xem bảng kê nợ chi tiết."
										enabled={systemConfig.lock_free_debts}
										onToggle={() => toggleSystemFlag('lock_free_debts')}
									/>
									<ConfigToggle
										title="Khóa Đồng bộ Sheets (FREE)"
										description="Yêu cầu PRO để sử dụng tính năng Sync Google Sheets."
										enabled={systemConfig.lock_free_sheets}
										onToggle={() => toggleSystemFlag('lock_free_sheets')}
									/>
									<ConfigToggle
										title="Chế độ bảo trì"
										description="Chỉ cho phép Admin truy cập hệ thống."
										enabled={systemConfig.maintenance_mode}
										onToggle={() => toggleSystemFlag('maintenance_mode')}
									/>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'customers' && (
						<div className="bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-800 overflow-x-auto shadow-2xl">
							<table className="w-full text-left min-w-[900px]">
								<thead>
									<tr className="bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
										<th className="px-6 py-5">Doanh nghiệp</th>
										<th className="px-6 py-5">Email Owner</th>
										<th className="px-6 py-5">Gói</th>
										<th className="px-6 py-5">Ngày vào trang</th>
										<th className="px-3 py-5 text-center">Đơn</th>
										<th className="px-3 py-5 text-center">Nợ</th>
										<th className="px-3 py-5 text-center">Sheet</th>
										<th className="px-6 py-5 text-right">Chi tiết</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-800">
									{customers.map((c) => {
										const eff = getEffectiveStatus(c);
										return (
											<tr key={c.id} className="hover:bg-slate-800/30 transition-colors text-xs">
												<td className="px-6 py-6 font-bold text-white uppercase truncate max-w-[150px]">
													{c.displayName || 'No Name'}
												</td>
												<td className="px-6 py-6 text-slate-400">{c.email}</td>
												<td className="px-6 py-6">
													<select
														className="bg-slate-800 text-white text-[10px] font-black rounded-lg px-2 py-1 outline-none border border-slate-700 hover:border-indigo-500 transition-colors cursor-pointer"
														value={c.planId || (c.isPro ? 'premium_monthly' : 'free')}
														onChange={(e) => handleUpdatePlan(c.uid, e.target.value)}
													>
														<option value="free">FREE (60d)</option>
														<option value="premium_monthly">1 THÁNG (30d)</option>
														<option value="premium_yearly">1 NĂM (365d)</option>
													</select>
												</td>
												<td className="px-6 py-6 text-slate-500 whitespace-nowrap">
													<div className={`font-bold text-[10px] ${eff.isExpired ? 'text-rose-500' : 'text-slate-300'}`}>
														{eff.isExpired ? 'ĐÃ HẾT HẠN' : 'ĐANG HIỆU LỰC'}
													</div>
													<div className="text-[10px] uppercase font-black tracking-tighter">
														{c.paymentConfirmedAt?.toDate ? c.paymentConfirmedAt.toDate().toLocaleDateString('vi-VN') : '---'}
														<span className="ml-1 opacity-50">({eff.daysUsed}d)</span>
													</div>
												</td>
												<td className="px-3 py-6 text-center">
													<button
														onClick={() => !eff.isExpired && toggleUserLock(c.uid, 'manualLockOrders', c.manualLockOrders)}
														className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${eff.locks.orders ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-white'} ${eff.isExpired ? 'cursor-not-allowed opacity-80' : ''}`}
														title={eff.isExpired ? "Tự động khóa do hết hạn" : "Khóa thủ công"}
													>
														{eff.locks.orders ? <Lock size={12} /> : <Unlock size={12} />}
													</button>
												</td>
												<td className="px-3 py-6 text-center">
													<button
														onClick={() => !eff.isExpired && toggleUserLock(c.uid, 'manualLockDebts', c.manualLockDebts)}
														className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${eff.locks.debts ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-white'} ${eff.isExpired ? 'cursor-not-allowed opacity-80' : ''}`}
														title={eff.isExpired ? "Tự động khóa do hết hạn" : "Khóa thủ công"}
													>
														{eff.locks.debts ? <Lock size={12} /> : <Unlock size={12} />}
													</button>
												</td>
												<td className="px-3 py-6 text-center">
													<button
														onClick={() => !eff.isExpired && toggleUserLock(c.uid, 'manualLockSheets', c.manualLockSheets)}
														className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${eff.locks.sheets ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-white'} ${eff.isExpired ? 'cursor-not-allowed opacity-80' : ''}`}
														title={eff.isExpired ? "Tự động khóa do hết hạn" : "Khóa thủ công"}
													>
														{eff.locks.sheets ? <Lock size={12} /> : <Unlock size={12} />}
													</button>
												</td>
												<td className="px-6 py-6 text-right">
													<ExternalLink size={16} className="text-slate-600 cursor-not-allowed mx-auto" />
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</main>
		</div>
	);
};

const SidebarItem = ({ icon, label, active, onClick, badge }: any) => (
	<button
		onClick={onClick}
		className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all relative group ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
	>
		<span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
		<span className="font-bold text-sm tracking-tight">{label}</span>
		{badge > 0 && <span className="ml-auto size-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">{badge}</span>}
	</button>
);

const StatBox = ({ label, value, icon, color }: any) => {
	const colorMap: Record<string, string> = {
		blue: 'text-blue-500 bg-blue-500/10',
		amber: 'text-amber-500 bg-amber-500/10',
		orange: 'text-orange-500 bg-orange-500/10',
		emerald: 'text-emerald-500 bg-emerald-500/10'
	};
	return (
		<div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col gap-4 relative overflow-hidden group">
			<div className={`size-12 rounded-2xl ${colorMap[color]} flex items-center justify-center`}>{icon}</div>
			<div>
				<p className="text-[10px] font-black text-slate-500 uppercase tracking-[2px] mb-1">{label}</p>
				<p className="text-2xl font-black text-white tracking-tighter">{value}</p>
			</div>
		</div>
	);
};

const ConfigToggle = ({ title, description, enabled, onToggle }: any) => (
	<div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 flex items-center justify-between group hover:border-slate-600 transition-all">
		<div className="pr-4">
			<h5 className="font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors uppercase text-sm tracking-tight">{title}</h5>
			<p className="text-xs text-slate-500 font-medium">{description}</p>
		</div>
		<button onClick={onToggle} className={`w-14 h-8 shrink-0 rounded-full p-1 transition-colors duration-300 ${enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}>
			<div className={`size-6 rounded-full bg-white shadow-xl transform transition-transform duration-300 ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
		</button>
	</div>
);

export default NexusControl;
