import { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from '../services/firebase';
import { setApiCredentials } from '../services/apiClient';

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
		let checkInterval: any = null;

		const cleanupActiveListeners = () => {
			if (unsubUser) { unsubUser(); unsubUser = null; }
			if (unsubConfig) { unsubConfig(); unsubConfig = null; }
			if (unsubSettings) { unsubSettings(); unsubSettings = null; }
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

				if (settingsData) {
					subscriptionStatus = settingsData.subscriptionStatus || 'trial';
					trialEndsAt = settingsData.trialEndsAt;
					subscriptionExpiresAt = settingsData.subscriptionExpiresAt;
					planId = settingsData.planId || planId;

					if (subscriptionStatus === 'active') {
						if (subscriptionExpiresAt && typeof subscriptionExpiresAt.toDate === 'function' && subscriptionExpiresAt.toDate() < new Date()) {
							isPro = false;
							subscriptionStatus = 'expired';
						} else {
							isPro = true;
						}
					} else if (subscriptionStatus === 'trial') {
						if (trialEndsAt && typeof trialEndsAt.toDate === 'function' && trialEndsAt.toDate() < new Date()) {
							isPro = false;
							subscriptionStatus = 'expired';
						} else {
							isPro = true;
						}
					} else isPro = false;

					manualLockOrders = settingsData.manualLockOrders ?? manualLockOrders;
					manualLockDebts = settingsData.manualLockDebts ?? manualLockDebts;
					manualLockSheets = settingsData.manualLockSheets ?? manualLockSheets;
					manualLockAi = settingsData.manualLockAi ?? manualLockAi;
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

			// 1. Listen to User
			const userRef = doc(db, 'users', user.uid);
			let hasCheckedInvite = false;
			unsubUser = onSnapshot(userRef, async (docSnap) => {
				if (!isMounted) return;
				userData = docSnap.exists() ? docSnap.data() : { role: 'admin' };
				// Tự động kiểm tra lời mời nếu tài khoản chưa gắn ownerId (chỉ chạy 1 lần và bỏ qua nếu đã là chủ xưởng/admin)
				const isAlreadyEstablished = (userData?.role === 'admin' && userData?.ownerId) || (userData?.ownerId && userData?.ownerId !== user.uid);
				if (!hasCheckedInvite && user.email && !isAlreadyEstablished && !userData?.ownerId) {
					hasCheckedInvite = true;
					try {
						const emailClean = (user.email || '').toLowerCase().trim();
						const tempId = emailClean.replace(/\W/g, '_');
						const [invDirect, invUnder, invUpperUnder] = await Promise.all([
							getDoc(doc(db, 'permissions', emailClean)),
							getDoc(doc(db, 'permissions', tempId)),
							getDoc(doc(db, 'permissions', tempId.toUpperCase()))
						]);
						const inv = invDirect.exists() ? invDirect : (invUnder.exists() ? invUnder : (invUpperUnder.exists() ? invUpperUnder : null));
						if (inv && inv.data()?.ownerId) {
							const invData = inv.data();
							const updatedProfile = {
								...userData,
								uid: user.uid,
								email: user.email,
								displayName: userData.displayName || user.displayName || user.email.split('@')[0],
								role: invData.role || 'sale',
								marketPointsRequired: invData.marketPointsRequired || 1,
								ownerId: invData.ownerId,
								ownerEmail: invData.ownerEmail,
								status: 'active',
								accessRights: invData.accessRights || {
									dashboard: true,
									orders_view: true,
									orders_create: true,
									inventory_view: true,
									customers_manage: true,
									debts_manage: true,
									users_manage: false,
									admin: false,
									system_manage: false
								}
							};
							await setDoc(userRef, updatedProfile, { merge: true });
							await deleteDoc(doc(db, 'permissions', inv.id));
							userData = updatedProfile;
						}
					} catch (e) {
						console.warn('useOwner: auto-invitation check warning', e);
					}
				}

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
		};

		// 🔄 Lắng nghe onAuthStateChanged để luôn kích hoạt ngay khi Firebase xác thực xong
		const unsubAuth = onAuthStateChanged(auth, (user) => {
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

