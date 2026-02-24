import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate, useLocation } from 'react-router-dom';
import {
	Settings, User, Bell, Shield, Database, Globe, Moon, Sun, Users, Activity,
	FileText, Save, Plus, Trash2, Edit2, CheckCircle, XCircle, Crown, Clock,
	Rocket, Lock, RefreshCcw, ExternalLink, MapPin, Calendar, X,
	ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { auth, db, functions } from '../services/firebase';
import {
	collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp,
	orderBy, limit, deleteDoc, getDoc, setDoc, where, getDocs
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';

const scrollbarHideStyle = `
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

const AdminSettings = () => {
	const { theme, toggleTheme } = useTheme();
	const owner = useOwner();
	const { showToast } = useToast();
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
		lastSyncAt: null as any,
		lat: 0,
		lng: 0,
		workStart: '08:00',
		workEnd: '17:30',
		geofenceRadius: 100,
		attendanceViewers: [] as string[],
		autoSyncSchedule: 'none'
	});
	const [syncing, setSyncing] = useState(false);
	const [syncRange, setSyncRange] = useState({
		start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
		end: new Date().toISOString().split('T')[0]
	});
	const [systemConfig, setSystemConfig] = useState<any>({ lock_free_sheets: false });
	const [exportLoading, setExportLoading] = useState(false);
	const [exportCount, setExportCount] = useState(0);

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

	// User Points for context (if needed)
	const [userPoints, setUserPoints] = useState(0);

	// Audit Logs & Attendance Logs & Field Checkins
	const [logs, setLogs] = useState<any[]>([]);
	const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
	const [fieldCheckins, setFieldCheckins] = useState<any[]>([]);

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
		const qLogs = query(collection(db, 'audit_logs'), where('ownerId', '==', owner.ownerId), orderBy('createdAt', 'desc'), limit(50));
		const unsubLogs = onSnapshot(qLogs, (snap) => {
			setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		// 3. Listen to System Config
		const unsubConfig = onSnapshot(doc(db, 'system_config', 'main'), (snap) => {
			if (snap.exists()) {
				setSystemConfig(snap.data());
			}
		});

		// Listen to Attendance Logs
		const qAtt = query(collection(db, 'attendance_logs'), where('ownerId', '==', owner.ownerId), orderBy('createdAt', 'desc'), limit(500));
		const unsubAtt = onSnapshot(qAtt, (snap) => {
			setAttendanceLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		// Listen to Field Checkins for Market Staff tracking
		const qField = query(collection(db, 'checkins'), where('ownerId', '==', owner.ownerId), orderBy('createdAt', 'desc'), limit(500));
		const unsubField = onSnapshot(qField, (snap) => {
			setFieldCheckins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		// 4. Listen to Export Usage
		const currentMonth = new Date().toISOString().slice(0, 7);
		const unsubUsage = onSnapshot(doc(db, 'usage_limits', `${owner.ownerId}_${currentMonth}`), (snap) => {
			if (snap.exists()) {
				setExportCount(snap.data().count || 0);
			} else {
				setExportCount(0);
			}
		});

		return () => {
			unsubUsers();
			unsubPerms();
			unsubLogs();
			unsubConfig();
			unsubAtt();
			unsubField();
			unsubUsage();
		};
	}, [owner.loading, owner.ownerId]);

	useEffect(() => {
		const params = new URLSearchParams(search);
		const tab = params.get('tab');
		if (tab) setActiveTab(tab);

		const action = params.get('action');
		if (action === 'add') {
			setActiveTab('users');
			setShowAddUser(true);
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
			showToast("Đã lưu cấu hình thành công!", "success");
		} catch (error) {
			showToast("Lỗi khi lưu cấu hình", "error");
		} finally {
			setLoading(false);
		}
	};

	const handleAddUser = async () => {
		if (!newUser.email) return showToast("Vui lòng nhập email", "warning");
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
			showToast(`Đã thêm quyền truy cập cho ${newUser.email}`, "success");
		} catch (error) {
			showToast("Lỗi khi thêm nhân viên", "error");
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
			showToast("Tính năng này đã bị khóa bởi hệ thống hoặc quản trị viên.", "warning");
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

			// Calculate stats for email notification
			const stats = syncOrders.reduce((acc: any, order: any) => {
				const email = order.createdByEmail || 'N/A';
				const name = order.createdByEmail?.split('@')[0] || 'Nhân viên';
				if (!acc[email]) acc[email] = { name, email, newCust: 0, orders: 0, revenue: 0 };
				acc[email].orders += 1;
				acc[email].revenue += (order.finalTotal || 0);
				return acc;
			}, {});

			// Count new customers in range
			custSnap.docs.forEach(d => {
				const c = d.data();
				if (!c.createdAt) return;
				const createdDate = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
				if (createdDate >= startTimestamp && createdDate <= endTimestamp) {
					const email = c.createdByEmail || 'N/A';
					if (stats[email]) stats[email].newCust += 1;
				}
			});

			const response = await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
				method: 'POST',
				body: JSON.stringify({
					action: 'sync_to_sheets',
					ownerEmail: owner.ownerEmail,
					spreadsheetId: companyInfo.spreadsheetId || '',
					data: dataToSync,
					syncRange: {
						start: syncRange.start,
						end: syncRange.end
					},
					stats: Object.values(stats)
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

				await addDoc(collection(db, 'notifications'), {
					userId: auth.currentUser?.uid,
					title: '📊 Đồng bộ thành công',
					message: `Toàn bộ dữ liệu từ ${syncRange.start} đến ${syncRange.end} đã được đẩy lên Google Sheets.`,
					body: `Toàn bộ dữ liệu từ ${syncRange.start} đến ${syncRange.end} đã được đẩy lên Google Sheets.`,
					type: 'auto_sync',
					read: false,
					createdAt: serverTimestamp()
				});

				showToast("Đồng bộ dữ liệu thành công!", "success");
			} else {
				throw new Error(result.message);
			}
		} catch (error: any) {
			showToast("Lỗi đồng bộ: " + error.message, "error");
		} finally {
			setSyncing(false);
		}
	};

	const handleExportData = async () => {
		if (!owner.ownerId) return;

		const isLocked = (systemConfig.lock_free_sheets && !owner.isPro) || companyInfo.manualLockSheets;
		if (isLocked) {
			showToast("Tính năng trích xuất dữ liệu đã bị khóa. Vui lòng nâng cấp Pro hoặc liên hệ Admin.", "warning");
			return;
		}

		if (exportCount >= 5) {
			showToast("Bạn đã hết lượt tải về trong tháng này.", "error");
			return;
		}

		setExportLoading(true);
		try {
			// 1. Prepare data containers
			const collections = ['products', 'customers', 'orders', 'debts', 'finance_transactions', 'checkins'];
			const workbook = XLSX.utils.book_new();

			// 2. Prepare Time Range
			const startTS = syncRange.start ? new Date(syncRange.start + 'T00:00:00') : null;
			const endTS = syncRange.end ? new Date(syncRange.end + 'T23:59:59') : null;

			// 3. Fetch and Process each collection
			const orderDetails: any[] = [];

			for (const colName of collections) {
				const q = query(collection(db, colName), where('ownerId', '==', owner.ownerId), limit(5000));
				const snap = await getDocs(q);

				let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

				// Apply date filtering client-side for transactional data
				if (['orders', 'debts', 'finance_transactions', 'checkins'].includes(colName) && startTS && endTS) {
					data = data.filter((item: any) => {
						if (!item.createdAt) return false;
						const itemDate = item.createdAt.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt);
						return itemDate >= startTS && itemDate <= endTS;
					});
				}

				if (data.length > 0) {
					// Special handling for orders: extract details
					if (colName === 'orders') {
						data.forEach((order: any) => {
							if (order.items && Array.isArray(order.items)) {
								order.items.forEach((item: any) => {
									orderDetails.push({
										orderId: order.id,
										orderDate: order.orderDate || (order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('vi-VN') : ''),
										customerName: order.customerName || '',
										customerBusiness: order.customerBusinessName || '',
										...item
									});
								});
							}
						});
					}

					// Format specific fields for readability in Excel
					const formattedData = data.map(item => {
						const newItem: any = { ...item };
						Object.keys(newItem).forEach(key => {
							const val = newItem[key];
							if (val && typeof val === 'object') {
								if (val.seconds) {
									// Firestore Timestamp
									newItem[key] = new Date(val.seconds * 1000).toLocaleString('vi-VN');
								} else {
									// Other objects/arrays - stringify to avoid [object Object]
									newItem[key] = JSON.stringify(val);
								}
							}
						});
						return newItem;
					});

					const worksheet = XLSX.utils.json_to_sheet(formattedData);
					XLSX.utils.book_append_sheet(workbook, worksheet, colName);
				}
			}

			// Add the specific details sheet if we have order items
			if (orderDetails.length > 0) {
				const detailsSheet = XLSX.utils.json_to_sheet(orderDetails);
				XLSX.utils.book_append_sheet(workbook, detailsSheet, 'order_details');
			}

			// 4. Download File
			XLSX.writeFile(workbook, `Dunvex_Export_${owner.ownerId}_${new Date().toISOString().slice(0, 10)}.xlsx`);

			// 5. Update Usage Count in Firestore
			const currentMonth = new Date().toISOString().slice(0, 7);
			const usageRef = doc(db, 'usage_limits', `${owner.ownerId}_${currentMonth}`);
			await setDoc(usageRef, {
				ownerId: owner.ownerId,
				count: exportCount + 1,
				lastExportAt: serverTimestamp(),
				lastExportBy: auth.currentUser?.email || 'Admin'
			}, { merge: true });

			// 6. Audit Log
			await addDoc(collection(db, 'audit_logs'), {
				action: 'Bộ lưu dữ liệu (Export - Client)',
				user: auth.currentUser?.email || 'Admin',
				userId: auth.currentUser?.uid,
				ownerId: owner.ownerId,
				details: `Đã xuất dữ liệu ra Excel (Lần thứ ${exportCount + 1} trong tháng)`,
				createdAt: serverTimestamp()
			});

			showToast("Tải dữ liệu thành công!", "success");
		} catch (error: any) {
			console.error("Export Error:", error);
			showToast("Lỗi khi trích xuất dữ liệu: " + (error.message || "Vui lòng thử lại sau"), "error");
		} finally {
			setExportLoading(false);
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

	const isAttendanceViewer = companyInfo.attendanceViewers?.includes(auth.currentUser?.email || '');

	useEffect(() => {
		if (isAttendanceViewer && !owner.role && activeTab !== 'attendance') {
			setActiveTab('attendance');
		}
	}, [isAttendanceViewer, activeTab]);

	if (owner.loading) return null;
	if (owner.role !== 'admin' && !isAttendanceViewer) return <div className="p-10 text-center uppercase font-black">Truy cập bị từ chối</div>;

	const isSyncLocked = (systemConfig.lock_free_sheets && !owner.isPro) || companyInfo.manualLockSheets;

	return (
		<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 transition-colors duration-300">
			<style>{scrollbarHideStyle}</style>
			<header className="min-h-[4rem] md:h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between px-4 md:px-8 shrink-0 py-2 md:py-0">
				<div className="flex items-center gap-4 py-1 md:py-0">
					<h2 className="text-[#1A237E] dark:text-indigo-400 text-lg md:text-2xl font-black uppercase tracking-tight">Quản Trị Hệ Thống</h2>
				</div>
				<nav className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar py-2 w-full md:w-auto">
					{owner.role === 'admin' && (
						<>
							<TabItem active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={<Settings size={18} />} label="Cấu hình" />
							<TabItem active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={18} />} label="Nhân sự" />
						</>
					)}
					<TabItem active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={<Calendar size={18} />} label="Chấm công" />
					{owner.role === 'admin' && (
						<>
							<TabItem active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} icon={<Shield size={18} />} label="Phân quyền" />
							<TabItem active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<Activity size={18} />} label="Nhật ký" />
						</>
					)}
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

									<div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-6">
										<h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Cấu hình Chấm công văn phòng</h4>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div className="space-y-2">
												<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vị trí Văn phòng (Lat, Lng)</label>
												<div className="flex gap-2">
													<input
														readOnly
														className="flex-1 bg-slate-100 dark:bg-slate-800/50 border-none rounded-xl px-4 py-3 text-xs font-bold dark:text-white"
														value={`${companyInfo.lat || 0}, ${companyInfo.lng || 0}`}
													/>
													<button
														onClick={() => {
															navigator.geolocation.getCurrentPosition(
																(pos) => setCompanyInfo({ ...companyInfo, lat: pos.coords.latitude, lng: pos.coords.longitude }),
																(err) => showToast("Không thể lấy vị trí: " + err.message, "error")
															);
														}}
														className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all shrink-0"
													>
														<MapPin size={20} />
													</button>
												</div>
											</div>
											<div className="grid grid-cols-3 gap-4">
												<InputSection label="Giờ bắt đầu" type="time" value={companyInfo.workStart} onChange={(v: string) => setCompanyInfo({ ...companyInfo, workStart: v })} />
												<InputSection label="Giờ kết thúc" type="time" value={companyInfo.workEnd} onChange={(v: string) => setCompanyInfo({ ...companyInfo, workEnd: v })} />
												<InputSection label="Bán kính (m)" type="number" value={companyInfo.geofenceRadius} onChange={(v: string) => setCompanyInfo({ ...companyInfo, geofenceRadius: Number(v) })} />
											</div>
										</div>
									</div>
								</div>
								<div className="mt-8 flex justify-end">
									<button onClick={handleSaveSettings} disabled={loading} className="flex items-center gap-2 bg-[#1A237E] dark:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50">
										<Save size={20} /> {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
									</button>
								</div>
							</div>

							<div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
								<div className="flex items-center gap-4 mb-6">
									<div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl text-indigo-600 dark:text-indigo-400">
										<Download size={24} />
									</div>
									<div>
										<h3 className="text-xl font-bold dark:text-white">Bộ lưu dữ liệu (Export)</h3>
										<p className="text-sm text-slate-500 dark:text-slate-400">Trích xuất dữ liệu tùy chọn theo mốc thời gian ra file Excel.</p>
									</div>
									<div className="ml-auto flex flex-col items-end">
										<span className={`text-[10px] font-black px-2 py-1 rounded-lg ${exportCount >= 5 ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
											SỬ DỤNG: {exportCount}/5 LẦN/THÁNG
										</span>
									</div>
									{isSyncLocked && (
										<div className="ml-auto bg-rose-500/10 text-rose-500 px-3 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
											<Lock size={14} />
											<span className="text-[10px] font-black">BỊ KHÓA</span>
										</div>
									)}
								</div>

								<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
										<div className="space-y-1">
											<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Từ ngày</label>
											<input
												type="date"
												className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
												value={syncRange.start}
												onChange={(e) => setSyncRange({ ...syncRange, start: e.target.value })}
											/>
										</div>
										<div className="space-y-1">
											<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đến ngày</label>
											<input
												type="date"
												className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
												value={syncRange.end}
												onChange={(e) => setSyncRange({ ...syncRange, end: e.target.value })}
											/>
										</div>
									</div>

									<div className="flex flex-col md:flex-row items-center gap-6">
										<div className="flex-1">
											<h4 className="font-bold text-slate-800 dark:text-white mb-2">Tải dữ liệu nâng cao</h4>
											<p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
												Hệ thống sẽ lọc dữ liệu (Đơn hàng, Công nợ, Checkin) theo khoảng thời gian bạn chọn và tạo file Excel trực tiếp.
												Hành động này giúp báo cáo gọn nhẹ và xử lý nhanh hơn. (Yêu cầu tài khoản PRO)
											</p>
										</div>
										<button
											onClick={handleExportData}
											disabled={exportLoading || exportCount >= 5 || isSyncLocked}
											className="w-full md:w-auto bg-[#1A237E] dark:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/10"
										>
											{exportLoading ? (
												<><RefreshCcw size={20} className="animate-spin" /> Đang xử lý...</>
											) : isSyncLocked ? (
												<><Lock size={20} /> ĐÃ BỊ KHÓA</>
											) : (
												<><Download size={20} /> Tải dữ liệu về</>
											)}
										</button>
									</div>
									{(exportCount >= 5 || isSyncLocked) && (
										<div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/10 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
											<Lock size={14} /> {isSyncLocked ? "Vui lòng nâng cấp lên gói PRO để sử dụng tính năng trích xuất dữ liệu." : `Bạn đã đạt giới hạn tải về trong tháng này. Lượt dùng: ${exportCount}/5.`}
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
											<p className="text-xs font-black text-slate-400 uppercase tracking-widest">Gói đăng ký</p>
											<p className="text-lg font-black text-slate-800 dark:text-white uppercase">
												{owner.planId === 'premium_yearly' ? 'Premium (1 Năm)' : owner.planId === 'premium_monthly' ? 'Premium (1 Tháng)' : owner.isPro ? 'Premium Pro' : 'Dùng thử'}
											</p>
										</div>
									</div>
									<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl flex items-center gap-4">
										<div className="p-3 rounded-xl bg-blue-50 text-blue-600"><Clock /></div>
										<div>
											<p className="text-xs font-black text-slate-400 uppercase tracking-widest">Thời gian còn lại</p>
											<p className="text-lg font-black text-slate-800 dark:text-white">
												{(() => {
													const expireAt = owner.subscriptionExpiresAt || owner.trialEndsAt;
													if (expireAt) {
														const days = Math.ceil((expireAt.toDate().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
														return days > 0 ? `${days} ngày` : 'Đã hết hạn';
													}
													return owner.subscriptionStatus === 'active' ? 'Vô thời hạn' : 'Hết hạn';
												})()}
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'users' && <UserManagement userList={userList} onAdd={() => setShowAddUser(true)} onUpdateRole={updateUserRole} onDelete={deleteUser} showAdd={showAddUser} onShowAdd={setShowAddUser} newUser={newUser} setNewUser={setNewUser} handleAddUser={handleAddUser} />}

					{activeTab === 'attendance' && <AttendanceAdmin logs={attendanceLogs} fieldLogs={fieldCheckins} companyInfo={companyInfo} setCompanyInfo={setCompanyInfo} onSave={handleSaveSettings} />}

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
								{logs.map((log: any) => (
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
	<button
		onClick={onClick}
		className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 whitespace-nowrap min-w-fit ${active
			? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none translate-y-[-1px]'
			: 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
			}`}
	>
		{icon}
		<span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{label}</span>
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

const AttendanceAdmin = ({ logs, fieldLogs, companyInfo, setCompanyInfo, onSave }: { logs: any[], fieldLogs: any[], companyInfo: any, setCompanyInfo: any, onSave: any }) => {
	const [viewerEmail, setViewerEmail] = useState('');
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const rowsPerPage = 10;

	// Aggregate data by User and Date
	const aggregatedData = useMemo(() => {
		const data: any = {};

		// 1. Process Office Logs & Requests
		logs.forEach(log => {
			const key = `${log.userEmail}_${log.date}`;
			if (!data[key]) data[key] = {
				userName: log.userName,
				userEmail: log.userEmail,
				date: log.date,
				officeIn: null,
				officeOut: null,
				fieldFirst: null,
				fieldLast: null,
				requests: [],
				status: 'on-time'
			};

			if (log.type === 'request') {
				data[key].requests.push(log);
			} else {
				if (log.checkInAt) data[key].officeIn = log.checkInAt;
				if (log.checkOutAt) data[key].officeOut = log.checkOutAt;
				if (log.status === 'late') data[key].status = 'late';
			}
		});

		// 2. Process Field Checkins
		fieldLogs.forEach(f => {
			const date = f.createdAt?.seconds ? new Date(f.createdAt.seconds * 1000).toISOString().split('T')[0] : '';
			if (!date) return;
			const key = `${f.userEmail}_${date}`;

			if (!data[key]) data[key] = {
				userName: f.userName || f.userEmail,
				userEmail: f.userEmail,
				date: date,
				officeIn: null,
				officeOut: null,
				fieldFirst: f.createdAt,
				fieldLast: f.createdAt,
				requests: [],
				status: 'field-trip'
			}; else {
				if (!data[key].fieldFirst || f.createdAt.seconds < data[key].fieldFirst.seconds) data[key].fieldFirst = f.createdAt;
				if (!data[key].fieldLast || f.createdAt.seconds > data[key].fieldLast.seconds) data[key].fieldLast = f.createdAt;
			}
		});

		const result = Object.values(data).sort((a: any, b: any) => b.date.localeCompare(a.date));

		// 3. Filter by Date Range
		return result.filter((item: any) => {
			if (startDate && item.date < startDate) return false;
			if (endDate && item.date > endDate) return false;
			return true;
		});
	}, [logs, fieldLogs, startDate, endDate]);

	const totalPages = Math.ceil(aggregatedData.length / rowsPerPage);
	const paginatedData = aggregatedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

	useEffect(() => {
		setCurrentPage(1);
	}, [startDate, endDate]);

	const addViewer = () => {
		if (!viewerEmail || !viewerEmail.includes('@')) return;
		const newList = [...(companyInfo.attendanceViewers || []), viewerEmail];
		setCompanyInfo({ ...companyInfo, attendanceViewers: newList });
		setViewerEmail('');
	};

	const removeViewer = (email: string) => {
		const newList = companyInfo.attendanceViewers.filter((e: string) => e !== email);
		setCompanyInfo({ ...companyInfo, attendanceViewers: newList });
	};

	return (
		<div className="space-y-6">
			{/* Sharing Header */}
			<div className="bg-white dark:bg-slate-900 rounded-[2rem] p-4 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<h3 className="font-bold dark:text-white uppercase text-[10px] md:text-sm tracking-widest flex items-center gap-2">
							<ExternalLink size={18} className="text-indigo-600" /> Chia sẻ bảng công
						</h3>
						<p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Cho phép Kế toán/Quản lý truy cập</p>
					</div>
					<div className="flex flex-col sm:flex-row gap-2">
						<input
							type="email"
							placeholder="Email người xem..."
							className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-xs font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500/20 flex-1 md:w-64"
							value={viewerEmail}
							onChange={(e) => setViewerEmail(e.target.value)}
						/>
						<div className="flex gap-2">
							<button onClick={addViewer} className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all">Thêm</button>
							<button onClick={onSave} className="flex-1 sm:flex-none bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all">Lưu</button>
						</div>
					</div>
				</div>
				{companyInfo.attendanceViewers?.length > 0 && (
					<div className="mt-4 flex flex-wrap gap-2">
						{companyInfo.attendanceViewers.map((email: string) => (
							<span key={email} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
								{email}
								<button onClick={() => removeViewer(email)} className="text-red-500 hover:scale-110 transition-transform"><X size={14} /></button>
							</span>
						))}
					</div>
				)}
			</div>

			<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
				<div className="p-4 md:p-6 border-b border-slate-50 dark:border-slate-800 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
					<div>
						<h3 className="font-bold dark:text-white uppercase text-[10px] md:text-sm tracking-widest font-['Manrope']">Nhật ký Tổng hợp (Văn phòng & Thị trường)</h3>
						<p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
							Hiển thị {paginatedData.length}/{aggregatedData.length} bản ghi
						</p>
					</div>

					<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
						<div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-700 flex-1">
							<span className="text-[9px] font-black text-slate-400 uppercase min-w-[30px]">Từ</span>
							<input
								type="date"
								className="bg-transparent border-none text-xs font-bold outline-none dark:text-white dark:color-scheme-dark flex-1"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
							/>
						</div>
						<div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-700 flex-1">
							<span className="text-[9px] font-black text-slate-400 uppercase min-w-[30px]">Đến</span>
							<input
								type="date"
								className="bg-transparent border-none text-xs font-bold outline-none dark:text-white dark:color-scheme-dark flex-1"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
							/>
						</div>
					</div>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-left min-w-[1000px]">
						<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
							<tr>
								<th className="px-6 py-4">Nhân viên</th>
								<th className="px-6 py-4">Ngày</th>
								<th className="px-6 py-4 text-center">Văn phòng (Vào/Ra)</th>
								<th className="px-6 py-4 text-center">Thị trường (Đầu/Cuối)</th>
								<th className="px-6 py-4">Đăng ký / Lý do</th>
								<th className="px-6 py-4">Trạng thái</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
							{paginatedData.length === 0 ? (
								<tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-xs">Chưa có nhật ký hoạt động</td></tr>
							) : paginatedData.map((row: any) => (
								<tr key={`${row.userEmail}_${row.date}`} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
									<td className="px-6 py-4">
										<div className="font-bold dark:text-white">{row.userName}</div>
										<div className="text-[10px] text-slate-400">{row.userEmail}</div>
									</td>
									<td className="px-6 py-4 font-black text-slate-600 dark:text-slate-400">{row.date}</td>
									<td className="px-6 py-4">
										<div className="flex items-center justify-center gap-2">
											<span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${row.officeIn ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>
												In: {row.officeIn ? new Date(row.officeIn.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
											<span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${row.officeOut ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-300'}`}>
												Out: {row.officeOut ? new Date(row.officeOut.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
										</div>
									</td>
									<td className="px-6 py-4">
										<div className="flex items-center justify-center gap-2">
											<span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${row.fieldFirst ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}>
												{row.fieldFirst ? new Date(row.fieldFirst.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
											<span className="text-slate-200">→</span>
											<span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${row.fieldLast ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}>
												{row.fieldLast ? new Date(row.fieldLast.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
											</span>
										</div>
									</td>
									<td className="px-6 py-4 max-w-[200px]">
										{row.requests.length > 0 ? (
											<div className="space-y-1">
												{row.requests.map((req: any, i: number) => (
													<div key={i} className="flex flex-col">
														<span className={`text-[9px] font-black uppercase ${req.requestType === 'leave' ? 'text-red-500' : 'text-amber-500'}`}>
															{req.requestType === 'leave' ? 'Nghỉ phép' : 'Đi muộn'}
														</span>
														<p className="text-[10px] italic text-slate-500 line-clamp-1" title={req.note}>{req.note}</p>
													</div>
												))}
											</div>
										) : <span className="text-slate-300">---</span>}
									</td>
									<td className="px-6 py-4">
										<span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase 
											${row.status === 'on-time' ? 'bg-emerald-100 text-emerald-600' :
												row.status === 'late' ? 'bg-rose-100 text-rose-600' :
													row.status === 'field-trip' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
											{row.status === 'on-time' ? 'Đúng giờ' :
												row.status === 'late' ? 'Đi trễ' :
													row.status === 'field-trip' ? 'Thị trường' : 'N/A'}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Pagination Footer */}
				{totalPages > 1 && (
					<div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
						<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
							Trang {currentPage} / {totalPages}
						</p>
						<div className="flex items-center gap-2">
							<button
								onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								className="p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-500 disabled:opacity-50 hover:bg-slate-50 transition-all shadow-sm"
							>
								<ChevronLeft size={16} />
							</button>
							<button
								onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
								disabled={currentPage === totalPages}
								className="p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-500 disabled:opacity-50 hover:bg-slate-50 transition-all shadow-sm"
							>
								<ChevronRight size={16} />
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default AdminSettings;
