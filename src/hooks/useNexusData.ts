import { useState, useEffect, useRef, useMemo } from 'react';
import { SUPER_ADMIN_EMAIL } from '../constants';
import {
	auth, db, collection, query, onSnapshot, doc,
	where, serverTimestamp, orderBy, limit, getDoc, getDocs, setDoc, addDoc
} from '../services/firebase';

export interface NexusStats {
	totalUsers: number;
	activePro: number;
	pendingPayments: number;
	totalRevenue: number;
}

export interface PaymentConfig {
	bankId: string;
	accountNumber: string;
	accountName: string;
}

export interface SystemConfig {
	lock_free_orders: boolean;
	lock_free_debts: boolean;
	lock_free_sheets: boolean;
	maintenance_mode: boolean;
	ai_auto_lock: boolean;
	[key: string]: any;
}

export function useNexusData() {
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState<NexusStats>({
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
	const [systemConfig, setSystemConfig] = useState<SystemConfig>({
		lock_free_orders: false,
		lock_free_debts: false,
		lock_free_sheets: false,
		maintenance_mode: false,
		ai_auto_lock: true
	});
	const [searchQuery, setSearchQuery] = useState('');
	const isRunningRef = useRef(false);

	// Config Tab States
	const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
		bankId: '',
		accountNumber: '',
		accountName: ''
	});
	const [isSavingConfig, setIsSavingConfig] = useState(false);
	const [qrModal, setQrModal] = useState<{ uid: string; email: string; name: string } | null>(null);
	const [addons, setAddons] = useState<any[]>([]);
	const [editingAddon, setEditingAddon] = useState<any>(null);
	const [aiAnalyticsData, setAiAnalyticsData] = useState<any[]>([]);
	const [aiActions, setAiActions] = useState<any[]>([]);
	const [activeLogId, setActiveLogId] = useState<string | null>(null);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	const parseExpireDate = (val: any): Date | null => {
		if (!val) return null;
		if (val.toDate) return val.toDate();
		if (val.seconds) return new Date(val.seconds * 1000);
		if (val instanceof Date) return val;
		return null;
	};

	const executeAiAutoLock = async (ownerId: string, email: string) => {
		try {
			const settingsRef = doc(db, 'settings', ownerId);
			const snap = await getDoc(settingsRef);
			const data = snap.data() || {};

			if (!data.manualLockOrders || !data.manualLockDebts || !data.manualLockSheets || !data.manualLockAi) {
				await setDoc(settingsRef, {
					manualLockOrders: true,
					manualLockDebts: true,
					manualLockSheets: true,
					manualLockAi: true,
					aiLockedAt: serverTimestamp(),
					aiLockReason: 'RAPID_ACTIONS_PREVENTION'
				}, { merge: true });

				const verifySnap = await getDoc(settingsRef);
				const isLocked = verifySnap.exists() && verifySnap.data().manualLockOrders && verifySnap.data().manualLockDebts && verifySnap.data().manualLockSheets && verifySnap.data().manualLockAi;

				await addDoc(collection(db, 'notifications'), {
					userId: ownerId,
					title: '🔒 NEXUS AI: PHÁT HIỆN THAO TÁC NHANH',
					body: 'Hệ thống phát hiện thao tác nhanh bất thường. AI đã chủ động tạm khoá tính năng trong 30 phút để bảo vệ dữ liệu. Tính năng sẽ tự động mở lại sau 30 phút.',
					type: 'alert',
					priority: 'high',
					read: false,
					createdAt: serverTimestamp()
				});

				await addDoc(collection(db, 'ai_actions'), {
					type: 'security_lock',
					targetEmail: email,
					targetId: ownerId,
					details: 'Tự động khóa do phát hiện Pocket Click (thao tác nhanh bất thường)',
					timestamp: serverTimestamp()
				});

				console.log(`AI Auto Lock: ${email} locked due to rapid actions`);
			}
		} catch (e) {
			console.error("AI Auto Lock Error:", e);
		}
	};

	const getEffectiveStatus = (c: any) => {
		const now = new Date();
		const parseDate = (val: any) => {
			if (!val) return null;
			if (val.toDate) return val.toDate();
			if (val.seconds) return new Date(val.seconds * 1000);
			if (val instanceof Date) return val;
			if (typeof val === 'string') return new Date(val);
			return null;
		};
		const createdAt = parseDate(c.createdAt);
		const paymentConfirmedAt = parseDate(c.paymentConfirmedAt);
		const expireAt = parseDate(c.subscriptionExpiresAt);

		const joinedAt = paymentConfirmedAt || createdAt;
		const diffDays = joinedAt ? Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;

		let effectiveExpireAt = expireAt;
		if (!effectiveExpireAt && joinedAt) {
			const planId = c.planId || (c.isPro ? 'premium_monthly' : 'free');
			const pkg = addons.find((p: any) => p.id === planId) || (planId === 'free' ? addons.find((p: any) => Number(p.price) === 0) : null);
			effectiveExpireAt = new Date(joinedAt.getTime());

			if (pkg) {
				if (pkg.durationMonths) {
					effectiveExpireAt.setMonth(effectiveExpireAt.getMonth() + Number(pkg.durationMonths));
				} else if (pkg.durationDays) {
					effectiveExpireAt.setDate(effectiveExpireAt.getDate() + Number(pkg.durationDays));
				} else {
					effectiveExpireAt.setMonth(effectiveExpireAt.getMonth() + 1);
				}
			} else {
				if (planId === 'free') {
					effectiveExpireAt.setMonth(effectiveExpireAt.getMonth() + 1);
				} else if (planId === 'premium_monthly') {
					effectiveExpireAt.setMonth(effectiveExpireAt.getMonth() + 1);
				} else {
					effectiveExpireAt.setFullYear(effectiveExpireAt.getFullYear() + 1);
				}
			}
		}

		const isExpired = effectiveExpireAt ? effectiveExpireAt < now : false;

		let daysRemaining = 0;
		let daysExpired = 0;

		if (effectiveExpireAt) {
			if (isExpired) {
				daysExpired = Math.floor((now.getTime() - effectiveExpireAt.getTime()) / (1000 * 60 * 60 * 24));
			} else {
				daysRemaining = Math.ceil((effectiveExpireAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
			}
		}

		return {
			isExpired,
			daysUsed: diffDays,
			daysRemaining,
			daysExpired,
			joinedAt,
			createdAt,
			paymentConfirmedAt,
			expireAt: effectiveExpireAt,
			isStaff: c.isStaff === true,
			adminName: c.adminName || ''
		};
	};

	const filteredCustomers = useMemo(() => customers.filter(c => {
		const queryStr = searchQuery.toLowerCase().trim();
		if (!queryStr) return true;

		const name = (c.displayName || '').toLowerCase();
		const email = (c.email || '').toLowerCase();
		const uid = (c.uid || '').toLowerCase();

		return name.includes(queryStr) || email.includes(queryStr) || uid.includes(queryStr);
	}), [customers, searchQuery]);

	// Main effect: all Firestore onSnapshot listeners
	useEffect(() => {
		// Security Check
		if (auth.currentUser?.email !== SUPER_ADMIN_EMAIL) {
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
			const staffUsers = usersData.filter((u: any) => u.uid !== u.ownerId && u.ownerId && u.role !== 'admin');

			const unsubSettings = onSnapshot(collection(db, 'settings'), (settingsSnap) => {
				const settingsData: Record<string, any> = {};
				settingsSnap.docs.forEach(d => { settingsData[d.id] = d.data(); });

				const adminMap: Record<string, any> = {};
				for (const u of owners) {
					const s = settingsData[u.uid] || {};
					adminMap[u.uid] = {
						...u,
						isPro: s.isPro ?? u.isPro ?? false,
						planId: s.planId || (s.isPro ? 'premium_monthly' : 'free'),
						subscriptionStatus: s.subscriptionStatus || (u.isPro ? 'active' : 'trial'),
						subscriptionExpiresAt: s.subscriptionExpiresAt || null,
						paymentConfirmedAt: s.paymentConfirmedAt || null,
						manualLockOrders: s.manualLockOrders || false,
						manualLockDebts: s.manualLockDebts || false,
						manualLockSheets: s.manualLockSheets || false,
						manualLockAi: s.manualLockAi || false
					};
				}

				const mergedAdmins = owners.map((u: any) => {
					const s = settingsData[u.uid] || {};
					return {
						...u, isPro: s.isPro ?? u.isPro ?? false,
						planId: s.planId || (s.isPro ? 'premium_monthly' : 'free'),
						subscriptionStatus: s.subscriptionStatus || (u.isPro ? 'active' : 'trial'),
						subscriptionExpiresAt: s.subscriptionExpiresAt || null,
						paymentConfirmedAt: s.paymentConfirmedAt || null,
						manualLockOrders: s.manualLockOrders || false,
						manualLockDebts: s.manualLockDebts || false,
						manualLockSheets: s.manualLockSheets || false,
						manualLockAi: s.manualLockAi || false,
						isStaff: false
					};
				});

				const mergedStaff = staffUsers.map((u: any) => {
					const admin = adminMap[u.ownerId];
					if (admin) return {
						...u, isPro: admin.isPro ?? false, planId: admin.planId || 'free',
						subscriptionStatus: admin.subscriptionStatus,
						subscriptionExpiresAt: admin.subscriptionExpiresAt,
						paymentConfirmedAt: admin.paymentConfirmedAt || null,
						manualLockOrders: admin.manualLockOrders,
						manualLockDebts: admin.manualLockDebts,
						manualLockSheets: admin.manualLockSheets,
						manualLockAi: admin.manualLockAi,
						isStaff: true, adminId: u.ownerId,
						adminName: admin.displayName || admin.email || 'Admin'
					};
					return {
						...u, isPro: false, planId: 'free', subscriptionStatus: 'trial',
						subscriptionExpiresAt: null, isStaff: true, adminName: 'Không xác định'
					};
				});

				const merged = [...mergedAdmins, ...mergedStaff];
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
					if (now - time < 60000) {
						if (!userActionCounts[log.ownerId]) userActionCounts[log.ownerId] = [];
						userActionCounts[log.ownerId].push(log);
					}
				});

				const anomalies: any[] = [];
				Object.entries(userActionCounts).forEach(([ownerId, actions]) => {
					if (actions.length >= 10) {
						const times = actions.map(a => a.createdAt?.toMillis ? a.createdAt.toMillis() : 0).sort();
						const span = times[times.length - 1] - times[0];
						if (span < 30000) {
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

		// 6. System AI Analytics
		const qAiAnalytics = query(collection(db, 'ai_analytics'), orderBy('createdAt', 'desc'), limit(100));
		const unsubAiAnalytics = onSnapshot(qAiAnalytics, (snap) => {
			setAiAnalyticsData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		});

		return () => {
			unsubRequests();
			unsubUsers();
			unsubLogs();
			unsubConfig();
			unsubAddons();
			unsubAiAnalytics();
		};
	}, [isAiActive, systemConfig.ai_auto_lock]);

	// aiActions listener
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

	// Interval 30 seconds (DISABLED - MOVED TO CLOUD FUNCTIONS)
	useEffect(() => {
		// if (!isAiActive) return;
		// const interval = setInterval(() => runAutonomousCycle(customersRef.current, requests), 30000);
		// return () => clearInterval(interval);
	}, [isAiActive]);

	return {
		// Data state
		stats,
		requests,
		customers,
		logs,
		addons,
		aiAnomalies,
		aiAnalyticsData,
		aiActions,
		// UI state
		loading,
		searchQuery,
		setSearchQuery,
		filteredCustomers,
		// Config state
		systemConfig,
		setSystemConfig,
		paymentConfig,
		setPaymentConfig,
		isSavingConfig,
		setIsSavingConfig,
		// Other state
		isAiActive,
		setIsAiActive,
		editingAddon,
		setEditingAddon,
		qrModal,
		setQrModal,
		activeLogId,
		setActiveLogId,
		isMobileMenuOpen,
		setIsMobileMenuOpen,
		// Refs
		isRunningRef,
		customersRef,
		// Helpers
		parseExpireDate,
		getEffectiveStatus,
		executeAiAutoLock,
	};
}
