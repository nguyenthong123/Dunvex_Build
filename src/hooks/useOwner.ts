import { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onSQLiteAuthStateChanged } from '../services/sqliteSession';
import { doc, onSnapshot } from '../services/firebase';
import { setApiCredentials } from '../services/apiClient';
import { licenseService } from '../services/licenseService';

export interface OwnerState {
	ownerId: string;
	ownerEmail: string;
	role: string;
	isEmployee: boolean;
	accessRights?: Record<string, boolean>;
	loading: boolean;
	// Subscription fields
	isPro: boolean;
	subscriptionStatus: 'trial' | 'active' | 'expired';
	planId?: string;
	trialEndsAt?: any;
	subscriptionExpiresAt?: any;
	manualLockOrders?: boolean;
	manualLockDebts?: boolean;
	manualLockSheets?: boolean;
	manualLockAi?: boolean;
	settingsData?: any; // Raw settings for direct access
	userDisplayName?: string;
	userEmail?: string;
	systemConfig: {
		lock_free_orders: boolean;
		lock_free_debts: boolean;
		lock_free_sheets: boolean;
		maintenance_mode: boolean;
	};
}

export function useOwner() {
	const [state, setState] = useState<OwnerState>({
		ownerId: '',
		ownerEmail: '',
		role: 'admin',
		isEmployee: false,
		loading: true,
		isPro: false,
		subscriptionStatus: 'trial',
		userDisplayName: '',
		userEmail: '',
		systemConfig: {
			lock_free_orders: false,
			lock_free_debts: false,
			lock_free_sheets: false,
			maintenance_mode: false
		}
	});

	useEffect(() => {
		let isMounted = true;
		let unsubUser: (() => void) | null = null;
		let unsubConfig: (() => void) | null = null;
		let unsubSettings: (() => void) | null = null;
		let unsubLicense: (() => void) | null = null;
		let checkInterval: any = null;

		const cleanupActiveListeners = () => {
			if (unsubUser) { unsubUser(); unsubUser = null; }
			if (unsubConfig) { unsubConfig(); unsubConfig = null; }
			if (unsubSettings) { unsubSettings(); unsubSettings = null; }
			if (unsubLicense) { unsubLicense(); unsubLicense = null; }
			if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
		};

		const initForUser = (user: any) => {
			cleanupActiveListeners();
			if (!isMounted) return;

			let userData: any = null;
			let settingsData: any = null;
			let configData: any = null;
			let isUserReady = false;
			let isConfigReady = false;

			const updateUserState = () => {
				if (!isMounted || !userData) return;

				const uid = user.uid;
				const ownerId = userData.ownerId || uid;
				const ownerEmail = userData.ownerEmail || user.email;
				const role = userData.role || 'admin';
				const accessRights = userData.accessRights;
				const userIsPro = userData.isPro || false;

				const sessionData = (() => {
					try {
						const s = localStorage.getItem('dunvex_user_session');
						return s ? JSON.parse(s) : null;
					} catch (e) { return null; }
				})();

				const userDisplayName = userData.displayName || userData.name || sessionData?.displayName || user.displayName || user.email?.split('@')[0] || 'Nhân viên';
				const userEmail = user.email || '';

				// Info from Settings (Optional/Defaults)
				let isPro = userIsPro;
				let subscriptionStatus: 'trial' | 'active' | 'expired' = userIsPro ? 'active' : 'trial';
				let trialEndsAt = null;
				let subscriptionExpiresAt = null;
				let planId = userData.planId || null;
				let manualLockOrders = userData.manualLockOrders || false;
				let manualLockDebts = userData.manualLockDebts || false;
				let manualLockSheets = userData.manualLockSheets || false;
				let manualLockAi = userData.manualLockAi || false;

				const parseDateSafe = (val: any): Date | null => {
					if (!val) return null;
					if (typeof val?.toDate === 'function') return val.toDate();
					if (val?.seconds) return new Date(val.seconds * 1000);
					if (val instanceof Date) return val;
					if (typeof val === 'string') {
						const d = new Date(val);
						return isNaN(d.getTime()) ? null : d;
					}
					return null;
				};

				if (settingsData) {
					subscriptionStatus = settingsData.subscriptionStatus || 'trial';
					trialEndsAt = settingsData.trialEndsAt;
					subscriptionExpiresAt = settingsData.subscriptionExpiresAt;
					planId = settingsData.planId || planId;

					const parsedExpire = parseDateSafe(subscriptionExpiresAt);
					const parsedTrial = parseDateSafe(trialEndsAt);
					const now = new Date();

					if (subscriptionStatus === 'active') {
						if (parsedExpire && parsedExpire < now) {
							isPro = false;
							subscriptionStatus = 'expired';
						} else {
							isPro = true;
						}
					} else if (subscriptionStatus === 'trial') {
						if (parsedTrial && parsedTrial < now) {
							isPro = false;
							subscriptionStatus = 'expired';
						} else if (parsedExpire && parsedExpire < now) {
							isPro = false;
							subscriptionStatus = 'expired';
						} else {
							isPro = true;
						}
					} else {
						isPro = false;
					}

					manualLockOrders = settingsData.manualLockOrders ?? manualLockOrders;
					manualLockDebts = settingsData.manualLockDebts ?? manualLockDebts;
					manualLockSheets = settingsData.manualLockSheets ?? manualLockSheets;
					manualLockAi = settingsData.manualLockAi ?? manualLockAi;
				}

				// Authoritative Offline-Proof License Certificate Enforcement
				const licStatus = licenseService.getStatus();
				if (licStatus.isExpired || licStatus.isClockTampered) {
					isPro = false;
					subscriptionStatus = 'expired';
					manualLockOrders = true;
					manualLockDebts = true;
					manualLockSheets = true;
					manualLockAi = true;
				} else if (licStatus.features.lockOrders) {
					manualLockOrders = true;
				}

				// Info from System Config (Must have defaults)
				const systemConfig = configData || {
					lock_free_orders: false,
					lock_free_debts: false,
					lock_free_sheets: false,
					maintenance_mode: false
				};

				// Cập nhật global API client credentials
				setApiCredentials('', ownerId);

				setState({
					ownerId,
					ownerEmail,
					role,
					accessRights,
					isEmployee: ownerId !== uid,
					loading: false,
					isPro,
					subscriptionStatus,
					planId,
					trialEndsAt,
					subscriptionExpiresAt,
					manualLockOrders,
					manualLockDebts,
					manualLockSheets,
					manualLockAi,
					settingsData: settingsData || null,
					userDisplayName,
					userEmail,
					systemConfig
				});
			};

			// Render from the persisted session immediately; remote snapshots can refresh
			// profile and settings later without leaving offline users on a loading screen.
			userData = user;
			updateUserState();

			// 1. Listen to User
			const userRef = doc(db, 'users', user.id || user.uid);
			unsubUser = onSnapshot(userRef, (docSnap) => {
				if (!isMounted) return;
				userData = docSnap.exists() ? docSnap.data() : user;

				isUserReady = true;
				updateUserState();
			}, (err) => {
				console.error("useOwner: User snapshot error", err);
				isUserReady = true;
				updateUserState();
			});

			// 2. Listen to Global Config
			const configRef = doc(db, 'system_config', 'main');
			unsubConfig = onSnapshot(configRef, (doc) => {
				if (!isMounted) return;
				configData = doc.exists() ? doc.data() : null;
				isConfigReady = true;
				updateUserState();
			}, (err) => {
				isConfigReady = true;
				updateUserState();
			});

			// 3. Listen to Settings
			const checkSettings = () => {
				if (userData && !unsubSettings && isMounted) {
					const ownerId = userData.ownerId || user.uid;
					if (ownerId) {
						const settingsRef = doc(db, 'settings', ownerId);
						unsubSettings = onSnapshot(settingsRef, (doc) => {
							if (!isMounted) return;
							settingsData = doc.exists() ? doc.data() : null;
							updateUserState();
						}, (err) => {
							updateUserState();
						});
					}
				}
			};

			checkInterval = setInterval(() => {
				if (userData) {
					checkSettings();
					if (checkInterval) {
						clearInterval(checkInterval);
						checkInterval = null;
					}
				}
			}, 100);

			unsubLicense = licenseService.subscribe(() => {
				if (isMounted) updateUserState();
			});
		};

		// 🔄 Lắng nghe onAuthStateChanged để luôn kích hoạt ngay khi Firebase xác thực xong
		const unsubAuth = onSQLiteAuthStateChanged((user) => {
			if (user) {
				initForUser(user);
			} else {
				cleanupActiveListeners();
				const savedSession = (() => {
					try {
						const s = localStorage.getItem('dunvex_user_session');
						return s ? JSON.parse(s) : null;
					} catch (e) { return null; }
				})();
				if (!savedSession) {
					setState(prev => ({ ...prev, loading: false }));
				}
			}
		});

		const handleProfileUpdated = (e: any) => {
			if (e.detail?.displayName) {
				setState(prev => ({ ...prev, userDisplayName: e.detail.displayName }));
			}
		};
		window.addEventListener('dunvex_profile_updated', handleProfileUpdated);

		return () => {
			isMounted = false;
			unsubAuth();
			cleanupActiveListeners();
			window.removeEventListener('dunvex_profile_updated', handleProfileUpdated);
		};
	}, []);

	return state;
};
