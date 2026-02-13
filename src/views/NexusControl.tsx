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
		lock_free_debts: false
	});

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
						subscriptionStatus: s.subscriptionStatus || (u.isPro ? 'active' : 'trial'),
						subscriptionExpiresAt: s.subscriptionExpiresAt || null,
						paymentConfirmedAt: s.paymentConfirmedAt || u.createdAt || null,
						manualLockOrders: s.manualLockOrders || false,
						manualLockDebts: s.manualLockDebts || false
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

	const handleApprovePayment = async (request: any) => {
		if (!window.confirm(`Xác nhận thanh toán ${request.amount.toLocaleString()}đ cho ${request.userEmail}?`)) return;

		try {
			// 1. Update Request Status
			await updateDoc(doc(db, 'payment_requests', request.id), {
				status: 'approved',
				handledAt: serverTimestamp(),
				handledBy: auth.currentUser?.email
			});

			// 2. Update Subscription in Settings
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

			alert("Đã duyệt thanh toán và kích hoạt tài khoản!");
		} catch (error) {
			alert("Lỗi khi duyệt thanh toán.");
		}
	};

	const handleRejectPayment = async (request: any) => {
		const reason = window.prompt("Lý do từ chối hoặc thu hồi:", request.status === 'approved' ? "Thu hồi do nhầm lẫn" : "Không tìm thấy giao dịch");
		if (reason === null) return;

		try {
			// 1. Update Request
			await updateDoc(doc(db, 'payment_requests', request.id), {
				status: 'rejected',
				rejectReason: reason,
				handledAt: serverTimestamp(),
				handledBy: auth.currentUser?.email
			});

			// 2. Revoke Pro Status
			await updateDoc(doc(db, 'settings', request.ownerId), {
				subscriptionStatus: 'expired',
				isPro: false,
				revokedAt: serverTimestamp(),
				revokeReason: reason
			});

			alert("Đã từ chối/thu hồi yêu cầu.");
		} catch (error) {
			// Failed to reject payment
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
			// Failed to update system config
		}
	};

	const toggleUserLock = async (ownerId: string, field: string, currentVal: boolean) => {
		try {
			const newVal = !currentVal;
			// 1. Update Company Settings (Applies to all Employees)
			await setDoc(doc(db, 'settings', ownerId), {
				[field]: newVal
			}, { merge: true });

			// 2. Identify owner email for notification
			const owner = customers.find(c => c.uid === ownerId);

			// 3. Send In-app Notification to the owner
			const featureName = field === 'manualLockOrders' ? 'Chi tiết Đơn hàng' : 'Công nợ Chi tiết';
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
			// Failed to update user lock
		}
	};

	if (auth.currentUser?.email !== NEXUS_ADMIN_EMAIL) {
		return (
			<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8">
				<div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-6 border border-red-500/20">
					<Lock size={64} />
				</div>
				<h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Access Denied</h1>
				<p className="text-slate-400 text-center max-w-md">Nexus Control is restricted to system administrators only. Your activity has been logged.</p>
				<button onClick={() => navigate('/')} className="mt-8 bg-white text-slate-950 px-8 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-200 transition-all">Go Back</button>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500 selection:text-white">
			{/* Sidebar (Desktop) */}
			<aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-6 z-50">
				<div className="flex items-center gap-3 mb-10 px-2">
					<div className="size-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
						<Database size={24} className="text-white" />
					</div>
					<div>
						<h2 className="text-lg font-black tracking-tighter text-white uppercase">Nexus Control</h2>
						<p className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">System Core v1.0</p>
					</div>
				</div>

				<nav className="flex-1 space-y-2">
					<SidebarItem icon={<Activity size={20} />} label="Hệ thống" active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} badge={stats.pendingPayments} />
					<SidebarItem icon={<Users size={20} />} label="Khách hàng" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
					<SidebarItem icon={<Settings size={20} />} label="Cấu hình Flag" active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
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

			{/* Main Content */}
			<main className="pl-64 min-h-screen flex flex-col">
				{/* Top Bar */}
				<header className="h-20 border-b border-slate-800 flex items-center justify-between px-10 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-40">
					<div>
						<h3 className="text-2xl font-black text-white uppercase tracking-tight">
							{activeTab === 'requests' ? 'Yêu cầu Thanh toán' : activeTab === 'customers' ? 'Quản lý Doanh nghiệp' : 'Cấu hình Hệ thống'}
						</h3>
					</div>
					<div className="flex items-center gap-4">
						<div className="relative group">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
							<input
								type="text"
								placeholder="Tìm kiếm nhanh..."
								className="bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none w-64 transition-all"
							/>
						</div>
					</div>
				</header>

				<div className="p-10 flex-1 overflow-y-auto">
					{/* Stats Grid */}
					<div className="grid grid-cols-4 gap-6 mb-10">
						<StatBox label="Tổng Doanh Nghiệp" value={stats.totalUsers} icon={<Users />} color="blue" />
						<StatBox label="Tài khoản Pro" value={stats.activePro} icon={<Crown />} color="amber" />
						<StatBox label="Yêu cầu chờ" value={stats.pendingPayments} icon={<Clock />} color="orange" />
						<StatBox label="Tỷ lệ chuyển đổi" value={`${Math.round((stats.activePro / (stats.totalUsers || 1)) * 100)}%`} icon={<ArrowUpRight />} color="emerald" />
					</div>

					{/* Tab Content */}
					{activeTab === 'requests' && (
						<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
							<div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
								<table className="w-full text-left">
									<thead>
										<tr className="bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
											<th className="px-8 py-5">Khách hàng</th>
											<th className="px-8 py-5">Gói đăng ký</th>
											<th className="px-8 py-5">Nội dung chuyển</th>
											<th className="px-8 py-5">Số tiền</th>
											<th className="px-8 py-5">Thời gian</th>
											<th className="px-8 py-5 text-right">Hành động</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-800">
										{requests.map((req) => (
											<tr key={req.id} className="hover:bg-slate-800/30 transition-colors group">
												<td className="px-8 py-6">
													<div className="flex items-center gap-3">
														<div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-400">
															{req.userEmail?.[0].toUpperCase()}
														</div>
														<div>
															<p className="font-bold text-white text-sm">{req.userEmail}</p>
															<p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{req.ownerId?.slice(-8)}</p>
														</div>
													</div>
												</td>
												<td className="px-8 py-6">
													<span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${req.planId === 'premium_yearly' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
														{req.planName}
													</span>
												</td>
												<td className="px-8 py-6">
													<span className="text-indigo-400 font-black tracking-widest text-xs">{req.transferCode || '---'}</span>
												</td>
												<td className="px-8 py-6 font-black text-white">{req.amount.toLocaleString()}đ</td>
												<td className="px-8 py-6 text-xs text-slate-500 font-bold">
													{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString('vi-VN') : 'Just now'}
												</td>
												<td className="px-8 py-6 text-right">
													<div className="flex justify-end gap-2">
														<button
															onClick={() => handleApprovePayment(req)}
															className={`size-10 rounded-xl flex items-center justify-center transition-all ${req.status === 'approved'
																? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
																: 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'
																}`}
															title="Duyệt"
														>
															<CheckCircle2 size={18} />
														</button>
														<button
															onClick={() => handleRejectPayment(req)}
															className={`size-10 rounded-xl flex items-center justify-center transition-all ${req.status === 'rejected'
																? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
																: 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white'
																}`}
															title="Từ chối / Thu hồi"
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
						<div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
							<div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-10">
								<h4 className="text-sm font-black text-slate-400 uppercase tracking-[4px] mb-8">Kiểm soát trải nghiệm người dùng (Friction Control)</h4>

								<div className="grid grid-cols-1 gap-4">
									<ConfigToggle
										title="Khóa Đơn chi tiết (Free User)"
										description="Yêu cầu nâng cấp khi tài khoản Free/Expired muốn xem ticket đơn hàng."
										enabled={systemConfig.lock_free_orders}
										onToggle={() => toggleSystemFlag('lock_free_orders')}
									/>
									<ConfigToggle
										title="Khóa Công nợ chi tiết (Free User)"
										description="Yêu cầu nâng cấp khi xem báo cáo nợ chi tiết của khách hàng."
										enabled={systemConfig.lock_free_debts}
										onToggle={() => toggleSystemFlag('lock_free_debts')}
									/>
									<ConfigToggle
										title="Chế độ bảo trì hệ thống"
										description="Tạm thời khóa truy cập toàn bộ người dùng để cập nhật hệ thống."
										enabled={systemConfig.maintenance_mode}
										onToggle={() => toggleSystemFlag('maintenance_mode')}
									/>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'customers' && (
						<div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
							<table className="w-full text-left">
								<thead>
									<tr className="bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
										<th className="px-6 py-5">Doanh nghiệp</th>
										<th className="px-6 py-5">Email Owner</th>
										<th className="px-6 py-5">Gói</th>
										<th className="px-6 py-5">Bắt đầu</th>
										<th className="px-6 py-5">Kết thúc</th>
										<th className="px-6 py-5 text-center">Khóa đơn</th>
										<th className="px-6 py-5 text-center">Khóa nợ</th>
										<th className="px-6 py-5 text-right">Ctiet</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-800">
									{customers.map((c) => (
										<tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
											<td className="px-6 py-6">
												<div className="flex items-center gap-3">
													<div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-black text-xs">
														{c.displayName?.[0].toUpperCase() || c.email?.[0].toUpperCase() || 'U'}
													</div>
													<div className="truncate max-w-[150px]">
														<p className="font-bold text-white text-xs uppercase truncate">{c.displayName || 'Người dùng mới'}</p>
														<p className="text-[10px] text-slate-500 font-medium">UID: {c.uid?.slice(-6)}</p>
													</div>
												</div>
											</td>
											<td className="px-6 py-6 text-xs text-slate-400">{c.email}</td>
											<td className="px-6 py-6">
												<span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${c.isPro ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
													}`}>
													{c.isPro ? 'PRO' : 'FREE'}
												</span>
											</td>
											<td className="px-6 py-6 text-[11px] font-bold text-slate-500">
												{c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('vi-VN') : '-'}
											</td>
											<td className="px-6 py-6 text-[11px] font-bold text-slate-500">
												{c.subscriptionExpiresAt?.toDate ? c.subscriptionExpiresAt.toDate().toLocaleDateString('vi-VN') : 'Hết hạn'}
											</td>
											<td className="px-6 py-6 text-center">
												<button
													onClick={() => toggleUserLock(c.uid, 'manualLockOrders', c.manualLockOrders)}
													className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockOrders ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
												>
													{c.manualLockOrders ? <Lock size={14} /> : <Unlock size={14} />}
												</button>
											</td>
											<td className="px-6 py-6 text-center">
												<button
													onClick={() => toggleUserLock(c.uid, 'manualLockDebts', c.manualLockDebts)}
													className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockDebts ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
												>
													{c.manualLockDebts ? <Lock size={14} /> : <Unlock size={14} />}
												</button>
											</td>
											<td className="px-6 py-6 text-right">
												<button className="p-2 text-slate-600 hover:text-white transition-colors">
													<ExternalLink size={16} />
												</button>
											</td>
										</tr>
									))}
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
		className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 relative group ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
			}`}
	>
		<span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
		<span className="font-bold text-sm tracking-tight">{label}</span>
		{badge > 0 && (
			<span className="ml-auto size-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
				{badge}
			</span>
		)}
	</button>
);

const StatBox = ({ label, value, icon, color }: any) => (
	<div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl shadow-slate-950 flex flex-col gap-4 relative overflow-hidden group">
		<div className={`absolute -right-4 -top-4 size-24 bg-${color}-500 opacity-[0.03] group-hover:scale-150 transition-transform duration-700`} />
		<div className={`size-12 rounded-2xl bg-${color}-500/10 text-${color}-500 flex items-center justify-center`}>
			{icon}
		</div>
		<div>
			<p className="text-[10px] font-black text-slate-500 uppercase tracking-[2px] mb-1">{label}</p>
			<p className="text-2xl font-black text-white tracking-tighter">{value}</p>
		</div>
	</div>
);

const ConfigToggle = ({ title, description, enabled, onToggle }: any) => (
	<div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 flex items-center justify-between group hover:border-slate-600 transition-all">
		<div>
			<h5 className="font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors uppercase text-sm tracking-tight">{title}</h5>
			<p className="text-xs text-slate-500 font-medium">{description}</p>
		</div>
		<button
			onClick={onToggle}
			className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
		>
			<div className={`size-6 rounded-full bg-white shadow-xl transform transition-transform duration-300 ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
		</button>
	</div>
);

export default NexusControl;
