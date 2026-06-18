import React, { useState, useEffect, useRef } from 'react';
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
	Calendar,
	Bot,
	Zap,
	AlertTriangle,
	Eye,
	Download,
	Rocket,
	Shield
} from 'lucide-react';
import { useToast } from '../components/shared/Toast';
import { auth, db } from '../services/firebase';
import { createAdminNotification } from '../utils/notifications';
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

const VIETNAM_BANKS = [
	{ id: "VCB", name: "Vietcombank (VCB)" },
	{ id: "ICB", name: "VietinBank (ICB)" },
	{ id: "BIDV", name: "BIDV" },
	{ id: "VBA", name: "Agribank (VBA)" },
	{ id: "STB", name: "Sacombank (STB)" },
	{ id: "TCB", name: "Techcombank (TCB)" },
	{ id: "MB", name: "MBBank (MB)" },
	{ id: "ACB", name: "ACB" },
	{ id: "VPB", name: "VPBank (VPB)" },
	{ id: "TPB", name: "TPBank (TPB)" },
	{ id: "VIB", name: "VIB" },
	{ id: "HDB", name: "HDBank (HDB)" },
	{ id: "SHB", name: "SHB" },
	{ id: "EIB", name: "Eximbank (EIB)" },
	{ id: "MSB", name: "MSB" },
	{ id: "OCB", name: "OCB" },
	{ id: "SCB", name: "SCB" },
	{ id: "LPB", name: "LienVietPostBank (LPB)" },
	{ id: "SGB", name: "Saigonbank (SGB)" },
	{ id: "NAB", name: "Nam A Bank (NAB)" },
	{ id: "KLB", name: "Kienlongbank (KLB)" },
	{ id: "VAB", name: "VietA Bank (VAB)" },
	{ id: "BVB", name: "BaoViet Bank (BVB)" },
	{ id: "NCB", name: "NCB" }
];

