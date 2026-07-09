import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
	Settings, User, Bell, Shield, Database, Globe, Moon, Sun, Users, Activity,
	FileText, Save, Plus, Trash2, Edit2, Edit3, CheckCircle, XCircle, Crown, Clock,
	Rocket, Lock, RefreshCcw, ExternalLink, MapPin, Calendar, X, AlertTriangle,
	ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { auth, db, functions } from '../services/firebase';
import {
	collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp,
	orderBy, limit, deleteDoc, getDoc, setDoc, where, getDocs, writeBatch, Timestamp
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
		geofenceRadius: 500,
		attendanceViewers: [] as string[],
		autoSyncSchedule: 'none',
		overheadRate: 8.5,
	});
	const [syncing, setSyncing] = useState(false);
	const [syncRange, setSyncRange] = useState({
		start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
		end: new Date().toISOString().split('T')[0]
	});
	const [systemConfig, setSystemConfig] = useState<any>({ lock_free_sheets: false });
	const [exportLoading, setExportLoading] = useState(false);
	const [exportCount, setExportCount] = useState(0);
	const [extraExportLimit, setExtraExportLimit] = useState(0);
	const [logoUploading, setLogoUploading] = useState(false);

	// User Management
	const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
	const [pendingInvites, setPendingInvites] = useState<any[]>([]);
	const [showAddUser, setShowAddUser] = useState(false);
	const [newUser, setNewUser] = useState({ email: '', role: 'sale', displayName: '' });
	const [editingUser, setEditingUser] = useState<any>(null);

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
	const [attendanceError, setAttendanceError] = useState<string | null>(null);
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
		}, (err) => {
			console.error('Audit logs query error:', err);
			// Fallback without orderBy
			const fallbackAuditQ = query(collection(db, 'audit_logs'), where('ownerId', '==', owner.ownerId), limit(50));
			onSnapshot(fallbackAuditQ, (fallbackSnap) => {
				const items = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
				items.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
				setLogs(items);
			});
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
			setAttendanceError(null);
		}, (err) => {
			console.error('Attendance query error:', err);
			setAttendanceError(err.message);
			// Fallback: try without orderBy to avoid index requirement
			const fallbackQ = query(collection(db, 'attendance_logs'), where('ownerId', '==', owner.ownerId), limit(500));
			const unsubFallback = onSnapshot(fallbackQ, (fallbackSnap) => {
				const logs = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
				logs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
				setAttendanceLogs(logs);
				setAttendanceError(null);
			}, (fallbackErr) => {
				console.error('Attendance fallback error:', fallbackErr);
				setAttendanceError(fallbackErr.message);
			});
			// Note: we can't return unsubscribe for fallback here easily,
			// but the original subscription is already errored
		});

		// Listen to Field Checkins for Market Staff tracking
		const qField = query(collection(db, 'checkins'), where('ownerId', '==', owner.ownerId), orderBy('createdAt', 'desc'), limit(500));
		const unsubField = onSnapshot(qField, (snap) => {
			setFieldCheckins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		}, (err) => {
			console.error('Field checkins query error:', err);
			// Fallback without orderBy
			const fallbackFieldQ = query(collection(db, 'checkins'), where('ownerId', '==', owner.ownerId), limit(500));
			onSnapshot(fallbackFieldQ, (fallbackSnap) => {
				const items = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
				items.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
				setFieldCheckins(items);
			});
		});

		// 4. Listen to Export Usage
		const currentMonth = new Date().toISOString().slice(0, 7);
		const unsubUsage = onSnapshot(doc(db, 'usage_limits', `${owner.ownerId}_${currentMonth}`), (snap) => {
			if (snap.exists()) {
				setExportCount(snap.data().count || 0);
				setExtraExportLimit(snap.data().extraExportLimit || 0);
			} else {
				setExportCount(0);
				setExtraExportLimit(0);
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
			// Clean undefined values to prevent Firestore error
			const cleanCompanyInfo = Object.entries(companyInfo).reduce((acc: any, [key, value]) => {
				if (value !== undefined) {
					acc[key] = value;
				}
				return acc;
			}, {});

			await setDoc(doc(db, 'settings', owner.ownerId), {
				...cleanCompanyInfo,
				updatedAt: serverTimestamp(),
				updatedBy: auth.currentUser?.uid
			}, { merge: true });
			showToast("Đã lưu cấu hình thành công!", "success");
		} catch (error: any) {
			console.error("Save config error:", error);
			showToast(`Lỗi khi lưu cấu: ${error.message || 'Lỗi không xác định'}`, "error");
		} finally {
			setLoading(false);
		}
	};

	const handleMigrateDebt = async () => {
		if (!owner.ownerId) return;
		if (!window.confirm("CẢNH BÁO: Việc này sẽ quét toàn bộ Đơn hàng và Phiếu thu để tính lại Công nợ cho TẤT CẢ khách hàng. Tiếp tục?")) return;
		
		setLoading(true);
		try {
			const customersSnap = await getDocs(query(collection(db, 'customers'), where('ownerId', '==', owner.ownerId)));
			const ordersSnap = await getDocs(query(collection(db, 'orders'), where('ownerId', '==', owner.ownerId)));
			const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('ownerId', '==', owner.ownerId)));
			
			const chunks = [];
			let currentBatch = writeBatch(db);
			let operationCount = 0;
			let updateCount = 0;

			customersSnap.docs.forEach((customerDoc) => {
				const customerId = customerDoc.id;
				const custOrders = ordersSnap.docs.filter(o => o.data().customerId === customerId && o.data().status === 'Đơn chốt');
				const custPayments = paymentsSnap.docs.filter(p => p.data().customerId === customerId);
				
				const totalBuy = custOrders.reduce((sum, o) => sum + (Number(o.data().totalAmount) || 0), 0);
				const totalPay = custPayments.reduce((sum, p) => sum + (Number(p.data().amount) || 0), 0);
				const finalDebt = totalBuy - totalPay;
				
				currentBatch.update(customerDoc.ref, { debt: finalDebt });
				operationCount++;
				updateCount++;

				if (operationCount === 400) {
					chunks.push(currentBatch.commit());
					currentBatch = writeBatch(db);
					operationCount = 0;
				}
			});

			if (operationCount > 0) {
				chunks.push(currentBatch.commit());
			}

			await Promise.all(chunks);
			showToast(`Đã đồng bộ công nợ cho ${updateCount} khách hàng thành công!`, "success");
		} catch (error: any) {
			console.error("Migration Error:", error);
			showToast("Lỗi đồng bộ công nợ: " + error.message, "error");
		} finally {
			setLoading(false);
		}
	};

	const handleAddUser = async () => {
		if (!newUser.email) return showToast("Vui lòng nhập email", "warning");
		try {
			setLoading(true);
			const tempId = newUser.email.replace(/\W/g, '_');
			await setDoc(doc(db, 'permissions', tempId), {
				email: newUser.email,
				displayName: newUser.displayName || newUser.email,
				role: newUser.role,
				ownerId: owner.ownerId,
				ownerEmail: owner.ownerEmail,
				status: 'pending',
				accessRights: {
					dashboard: true,
					orders_view: true,
					orders_create: true,
					inventory_view: true,
					customers_manage: true,
					debts_manage: false,
					users_manage: false,
					admin: false,
					system_manage: false
				},
				createdAt: serverTimestamp()
			});

			// Trigger Apps Script to send email invitation
			try {
				await fetch('https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec', {
					method: 'POST',
					mode: 'no-cors',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						action: 'invite_user',
						email: newUser.email,
						role: newUser.role,
						inviterName: owner.ownerEmail?.split('@')[0] || 'Quản trị viên'
					})
				});
			} catch (e) {
				console.error("Apps Script invite email trigger failed:", e);
			}

			showToast("Đã gửi lời mời thành công!", "success");
			setShowAddUser(false);
			setNewUser({ email: '', role: 'sale', displayName: '' });
		} catch (error: any) {
			showToast("Lỗi: " + error.message, "error");
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
		try {
			const docId = user.id;
			const emailClean = (user.email || '').toLowerCase().trim();
			const tempId = emailClean.replace(/\W/g, '_');

			// Delete from permissions (invitations) in all possible formats
			await deleteDoc(doc(db, 'permissions', docId));
			if (tempId !== docId) {
				await deleteDoc(doc(db, 'permissions', tempId));
			}
			await deleteDoc(doc(db, 'permissions', tempId.toUpperCase()));
			await deleteDoc(doc(db, 'permissions', emailClean));

			// Delete from active users collection
			await deleteDoc(doc(db, 'users', docId));
			if (user.uid) {
				await deleteDoc(doc(db, 'users', user.uid));
			}

			showToast("Đã xóa nhân viên thành công", "success");
		} catch (error: any) {
			showToast("Lỗi khi xóa: " + error.message, "error");
		}
	};

	const handleUpdateUser = async () => {
		if (!editingUser) return;
		try {
			setLoading(true);
			const collectionName = editingUser.status === 'pending' ? 'permissions' : 'users';
			const updateData: any = {
				displayName: editingUser.displayName,
				role: editingUser.role
			};
			// Lương tháng → tự động tính lương ngày (26 ngày công chuẩn)
			const monthlyWage = Number(editingUser.monthlyWage) || 0;
			if (monthlyWage > 0) {
				updateData.monthlyWage = monthlyWage;
				updateData.dailyWage = Math.round(monthlyWage / 26);
			} else if (editingUser.monthlyWage === '' || editingUser.monthlyWage === 0) {
				// Xóa lương nếu để trống
				updateData.monthlyWage = 0;
				updateData.dailyWage = 0;
			}
			await updateDoc(doc(db, collectionName, editingUser.id), updateData);
			showToast("Cập nhật thành công", "success");
			setEditingUser(null);
		} catch (error: any) {
			showToast("Lỗi: " + error.message, "error");
		} finally {
			setLoading(false);
		}
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
					userId: auth.currentUser?.uid || "",
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

		if (!owner.isPro) {
			const limit = 5 + extraExportLimit;
			if (exportCount >= limit) {
				showToast("Bạn đã hết lượt tải về trong tháng này.", "error");
				return;
			}
		}

		setExportLoading(true);
		try {
			// 1. Prepare data containers
			const collections = ['products', 'customers', 'orders', 'debts', 'checkins'];
			const XLSX = await import('xlsx');
			const workbook = XLSX.utils.book_new();

			// 2. Prepare Time Range
			const startTS = syncRange.start ? new Date(syncRange.start + 'T00:00:00') : null;
			const endTS = syncRange.end ? new Date(syncRange.end + 'T23:59:59') : null;

			// 3. Fetch and Process each collection
			const orderDetails: any[] = [];

			for (const colName of collections) {
				const q = query(collection(db, colName), where('ownerId', '==', owner.ownerId));
				const snap = await getDocs(q);

				let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

				// Apply date filtering client-side for transactional data
				if (['orders', 'debts', 'checkins'].includes(colName) && startTS && endTS) {
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

					// Format specific fields for readability in Excel and remove technical fields
					const TECHNICAL_FIELDS = ['ownerId', 'ownerEmail', 'createdBy', 'createdByEmail', 'updatedBy', 'updatedAt'];
					const formattedData = data.map((item: any) => {
						const newItem: any = {};
						Object.keys(item).forEach(key => {
							if (TECHNICAL_FIELDS.includes(key)) return;

							const val = item[key];
							if (val && typeof val === 'object') {
								if (val.seconds) {
									// Firestore Timestamp
									newItem[key] = new Date(val.seconds * 1000).toLocaleString('vi-VN');
								} else {
									// Other objects/arrays - stringify to avoid [object Object]
									newItem[key] = JSON.stringify(val);
								}
							} else {
								newItem[key] = val;
							}
						});
						return newItem;
					});

					const worksheet = XLSX.utils.json_to_sheet(formattedData);

					// Đổi tên sheet sang tiếng Việt cho thân thiện
					let sheetName = colName;
					switch (colName) {
						case 'products': sheetName = 'san_pham'; break;
						case 'customers': sheetName = 'khach_hang'; break;
						case 'orders': sheetName = 'don_hang'; break;
						case 'debts': sheetName = 'cong_no'; break;
						case 'checkins': sheetName = 'checkin'; break;
					}

					XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
				}
			}

			// Add the specific details sheet if we have order items
			if (orderDetails.length > 0) {
				const detailsSheet = XLSX.utils.json_to_sheet(orderDetails);
				XLSX.utils.book_append_sheet(workbook, detailsSheet, 'chi_tiet_don_hang');
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
				userId: auth.currentUser?.uid || "",
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

	const handleLogoUpload = async (fileOrUrl: File | string) => {
		if (typeof fileOrUrl === 'string') {
			setCompanyInfo({ ...companyInfo, logoUrl: fileOrUrl });
			return;
		}

		setLogoUploading(true);
		try {
			const formData = new FormData();
			formData.append('file', fileOrUrl);
			formData.append('upload_preset', 'dunvexbuil');
			formData.append('folder', 'dunvex_branding');

			const response = await fetch(
				`https://api.cloudinary.com/v1_1/dtx0uvb4e/image/upload`,
				{
					method: 'POST',
					body: formData,
				}
			);

			const data = await response.json();

			if (data.secure_url) {
				setCompanyInfo(prev => ({ ...prev, logoUrl: data.secure_url }));
				showToast("Tải logo lên thành công", "success");
			} else {
				showToast("Lỗi upload: " + (data.error?.message || "Không xác định"), "error");
			}
		} catch (error: any) {
			showToast(`Lỗi upload: ${error.message}`, "error");
		} finally {
			setLogoUploading(false);
		}
	};

	const handleTogglePermission = async (user: any, resource: string) => {
		// Protection: Cannot edit owner or self
		if (user.uid === owner.ownerId || user.id === auth.currentUser?.uid) {
			showToast("Bạn không thể thay đổi quyền của tài khoản này.", "error");
			return;
		}

		// Simplified default logic: staff can access basic tools but sensitive ones are locked
		const sensitiveKeys = ['admin', 'users_manage', 'system_manage'];
		const defaultVal = sensitiveKeys.includes(resource) ? false : true;
		
		const currentVal = user.accessRights?.[resource] ?? defaultVal;
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

	// Access Control based on Toggles
	const canManageUsers = !owner.isEmployee || owner.accessRights?.users_manage === true;
	const canManageSystem = !owner.isEmployee || owner.accessRights?.system_manage === true;

	// Filter user list based on hierarchy:
	// - Staff Admin can only see Sales/Warehouse/etc. 
	// - Owner (Super Admin) sees everyone.
	const filteredUserList = useMemo(() => {
		if (!owner.isEmployee) return userList; // Super Admin sees all

		// Staff Admin: Hide other Admins or anyone with users_manage/system_manage to prevent escalation
		return userList.filter(u => {
			if (u.uid === owner.ownerId) return false; // Hide owner
			if (u.id === auth.currentUser?.uid) return false; // Hide self

			const isHighLevel = u.accessRights?.admin === true || 
							   u.accessRights?.users_manage === true || 
							   u.accessRights?.system_manage === true ||
							   u.role === 'admin';
			
			return !isHighLevel;
		});
	}, [userList, owner.isEmployee, owner.ownerId]);

	if (owner.loading) return null;
	if (owner.role !== 'admin' && !isAttendanceViewer && !canManageSystem && !canManageUsers) return <div className="p-10 text-center uppercase font-black">Truy cập bị từ chối</div>;

	const isSyncLocked = (systemConfig.lock_free_sheets && !owner.isPro) || companyInfo.manualLockSheets;

	return (
		<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 p-4 md:p-8 pb-32">
			<style>{scrollbarHideStyle}</style>

			<div className="max-w-[1400px] mx-auto">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
					<div>
						<h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Quản Trị Hệ Thống</h1>
						<p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Cài đặt doanh nghiệp & Phân quyền nhân sự</p>
					</div>

					<div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
						{canManageSystem && <TabItem active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={<Settings size={18} />} label="Hệ thống" />}
						{canManageUsers && <TabItem active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={18} />} label="Nhân sự" />}
						{canManageUsers && <TabItem active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} icon={<Shield size={18} />} label="Phân quyền" />}
						{(canManageSystem || isAttendanceViewer) && <TabItem active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={<Clock size={18} />} label="Bảng công" />}
						<TabItem active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<Activity size={18} />} label="Nhật ký" />
					</div>
				</div>

				<div className="space-y-8 animate-in fade-in duration-500">
					{activeTab === 'general' && canManageSystem && (
						<div className="space-y-6">
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
									<LogoUploadSection
										label="Logo Doanh nghiệp"
										value={companyInfo.logoUrl}
										uploading={logoUploading}
										onUpload={handleLogoUpload}
									/>
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
								<div className="mt-8 flex justify-between items-center">
									<button onClick={handleMigrateDebt} disabled={loading} className="flex items-center gap-2 bg-rose-500/10 text-rose-600 px-4 py-2 rounded-xl font-bold hover:bg-rose-500/20 transition-all disabled:opacity-50 text-xs">
										<RefreshCcw size={16} /> Đồng bộ Công Nợ Toàn Hệ Thống
									</button>
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
										<span className={`text-[10px] font-black px-2 py-1 rounded-lg ${!owner.isPro && exportCount >= (5 + extraExportLimit) ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
											SỬ DỤNG: {exportCount}/{owner.isPro ? 'Không giới hạn' : (5 + extraExportLimit + ' LẦN/THÁNG')}
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
											disabled={exportLoading || (!owner.isPro && exportCount >= (5 + extraExportLimit)) || isSyncLocked}
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
														const expireDate = expireAt.toDate ? expireAt.toDate() : new Date(expireAt);
														const days = Math.ceil((expireDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
														return days > 0 ? `${days} ngày` : 'Đã hết hạn';
													}
													return owner.subscriptionStatus === 'active' ? 'Vô thời hạn' : 'Hết hạn';
												})()}
											</p>
										</div>
									</div>
								</div>
							</div>

							{/* Hệ số chi phí vận hành */}
							<div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-6">
								<h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Hệ số chi phí vận hành</h4>
								<p className="text-[10px] text-slate-400 mb-3">Áp dụng cho sản phẩm được tick "Áp hệ số chi phí". Lợi nhuận = Giá bán - (Giá nhập × (1 + Hệ số%))</p>
								<InputSection label="Hệ số chi phí (%)" type="number" value={companyInfo.overheadRate ?? 8.5} onChange={(v: string) => setCompanyInfo({ ...companyInfo, overheadRate: Number(v) })} />
							</div>
						</div>
					)}

					{activeTab === 'users' && canManageUsers && (
						<>
						<UserManagement
							userList={filteredUserList}
							onAdd={() => setShowAddUser(true)}
							onUpdateRole={updateUserRole}
							onDelete={deleteUser}
							showAdd={showAddUser}
							onShowAdd={setShowAddUser}
							newUser={newUser}
							setNewUser={setNewUser}
							handleAddUser={handleAddUser}
							editingUser={editingUser}
							setEditingUser={setEditingUser}
							handleUpdateUser={handleUpdateUser}
						/>
						<div className="mt-8">
							<SalarySummary userList={filteredUserList} ownerId={owner.ownerId} />
						</div>
						</>
					)}

					{activeTab === 'attendance' && <AttendanceAdmin logs={attendanceLogs} fieldLogs={fieldCheckins} companyInfo={companyInfo} setCompanyInfo={setCompanyInfo} onSave={handleSaveSettings} error={attendanceError} />}

					{activeTab === 'permissions' && canManageUsers && (
						<div className="space-y-6">
							<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-x-auto custom-scrollbar">
								<table className="w-full text-left min-w-[1000px]">
									<thead>
										<tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
											<th className="px-6 py-4">Nhân viên</th>
											{['Dashboard', 'Xem Đơn', 'Lên Đơn', 'Check-in', 'Xem Kho', 'Quản SP', 'Khách hàng', 'Thu Nợ', 'Tài chính', 'Nhân sự', 'Hệ thống Admin', 'Nâng cao'].map(h => <th key={h} className="px-2 py-4 text-center">{h}</th>)}
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
										{filteredUserList.map(u => (
											<tr key={u.id}>
												<td className="px-6 py-4 font-bold text-sm text-slate-700 dark:text-white">{u.displayName || u.email}</td>
												{['dashboard', 'orders_view', 'orders_create', 'checkin_create', 'inventory_view', 'inventory_manage', 'customers_manage', 'debts_manage', 'users_manage', 'admin', 'system_manage'].map(p => {
													// Determine visual state
													const sensitiveKeys = ['admin', 'users_manage', 'system_manage'];
													const defaultBtnVal = sensitiveKeys.includes(p) ? false : true;
													const isActive = u.accessRights?.[p] ?? defaultBtnVal;
													
													return (
														<td key={p} className="px-2 py-4">
															<div onClick={() => handleTogglePermission(u, p)} className={`w-10 h-5 rounded-full p-0.5 cursor-pointer mx-auto transition-colors ${isActive ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
																<div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
															</div>
														</td>
													);
												})}
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

const LogoUploadSection = ({ label, value, onUpload, uploading }: any) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	return (
		<div className="space-y-2 md:col-span-2 mb-4">
			<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
			<div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-slate-50 dark:bg-slate-800/20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl transition-all hover:border-indigo-500/50">
				<div className="relative group shrink-0">
					<div className="w-24 h-24 md:w-32 md:h-32 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex items-center justify-center p-2">
						{value ? (
							<img src={value} alt="Company Logo" className="w-full h-full object-contain" />
						) : (
							<div className="text-slate-300 dark:text-slate-600">
								<Globe size={48} />
							</div>
						)}
						{uploading && (
							<div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center">
								<div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
							</div>
						)}
					</div>
				</div>

				<div className="flex-1 space-y-3 text-center md:text-left">
					<h4 className="font-bold text-slate-700 dark:text-slate-300">Logo Thương Hiệu</h4>
					<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">PNG, JPG hoặc SVG. Khuyên dùng 300x100px.</p>
					<div className="flex flex-wrap justify-center md:justify-start gap-2">
						<button
							onClick={() => fileInputRef.current?.click()}
							disabled={uploading}
							className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2"
						>
							<Plus size={14} />
							{value ? 'Thay đổi Logo' : 'Tải lên Logo'}
						</button>
						{value && (
							<button
								onClick={() => onUpload('')}
								className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all flex items-center gap-2"
							>
								<Trash2 size={14} />
								Xóa
							</button>
						)}
					</div>
					<input
						type="file"
						ref={fileInputRef}
						className="hidden"
						accept="image/*"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) onUpload(file);
						}}
					/>
				</div>
			</div>
		</div>
	);
}

