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
	trialEndsAt?: any;
	subscriptionExpiresAt?: any;
	manualLockOrders?: boolean;
	manualLockDebts?: boolean;
	systemConfig: {
		lock_free_orders: boolean;
		lock_free_debts: boolean;
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
		isPro: true, // Default to true until checked
		subscriptionStatus: 'active',
		systemConfig: {
			lock_free_orders: false,
			lock_free_debts: false,
			maintenance_mode: false
		}
	});

	useEffect(() => {
		if (!auth.currentUser) {
			setState(prev => ({ ...prev, loading: false }));
			return;
		}

		const userRef = doc(db, 'users', auth.currentUser.uid);

		// 1. Listen to User document for base info
		const unsubscribeUser = onSnapshot(userRef, (userSnap) => {
			if (userSnap.exists()) {
				const userData = userSnap.data();
				const ownerId = userData.ownerId || auth.currentUser?.uid;
				const ownerEmail = userData.ownerEmail || auth.currentUser?.email;
				const role = userData.role || 'admin';
				const accessRights = userData.accessRights;

				// New: Per-user flags direct from users collection
				const manualLockOrdersUser = userData.manualLockOrders || false; // Still check per-user as fallback
				const manualLockDebtsUser = userData.manualLockDebts || false;
				const userIsPro = userData.isPro || false;

				// 2. Listen to Settings document for Subscription info (Company-wide)
				if (ownerId) {
					const settingsRef = doc(db, 'settings', ownerId);
					const unsubscribeSettings = onSnapshot(settingsRef, (settingsSnap) => {
						let isPro = userIsPro; // Use per-user pro status if available
						let subscriptionStatus: 'trial' | 'active' | 'expired' = 'active';
						let trialEndsAt = null;

						if (settingsSnap.exists()) {
							const settingsData = settingsSnap.data();
							subscriptionStatus = settingsData.subscriptionStatus || 'trial';
							trialEndsAt = settingsData.trialEndsAt;

							if (subscriptionStatus === 'active') isPro = true;
							else if (subscriptionStatus === 'trial') {
								if (trialEndsAt && trialEndsAt.toDate() < new Date()) {
									isPro = false;
									subscriptionStatus = 'expired';
								} else {
									isPro = true;
								}
							} else isPro = false;
						}

						const sData = settingsSnap.exists() ? settingsSnap.data() : {};
						const subscriptionExpiresAt = sData.subscriptionExpiresAt || null;
						// Priority: Manual lock from company settings > Individual user lock
						const manualLockOrders = sData.manualLockOrders || manualLockOrdersUser;
						const manualLockDebts = sData.manualLockDebts || manualLockDebtsUser;

						// 3. Listen to System Config (Nexus Control flags)
						const configRef = doc(db, 'system_config', 'main');
						const unsubscribeConfig = onSnapshot(configRef, (configSnap) => {
							const systemConfig = configSnap.exists()
								? configSnap.data() as any
								: { lock_free_orders: false, lock_free_debts: false, maintenance_mode: false };

							setState(prev => ({
								...prev,
								ownerId,
								ownerEmail,
								role,
								accessRights,
								isEmployee: ownerId !== auth.currentUser?.uid,
								loading: false,
								isPro,
								subscriptionStatus,
								trialEndsAt,
								subscriptionExpiresAt,
								manualLockOrders,
								manualLockDebts,
								systemConfig
							}));
						});

						return () => {
							unsubscribeSettings();
							unsubscribeConfig();
						};
					});

					return () => unsubscribeSettings();
				}
			} else {
				// Fallback
				setState(prev => ({ ...prev, loading: false }));
			}
		});

		return () => unsubscribeUser();
	}, [auth.currentUser]);

	return state;
};