const renderAddonIcon = (iconName: string, className: string) => {
	switch (iconName) {
		case 'Crown': return <Crown className={className} />;
		case 'Rocket': return <Rocket className={className} />;
		case 'Shield': return <Shield className={className} />;
		case 'Download': return <Download className={className} />;
		case 'Database': return <Database className={className} />;
		case 'Activity': return <Activity className={className} />;
		case 'Zap':
		default:
			return <Zap className={className} />;
	}
};

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
	const [logs, setLogs] = useState<any[]>([]);
	const [aiAnomalies, setAiAnomalies] = useState<any[]>([]);
	const [isAiActive, setIsAiActive] = useState(true);
	const [systemConfig, setSystemConfig] = useState<any>({
		lock_free_orders: false,
		lock_free_debts: false,
		lock_free_sheets: false,
		maintenance_mode: false,
		ai_auto_lock: true
	});
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const isRunningRef = useRef(false); // 🛡️ Guard chạy chồng lấn

	// Config Tab States
	const [paymentConfig, setPaymentConfig] = useState({
		bankId: '',
		accountNumber: '',
		accountName: ''
	});
	const [isSavingConfig, setIsSavingConfig] = useState(false);
	const [addons, setAddons] = useState<any[]>([]);
	const [editingAddon, setEditingAddon] = useState<any>(null);

	const filteredCustomers = customers.filter(c => {
		const queryStr = searchQuery.toLowerCase().trim();
		if (!queryStr) return true;
		
		const name = (c.displayName || '').toLowerCase();
		const email = (c.email || '').toLowerCase();
		const uid = (c.uid || '').toLowerCase();
		
		return name.includes(queryStr) || email.includes(queryStr) || uid.includes(queryStr);
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
			const usersData = userSnap.docs.map(d => ({ id: d.id, ...d.data(), uid: d.data().uid || d.id }));
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
						manualLockSheets: s.manualLockSheets || false,
						manualLockAi: s.manualLockAi || false
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

		// 4. Listen to Audit Logs (System-wide)
		const qLogs = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(100));
		const unsubLogs = onSnapshot(qLogs, (snap) => {
			const newLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			setLogs(newLogs);

			// AI ANOMALY DETECTION (Pocket Click Logic)
			if (isAiActive) {
				const userActionCounts: Record<string, any[]> = {};
				const now = Date.now();

				newLogs.forEach((log: any) => {
					const time = log.createdAt?.toMillis ? log.createdAt.toMillis() : 0;
					if (now - time < 60000) { // Only check last 60 seconds
						if (!userActionCounts[log.ownerId]) userActionCounts[log.ownerId] = [];
						userActionCounts[log.ownerId].push(log);
					}
				});

				const anomalies: any[] = [];
				Object.entries(userActionCounts).forEach(([ownerId, actions]) => {
					if (actions.length >= 10) { // 🟡 Threshold: 10 actions (tăng từ 5)
						const times = actions.map(a => a.createdAt?.toMillis ? a.createdAt.toMillis() : 0).sort();
						const span = times[times.length - 1] - times[0];
						if (span < 30000) { // 🟡 30 giây (tăng từ 15s)
							anomalies.push({
								ownerId,
								email: actions[0].user,
								severity: 'high',
								reason: 'RAPID_ACTIONS_DETECTED',
								details: `Phát hiện ${actions.length} thao tác trong ${Math.round(span / 1000)}s — Nghi ngờ thao tác nhanh bất thường.`
							});

							// AUTO LOCK if enabled
							if (systemConfig.ai_auto_lock) {
								executeAiAutoLock(ownerId, actions[0].user);
							}
						}
					}
				});
				setAiAnomalies(anomalies);
			}
		});

		// 5. System config & Addons for Config Tab
		const unsubConfig = onSnapshot(doc(db, 'system_config', 'payment'), (snap) => {
			if (snap.exists()) {
				setPaymentConfig(snap.data() as any);
			}
		});

		const unsubAddons = onSnapshot(collection(db, 'subscription_packages'), (snap) => {
			const fetchedAddons = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			fetchedAddons.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
			setAddons(fetchedAddons);
		});

		return () => {
			unsubRequests();
			unsubUsers();
			unsubLogs();
			unsubConfig();
			unsubAddons();
		};
	}, [navigate, isAiActive, systemConfig.ai_auto_lock]);

	const executeAiAutoLock = async (ownerId: string, email: string) => {
		try {
			// Only lock if not already locked
			const settingsRef = doc(db, 'settings', ownerId);
			const snap = await getDoc(settingsRef);
			const data = snap.data() || {};

			if (!data.manualLockOrders || !data.manualLockDebts || !data.manualLockSheets || !data.manualLockAi) {
				// We use setDoc with merge instead of updateDoc in case the doc doesn't exist yet
				await setDoc(settingsRef, {
					manualLockOrders: true,
					manualLockDebts: true,
					manualLockSheets: true,
					manualLockAi: true,
					aiLockedAt: serverTimestamp(),
					aiLockReason: 'RAPID_ACTIONS_PREVENTION'
				}, { merge: true });

				// 🔍 AI Verification Step
				const verifySnap = await getDoc(settingsRef);
				const isLocked = verifySnap.exists() && verifySnap.data().manualLockOrders && verifySnap.data().manualLockDebts && verifySnap.data().manualLockSheets && verifySnap.data().manualLockAi;

				// Notify User via Bell
				await addDoc(collection(db, 'notifications'), {
					userId: ownerId,
					title: '🔒 NEXUS AI: PHÁT HIỆN THAO TÁC NHANH',
					body: 'Hệ thống phát hiện thao tác nhanh bất thường. AI đã chủ động tạm khoá tính năng trong 30 phút để bảo vệ dữ liệu. Tính năng sẽ tự động mở lại sau 30 phút.',
					type: 'alert',
					priority: 'high',
					read: false,
					createdAt: serverTimestamp()
				});

				// Log AI Action
				await addDoc(collection(db, 'ai_actions'), {
					type: 'security_lock',
					targetEmail: email,
					targetId: ownerId,
					details: 'Tự động khóa do phát hiện Pocket Click (thao tác nhanh bất thường)',
					timestamp: serverTimestamp()
				});

				showToast(`AI đã tự động khóa tài khoản ${email} do nghi ngờ cấn máy!`, "warning");
			}
		} catch (e) {
			console.error("AI Auto Lock Error:", e);
		}
	};

	// --- AUTONOMOUS AI MANAGER LOGIC ---
	const [aiActions, setAiActions] = useState<any[]>([]);

	useEffect(() => {
		const qActions = query(collection(db, 'ai_actions'), orderBy('timestamp', 'desc'), limit(20));
		return onSnapshot(qActions, (snap) => {
			setAiActions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});
	}, []);

	const customersRef = useRef(customers);
	useEffect(() => {
		customersRef.current = customers;
	}, [customers]);

	// ✅ CHỈ 1 interval duy nhất — guard chặn chạy chồng lấn
	const runAutonomousCycle = async (currentCustomers: any[], currentRequests: any[]) => {
		if (!isAiActive) return;
		if (isRunningRef.current) { console.log("Nexus AI: skipped (running)"); return; }
		isRunningRef.current = true;
		try {
			console.log("Nexus AI: Starting cycle...");
			if (currentCustomers.length === 0) return;
			
			// 0. Check bank transfer matches (mỗi 5 phút)
			await checkBankTransferMatches();
			
			const processPromises = currentCustomers.map(async (customer) => {
				if (customer.email === NEXUS_ADMIN_EMAIL) return;
				const status = getEffectiveStatus(customer);
				const now = new Date();
				// 1. Provision new users - dùng gói trial từ subscription_packages
				if (!customer.planId && !customer.isAiProcessed) {
					const expireDate = new Date();
					// Tìm gói trial/free trong subscription_packages để lấy durationDays
					let trialDays = 60; // mặc định 60 ngày
					try {
						const pkgSnap = await getDoc(doc(db, 'subscription_packages', 'free_trial'));
						if (pkgSnap.exists() && pkgSnap.data().price === 0) {
							trialDays = Number(pkgSnap.data().durationDays) || 60;
						}
					} catch (e) { /* fallback 60 ngày */ }
					expireDate.setDate(expireDate.getDate() + trialDays);
					await setDoc(doc(db, 'settings', customer.uid), { planId: 'free_trial', isPro: false, subscriptionStatus: 'trial', subscriptionExpiresAt: expireDate, graceUntil: null, isAiProcessed: true }, { merge: true });
				}
				// 2. Grace period
				if (status.isExpired) {
					const expireAt = parseExpireDate(customer.subscriptionExpiresAt);
					const graceUntil = parseExpireDate(customer.graceUntil);
					if (!graceUntil && expireAt) {
						const graceEnd = new Date(expireAt.getTime());
						graceEnd.setDate(graceEnd.getDate() + 3);
						if (now < graceEnd) {
							await setDoc(doc(db, 'settings', customer.uid), { graceUntil: graceEnd, subscriptionStatus: 'grace' }, { merge: true });
							await addDoc(collection(db, 'notifications'), { userId: customer.uid, title: '⚠️ GÓI ĐÃ HẾT HẠN — 3 NGÀY ÂN HẠN', body: `Gói đã hết hạn. Bạn có 3 ngày (đến ${graceEnd.toLocaleDateString('vi-VN')}) để gia hạn trước khi bị khoá.`, type: 'warning', priority: 'high', read: false, createdAt: serverTimestamp() });
							// 📢 Thông báo cho admin
							await createAdminNotification(customer.uid, { title: '⚠️ KH gần hết hạn', body: `${customer.email || customer.uid} sắp hết hạn gói. Gia hạn trước ${graceEnd.toLocaleDateString('vi-VN')}.`, type: 'subscription', priority: 'high' });
							return;
						}
					}
					if (graceUntil && now >= graceUntil) { await hardLockUser(customer); return; }
				}
				// 3. Auto-unlock after 30 min
				if (customer.manualLockAi && customer.aiLockedAt) {
					const lockedAt = parseExpireDate(customer.aiLockedAt);
					if (lockedAt && (now.getTime() - lockedAt.getTime()) > 30 * 60 * 1000) {
						await setDoc(doc(db, 'settings', customer.uid), { manualLockOrders: false, manualLockDebts: false, manualLockSheets: false, manualLockAi: false, aiLockedAt: null, aiLockReason: null }, { merge: true });
						await addDoc(collection(db, 'notifications'), { userId: customer.uid, title: '🔓 TỰ ĐỘNG MỞ KHOÁ', body: 'Hệ thống đã tự mở khoá sau 30 phút.', type: 'unlock', read: false, createdAt: serverTimestamp() });
					}
				}
			});
			await Promise.all(processPromises);
		} finally {
			isRunningRef.current = false;
		}
	};

	// 💰 Check bank transfer matches from AppScript (auto-confirm payments)
	const checkBankTransferMatches = async () => {
		const lastCheck = localStorage.getItem('nexus_last_bank_check');
		const now = Date.now();
		if (lastCheck && now - parseInt(lastCheck) < 5 * 60 * 1000) return; // Mỗi 5 phút
		
		try {
			const appscriptUrl = 'https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec';
			const res = await fetch(`${appscriptUrl}?token=dunvex-nexus-2026&action=check_transfers`, { method: 'GET' });
			if (res.ok) {
				const data = await res.json();
				if (data.matches > 0) {
					console.log(`Nexus: Auto-matched ${data.matches} bank transfers`, data.details);
				}
			}
		} catch (e) {
			// AppScript có thể chưa bật Gmail API — silent fail
		}
		localStorage.setItem('nexus_last_bank_check', now.toString());
	};

	const hardLockUser = async (customer: any) => {
		if (customer.manualLockOrders && customer.manualLockDebts && customer.manualLockSheets && customer.manualLockAi) return;
		await setDoc(doc(db, 'settings', customer.uid), { manualLockOrders: true, manualLockDebts: true, manualLockSheets: true, manualLockAi: true, subscriptionStatus: 'expired', isPro: false, graceUntil: null }, { merge: true });
		await addDoc(collection(db, 'notifications'), { userId: customer.uid, title: '🔒 TÍNH NĂNG ĐÃ BỊ KHOÁ', body: 'Gói đã hết hạn. Vui lòng gia hạn để tiếp tục.', type: 'lock', priority: 'high', read: false, createdAt: serverTimestamp() });
		// 📢 Thông báo cho admin
		await createAdminNotification(customer.uid, { title: '🔒 KH ĐÃ BỊ KHOÁ', body: `${customer.email || customer.uid} đã hết hạn gói và bị khoá tính năng.`, type: 'subscription', priority: 'high' });
	};

	const parseExpireDate = (val: any): Date | null => {
		if (!val) return null;
		if (val.toDate) return val.toDate();
		if (val.seconds) return new Date(val.seconds * 1000);
		if (val instanceof Date) return val;
		return null;
	};

	// Interval 30 giây
	useEffect(() => {
		if (!isAiActive) return;
		const interval = setInterval(() => runAutonomousCycle(customersRef.current, requests), 30000);
		return () => clearInterval(interval);
	}, [isAiActive]);

	const handleUpdatePlan = async (ownerId: string, newPlan: string) => {
		if (!window.confirm(`Xác nhận hành động: ${newPlan === 'cancel_payment' ? 'HUỶ ĐĂNG KÝ VÀ KHÓA' : newPlan}?`)) return;
		try {
			if (newPlan === 'cancel_payment') {
				const expireDate = new Date();
				expireDate.setDate(expireDate.getDate() - 2); // Explicitly expired

				await setDoc(doc(db, 'settings', ownerId), {
					planId: 'free',
					isPro: false,
					subscriptionStatus: 'expired',
					subscriptionExpiresAt: expireDate,
					manualLockOrders: true,
					manualLockDebts: true,
					manualLockSheets: true,
					manualLockAi: true
				}, { merge: true });

				await addDoc(collection(db, 'notifications'), {
					userId: ownerId,
					title: '⛔ HỦY TRUY CẬP (CHƯA NHẬN ĐƯỢC THANH TOÁN)',
					body: 'Admin đã kiểm tra đối soát nhưng chưa nhận được lệnh chuyển khoản từ bạn. Hệ thống đã tiến hành thu hồi gói cước và thiết lập khóa tính năng. Vui lòng thanh toán lại hoặc liên hệ hỗ trợ.',
					type: 'alert',
					priority: 'high',
					read: false,
					createdAt: serverTimestamp()
				});

				showToast("Đã hủy đăng ký, thiết lập khóa và gửi thông báo cho khách!", "success");
				return;
			}

			const isPro = newPlan !== 'free' && newPlan !== 'test_expire';
			const expireDate = new Date();

			if (newPlan === 'premium_monthly') {
				expireDate.setMonth(expireDate.getMonth() + 1);
			} else if (newPlan === 'premium_yearly') {
				expireDate.setFullYear(expireDate.getFullYear() + 1);
			} else if (newPlan === 'test_expire') {
				expireDate.setDate(expireDate.getDate() - 1);
			} else {
				// Free plan policy: 60 days
				expireDate.setDate(expireDate.getDate() + 60);
			}

			await setDoc(doc(db, 'settings', ownerId), {
				planId: newPlan,
				isPro: isPro,
				subscriptionStatus: isPro ? 'active' : 'trial',
				paymentConfirmedAt: serverTimestamp(),
				subscriptionExpiresAt: expireDate
			}, { merge: true });
			showToast("Cập nhật gói thành công. Số ngày còn lại đã được đồng bộ!", "success");
		} catch (error) {
			console.error("Plan Update Error:", error);
			showToast("Lỗi khi cập nhật gói", "error");
		}
	};

	const getEffectiveStatus = (c: any) => {
		const now = new Date();
		// Try paymentConfirmedAt first, then fall back to user's createdAt (account creation date)
		const parseDate = (val: any) => {
			if (!val) return null;
			if (val.toDate) return val.toDate();
			if (val.seconds) return new Date(val.seconds * 1000);
			if (val instanceof Date) return val;
			if (typeof val === 'string') return new Date(val);
			return null;
		};
		const joinedAt = parseDate(c.paymentConfirmedAt) || parseDate(c.createdAt);
		const expireAt = parseDate(c.subscriptionExpiresAt);

		const diffDays = joinedAt ? Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;

		// Calculate days remaining from expireAt
		let daysRemaining = 0;
		if (expireAt) {
			daysRemaining = Math.max(0, Math.ceil((expireAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
		} else if (joinedAt) {
			// Legacy fallback: calculate remaining based on plan duration
			const plan = c.planId || (c.isPro ? 'premium_monthly' : 'free');
			const totalDays = plan === 'free' ? 60 : plan === 'premium_monthly' ? 30 : 365;
			daysRemaining = Math.max(0, totalDays - diffDays);
		}

		let isExpired = false;
		if (expireAt) {
			isExpired = expireAt < now;
		} else if (joinedAt) {
			// Legacy fallback if expireAt is missing
			const plan = c.planId || (c.isPro ? 'premium_monthly' : 'free');
			if (plan === 'free' && diffDays > 60) isExpired = true;
			else if (plan === 'premium_monthly' && diffDays > 30) isExpired = true;
			else if (plan === 'premium_yearly' && diffDays > 365) isExpired = true;
		}

		return {
			isExpired,
			daysUsed: diffDays,
			daysRemaining,
			joinedAt
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

			const planId = request.planId;

			if (planId && planId.startsWith('addon_export')) {
				const currentMonth = new Date().toISOString().slice(0, 7);
				const { setDoc, increment } = await import('firebase/firestore');
				await setDoc(doc(db, 'usage_limits', `${request.ownerId}_${currentMonth}`), {
					extraExportLimit: increment(5)
				}, { merge: true });
			} else if (planId === 'addon_ai_assistant') {
				await setDoc(doc(db, 'settings', request.ownerId), {
					hasAIAssistant: true
				}, { merge: true });
			} else {
				const expireDate = new Date();
				// Đọc durationDays từ gói trong subscription_packages
				let durDays = 30; // mặc định 30 ngày
				try {
					const planSnap = await getDoc(doc(db, 'subscription_packages', request.planId));
					if (planSnap.exists() && planSnap.data().durationDays) {
						durDays = Number(planSnap.data().durationDays);
					} else {
						// Fallback cũ nếu gói không có durationDays
						const isYearly = planId === 'premium_yearly' || planId === 'addon_yearly';
						durDays = isYearly ? 365 : 30;
					}
				} catch (e) { /* fallback */ }
				expireDate.setDate(expireDate.getDate() + durDays);

				await setDoc(doc(db, 'settings', request.ownerId), {
					subscriptionStatus: 'active',
					isPro: true,
					planId: request.planId,
					paymentConfirmedAt: serverTimestamp(),
					subscriptionExpiresAt: expireDate,
					// Auto-unlock features upon approval
					manualLockOrders: false,
					manualLockDebts: false,
					manualLockSheets: false,
					manualLockAi: false
				}, { merge: true });
			}

			// Notify User
			await addDoc(collection(db, 'notifications'), {
				userId: request.ownerId,
				title: '✨ GIA HẠN THÀNH CÔNG',
				body: `Hệ thống đã nhận được xác nhận thanh toán. Gói ${request.planName || request.planId} đã được kích hoạt thành công.`,
				type: 'success',
				priority: 'high',
				read: false,
				createdAt: serverTimestamp()
			});

			// 📢 Thông báo cho admin về gói đăng ký mới
			await createAdminNotification(request.ownerId, {
				title: `💰 GÓI MỚI: ${request.planName || request.planId}`,
				body: `${request.userEmail} vừa đăng ký gói ${request.planName || request.planId} — ${request.amount.toLocaleString('vi-VN')}đ. Đã được duyệt & kích hoạt.`,
				type: 'subscription',
				priority: 'high'
			});

			// 📢 Thông báo cho admin về gói đăng ký mới
			await createAdminNotification(request.ownerId, {
				title: `💰 GÓI MỚI: ${request.planName || request.planId}`,
				body: `${request.userEmail} vừa đăng ký gói ${request.planName || request.planId} — ${request.amount.toLocaleString('vi-VN')}đ. Đã được duyệt & kích hoạt.`,
				type: 'subscription',
				priority: 'high'
			});

			showToast("Đã duyệt thanh toán và kích hoạt tài khoản!", "success");
		} catch (error) {
			console.error("Approve Payment Error:", error);
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

			await setDoc(doc(db, 'settings', request.ownerId), {
				subscriptionStatus: 'expired',
				isPro: false,
				revokedAt: serverTimestamp(),
				revokeReason: reason,
				// Re-lock features
				manualLockOrders: true,
				manualLockDebts: true,
				manualLockSheets: true,
				manualLockAi: true
			}, { merge: true });

			// Notify User
			await addDoc(collection(db, 'notifications'), {
				userId: request.ownerId,
				title: '❌ GIAO DỊCH BỊ TỪ CHỐI',
				body: `Yêu cầu gia hạn của bạn đã bị từ chối. Lý do: ${reason}. Hệ thống sẽ duy trì trạng thái khóa nếu tài khoản đã hết hạn.`,
				type: 'error',
				priority: 'high',
				read: false,
				createdAt: serverTimestamp()
			});

			showToast("Đã từ chối/thu hồi yêu cầu.", "info");
		} catch (error) {
			console.error("Reject Payment Error:", error);
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

	const handleSaveConfig = async () => {
		if (!paymentConfig.bankId || !paymentConfig.accountNumber || !paymentConfig.accountName) {
			showToast("Vui lòng điền đầy đủ thông tin", "error");
			return;
		}
		setIsSavingConfig(true);
		try {
			await setDoc(doc(db, 'system_config', 'payment'), {
				...paymentConfig,
				bankId: paymentConfig.bankId.toUpperCase(),
				accountName: paymentConfig.accountName.toUpperCase(),
				updatedAt: serverTimestamp(),
				updatedBy: auth.currentUser?.email
			});
			showToast("Đã cập nhật thông tin QR thanh toán!", "success");
		} catch (error) {
			showToast("Lỗi khi lưu cấu hình", "error");
		} finally {
			setIsSavingConfig(false);
		}
	};

	const handleSaveAddon = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingAddon.id || !editingAddon.name || !editingAddon.price) {
			showToast("Vui lòng điền đủ mã, tên và giá gói", "error");
			return;
		}
		try {
			await setDoc(doc(db, 'subscription_packages', editingAddon.id), {
				name: editingAddon.name,
				price: Number(editingAddon.price),
				description: editingAddon.description || '',
				icon: editingAddon.icon || 'Zap',
				durationDays: Number(editingAddon.durationDays) || 30,
				features: typeof editingAddon.features === 'string' ? editingAddon.features.split('\n').filter((f: string) => f.trim() !== '') : (editingAddon.features || []),
				bgClass: editingAddon.bgClass || 'bg-slate-50 dark:bg-slate-800',
				textClass: editingAddon.textClass || 'text-slate-500',
				shadowClass: editingAddon.shadowClass || 'shadow-none'
			});
			showToast("Đã lưu gói dịch vụ!", "success");
			setEditingAddon(null);
		} catch (error) {
			showToast("Lỗi lưu gói dịch vụ", "error");
		}
	};

	const handleDeleteAddon = async (id: string) => {
		if (!window.confirm("Chắc chắn xóa gói dịch vụ này?")) return;
		try {
			const { deleteDoc } = await import('firebase/firestore');
			await deleteDoc(doc(db, 'subscription_packages', id));
			showToast("Đã xóa gói dịch vụ", "info");
		} catch (error) {
			showToast("Lỗi khi xóa gói dịch vụ", "error");
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
				'manualLockSheets': 'Tải & Đồng bộ dữ liệu (Export)',
				'manualLockAi': 'Trợ lý AI'
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
		} catch (error: any) {
			console.error("Lock Toggle Error:", error);
			showToast("Lỗi khi khóa: " + error.message, "error");
		}
	};

	if (auth.currentUser?.email !== NEXUS_ADMIN_EMAIL) {
		return (
			<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 flex flex-col items-center justify-center text-slate-800 dark:text-slate-900 dark:text-white p-8">
				<div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-6 border border-red-500/20">
					<Lock size={64} />
				</div>
				<h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Access Denied</h1>
				<p className="text-slate-500 dark:text-slate-400 text-center max-w-md">Nexus Control is restricted to system administrators only.</p>
				<button onClick={() => navigate('/')} className="mt-8 bg-white dark:bg-slate-900 dark:bg-white text-slate-900 dark:text-white dark:text-slate-950 px-8 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all">Go Back</button>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 p-4 md:p-8 pb-32 font-sans selection:bg-indigo-500 selection:text-slate-900 dark:text-white transition-colors duration-300">
			<div className="max-w-[1400px] mx-auto">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
					<div className="flex items-center gap-4">
						<div>
							<h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-900 dark:text-white uppercase tracking-tight">Nexus Control</h1>
							<p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">System Core v1.0</p>
						</div>
						<button 
							onClick={() => runAutonomousCycle(customers, requests)}
							className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95"
						>
							<Bot size={14} />
							Đồng bộ AI
						</button>
						<button 
							onClick={checkBankTransferMatches}
							className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
							title="Kiểm tra email ngân hàng đối chiếu chuyển khoản"
						>
							<CreditCard size={14} />
							Check Bank
						</button>
					</div>

					<div className="flex bg-white dark:bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
						<TabItem active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} icon={<Activity size={18} />} label="Hệ thống" badge={stats.pendingPayments} />
						<TabItem active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={18} />} label="Khách hàng" />
						<TabItem active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<Settings size={18} />} label="Lịch sử Log" />
						<TabItem active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Bot size={18} />} label="Cấu hình" />
					</div>
				</div>

				<div className="space-y-8 animate-in fade-in duration-500">
					{/* Stats Grid */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10">
						<StatBox label="Doanh Nghiệp" value={stats.totalUsers} icon={<Users />} color="blue" />
						<StatBox label="Tài khoản Pro" value={stats.activePro} icon={<Crown />} color="amber" />
						<StatBox label="Yêu cầu chờ" value={stats.pendingPayments} icon={<Clock />} color="orange" />
						<StatBox label="Chuyển đổi" value={`${Math.round((stats.activePro / (stats.totalUsers || 1)) * 100)}%`} icon={<ArrowUpRight />} color="emerald" />
					</div>

					{activeTab === 'requests' && (
						<div className="space-y-6">
							<div className="bg-white dark:bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
								{/* Desktop Table */}
								<div className="hidden md:block overflow-x-auto custom-scrollbar">
									<table className="w-full text-left min-w-[800px]">
										<thead>
											<tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
												<th className="px-8 py-5">Khách hàng</th>
												<th className="px-8 py-5">Gói đăng ký</th>
												<th className="px-8 py-5">Ngày gửi</th>
												<th className="px-8 py-5">Coupon</th>
												<th className="px-8 py-5">Nội dung chuyển</th>
												<th className="px-8 py-5">Số tiền</th>
												<th className="px-8 py-5 text-right">Hành động</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
											{requests.map((req) => (
												<tr key={req.id} className="hover:bg-slate-800/30 transition-colors group text-xs">
													<td className="px-8 py-6">
														<div className="flex items-center gap-3">
															<div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-400">
																{req.userEmail?.[0].toUpperCase()}
															</div>
															<div className="max-w-[150px] truncate">
																<p className="font-bold text-slate-900 dark:text-white truncate">{req.userEmail}</p>
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
													<td className="px-8 py-6 font-black text-slate-900 dark:text-white">{req.amount.toLocaleString()}đ</td>
													<td className="px-8 py-6 text-right">
														<div className="flex justify-end gap-2">
															<button
																onClick={() => handleApprovePayment(req)}
																className={`size-10 rounded-xl flex items-center justify-center transition-all ${req.status === 'approved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-slate-900 dark:text-white'}`}
															>
																<CheckCircle2 size={18} />
															</button>
															<button
																onClick={() => handleRejectPayment(req)}
																className={`size-10 rounded-xl flex items-center justify-center transition-all ${req.status === 'rejected' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-slate-900 dark:text-white'}`}
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

								{/* Mobile Cards */}
								<div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
									{requests.map((req) => (
										<div key={req.id} className="p-6 space-y-4">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-400">
														{req.userEmail?.[0].toUpperCase()}
													</div>
													<div>
														<p className="font-bold text-slate-900 dark:text-white text-sm">{req.userEmail}</p>
														<p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{req.ownerId?.slice(-8)}</p>
													</div>
												</div>
												<span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${req.planId === 'premium_yearly' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
													{req.planName}
												</span>
											</div>
											<div className="grid grid-cols-2 gap-4 text-[10px] items-center">
												<div>
													<p className="text-slate-500 font-black uppercase tracking-widest mb-1">Số tiền</p>
													<p className="text-slate-900 dark:text-white font-black text-base">{req.amount.toLocaleString()}đ</p>
												</div>
												<div>
													<p className="text-slate-500 font-black uppercase tracking-widest mb-1">Mã CK</p>
													<p className="text-indigo-400 font-black tracking-widest uppercase">{req.transferCode || '---'}</p>
												</div>
											</div>
											<div className="flex items-center justify-between pt-2">
												<div className="text-[9px] text-slate-500 font-medium">
													{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString('vi-VN') : '---'}
												</div>
												<div className="flex gap-2">
													<button
														onClick={() => handleApprovePayment(req)}
														className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2"
													>
														<CheckCircle2 size={14} /> Duyệt
													</button>
													<button
														onClick={() => handleRejectPayment(req)}
														className="bg-rose-500/10 text-rose-500 px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2"
													>
														<XCircle size={14} /> Loại
													</button>
												</div>
											</div>
										</div>
									))}
									{requests.length === 0 && (
										<div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs opacity-40">
											Không có yêu cầu nào
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{activeTab === 'logs' && (
						<div className="space-y-6">
							<div className="bg-white dark:bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
								<div className="px-6 lg:px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-800/20">
									<div>
										<h4 className="text-[10px] lg:text-xs font-black text-indigo-400 uppercase tracking-[4px] mb-1">System Audit Logs</h4>
										<p className="text-[9px] lg:text-[10px] text-slate-500 font-bold uppercase tracking-wider">Theo dõi hoạt động toàn hệ thống</p>
									</div>
									<div className="size-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
										<Activity size={20} />
									</div>
								</div>

								{/* Desktop Table */}
								<div className="hidden md:block overflow-x-auto custom-scrollbar">
									<table className="w-full text-left min-w-[800px]" data-chatbot="audit-logs-table">
										<thead>
											<tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
												<th className="px-8 py-5">Thời gian</th>
												<th className="px-8 py-5">Người dùng</th>
												<th className="px-8 py-5">Trang</th>
												<th className="px-8 py-5">Hành động</th>
												<th className="px-8 py-5">Chi tiết</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
											{logs.map((log) => (
												<tr key={log.id} className="hover:bg-slate-800/30 transition-colors group text-xs" data-chatbot-row={log.id}>
													<td className="px-8 py-6 text-slate-400 font-medium whitespace-nowrap" data-chatbot-cell="time">
														{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('vi-VN', {
															hour: '2-digit',
															minute: '2-digit',
															day: '2-digit',
															month: '2-digit',
															year: '2-digit'
														}) : '---'}
													</td>
													<td className="px-8 py-6" data-chatbot-cell="user">
														<div className="flex items-center gap-3">
															<div className="size-8 rounded-lg bg-slate-800 flex items-center justify-center font-black text-slate-500 text-[10px]">
																{log.user?.[0].toUpperCase() || 'U'}
															</div>
															<div className="max-w-[200px] truncate">
																<p className="font-bold text-slate-900 dark:text-white truncate">{log.user || 'Hệ thống'}</p>
																<p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{log.ownerId?.slice(-8) || 'GLOBAL'}</p>
															</div>
														</div>
													</td>
													<td className="px-8 py-6">
														<span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">{log.path || '/home'}</span>
													</td>
													<td className="px-8 py-6" data-chatbot-cell="action">
														<span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-slate-800 text-indigo-400 border border-slate-700/50`}>
															{log.action}
														</span>
													</td>
													<td className="px-8 py-6 text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-md" data-chatbot-cell="details">
														{log.details}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>

								{/* Mobile Cards */}
								<div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
									{logs.map((log) => (
										<div key={log.id} className="p-6 space-y-3">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{log.user || 'Hệ thống'}</p>
													<span className="text-[9px] text-slate-500 font-bold px-1.5 py-0.5 bg-slate-800 rounded">{log.ownerId?.slice(-8) || 'GLOBAL'}</span>
												</div>
												<span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">{log.action}</span>
											</div>
											<p className="text-xs text-slate-400 font-medium leading-relaxed">{log.details}</p>
											<div className="flex items-center justify-between pt-2">
												<span className="text-[9px] text-slate-600 font-black uppercase tracking-tighter">{log.path || '/home'}</span>
												<span className="text-[9px] text-slate-600 font-medium">
													{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('vi-VN') : '---'}
												</span>
											</div>
										</div>
									))}
									{logs.length === 0 && (
										<div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs opacity-40">
											Chưa có dữ liệu nhật ký
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{activeTab === 'customers' && (
						<div className="bg-white dark:bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
							<div className="px-6 lg:px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-slate-800/20">
								<div>
									<h4 className="text-[10px] lg:text-xs font-black text-indigo-400 uppercase tracking-[4px] mb-1">Doanh nghiệp & Thành viên</h4>
									<p className="text-[9px] lg:text-[10px] text-slate-500 font-bold uppercase tracking-wider">Danh sách tài khoản đăng nhập và quản lý gói</p>
								</div>
								<div className="flex items-center gap-4">
									<div className="relative w-full md:w-80">
										<div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
											<Search size={16} />
										</div>
										<input
											type="text"
											placeholder="Tìm theo tên, email hoặc UID..."
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs text-slate-900 dark:text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-all font-medium"
										/>
										{searchQuery && (
											<button
												onClick={() => setSearchQuery('')}
												className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-900 dark:text-white transition-colors"
											>
												<XCircle size={16} />
											</button>
										)}
									</div>
									<div className="size-10 shrink-0 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
										<Users size={20} />
									</div>
								</div>
							</div>

							{/* Desktop Table */}
							<div className="hidden lg:block overflow-x-auto custom-scrollbar">
								<table className="w-full text-left min-w-[900px]">
									<thead>
										<tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
											<th className="px-6 py-5">Doanh nghiệp</th>
											<th className="px-6 py-5">Email Owner</th>
											<th className="px-6 py-5">Gói</th>
											<th className="px-6 py-5">Ngày vào trang</th>
											<th className="px-3 py-5 text-center">Đơn</th>
											<th className="px-3 py-5 text-center">Nợ</th>
											<th className="px-3 py-5 text-center">Sheet</th>
											<th className="px-3 py-5 text-center">AI</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
										{filteredCustomers.map((c) => {
											const eff = getEffectiveStatus(c);
											return (
												<tr key={c.id} className="hover:bg-slate-800/30 transition-colors text-xs">
													<td className="px-6 py-6 font-bold text-slate-900 dark:text-white uppercase truncate max-w-[150px]">
														{c.displayName || 'No Name'}
													</td>
													<td className="px-6 py-6 text-slate-400">{c.email}</td>
													<td className="px-6 py-6">
														<select
															className="bg-slate-800 text-slate-900 dark:text-white text-[10px] font-black rounded-lg px-2 py-1 outline-none border border-slate-700 hover:border-indigo-500 transition-colors cursor-pointer"
															value={c.planId || (c.isPro ? 'premium_monthly' : 'free')}
															onChange={(e) => handleUpdatePlan(c.uid, e.target.value)}
														>
															<option value="test_expire">TEST HẾT HẠN (-1d)</option>
															<option value="free">FREE (60d)</option>
															<option value="premium_monthly">1 THÁNG (30d)</option>
															<option value="premium_yearly">1 NĂM (365d)</option>
															<option value="cancel_payment">⛔ HUỶ ĐĂNG KÝ (KHÓA)</option>
														</select>
													</td>
													<td className="px-6 py-6 text-slate-500 whitespace-nowrap">
														<div className={`font-bold text-[10px] ${eff.isExpired ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}`}>
															{eff.isExpired ? 'ĐÃ HẾT HẠN' : 'ĐANG HIỆU LỰC'}
														</div>
														<div className="text-[10px] uppercase font-black tracking-tighter">
															{eff.joinedAt ? eff.joinedAt.toLocaleDateString('vi-VN') : '---'}
															<span className="ml-1 opacity-50">({eff.isExpired ? `${eff.daysUsed}D` : `${eff.daysRemaining}D`})</span>
														</div>
													</td>
													<td className="px-3 py-6 text-center">
														<button
															onClick={() => toggleUserLock(c.uid, 'manualLockOrders', c.manualLockOrders)}
															className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockOrders ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-white'}`}
															title={c.manualLockOrders ? "Đã khóa" : "Khóa thủ công"}
														>
															{c.manualLockOrders ? <Lock size={12} /> : <Unlock size={12} />}
														</button>
													</td>
													<td className="px-3 py-6 text-center">
														<button
															onClick={() => toggleUserLock(c.uid, 'manualLockDebts', c.manualLockDebts)}
															className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockDebts ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-white'}`}
															title={c.manualLockDebts ? "Đã khóa" : "Khóa thủ công"}
														>
															{c.manualLockDebts ? <Lock size={12} /> : <Unlock size={12} />}
														</button>
													</td>
													<td className="px-3 py-6 text-center">
														<button
															onClick={() => toggleUserLock(c.uid, 'manualLockSheets', c.manualLockSheets)}
															className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockSheets ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-white'}`}
															title={c.manualLockSheets ? "Đã khóa" : "Khóa thủ công"}
														>
															{c.manualLockSheets ? <Lock size={12} /> : <Unlock size={12} />}
														</button>
													</td>
													<td className="px-3 py-6 text-center">
														<button
															onClick={() => toggleUserLock(c.uid, 'manualLockAi', c.manualLockAi)}
															className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockAi ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-white'}`}
															title={c.manualLockAi ? "Đã khóa" : "Khóa thủ công"}
														>
															{c.manualLockAi ? <Lock size={12} /> : <Unlock size={12} />}
														</button>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>

							{/* Mobile/Tablet Card Layout */}
							<div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
								{filteredCustomers.map((c) => {
									const eff = getEffectiveStatus(c);
									return (
										<div key={c.id} className="p-6 space-y-5">
											<div className="flex items-center justify-between">
												<div>
													<p className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight mb-1">{c.displayName || 'No Name'}</p>
													<p className="text-[10px] text-slate-500 font-medium">{c.email}</p>
												</div>
												<div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${eff.isExpired ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
													{eff.isExpired ? 'Hết hạn' : 'Active'}
												</div>
											</div>

											<div className="grid grid-cols-2 gap-4">
												<div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
													<p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Gói dịch vụ</p>
													<select
														className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[10px] font-black rounded-lg px-2 py-1.5 outline-none border border-slate-700"
														value={c.planId || (c.isPro ? 'premium_monthly' : 'free')}
														onChange={(e) => handleUpdatePlan(c.uid, e.target.value)}
													>
														<option value="test_expire">TEST HẾT HẠN</option>
														<option value="free">FREE</option>
														<option value="premium_monthly">M-PRO</option>
														<option value="premium_yearly">Y-PRO</option>
														<option value="cancel_payment">⛔ HUỶ ĐĂNG KÝ (KHÓA)</option>
													</select>
												</div>
												<div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-center">
													<p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{eff.isExpired ? 'Đã dùng' : 'Còn lại'}</p>
													<p className={`font-black text-sm uppercase ${eff.isExpired ? 'text-rose-400' : 'text-slate-900 dark:text-white'}`}>{eff.isExpired ? `${eff.daysUsed} ngày` : `${eff.daysRemaining} ngày`}</p>
													{eff.joinedAt && <p className="text-[8px] text-slate-600 font-medium mt-1">Vào: {eff.joinedAt.toLocaleDateString('vi-VN')}</p>}
												</div>
											</div>

											<div className="flex items-center justify-between bg-slate-800/30 p-4 rounded-2xl border border-slate-700/30">
												<div className="flex flex-col items-center gap-1.5">
													<p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Đơn hàng</p>
													<button
														onClick={() => toggleUserLock(c.uid, 'manualLockOrders', c.manualLockOrders)}
														className={`size-10 rounded-xl flex items-center justify-center transition-all ${c.manualLockOrders ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}
													>
														{c.manualLockOrders ? <Lock size={16} /> : <Unlock size={16} />}
													</button>
												</div>
												<div className="flex flex-col items-center gap-1.5">
													<p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Công nợ</p>
													<button
														onClick={() => toggleUserLock(c.uid, 'manualLockDebts', c.manualLockDebts)}
														className={`size-10 rounded-xl flex items-center justify-center transition-all ${c.manualLockDebts ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}
													>
														{c.manualLockDebts ? <Lock size={16} /> : <Unlock size={16} />}
													</button>
												</div>
												<div className="flex flex-col items-center gap-1.5">
													<p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Sheets</p>
													<button
														onClick={() => toggleUserLock(c.uid, 'manualLockSheets', c.manualLockSheets)}
														className={`size-10 rounded-xl flex items-center justify-center transition-all ${c.manualLockSheets ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}
													>
														{c.manualLockSheets ? <Lock size={16} /> : <Unlock size={16} />}
													</button>
												</div>
												<div className="flex flex-col items-center gap-1.5">
													<p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">AI</p>
													<button
														onClick={() => toggleUserLock(c.uid, 'manualLockAi', c.manualLockAi)}
														className={`size-10 rounded-xl flex items-center justify-center transition-all ${c.manualLockAi ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}
													>
														{c.manualLockAi ? <Lock size={16} /> : <Unlock size={16} />}
													</button>
												</div>
											</div>
										</div>
									);
								})}
								{filteredCustomers.length === 0 && (
									<div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs opacity-40">
										{searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có doanh nghiệp nào'}
									</div>
								)}
							</div>
						</div>
					)}

					{activeTab === 'config' && (
						<div className="space-y-6 lg:space-y-8 max-w-5xl">
							{/* Bank QR Config */}
							<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
								<div className="px-6 lg:px-8 py-5 lg:py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-800/30 flex items-center justify-between">
									<div className="flex items-center gap-3">
										<CreditCard className="text-indigo-500" size={20} />
										<h4 className="text-[10px] lg:text-xs font-black text-slate-900 dark:text-white uppercase tracking-[2px] lg:tracking-[4px]">Cấu hình Tài khoản Nhận tiền</h4>
									</div>
								</div>
								<div className="p-6 lg:p-8">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
										<div>
											<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ngân hàng (VD: ICB, VCB)</label>
											<select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={paymentConfig.bankId} onChange={e => setPaymentConfig({...paymentConfig, bankId: e.target.value})}>
												<option value="" disabled>-- Chọn ngân hàng --</option>
												{VIETNAM_BANKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
											</select>										</div>
										<div>
											<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Số tài khoản</label>
											<input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={paymentConfig.accountNumber} onChange={e => setPaymentConfig({...paymentConfig, accountNumber: e.target.value})} />
										</div>
										<div className="md:col-span-2">
											<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tên chủ tài khoản</label>
											<input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={paymentConfig.accountName} onChange={e => setPaymentConfig({...paymentConfig, accountName: e.target.value})} />
										</div>
									</div>
									<button onClick={handleSaveConfig} disabled={isSavingConfig} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all w-full md:w-auto flex justify-center items-center gap-2">
										{isSavingConfig ? <Clock className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
										Lưu Cấu Hình QR
									</button>
								</div>
							</div>

							{/* Addons CRUD */}
							<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
								<div className="px-6 lg:px-8 py-5 lg:py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-800/30 flex items-center justify-between">
									<div className="flex items-center gap-3">
										<Crown className="text-amber-500" size={20} />
										<h4 className="text-[10px] lg:text-xs font-black text-slate-900 dark:text-white uppercase tracking-[2px] lg:tracking-[4px]">Quản lý Gói Dịch vụ</h4>
									</div>
									<button onClick={() => setEditingAddon({ id: `addon_${Date.now()}`, name: '', price: 0, description: '', icon: 'Zap', features: '', bgClass: '', textClass: '', shadowClass: '' })} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
										Thêm Gói Mới
									</button>
								</div>
								
								<div className="p-6 lg:p-8">
									{editingAddon && (
										<form onSubmit={handleSaveAddon} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mb-8 space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<label className="block text-xs font-bold text-slate-500 uppercase mb-2">ID Gói (VD: addon_export_5)</label>
													<input type="text" required className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={editingAddon.id} onChange={e => setEditingAddon({...editingAddon, id: e.target.value})} />
												</div>
												<div>
													<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tên gói (VD: Gói Tháng)</label>
													<input type="text" required className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={editingAddon.name} onChange={e => setEditingAddon({...editingAddon, name: e.target.value})} />
												</div>
												<div>
													<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mức giá (VNĐ)</label>
													<input type="number" required className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={editingAddon.price} onChange={e => setEditingAddon({...editingAddon, price: e.target.value})} />
												</div>
												<div>
													<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Biểu tượng (Icon)</label>
													<select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={editingAddon.icon} onChange={e => setEditingAddon({...editingAddon, icon: e.target.value})}>
														<option value="Zap">Tia sét (Zap)</option>
														<option value="Crown">Vương miện (Crown)</option>
														<option value="Rocket">Tên lửa (Rocket)</option>
														<option value="Shield">Cái khiên (Shield)</option>
														<option value="Download">Tải xuống (Download)</option>
														<option value="Database">Cơ sở dữ liệu (Database)</option>
														<option value="Activity">Biểu đồ (Activity)</option>
													</select>
												</div>
												<div className="md:col-span-2">
													<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mô tả ngắn gọn</label>
													<input type="text" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white" value={editingAddon.description} onChange={e => setEditingAddon({...editingAddon, description: e.target.value})} />
												</div>
												<div className="md:col-span-2">
												<label className="block text-xs font-bold text-slate-500 uppercase mb-2">⏱️ Thời hạn gói</label>
												<select
													className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white"
													value={editingAddon.durationDays || 30}
													onChange={e => setEditingAddon({...editingAddon, durationDays: Number(e.target.value)})}
												>
													<option value={7}>7 ngày (Dùng thử ngắn)</option>
													<option value={30}>30 ngày (1 tháng)</option>
													<option value={60}>60 ngày (2 tháng)</option>
													<option value={90}>90 ngày (3 tháng)</option>
													<option value={180}>180 ngày (6 tháng)</option>
													<option value={365}>365 ngày (1 năm)</option>
												</select>
											</div>
												<div className="md:col-span-2">
													<label className="block text-xs font-bold text-slate-500 uppercase mb-2">Màu sắc chủ đạo (Theme)</label>
													<select 
														className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white"
														value={editingAddon.textClass?.match(/text-([a-z]+)-/)?.[1] || 'slate'}
														onChange={e => {
															const color = e.target.value;
															setEditingAddon({
																...editingAddon, 
																bgClass: `bg-${color}-50 dark:bg-${color}-500/10`, 
																textClass: `text-${color}-600 dark:text-${color}-400`
															});
														}}
													>
														<option value="slate">Màu Xám (Mặc định)</option>
														<option value="indigo">Màu Tím (Indigo)</option>
														<option value="blue">Màu Xanh Dương (Blue)</option>
														<option value="emerald">Màu Xanh Ngọc (Emerald)</option>
														<option value="amber">Màu Cam (Amber)</option>
														<option value="rose">Màu Hồng (Rose)</option>
													</select>
												</div>
											</div>
											<div className="flex gap-3 justify-end pt-4">
												<button type="button" onClick={() => setEditingAddon(null)} className="px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">Hủy</button>
												<button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all">Lưu Gói</button>
											</div>
										</form>
									)}

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										{addons.map(addon => (
											<div key={addon.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
												<div>
													<div className="flex items-start justify-between mb-2">
														<h5 className={`font-black text-lg flex items-center gap-2 ${addon.textClass || 'text-slate-900 dark:text-white'}`}>
															{renderAddonIcon(addon.icon, "size-5")}
															{addon.name}
														</h5>
														<span className="font-bold text-sm bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md text-slate-700 dark:text-slate-300">{addon.price.toLocaleString()}đ</span>
													</div>
													<p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{addon.description}</p>
												{addon.durationDays ? (
													<span className="inline-block bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded-md mb-2">⏱️ {addon.durationDays} ngày</span>
												) : addon.features?.length > 0 && (
													<span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-md mb-2">{addon.features.length} tính năng</span>
												)}
													<p className="text-[10px] font-black uppercase text-slate-400 mb-1">ID: {addon.id}</p>
												</div>
												<div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
													<button onClick={() => setEditingAddon(addon)} className="flex-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 py-2 rounded-xl text-xs font-bold uppercase hover:bg-indigo-100 transition-colors">Sửa</button>
													<button onClick={() => handleDeleteAddon(addon.id)} className="flex-1 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 py-2 rounded-xl text-xs font-bold uppercase hover:bg-rose-100 transition-colors">Xóa</button>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const TabItem = ({ icon, label, active, onClick, badge }: any) => (
	<button
		onClick={onClick}
		className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[13px] whitespace-nowrap transition-all duration-300 ${active ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-600 dark:text-slate-300'}`}
	>
		{icon}
		{label}
		{badge > 0 && <span className="ml-1 size-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">{badge}</span>}
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
		<div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3 lg:gap-4 relative overflow-hidden group">
			<div className={`size-10 lg:size-12 rounded-xl lg:rounded-2xl ${colorMap[color]} flex items-center justify-center scale-90 lg:scale-100`}>{icon}</div>
			<div>
				<p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-[2px] mb-1">{label}</p>
				<p className="text-lg lg:text-2xl font-black text-slate-900 dark:text-white tracking-tighter truncate">{value}</p>
			</div>
		</div>
	);
};

const ConfigToggle = ({ title, description, enabled, onToggle }: any) => (
	<div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 flex items-center justify-between group hover:border-slate-600 transition-all">
		<div className="pr-4">
			<h5 className="font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-400 transition-colors uppercase text-sm tracking-tight">{title}</h5>
			<p className="text-xs text-slate-500 font-medium">{description}</p>
		</div>
		<button onClick={onToggle} className={`w-14 h-8 shrink-0 rounded-full p-1 transition-colors duration-300 ${enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}>
			<div className={`size-6 rounded-full bg-white shadow-xl transform transition-transform duration-300 ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
		</button>
	</div>
);

export default NexusControl;