const UserManagement = ({ userList, showAdd, onShowAdd, newUser, setNewUser, handleAddUser, onUpdateRole, onDelete, editingUser, setEditingUser, handleUpdateUser }: any) => {
	const [deletingUserId, setDeletingUserId] = React.useState<string | null>(null);

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h2 className="text-xl font-black uppercase text-slate-800 dark:text-white tracking-tight">Danh sách nhân sự</h2>
				<button onClick={() => onShowAdd(true)} className="flex items-center gap-2 bg-[#FF6D00] text-white px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"><Plus size={16} /> Thêm nhân viên</button>
			</div>

			{/* Add User Form */}
			{showAdd && (
				<div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
					<h3 className="font-bold text-lg mb-4 dark:text-white">Mời nhân viên mới</h3>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="space-y-1">
							<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên hiển thị</label>
							<input type="text" placeholder="VD: Nguyễn Văn A" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={newUser.displayName} onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} />
						</div>
						<div className="space-y-1">
							<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Google</label>
							<input type="email" placeholder="email@gmail.com" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
						</div>
						<div className="space-y-1">
							<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vai trò</label>
							<select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
								<option value="sale">Nhân viên Sale</option>
								<option value="warehouse">Thủ kho</option>
								<option value="accountant">Kế toán</option>
								<option value="admin">Quản trị viên</option>
							</select>
						</div>
					</div>
					<div className="flex justify-end gap-3 mt-4">
						<button onClick={() => onShowAdd(false)} className="px-6 py-2 text-slate-500 dark:text-slate-400 font-bold text-sm hover:text-slate-700 transition-colors">Hủy</button>
						<button onClick={handleAddUser} className="px-6 py-2 bg-[#1A237E] dark:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none hover:opacity-90 transition-all">Gửi lời mời</button>
					</div>
				</div>
			)}

			{/* Edit User Form/Modal */}
			{editingUser && (
				<div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
					<div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-8">
						<div className="flex justify-between items-center mb-6">
							<div>
								<h3 className="text-xl font-black uppercase text-[#1A237E] dark:text-indigo-400">Chỉnh sửa nhân sự</h3>
								<p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{editingUser.email}</p>
							</div>
							<button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><XCircle size={24} /></button>
						</div>

						<div className="space-y-5">
							<div className="space-y-2">
								<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên hiển thị</label>
								<input
									type="text"
									className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
									value={editingUser.displayName}
									onChange={e => setEditingUser({ ...editingUser, displayName: e.target.value })}
								/>
							</div>

							<div className="space-y-2">
								<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vai trò</label>
								<select
									className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
									value={editingUser.role}
									onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
								>
									<option value="sale">Nhân viên Sale</option>
									<option value="warehouse">Thủ kho</option>
									<option value="accountant">Kế toán</option>
									<option value="admin">Quản trị viên</option>
								</select>
							</div>

							<div className="space-y-2">
								<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">💰 Lương / tháng (VNĐ)</label>
								<input
									type="number"
									className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
									value={editingUser.monthlyWage || ''}
									onChange={e => setEditingUser({ ...editingUser, monthlyWage: e.target.value })}
									placeholder="VD: 8000000"
								/>
								{editingUser.monthlyWage > 0 && (
									<p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold px-1">
										≈ {Math.round(Number(editingUser.monthlyWage) / 26).toLocaleString('vi-VN')}đ/ngày (26 ngày công)
									</p>
								)}
							</div>

							<div className="flex gap-3 pt-4">
								<button onClick={() => setEditingUser(null)} className="flex-1 px-4 py-3 text-slate-500 dark:text-slate-400 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">Bỏ qua</button>
								<button onClick={handleUpdateUser} className="flex-1 px-4 py-3 bg-[#1A237E] dark:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all">Lưu thay đổi</button>
							</div>
						</div>
					</div>
				</div>
			)}

			<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
				<div className="overflow-x-auto custom-scrollbar">
					<table className="w-full text-left min-w-[700px]">
						<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
							<tr><th className="px-6 py-4">Nhân viên</th><th className="px-6 py-4">Vai trò</th><th className="px-6 py-4">Trạng thái</th><th className="px-6 py-4 text-right">Hành động</th></tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
							{userList.map((user: any) => (
								<tr key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
									<td className="px-6 py-4">
										<div className="font-bold text-sm dark:text-white">{user.displayName || 'Guest'}</div>
										<div className="text-[10px] text-slate-400 font-bold lowercase">{user.email}</div>
									</td>
									<td className="px-6 py-4">
										<span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">
											{user.role === 'admin' ? 'Quản trị' : user.role === 'sale' ? 'Sale' : user.role === 'warehouse' ? 'Kho' : 'Kế toán'}
										</span>
									</td>
									<td className="px-6 py-4">
										<span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${user.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
											{user.status === 'active' ? 'Đã kích hoạt' : 'Chờ xác nhận'}
										</span>
									</td>
									<td className="px-6 py-4 text-right">
										{deletingUserId === user.id ? (
											<div className="flex items-center justify-end gap-2 animate-in fade-in zoom-in-95 duration-200">
												<span className="text-[11px] text-rose-500 font-extrabold dark:text-rose-400 mr-1 animate-pulse">Xác nhận xóa?</span>
												<button
													onClick={(e) => {
														e.stopPropagation();
														e.preventDefault();
														onDelete(user);
														setDeletingUserId(null);
													}}
													className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-rose-600 active:scale-95 transition-all shadow-md shadow-rose-500/20"
												>
													Có
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														e.preventDefault();
														setDeletingUserId(null);
													}}
													className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase active:scale-95 transition-all"
												>
													Hủy
												</button>
											</div>
										) : (
											<div className="flex items-center justify-end gap-2">
												<button
													onClick={(e) => {
														e.stopPropagation();
														e.preventDefault();
														setEditingUser(user);
													}}
													className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
													title="Chỉnh sửa"
												>
													<Edit3 size={18} />
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														e.preventDefault();
														setDeletingUserId(user.id);
													}}
													className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
													title="Xóa nhân viên"
												>
													<Trash2 size={18} />
												</button>
											</div>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

const AttendanceAdmin = ({ logs, fieldLogs, companyInfo, setCompanyInfo, onSave, error }: { logs: any[], fieldLogs: any[], companyInfo: any, setCompanyInfo: any, onSave: any, error?: string | null }) => {
	const [viewerEmail, setViewerEmail] = useState('');
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [currentPage, setCurrentPage] = useState(1);

	// Hiển thị lỗi nếu query Firestore thất bại
	if (error) {
		return (
			<div className="flex flex-col items-center justify-center p-12 text-center">
				<div className="bg-amber-500/10 p-6 rounded-full text-amber-500 mb-4 border border-amber-500/20">
					<AlertTriangle size={48} />
				</div>
				<h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">Đang gặp sự cố kết nối</h3>
				<p className="text-sm text-slate-500 max-w-md mb-6">{error}</p>
				<p className="text-xs text-slate-400 mb-4">Vui lòng tạo composite index trong Firebase Console:<br/><code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px]">attendance_logs: ownerId ASC, createdAt DESC</code></p>
				<button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm">Thử lại</button>
			</div>
		);
	}
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

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center p-12 text-center">
				<div className="bg-amber-500/10 p-6 rounded-full text-amber-500 mb-4 border border-amber-500/20">
					<AlertTriangle size={48} />
				</div>
				<h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">Đang gặp sự cố kết nối</h3>
				<p className="text-sm text-slate-500 max-w-md mb-6">{error}</p>
				<p className="text-xs text-slate-400 mb-4">Vui lòng tạo composite index trong Firebase Console:<br/><code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px]">attendance_logs: ownerId ASC, createdAt DESC</code></p>
				<button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm">Thử lại</button>
			</div>
		);
	}

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
				<div className="overflow-x-auto custom-scrollbar">
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
// ==================== BẢNG LƯƠNG NHÂN VIÊN ====================
const SalarySummary = ({ userList, ownerId }: { userList: any[], ownerId: string }) => {
	const [salaryData, setSalaryData] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
	const [expandedUser, setExpandedUser] = useState<string | null>(null);
	const [rawCheckins, setRawCheckins] = useState<any[]>([]);
	const [rawAttendance, setRawAttendance] = useState<any[]>([]);

	useEffect(() => {
		if (!ownerId || userList.length === 0) return;
		setExpandedUser(null);
		loadSalaryData();
	}, [ownerId, userList, month]);

	const loadSalaryData = async () => {
		setLoading(true);
		try {
			const [year, mon] = month.split('-').map(Number);
			const startDate = new Date(year, mon - 1, 1);
			const endDate = new Date(year, mon, 0); // Last day of month

			const checkinsQ = query(
				collection(db, 'checkins'),
				where('ownerId', '==', ownerId),
				where('createdAt', '>=', Timestamp.fromDate(startDate)),
				where('createdAt', '<=', Timestamp.fromDate(endDate))
			);
			
			const attendanceQ = query(
				collection(db, 'attendance_logs'),
				where('ownerId', '==', ownerId),
				where('createdAt', '>=', Timestamp.fromDate(startDate)),
				where('createdAt', '<=', Timestamp.fromDate(endDate))
			);

			const [checkinsSnap, attendanceSnap] = await Promise.all([
				getDocs(checkinsQ),
				getDocs(attendanceQ)
			]);

			const allCheckins: any[] = checkinsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
			const allAttendance: any[] = attendanceSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
			setRawCheckins(allCheckins);
			setRawAttendance(allAttendance);
			
			const data = userList.map(user => {
				const userCheckins = allCheckins.filter(c => c.userId === user.id || c.userEmail === user.email);
				const userAttendance = allAttendance.filter(a => a.userId === user.id || a.userEmail === user.email);
				
				// Loại bỏ các đơn từ (nghỉ phép, đi muộn) khỏi ngày công thực tế
				const validAttendance = userAttendance.filter(a => a.type !== 'request');

				// Gom nhóm chi tiết theo ngày
				const dailyDetails: Record<string, { checkin?: any; attendances: any[] }> = {};
				userCheckins.forEach(c => {
					const dt = c.createdAt?.toDate?.() || new Date(c.createdAt);
					const day = dt.toISOString().slice(0, 10);
					if (!dailyDetails[day]) dailyDetails[day] = { attendances: [] };
					dailyDetails[day].checkin = c;
				});
				validAttendance.forEach(a => {
					const dt = a.createdAt?.toDate?.() || new Date(a.createdAt);
					const day = dt.toISOString().slice(0, 10);
					if (!dailyDetails[day]) dailyDetails[day] = { attendances: [] };
					dailyDetails[day].attendances.push(a);
				});

				const daysWorked = Object.keys(dailyDetails).length;
				const WORKING_DAYS = 26; // Ngày công chuẩn / tháng
				const monthlyWage = Number(user.monthlyWage) || 0;
				const dailyWage = monthlyWage > 0 
					? Math.round(monthlyWage / WORKING_DAYS)
					: (Number(user.dailyWage) || 0); // fallback lương ngày cũ
				return {
					userId: user.id,
					name: user.displayName || user.email?.split('@')[0] || 'N/A',
					email: user.email,
					role: user.role,
					checkins: userCheckins.length + validAttendance.length,
					daysWorked,
					monthlyWage,
					dailyWage,
					totalSalary: daysWorked * dailyWage,
					dailyDetails,
				};
			});
			setSalaryData(data);
		} catch(e) {
			console.error('SalarySummary error:', e);
		} finally {
			setLoading(false);
		}
	};

	const getDetailForUser = (userId: string) => {
		const user = salaryData.find(d => d.userId === userId);
		if (!user?.dailyDetails) return [];
		return Object.entries(user.dailyDetails)
			.sort(([a], [b]) => b.localeCompare(a))
			.map(([day, detail]: [string, any]) => ({
				day,
				checkinTime: detail.checkin ? (() => {
					const dt = detail.checkin.createdAt?.toDate?.() || new Date(detail.checkin.createdAt);
					return dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
				})() : null,
				checkinNote: detail.checkin?.note || detail.checkin?.location || '',
				attendances: detail.attendances.map((a: any) => {
					const dt = a.createdAt?.toDate?.() || new Date(a.createdAt);
					return {
						time: dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
						type: a.type || a.status || 'check',
						note: a.note || a.location || ''
					};
				})
			}));
	};

	const formatPrice = (n: number) => n.toLocaleString('vi-VN');
	const totalAll = salaryData.reduce((s, d) => s + d.totalSalary, 0);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-black uppercase text-slate-800 dark:text-white">💰 Bảng lương nhân viên</h3>
				<input
					type="month"
					value={month}
					onChange={e => setMonth(e.target.value)}
					className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold dark:text-white outline-none"
				/>
			</div>
			{loading ? (
				<div className="text-center py-8 text-slate-400">Đang tính...</div>
			) : (
				<div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
					<table className="w-full text-left">
						<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
							<tr>
								<th className="px-4 py-3">Nhân viên</th>
								<th className="px-4 py-3 text-center">Ngày làm</th>
								<th className="px-4 py-3 text-center">Lượt chấm</th>
								<th className="px-4 py-3 text-right">Lương/tháng</th>
								<th className="px-4 py-3 text-right">Lương/ngày</th>
								<th className="px-4 py-3 text-right">Thực lãnh</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-50 dark:divide-slate-800">
							{salaryData.map((d, i) => {
								const isExpanded = expandedUser === d.userId;
								const details = isExpanded ? getDetailForUser(d.userId) : [];
								return (
									<React.Fragment key={i}>
										<tr
											className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-all ${isExpanded ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
											onClick={() => setExpandedUser(isExpanded ? null : d.userId)}
										>
											<td className="px-4 py-3">
												<div className="flex items-center gap-2">
													<ChevronRight size={14} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
													<div>
														<div className="font-bold text-sm dark:text-white">{d.name}</div>
														<div className="text-[10px] text-slate-400">{d.role === 'admin' ? 'Quản trị' : d.role === 'sale' ? 'Sale' : d.role === 'warehouse' ? 'Kho' : 'Kế toán'}</div>
													</div>
												</div>
											</td>
											<td className="px-4 py-3 text-center">
												<span className={`font-black text-sm ${d.daysWorked > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300'}`}>
													{d.daysWorked} ngày
												</span>
											</td>
											<td className="px-4 py-3 text-center text-xs text-slate-500">{d.checkins} lượt</td>
											<td className="px-4 py-3 text-right text-xs font-bold text-slate-600 dark:text-slate-300">
												{d.monthlyWage > 0 ? formatPrice(d.monthlyWage) + 'đ' : <span className="text-slate-300 italic">-</span>}
											</td>
											<td className="px-4 py-3 text-right text-xs font-bold text-slate-600 dark:text-slate-300">
												{d.dailyWage > 0 ? formatPrice(d.dailyWage) + 'đ' : <span className="text-slate-300 italic">-</span>}
											</td>
											<td className="px-4 py-3 text-right">
												<span className={`font-black text-sm ${d.totalSalary > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300'}`}>
													{formatPrice(d.totalSalary)}đ
												</span>
											</td>
										</tr>
										{isExpanded && details.length > 0 && (
											<tr key={`detail-${i}`}>
												<td colSpan={6} className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30">
													<div className="space-y-2">
														<p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">📅 Chi tiết chấm công tháng {month}</p>
														<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
															{details.map((day: any, di: number) => (
																<div key={di} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700 p-3">
																	<div className="flex items-center justify-between mb-2">
																		<span className="font-black text-sm text-indigo-600 dark:text-indigo-400">
																			{new Date(day.day).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
																		</span>
																		{day.checkinTime && (
																			<span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
																				{day.checkinTime}
																			</span>
																		)}
																	</div>
																	{day.checkinNote && (
																		<p className="text-[10px] text-slate-400 mb-1">📍 {day.checkinNote}</p>
																	)}
																	{day.attendances.length > 0 && (
																		<div className="space-y-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
																			{day.attendances.map((att: any, ai: number) => (
																				<div key={ai} className="flex items-center justify-between">
																					<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${att.type === 'checkin' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : att.type === 'checkout' ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
																						{att.type === 'checkin' ? 'Vào' : att.type === 'checkout' ? 'Ra' : att.type}
																					</span>
																					<span className="text-[10px] text-slate-500">{att.time}</span>
																				</div>
																			))}
																		</div>
																	)}
																</div>
															))}
														</div>
													</div>
												</td>
											</tr>
										)}
									</React.Fragment>
								);
							})}
						</tbody>
						<tfoot className="bg-indigo-50 dark:bg-indigo-900/20">
							<tr>
								<td colSpan={5} className="px-4 py-3 text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 text-right">TỔNG CỘNG</td>
								<td className="px-4 py-3 text-right font-black text-lg text-indigo-600 dark:text-indigo-400">{formatPrice(totalAll)}đ</td>
							</tr>
						</tfoot>
					</table>
				</div>
			)}
		</div>
	);
};


export default AdminSettings;
