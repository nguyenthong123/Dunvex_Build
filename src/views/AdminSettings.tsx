import React, { useState, useEffect } from 'react';
import { Settings, User, Bell, Shield, Database, Globe, Moon, Sun, Users, Activity, FileText, Save, Plus, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, orderBy, limit, deleteDoc, getDoc, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

import { useOwner } from '../hooks/useOwner';

const AdminSettings = () => {
	const { theme, toggleTheme } = useTheme();
	const owner = useOwner();
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
		defaultVat: 10
	});

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
			// Filter out the owner themselves
			setActiveEmployees(users.filter(u => u.uid !== owner.ownerId));
		});

		// 2. Listen to Pending Invites (Permissions)
		const qPerms = query(collection(db, 'permissions'), where('ownerId', '==', owner.ownerId));
		const unsubPerms = onSnapshot(qPerms, (snap) => {
			const invites = snap.docs.map(d => ({
				id: d.id, // email is the id for permissions
				...d.data(),
				displayName: d.data().email, // Use email as name for pending
				status: 'pending'
			}));
			setPendingInvites(invites);
		});

		// Listen to Logs
		const qLogs = query(
			collection(db, 'audit_logs'),
			where('ownerId', '==', owner.ownerId),
			orderBy('createdAt', 'desc'),
			limit(50)
		);
		const unsubLogs = onSnapshot(qLogs, (snap) => {
			setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		return () => {
			unsubUsers();
			unsubPerms();
			unsubLogs();
		};
	}, [owner.loading, owner.ownerId]);

	const handleSaveSettings = async () => {
		if (!owner.ownerId) return;
		setLoading(true);
		try {
			await setDoc(doc(db, 'settings', owner.ownerId), {
				...companyInfo,
				updatedAt: serverTimestamp(),
				updatedBy: auth.currentUser?.uid
			}, { merge: true }); // Merge to avoid overwriting other fields if any
			alert("Đã lưu cấu hình thành công!");
		} catch (error) {
			console.error("Error saving settings:", error);
			alert("Lỗi khi lưu cấu hình");
		} finally {
			setLoading(false);
		}
	};

	const handleAddUser = async () => {
		if (!newUser.email) return alert("Vui lòng nhập email");
		setLoading(true);
		try {
			// 1. Create Permission/Invite Doc
			await setDoc(doc(db, 'permissions', newUser.email), {
				email: newUser.email,
				role: newUser.role,
				ownerId: owner.ownerId,
				ownerEmail: owner.ownerEmail,
				createdAt: serverTimestamp(),
				inviterName: auth.currentUser?.displayName || auth.currentUser?.email
			});

			// 2. Log
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Mời nhân viên mới',
				user: auth.currentUser?.displayName || auth.currentUser?.email,
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId, // Log for owner
				details: `Đã cấp quyền cho email ${newUser.email} - Quyền: ${newUser.role}`,
				createdAt: serverTimestamp()
			});

			// 3. Send Email Notification (via Google Apps Script)
			try {
				await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
					method: 'POST',
					body: JSON.stringify({
						action: 'invite_user',
						email: newUser.email,
						role: newUser.role,
						inviterName: auth.currentUser?.displayName || 'Quản Trị Viên'
					})
				});
			} catch (emailErr) {
				console.error("Failed to send invite email:", emailErr);
			}

			setShowAddUser(false);
			setNewUser({ email: '', role: 'sale', displayName: '' });
			alert(`Đã thêm quyền truy cập và gửi email mời cho ${newUser.email}`);
		} catch (error) {
			console.error("Error adding user:", error);
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

			await addDoc(collection(db, 'audit_logs'), {
				action: 'Cập nhật quyền nhân viên',
				user: auth.currentUser?.displayName,
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã đổi quyền user ${user.email} thành ${newRole}`,
				createdAt: serverTimestamp()
			});
		} catch (error) {
			console.error("Error updating role:", error);
		}
	};

	const deleteUser = async (user: any) => {
		if (!window.confirm(`Bạn có chắc muốn xóa nhân viên ${user.email}?`)) return;
		try {
			if (user.status === 'pending') {
				await deleteDoc(doc(db, 'permissions', user.id));
			} else {
				await deleteDoc(doc(db, 'users', user.id));
			}

			await addDoc(collection(db, 'audit_logs'), {
				action: 'Xóa nhân viên',
				user: auth.currentUser?.displayName,
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã xóa nhân viên ${user.email}`,
				createdAt: serverTimestamp()
			});
		} catch (error) {
			console.error("Error deleting user:", error);
		}
	};


	const handleTogglePermission = async (user: any, resource: string) => {
		const currentVal = user.accessRights?.[resource] ?? true; // Default access is TRUE
		const newVal = !currentVal;
		const collectionName = user.status === 'pending' ? 'permissions' : 'users';

		try {
			await updateDoc(doc(db, collectionName, user.id), {
				[`accessRights.${resource}`]: newVal
			});
		} catch (error) {
			console.error("Error toggling permission:", error);
			alert("Không thể cập nhật quyền hạn.");
		}
	};

	if (owner.loading) return null;

	if (owner.role !== 'admin') {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center text-center p-8">
				<div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-full text-red-500 mb-4">
					<Shield size={48} />
				</div>
				<h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">Quyền truy cập bị từ chối</h2>
				<p className="text-slate-500 dark:text-slate-400 max-w-md">
					Bạn không có quyền truy cập vào trang quản trị hệ thống. Vui lòng liên hệ với người quản lý của bạn.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 transition-colors duration-300">
			{/* HEADER */}
			<header className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300">
				<div className="flex items-center gap-4">
					<h2 className="text-[#1A237E] dark:text-indigo-400 text-lg md:text-2xl font-black uppercase tracking-tight">Quản Trị Doanh Nghiệp</h2>
				</div>
			</header>

			<div className="flex flex-1 overflow-hidden">
				{/* SIDEBAR TABS */}
				<div className="w-20 md:w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col py-6 gap-2">
					<TabItem
						active={activeTab === 'general'}
						onClick={() => setActiveTab('general')}
						icon={<Settings size={20} />}
						label="Cấu hình chung"
					/>
					<TabItem
						active={activeTab === 'users'}
						onClick={() => setActiveTab('users')}
						icon={<Users size={20} />}
						label="Quản lý Nhân sự"
					/>
					<TabItem
						active={activeTab === 'permissions'}
						onClick={() => setActiveTab('permissions')}
						icon={<Shield size={20} />}
						label="Phân quyền Truy cập"
					/>
					<TabItem
						active={activeTab === 'audit'}
						onClick={() => setActiveTab('audit')}
						icon={<Activity size={20} />}
						label="Nhật ký Hoạt động"
					/>
					<div className="mt-auto px-4">
						<div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl cursor-pointer" onClick={toggleTheme}>
							<div className="flex items-center gap-3">
								{theme === 'dark' ? <Sun className="text-yellow-500" size={20} /> : <Moon className="text-slate-500" size={20} />}
								<span className="hidden md:block text-sm font-bold text-slate-600 dark:text-slate-300">
									{theme === 'dark' ? 'Giao diện Sáng' : 'Giao diện Tối'}
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* CONTENT AREA */}
				<div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
					<div className="max-w-5xl mx-auto">

						{/* --- TAB: GENERAL SETTINGS --- */}
						{activeTab === 'general' && (
							<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
									<div className="flex items-center gap-4 mb-6">
										<div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-blue-600 dark:text-blue-400">
											<Globe size={24} />
										</div>
										<div>
											<h3 className="text-xl font-bold dark:text-white">Thông tin Doanh nghiệp</h3>
											<p className="text-sm text-slate-500 dark:text-slate-400">Thông tin này sẽ hiển thị trên phiếu in và hóa đơn.</p>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
										<div className="space-y-2">
											<label className="text-xs font-bold text-slate-500 uppercase">Tên Công Ty / Cửa Hàng</label>
											<input
												type="text"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-white"
												placeholder="VD: Cửa Hàng VLXD Dunvex"
												value={companyInfo.name}
												onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
											/>
										</div>
										<div className="space-y-2">
											<label className="text-xs font-bold text-slate-500 uppercase">Mã số thuế</label>
											<input
												type="text"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-white"
												placeholder="VD: 0312345678"
												value={companyInfo.taxCode}
												onChange={(e) => setCompanyInfo({ ...companyInfo, taxCode: e.target.value })}
											/>
										</div>
										<div className="space-y-2 md:col-span-2">
											<label className="text-xs font-bold text-slate-500 uppercase">Địa chỉ trụ sở</label>
											<input
												type="text"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-white"
												placeholder="VD: 123 Đường ABC, Quận 1, TP.HCM"
												value={companyInfo.address}
												onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
											/>
										</div>
										<div className="space-y-2">
											<label className="text-xs font-bold text-slate-500 uppercase">Số điện thoại hotline</label>
											<input
												type="text"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-white"
												placeholder="VD: 0909 123 456"
												value={companyInfo.phone}
												onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
											/>
										</div>
										<div className="space-y-2">
											<label className="text-xs font-bold text-slate-500 uppercase">Email liên hệ</label>
											<input
												type="email"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-white"
												placeholder="VD: contact@dunvex.com"
												value={companyInfo.email}
												onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
											/>
										</div>
										<div className="space-y-2">
											<label className="text-xs font-bold text-slate-500 uppercase">Logo URL</label>
											<input
												type="text"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-white"
												placeholder="https://..."
												value={companyInfo.logoUrl}
												onChange={(e) => setCompanyInfo({ ...companyInfo, logoUrl: e.target.value })}
											/>
										</div>
										<div className="space-y-2">
											<label className="text-xs font-bold text-slate-500 uppercase">VAT Mặc định (%)</label>
											<input
												type="number"
												className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-white"
												value={companyInfo.defaultVat}
												onChange={(e) => setCompanyInfo({ ...companyInfo, defaultVat: Number(e.target.value) })}
											/>
										</div>
									</div>

									<div className="mt-8 flex justify-end">
										<button
											onClick={handleSaveSettings}
											disabled={loading}
											className="flex items-center gap-2 bg-[#1A237E] dark:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-[#0D47A1] transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50"
										>
											<Save size={20} />
											{loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
										</button>
									</div>
								</div>
							</div>
						)}

						{/* --- TAB: USER MANAGEMENT --- */}
						{activeTab === 'users' && (
							<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div className="flex justify-between items-center">
									<h2 className="text-xl font-black uppercase text-slate-800 dark:text-white tracking-tight">Danh sách nhân viên</h2>
									<button
										onClick={() => setShowAddUser(true)}
										className="flex items-center gap-2 bg-[#FF6D00] text-white px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
									>
										<Plus size={16} /> Thêm nhân viên
									</button>
								</div>

								{showAddUser && (
									<div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
										<h3 className="font-bold text-lg mb-4 dark:text-white">Thêm nhân viên mới</h3>
										<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
											<input
												type="text"
												placeholder="Tên hiển thị"
												className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white"
												value={newUser.displayName}
												onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
											/>
											<input
												type="email"
												placeholder="Email đăng nhập (Google)"
												className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white"
												value={newUser.email}
												onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
											/>
											<select
												className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white"
												value={newUser.role}
												onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
											>
												<option value="sale">Nhân viên Sale</option>
												<option value="warehouse">Thủ kho</option>
												<option value="accountant">Kế toán</option>
												<option value="admin">Quản trị viên (Admin)</option>
											</select>
										</div>
										<div className="flex justify-end gap-3 mt-4">
											<button onClick={() => setShowAddUser(false)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Hủy</button>
											<button onClick={handleAddUser} className="px-4 py-2 bg-[#1A237E] text-white font-bold text-sm rounded-lg hover:bg-[#0D47A1]">Xác nhận</button>
										</div>
									</div>
								)}

								<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
									<table className="w-full text-left">
										<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
											<tr>
												<th className="px-6 py-4">Nhân viên</th>
												<th className="px-6 py-4">Email</th>
												<th className="px-6 py-4">Vai trò</th>
												<th className="px-6 py-4">Trạng thái</th>
												<th className="px-6 py-4 text-right">Hành động</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
											{userList.map((user) => (
												<tr key={user.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
													<td className="px-6 py-4">
														<div className="flex items-center gap-3">
															<div className="size-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-600">
																{user.displayName?.[0] || 'U'}
															</div>
															<span className="font-bold text-sm text-slate-700 dark:text-white">{user.displayName || 'Unnamed'}</span>
														</div>
													</td>
													<td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">{user.email}</td>
													<td className="px-6 py-4">
														<select
															className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-xs font-bold px-2 py-1 outline-none cursor-pointer hover:bg-slate-200 dark:text-white"
															value={user.role || 'sale'}
															onChange={(e) => updateUserRole(user, e.target.value)}
														>
															<option value="sale">Sale</option>
															<option value="warehouse">Kho</option>
															<option value="accountant">Kế toán</option>
															<option value="admin">Admin</option>
														</select>
													</td>
													<td className="px-6 py-4">
														<span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${user.status === 'banned' ? 'bg-red-100 text-red-600' :
															user.status === 'pending' ? 'bg-orange-100 text-orange-600' :
																'bg-green-100 text-green-600'
															}`}>
															{user.status === 'banned' ? 'Vô hiệu hóa' :
																user.status === 'pending' ? 'Đang chờ' :
																	'Hoạt động'}
														</span>
													</td>
													<td className="px-6 py-4 text-right">
														<button
															onClick={() => deleteUser(user)}
															className="text-slate-400 hover:text-red-500 transition-colors"
															title="Xóa nhân viên"
														>
															<Trash2 size={18} />
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}

						{/* --- TAB: PERMISSIONS --- */}
						{activeTab === 'permissions' && (
							<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div className="flex justify-between items-center mb-6">
									<div>
										<h2 className="text-xl font-black uppercase text-slate-800 dark:text-white tracking-tight">Phân quyền Truy cập</h2>
										<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Bật/tắt quyền truy cập các chức năng cho từng nhân viên.</p>
									</div>
								</div>

								<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden overflow-x-auto">
									<table className="w-full text-left min-w-[800px]">
										<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
											<tr>
												<th className="px-6 py-4 sticky left-0 bg-slate-50 dark:bg-slate-800/50 z-10 w-[30%]">Nhân viên</th>
												<th className="px-4 py-4 text-center w-[14%]">Tổng quan</th>
												<th className="px-4 py-4 text-center w-[14%]">Đơn hàng</th>
												<th className="px-4 py-4 text-center w-[14%]">Công nợ</th>
												<th className="px-4 py-4 text-center w-[14%]">Kho/SP</th>
												<th className="px-4 py-4 text-center w-[14%]">Khách hàng</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
											{userList.map((user) => (
												<tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
													<td className="px-6 py-4 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 transition-colors z-10 border-r border-slate-100 dark:border-slate-800">
														<div className="flex items-center gap-3">
															<div className="size-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-600 shrink-0">
																{user.displayName?.[0] || 'U'}
															</div>
															<div className="min-w-0">
																<p className="font-bold text-sm text-slate-700 dark:text-white truncate">{user.displayName || 'Unnamed'}</p>
																<p className="text-xs text-slate-500 truncate">{user.email}</p>
																<span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500">
																	{user.role}
																</span>
															</div>
														</div>
													</td>

													{['dashboard', 'orders', 'debts', 'inventory', 'customers'].map(metric => (
														<td key={metric} className="px-4 py-4 text-center align-middle">
															<div
																onClick={() => handleTogglePermission(user, metric)}
																className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 mx-auto ${(user.accessRights?.[metric] ?? true)
																		? 'bg-green-500'
																		: 'bg-slate-200 dark:bg-slate-700'
																	}`}
															>
																<div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${(user.accessRights?.[metric] ?? true)
																		? 'translate-x-6'
																		: 'translate-x-0'
																	}`} />
															</div>
														</td>
													))}
												</tr>
											))}
											{userList.length === 0 && (
												<tr>
													<td colSpan={6} className="py-12 text-center text-slate-400 text-xs font-bold uppercase">Chưa có nhân viên nào</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
							</div>
						)}

						{/* --- TAB: AUDIT LOGS --- */}
						{activeTab === 'audit' && (
							<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div className="flex justify-between items-center mb-6">
									<h2 className="text-xl font-black uppercase text-slate-800 dark:text-white tracking-tight">Nhật ký Hoạt động</h2>
									<div className="text-xs font-bold text-slate-400 uppercase">50 hoạt động gần nhất</div>
								</div>

								<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
									<table className="w-full text-left">
										<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
											<tr>
												<th className="px-6 py-4">Thời gian</th>
												<th className="px-6 py-4">Người thực hiện</th>
												<th className="px-6 py-4">Hành động</th>
												<th className="px-6 py-4">Chi tiết</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
											{logs.map((log) => (
												<tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
													<td className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
														{log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000).toLocaleString('vi-VN') : '---'}
													</td>
													<td className="px-6 py-4">
														<div className="flex items-center gap-2">
															<span className="font-bold text-sm text-[#1A237E] dark:text-indigo-400">{log.user || 'Unknown'}</span>
														</div>
													</td>
													<td className="px-6 py-4">
														<span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
															{log.action}
														</span>
													</td>
													<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate" title={log.details}>
														{log.details}
													</td>
												</tr>
											))}
											{logs.length === 0 && (
												<tr>
													<td colSpan={4} className="py-12 text-center text-slate-400 text-xs font-bold uppercase">Chưa có nhật ký nào</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
							</div>
						)}

					</div>
				</div>
			</div>
		</div>
	);
};

const TabItem = ({ active, onClick, icon, label }: any) => (
	<button
		onClick={onClick}
		className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-all font-bold text-sm group ${active
			? 'bg-[#1A237E] dark:bg-indigo-600 text-white shadow-lg shadow-blue-900/20'
			: 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
			}`}
	>
		<span className={active ? 'text-white' : 'text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'}>{icon}</span>
		<span className="hidden md:block">{label}</span>
	</button>
);

export default AdminSettings;
