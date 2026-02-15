import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
	Settings, User, Bell, Shield, Database, Globe, Moon, Sun, Users, Activity,
	FileText, Save, Plus, Trash2, Edit2, CheckCircle, XCircle, Crown, Clock,
	Rocket, Lock, RefreshCcw, ExternalLink
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../services/firebase';
import {
	collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp,
	orderBy, limit, deleteDoc, getDoc, setDoc, where, getDocs
} from 'firebase/firestore';

import { useOwner } from '../hooks/useOwner';

const AdminSettings = () => {
	const { theme, toggleTheme } = useTheme();
	const owner = useOwner();
	const navigate = useNavigate();
	const { search } = useLocation();
	const [activeTab, setActiveTab] = useState('general');
	const [loading, setLoading] = useState(false);

	// General Settings State
	const [companyInfo, setCompanyInfo] = useState({
		name: '',
		address: '',
		phone: '',
		email: '',
		taxCode: '',
		logoUrl: '',
		defaultVat: 10,
		spreadsheetId: '',
		spreadsheetUrl: '',
		manualLockSheets: false,
		lastSyncAt: null as any
	});
	const [syncing, setSyncing] = useState(false);
	const [syncRange, setSyncRange] = useState({
		start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
		end: new Date().toISOString().split('T')[0]
	});
	const [systemConfig, setSystemConfig] = useState<any>({ lock_free_sheets: false });

	// User Management
	const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
	const [pendingInvites, setPendingInvites] = useState<any[]>([]);
	const [showAddUser, setShowAddUser] = useState(false);
	const [newUser, setNewUser] = useState({ email: '', role: 'sale', displayName: '' });

	// Derived User List (Active + Pending)
	const userList = [
		...activeEmployees,
		...pendingInvites.filter(p => !activeEmployees.some(u => u.email === p.email))
	];

	// Audit Logs State
	const [logs, setLogs] = useState<any[]>([]);

	useEffect(() => {
		if (owner.loading || !owner.ownerId) return;

		// Fetch Settings
		const fetchSettings = async () => {
			const docRef = doc(db, 'settings', owner.ownerId);
			const docSnap = await getDoc(docRef);
			if (docSnap.exists()) {
				setCompanyInfo(docSnap.data() as any);
			}
		};
		fetchSettings();

		// 1. Listen to Active Users
		const qUsers = query(collection(db, 'users'), where('ownerId', '==', owner.ownerId));
		const unsubUsers = onSnapshot(qUsers, (snap) => {
			const users = snap.docs.map(d => ({ id: d.id, ...d.data(), status: 'active' })) as any[];
			setActiveEmployees(users.filter(u => u.uid !== owner.ownerId));
		});

		// 2. Listen to Pending Invites
		const qPerms = query(collection(db, 'permissions'), where('ownerId', '==', owner.ownerId));
		const unsubPerms = onSnapshot(qPerms, (snap) => {
			const invites = snap.docs.map(d => ({
				id: d.id,
				...d.data(),
				displayName: d.data().email,
				status: 'pending'
			}));
			setPendingInvites(invites);
		});

		// Listen to Logs
		const qLogs = query(collection(db, 'audit_logs'), where('ownerId', '==', owner.ownerId));
		const unsubLogs = onSnapshot(qLogs, (snap) => {
			const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			const sorted = data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
			setLogs(sorted.slice(0, 50));
		});

		// 3. Listen to System Config
		const unsubConfig = onSnapshot(doc(db, 'system_config', 'main'), (snap) => {
			if (snap.exists()) {
				setSystemConfig(snap.data());
			}
		});

		return () => {
			unsubUsers();
			unsubPerms();
			unsubLogs();
			unsubConfig();
		};
	}, [owner.loading, owner.ownerId]);

	useEffect(() => {
		const params = new URLSearchParams(search);
		const tab = params.get('tab');
		if (tab) {
			setActiveTab(tab);
		}
	}, [search]);

	const handleSaveSettings = async () => {
		if (!owner.ownerId) return;
		setLoading(true);
		try {
			await setDoc(doc(db, 'settings', owner.ownerId), {
				...companyInfo,
				updatedAt: serverTimestamp(),
				updatedBy: auth.currentUser?.uid
			}, { merge: true });
			alert("Đã lưu cấu hình thành công!");
		} catch (error) {
			alert("Lỗi khi lưu cấu hình");
		} finally {
			setLoading(false);
		}
	};

	const handleAddUser = async () => {
		if (!newUser.email) return alert("Vui lòng nhập email");
		setLoading(true);
		try {
			await setDoc(doc(db, 'permissions', newUser.email), {
				email: newUser.email,
				role: newUser.role,
				ownerId: owner.ownerId,
				ownerEmail: owner.ownerEmail,
				createdAt: serverTimestamp(),
				inviterName: auth.currentUser?.displayName || auth.currentUser?.email,
				accessRights: {
					dashboard: true,
					orders_view: true,
					orders_create: true,
					checkin_create: true,
					inventory_view: true,
					inventory_manage: true,
					customers_manage: true,
					debts_manage: true
				}
			});

			await addDoc(collection(db, 'audit_logs'), {
				action: 'Mời nhân viên mới',
				user: auth.currentUser?.displayName || auth.currentUser?.email,
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã cấp quyền cho email ${newUser.email} - Quyền: ${newUser.role}`,
				createdAt: serverTimestamp()
			});

			setShowAddUser(false);
			setNewUser({ email: '', role: 'sale', displayName: '' });
			alert(`Đã thêm quyền truy cập cho ${newUser.email}`);
		} catch (error) {
			alert("Lỗi khi thêm nhân viên");
		} finally {
			setLoading(false);
		}
	};

	const updateUserRole = async (user: any, newRole: string) => {
		try {
			if (user.status === 'pending') {
				await updateDoc(doc(db, 'permissions', user.id), { role: newRole });
			} else {
				await updateDoc(doc(db, 'users', user.id), { role: newRole });
			}
		} catch (error) { }
	};

	const deleteUser = async (user: any) => {
		if (!window.confirm(`Bạn có chắc muốn xóa nhân viên ${user.email}?`)) return;
		try {
			if (user.status === 'pending') {
				await deleteDoc(doc(db, 'permissions', user.id));
			} else {
				await deleteDoc(doc(db, 'users', user.id));
			}
		} catch (error) { }
	};

	const handleSheetSync = async () => {
		if (!owner.ownerId || !owner.ownerEmail) return;

		const isLocked = (systemConfig.lock_free_sheets && !owner.isPro) || companyInfo.manualLockSheets;
		if (isLocked) {
			alert("Tính năng này đã bị khóa bởi hệ thống hoặc quản trị viên.");
			return;
		}

		setSyncing(true);
		try {
			const startTimestamp = new Date(syncRange.start + 'T00:00:00');
			const endTimestamp = new Date(syncRange.end + 'T23:59:59');

			const [prodSnap, custSnap, orderSnap] = await Promise.all([
				getDocs(query(collection(db, 'products'), where('ownerId', '==', owner.ownerId))),
				getDocs(query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId))),
				getDocs(query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId)))
			]);

			const syncOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((o: any) => {
				if (!o.createdAt) return false;
				const createdDate = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
				return createdDate >= startTimestamp && createdDate <= endTimestamp;
			});

			const orderDetails: any[] = [];
			syncOrders.forEach((order: any) => {
				if (Array.isArray(order.items)) {
					order.items.forEach((item: any) => {
						orderDetails.push({
							orderId: order.id,
							orderDate: order.orderDate,
							customerName: order.customerName,
							productName: item.name,
							qty: item.qty,
							price: item.price,
							unit: item.unit,
							total: (item.qty || 0) * (item.price || 0),
							category: item.category,
							packaging: item.packaging
						});
					});
				}
			});

			const dataToSync = {
				products: prodSnap.docs.map(d => ({ id: d.id, ...d.data() })),
				customers: custSnap.docs.map(d => ({ id: d.id, ...d.data() })),
				orders: syncOrders,
				orderDetails: orderDetails
			};

			const response = await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
				method: 'POST',
				body: JSON.stringify({
					action: 'sync_to_sheets',
					ownerEmail: owner.ownerEmail,
					spreadsheetId: companyInfo.spreadsheetId || '',
					data: dataToSync
				})
			});

			const result = await response.json();
			if (result.status === 'success') {
				await updateDoc(doc(db, 'settings', owner.ownerId), {
					spreadsheetId: result.spreadsheetId,
					spreadsheetUrl: result.spreadsheetUrl,
					lastSyncAt: serverTimestamp()
				});

				setCompanyInfo(prev => ({
					...prev,
					spreadsheetId: result.spreadsheetId,
					spreadsheetUrl: result.spreadsheetUrl,
					lastSyncAt: { seconds: Math.floor(Date.now() / 1000) }
				}));

				alert("Đồng bộ dữ liệu thành công!");
			} else {
				throw new Error(result.message);
			}
		} catch (error: any) {
			alert("Lỗi đồng bộ: " + error.message);
		} finally {
			setSyncing(false);
		}
	};

	const handleTogglePermission = async (user: any, resource: string) => {
		const currentVal = user.accessRights?.[resource] ?? true;
		const newVal = !currentVal;
		const collectionName = user.status === 'pending' ? 'permissions' : 'users';
		try {
			await updateDoc(doc(db, collectionName, user.id), {
				[`accessRights.${resource}`]: newVal
			});
		} catch (error) { }
	};

	if (owner.loading) return null;
	if (owner.role !== 'admin') return <div className="p-10 text-center uppercase font-black">Truy cập bị từ chối</div>;

	const isSyncLocked = (systemConfig.lock_free_sheets && !owner.isPro) || companyInfo.manualLockSheets;

	return (
		<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 transition-colors duration-300">
			<header className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between px-4 md:px-8 shrink-0">
				<div className="flex items-center gap-4 py-2 md:py-0">
					<h2 className="text-[#1A237E] dark:text-indigo-400 text-lg md:text-2xl font-black uppercase tracking-tight">Quản Trị Hệ Thống</h2>
				</div>
				<nav className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar py-2">
					<TabItem active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={<Settings size={18} />} label="Cấu hình" />
					<TabItem active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={18} />} label="Nhân sự" />
					<TabItem active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} icon={<Shield size={18} />} label="Phân quyền" />
					<TabItem active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<Activity size={18} />} label="Nhật ký" />
				</nav>
			</header>

			<div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
				<div className="max-w-6xl mx-auto">
					{activeTab === 'general' && (
						<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
							<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-4 mb-6">
									<div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-blue-600 dark:text-blue-400">
										<Globe size={24} />
									</div>
									<div>
										<h3 className="text-xl font-bold dark:text-white">Thông tin Doanh nghiệp</h3>
										<p className="text-sm text-slate-500 dark:text-slate-400">Hiển thị trên phiếu in và hóa đơn.</p>
									</div>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<InputSection label="Tên Công Ty" value={companyInfo.name} onChange={(v: string) => setCompanyInfo({ ...companyInfo, name: v })} />
									<InputSection label="Mã số thuế" value={companyInfo.taxCode} onChange={(v: string) => setCompanyInfo({ ...companyInfo, taxCode: v })} />
									<InputSection label="Địa chỉ" value={companyInfo.address} onChange={(v: string) => setCompanyInfo({ ...companyInfo, address: v })} fullWidth />
									<InputSection label="Hotline" value={companyInfo.phone} onChange={(v: string) => setCompanyInfo({ ...companyInfo, phone: v })} />
									<InputSection label="Email" value={companyInfo.email} onChange={(v: string) => setCompanyInfo({ ...companyInfo, email: v })} />
								</div>
								<div className="mt-8 flex justify-end">
									<button onClick={handleSaveSettings} disabled={loading} className="flex items-center gap-2 bg-[#1A237E] dark:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50">
										<Save size={20} /> {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
									</button>
								</div>
							</div>

							<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-4 mb-6">
									<div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl text-emerald-600 dark:text-emerald-400">
										<FileText size={24} />
									</div>
									<div>
										<h3 className="text-xl font-bold dark:text-white">Sao lưu Google Sheets</h3>
										<p className="text-sm text-slate-500 dark:text-slate-400">Tự động đẩy toàn bộ dữ liệu từ Firestore về Google Sheets.</p>
									</div>
									{isSyncLocked && (
										<div className="ml-auto bg-rose-500/10 text-rose-500 px-3 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
											<Lock size={14} />
											<span className="text-[10px] font-black">BỊ KHÓA</span>
										</div>
									)}
								</div>

								<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
									{companyInfo.spreadsheetUrl ? (
										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div className="size-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center text-green-600 dark:text-green-400">
														<Database size={20} />
													</div>
													<div>
														<p className="text-xs font-black text-slate-400 uppercase tracking-widest">File liên kết</p>
														<a href={companyInfo.spreadsheetUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1">Mở Sheets <ExternalLink size={12} /></a>
													</div>
												</div>
												<div className="text-right">
													<p className="text-[10px] font-black text-slate-400">ID: {companyInfo.spreadsheetId?.slice(0, 8)}...</p>
													<p className="text-[10px] font-bold text-emerald-500">Cập nhật: {companyInfo.lastSyncAt ? new Date(companyInfo.lastSyncAt.seconds * 1000).toLocaleDateString() : 'Never'}</p>
												</div>
											</div>

											<div className="grid grid-cols-2 gap-4 pt-2">
												<div className="space-y-1">
													<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Từ ngày</label>
													<input
														type="date"
														className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-green-500/20"
														value={syncRange.start}
														onChange={(e) => setSyncRange({ ...syncRange, start: e.target.value })}
													/>
												</div>
												<div className="space-y-1">
													<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đến ngày</label>
													<input
														type="date"
														className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-green-500/20"
														value={syncRange.end}
														onChange={(e) => setSyncRange({ ...syncRange, end: e.target.value })}
													/>
												</div>
											</div>
											<button onClick={handleSheetSync} disabled={syncing || isSyncLocked} className="w-full bg-[#1A237E] dark:bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 enabled:hover:bg-blue-800 transition-all disabled:opacity-50">
												{syncing ? <><RefreshCcw size={18} className="animate-spin" /> Đang đồng bộ...</> : isSyncLocked ? <><Lock size={18} /> TÍNH NĂNG ĐÃ BỊ KHÓA</> : <><Rocket size={18} /> CẬP NHẬT DỮ LIỆU NGAY</>}
											</button>
										</div>
									) : (
										<div className="text-center py-6">
											<p className="text-slate-500 text-sm mb-6">Bạn chưa tạo file sao lưu. Hệ thống sẽ tự động khởi tạo file mới cho bạn.</p>
											<button onClick={handleSheetSync} disabled={syncing || isSyncLocked} className="bg-[#00a859] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto">
												{syncing ? <><RefreshCcw size={20} className="animate-spin" /> Đang thiết lập...</> : isSyncLocked ? <><Lock size={20} /> TÍNH NĂNG ĐÃ BỊ KHÓA</> : <><Plus size={20} /> KHỞI TẠO FILE SAO LƯU</>}
											</button>
										</div>
									)}
								</div>
							</div>

							<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-4 mb-6">
									<div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl text-amber-600 dark:text-amber-400">
										<Crown size={24} />
									</div>
									<div>
										<h3 className="text-xl font-bold dark:text-white">Gói Dịch Vụ</h3>
									</div>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl flex items-center gap-4">
										<div className={`p-3 rounded-xl ${owner.isPro ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{owner.isPro ? <CheckCircle /> : <XCircle />}</div>
										<div>
											<p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loại tài khoản</p>
											<p className="text-lg font-black text-slate-800 dark:text-white uppercase">{owner.isPro ? 'Premium Pro' : 'Free Trial'}</p>
										</div>
									</div>
									<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl flex items-center gap-4">
										<div className="p-3 rounded-xl bg-blue-50 text-blue-600"><Clock /></div>
										<div>
											<p className="text-xs font-black text-slate-400 uppercase tracking-widest">Thời gian còn lại</p>
											<p className="text-lg font-black text-slate-800 dark:text-white">{owner.subscriptionStatus === 'active' ? 'Vô thời hạn' : 'Dùng thử'}</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'users' && <UserManagement userList={userList} onAdd={() => setShowAddUser(true)} onUpdateRole={updateUserRole} onDelete={deleteUser} showAdd={showAddUser} onShowAdd={setShowAddUser} newUser={newUser} setNewUser={setNewUser} handleAddUser={handleAddUser} />}

					{activeTab === 'permissions' && (
						<div className="space-y-6">
							<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-x-auto">
								<table className="w-full text-left min-w-[1000px]">
									<thead>
										<tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
											<th className="px-6 py-4">Nhân viên</th>
											{['Dashboard', 'Xem Đơn', 'Lên Đơn', 'Check-in', 'Xem Kho', 'Quản SP', 'Khách hàng', 'Thu Nợ'].map(h => <th key={h} className="px-2 py-4 text-center">{h}</th>)}
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
										{userList.map(u => (
											<tr key={u.id}>
												<td className="px-6 py-4 font-bold text-sm text-slate-700 dark:text-white">{u.displayName || u.email}</td>
												{['dashboard', 'orders_view', 'orders_create', 'checkin_create', 'inventory_view', 'inventory_manage', 'customers_manage', 'debts_manage'].map(p => (
													<td key={p} className="px-2 py-4">
														<div onClick={() => handleTogglePermission(u, p)} className={`w-10 h-5 rounded-full p-0.5 cursor-pointer mx-auto transition-colors ${u.accessRights?.[p] ?? true ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
															<div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${u.accessRights?.[p] ?? true ? 'translate-x-5' : 'translate-x-0'}`} />
														</div>
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{activeTab === 'audit' && (
						<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
							<div className="p-6 border-b border-slate-50 dark:border-slate-800">
								<h3 className="font-bold dark:text-white">Nhật ký hoạt động hệ thống</h3>
							</div>
							<div className="divide-y divide-slate-50 dark:divide-slate-800 overflow-y-auto max-h-[600px]">
								{logs.map(log => (
									<div key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
										<div className="flex justify-between items-start mb-1">
											<span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{log.action}</span>
											<span className="text-[10px] text-slate-400 font-bold">{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Just now'}</span>
										</div>
										<p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{log.details}</p>
										<p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-tighter">Thực hiện bởi: {log.user}</p>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const TabItem = ({ active, onClick, icon, label }: any) => (
	<button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
		{icon} <span>{label}</span>
	</button>
);

const InputSection = ({ label, value, onChange, fullWidth = false, type = 'text' }: any) => (
	<div className={`space-y-2 ${fullWidth ? 'md:col-span-2' : ''}`}>
		<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
		<input type={type} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={value} onChange={e => onChange(e.target.value)} />
	</div>
);

const UserManagement = ({ userList, showAdd, onShowAdd, newUser, setNewUser, handleAddUser, onUpdateRole, onDelete }: any) => (
	<div className="space-y-6">
		<div className="flex justify-between items-center">
			<h2 className="text-xl font-black uppercase text-slate-800 dark:text-white tracking-tight">Danh sách nhân sự</h2>
			<button onClick={() => onShowAdd(true)} className="flex items-center gap-2 bg-[#FF6D00] text-white px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"><Plus size={16} /> Thêm nhân viên</button>
		</div>
		{showAdd && (
			<div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
				<h3 className="font-bold text-lg mb-4 dark:text-white">Mời nhân viên mới</h3>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<input type="text" placeholder="Tên hiển thị" className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white" value={newUser.displayName} onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} />
					<input type="email" placeholder="Email Google" className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
					<select className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
						<option value="sale">Nhân viên Sale</option>
						<option value="warehouse">Thủ kho</option>
						<option value="accountant">Kế toán</option>
						<option value="admin">Quản trị viên</option>
					</select>
				</div>
				<div className="flex justify-end gap-3 mt-4">
					<button onClick={() => onShowAdd(false)} className="px-4 py-2 text-slate-500 font-bold text-sm">Hủy</button>
					<button onClick={handleAddUser} className="px-4 py-2 bg-indigo-600 text-white font-bold text-sm rounded-lg">Gửi lời mời</button>
				</div>
			</div>
		)}
		<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
			<table className="w-full text-left">
				<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
					<tr><th className="px-6 py-4">Họ tên</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Vai trò</th><th className="px-6 py-4">Trạng thái</th><th className="px-6 py-4 text-right">#</th></tr>
				</thead>
				<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
					{userList.map((user: any) => (
						<tr key={user.id}>
							<td className="px-6 py-4 font-bold text-sm dark:text-white">{user.displayName || 'Guest'}</td>
							<td className="px-6 py-4 text-sm text-slate-500">{user.email}</td>
							<td className="px-6 py-4">
								<select className="bg-transparent border-none text-xs font-bold outline-none cursor-pointer dark:text-white" value={user.role || 'sale'} onChange={e => onUpdateRole(user, e.target.value)}>
									<option value="sale">Sale</option>
									<option value="warehouse">Kho</option>
									<option value="accountant">Kế toán</option>
									<option value="admin">Admin</option>
								</select>
							</td>
							<td className="px-6 py-4">
								<span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${user.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{user.status}</span>
							</td>
							<td className="px-6 py-4 text-right">
								<button onClick={() => onDelete(user)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	</div>
);

export default AdminSettings;
