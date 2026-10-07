import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
	Settings, User, Bell, Shield, Database, Globe, Moon, Sun, Users, Activity,
	FileText, Save, Plus, Trash2, Edit2, Edit3, CheckCircle, XCircle, Crown, Clock,
	Rocket, Lock, RefreshCcw, ExternalLink, MapPin, Calendar, X, AlertTriangle,
	ChevronLeft, ChevronRight, Download, ShieldAlert
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../services/firebase';
import { getSessionToken } from '../services/sqliteSession';
import {
	collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp,
	orderBy, limit, deleteDoc, getDoc, setDoc, where, getDocs, writeBatch, Timestamp
} from '../services/firebase';

import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';
import { apiUrl } from '../services/apiClient';
import { TabItem, InputSection, LogoUploadSection } from '../components/admin/SharedComponents';
import { UserManagement } from '../components/admin/UserManagement';
import { AttendanceAdmin } from '../components/admin/AttendanceAdmin';
import { StaffApprovalTab } from '../components/admin/StaffApprovalTab';
import { SalarySummary } from '../components/admin/SalarySummary';
import { exportLocalDataToExcel } from '../utils/excelExport';

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
	const { showToast, showConfirm } = useToast();
	const navigate = useNavigate();
	const { search } = useLocation();
	const queryTab = new URLSearchParams(search).get('tab');
	const [activeTab, setActiveTab] = useState(queryTab || 'general');
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const tabParam = new URLSearchParams(search).get('tab');
		if (tabParam) {
			setActiveTab(tabParam);
		}
	}, [search]);

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
		marketPointsRequired: 1,
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
	const [newUser, setNewUser] = useState({ email: '', password: '', role: 'sale', displayName: '', marketPointsRequired: 1 });
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
	const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

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

		// Pending Approval Counts
		let pendingProdCount = 0;
		let pendingCustCount = 0;
		let pendingAttCount = 0;

		const updateBadge = () => {
			setPendingApprovalsCount(pendingProdCount + pendingCustCount + pendingAttCount);
		};

		const unsubPendingProds = onSnapshot(collection(db, 'products'), (snap) => {
			pendingProdCount = snap.docs.filter(d => {
				const data = d.data();
				return data.approvalStatus === 'pending_approval' || data.approvalStatus === 'pending_delete';
			}).length;
			updateBadge();
		});

		const unsubPendingCusts = onSnapshot(collection(db, 'customers'), (snap) => {
			pendingCustCount = snap.docs.filter(d => {
				const data = d.data();
				return data.approvalStatus === 'pending_approval' || data.approvalStatus === 'pending_delete';
			}).length;
			updateBadge();
		});

		// Listen to Attendance Logs
		const qAtt = query(collection(db, 'attendance_logs'), where('ownerId', '==', owner.ownerId), orderBy('createdAt', 'desc'), limit(500));
		const unsubAtt = onSnapshot(qAtt, (snap) => {
			const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			setAttendanceLogs(logs);
			setAttendanceError(null);
			pendingAttCount = logs.filter((a: any) => a.type === 'request' && a.status === 'pending').length;
			updateBadge();
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
				pendingAttCount = logs.filter((a: any) => a.type === 'request' && a.status === 'pending').length;
				updateBadge();
			}, (fallbackErr) => {
				console.error('Attendance fallback error:', fallbackErr);
				setAttendanceError(fallbackErr.message);
			});
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
			unsubPendingProds();
			unsubPendingCusts();
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
		showConfirm(
			"Đồng bộ công nợ toàn hệ thống",
			"CẢNH BÁO: Việc này sẽ quét toàn bộ Đơn hàng và Phiếu thu để tính lại Công nợ cho TẤT CẢ khách hàng. Bạn có chắc chắn muốn tiếp tục?",
			async () => {
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
			}
		);
	};

	const handleAddUser = async () => {
		if (!newUser.email) return showToast("Vui lòng nhập email", "warning");
		try {
			setLoading(true);
			const cleanEmail = newUser.email.toLowerCase().trim();
			const password = newUser.password?.trim() || '123456';

			// Tạo hoặc cập nhật user và mật khẩu trong SQLite qua backend.
			try {
				const sessionToken = getSessionToken();
				const res = await fetch(apiUrl('/api/create-user'), {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${sessionToken}`
					},
					body: JSON.stringify({
						email: cleanEmail,
						password: password,
						displayName: newUser.displayName || cleanEmail.split('@')[0],
						role: newUser.role || 'sale',
						marketPointsRequired: Number(newUser.marketPointsRequired) || 1,
						ownerId: owner.ownerId,
						ownerEmail: owner.ownerEmail
					})
				});

				const resData = await res.json();
				if (!res.ok || resData.error) {
					throw new Error(resData.error || 'Lỗi tạo tài khoản');
				}

				showToast(resData.emailSent 
					? `Đã gửi thư mời vào công ty và cấp tài khoản cho ${cleanEmail}!`
					: `Đã tạo tài khoản nhân viên thành công! Mật khẩu: ${password}`, "success");
			} catch (apiErr: any) {
				console.warn('SQLite create-user failed:', apiErr);
				throw apiErr;
			}

			setShowAddUser(false);
			setNewUser({ email: '', password: '', role: 'sale', displayName: '', marketPointsRequired: 1 });
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
				role: editingUser.role,
				marketPointsRequired: Number(editingUser.marketPointsRequired) || 1
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

			const EXCLUDE_PROFIT_KEYWORDS = ['ứng tiền', 'ung tien', 'ưng tiền', 'ứng trước', 'ung truoc', 'tạm ứng', 'tam ung'];
			const isExcludedFromProfit = (name: string, flag?: boolean) => {
				if (flag) return true;
				if (!name) return false;
				const lower = String(name).toLowerCase();
				return EXCLUDE_PROFIT_KEYWORDS.some((kw) => lower.includes(kw));
			};
			const overheadRate = companyInfo.overheadRate ?? 8.5;
			const prods = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));

			const orderDetails: any[] = [];
			syncOrders.forEach((order: any) => {
				if (Array.isArray(order.items)) {
					order.items.forEach((item: any) => {
						const matchedProd: any = prods.find((p: any) => p.id === item.id || p.name === item.name) || {};
						const excluded = isExcludedFromProfit(item.name, item.excludeProfit || matchedProd.excludeProfit);
						const applyOverhead = item.applyOverheadCost !== undefined ? Boolean(item.applyOverheadCost) : Boolean(matchedProd.applyOverheadCost);
						const qty = Number(item.qty || 0);
						const priceSell = Number(item.price || 0);
						const buyPrice = Number(item.buyPrice !== undefined && item.buyPrice !== null ? item.buyPrice : (matchedProd.priceImport || matchedProd.costPrice || 0));

						let unitProfit = 0;
						let profit = 0;
						if (!excluded) {
							let effectiveCost = buyPrice;
							if (applyOverhead && overheadRate > 0) {
								effectiveCost = buyPrice * (1 + overheadRate / 100);
							}
							unitProfit = priceSell - effectiveCost;
							profit = unitProfit * qty;
						}

						orderDetails.push({
							orderId: order.id,
							orderDate: order.orderDate,
							customerName: order.customerName,
							productName: item.name,
							qty: item.qty,
							price: item.price,
							buyPrice: Math.round(buyPrice),
							unit: item.unit,
							total: (item.qty || 0) * (item.price || 0),
							profit: Math.round(profit),
							unitProfit: Math.round(unitProfit),
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
			const { totalRows, fileName, savedLocation } = await exportLocalDataToExcel({
				ownerId: owner.ownerId,
				startDate: syncRange.start,
				endDate: syncRange.end,
				isEmployee: false,
				role: 'admin',
				exportCount,
				userEmail: auth.currentUser?.email || '',
				displayName: auth.currentUser?.displayName || '',
				uid: auth.currentUser?.uid || ''
			});

			showToast(`Đã xuất ${totalRows} dòng vào ${fileName}! Kiểm tra ${savedLocation}.`, "success");
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
						{canManageUsers && <TabItem active={activeTab === 'approvals'} onClick={() => setActiveTab('approvals')} icon={<ShieldAlert size={18} />} label="Duyệt yêu cầu" badge={pendingApprovalsCount} />}
						{canManageUsers && <TabItem active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={18} />} label="Nhân sự" />}
						{canManageUsers && <TabItem active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} icon={<Shield size={18} />} label="Phân quyền" />}
						{(canManageSystem || isAttendanceViewer) && <TabItem active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={<Clock size={18} />} label="Bảng công" />}
						<TabItem active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<Activity size={18} />} label="Nhật ký" />
					</div>
				</div>

				<div className="space-y-8 animate-in fade-in duration-500">
					{activeTab === 'approvals' && canManageUsers && (
						<StaffApprovalTab ownerId={owner.ownerId} />
					)}
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

									<div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-6">
										<h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Cấu hình Chấm công thị trường</h4>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<InputSection 
												label="Số điểm chấm công tối thiểu trong ngày" 
												type="number" 
												value={companyInfo.marketPointsRequired || 1} 
												onChange={(v: string) => setCompanyInfo({ ...companyInfo, marketPointsRequired: Math.max(1, Number(v)) })} 
											/>
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
							<SalarySummary
								userList={filteredUserList}
								ownerId={owner.ownerId}
								companyInfo={companyInfo}
								logs={attendanceLogs}
								fieldLogs={fieldCheckins}
							/>
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

export default AdminSettings;
