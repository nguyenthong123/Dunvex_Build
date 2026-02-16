import { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

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
	systemConfig: {
		lock_free_orders: boolean;
		lock_free_debts: boolean;
		lock_free_sheets: boolean;
		maintenance_mode: boolean;
	};
}

export const useOwner = () => {
	const [state, setState] = useState<OwnerState>({
		ownerId: '',
		ownerEmail: '',
		role: 'admin',
		isEmployee: false,
		loading: true,
		isPro: true,
		subscriptionStatus: 'active',
		systemConfig: {
			lock_free_orders: false,
			lock_free_debts: false,
			lock_free_sheets: false,
			maintenance_mode: false
		}
	});

	useEffect(() => {
		if (!auth.currentUser) {
			setState(prev => ({ ...prev, loading: false }));
			return;
		}

		// Initial pieces of data
		let userData: any = null;
		let settingsData: any = null;
		let configData: any = null;
		let isUserReady = false;
		let isConfigReady = false;

		const updateUserState = () => {
			// Basic Info from User (Must have)
			if (!userData) return;

			const uid = auth.currentUser?.uid;
			const ownerId = userData.ownerId || uid;
			const ownerEmail = userData.ownerEmail || auth.currentUser?.email;
			const role = userData.role || 'admin';
			const accessRights = userData.accessRights;
			const userIsPro = userData.isPro || false;

			// Info from Settings (Optional/Defaults)
			let isPro = userIsPro;
			let subscriptionStatus: 'trial' | 'active' | 'expired' = 'active';
			let trialEndsAt = null;
			let subscriptionExpiresAt = null;
			let planId = userData.planId || null;
			let manualLockOrders = userData.manualLockOrders || false;
			let manualLockDebts = userData.manualLockDebts || false;

			if (settingsData) {
				subscriptionStatus = settingsData.subscriptionStatus || 'trial';
				trialEndsAt = settingsData.trialEndsAt;
				subscriptionExpiresAt = settingsData.subscriptionExpiresAt;
				planId = settingsData.planId || planId;

				if (subscriptionStatus === 'active') isPro = true;
				else if (subscriptionStatus === 'trial') {
					if (trialEndsAt && trialEndsAt.toDate() < new Date()) {
						isPro = false;
						subscriptionStatus = 'expired';
					} else {
						isPro = true;
					}
				} else isPro = false;

				manualLockOrders = settingsData.manualLockOrders || manualLockOrders;
				manualLockDebts = settingsData.manualLockDebts || manualLockDebts;
			}

			// Info from Nexus (Must have defaults)
			const systemConfig = configData || {
				lock_free_orders: false,
				lock_free_debts: false,
				maintenance_mode: false
			};

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
				systemConfig
			});
		};

		// 1. Listen to User
		const userRef = doc(db, 'users', auth.currentUser.uid);
		const unsubUser = onSnapshot(userRef, (doc) => {
			userData = doc.exists() ? doc.data() : { role: 'admin' };
			isUserReady = true;
			// Trigger update
			updateUserState();
		}, (err) => {
			console.error("useOwner: User snapshot error", err);
			isUserReady = true;
			updateUserState();
		});

		// 2. Listen to Global Config
		const configRef = doc(db, 'system_config', 'main');
		const unsubConfig = onSnapshot(configRef, (doc) => {
			configData = doc.exists() ? doc.data() : null;
			isConfigReady = true;
			updateUserState();
		}, (err) => {
			isConfigReady = true;
			updateUserState();
		});

		// 3. Listen to Settings (Wait for userData to know ownerId)
		let unsubSettings: any = null;

		// We use a separate effect logic or watcher for ownerId
		// Since we want to stay inside one effect for cleanup, we can't easily wait
		// But we can check userData in a loop or just start listening once userData arrives

		const checkSettings = () => {
			if (userData && !unsubSettings) {
				const ownerId = userData.ownerId || auth.currentUser?.uid;
				if (ownerId) {
					const settingsRef = doc(db, 'settings', ownerId);
					unsubSettings = onSnapshot(settingsRef, (doc) => {
						settingsData = doc.exists() ? doc.data() : null;
						updateUserState();
					}, (err) => {
						updateUserState();
					});
				}
			}
		};

		// Polling-ish logic or just call it every time userData updates
		const interval = setInterval(() => {
			if (userData) {
				checkSettings();
				clearInterval(interval);
			}
		}, 100);

		return () => {
			unsubUser();
			unsubConfig();
			if (unsubSettings) unsubSettings();
			clearInterval(interval);
		};
	}, [auth.currentUser]);

	return state;
};

