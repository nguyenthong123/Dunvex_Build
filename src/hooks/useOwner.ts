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
}

export const useOwner = () => {
	const [state, setState] = useState<OwnerState>({
		ownerId: '',
		ownerEmail: '',
		role: 'admin',
		isEmployee: false,
		loading: true
	});

	useEffect(() => {
		if (!auth.currentUser) {
			setState(prev => ({ ...prev, loading: false }));
			return;
		}

		const userRef = doc(db, 'users', auth.currentUser.uid);

		// Real-time listener for permission changes
		const unsubscribe = onSnapshot(userRef, (docSnap) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				// If ownerId is present, use it. Otherwise default to self.
				const ownerId = data.ownerId || auth.currentUser?.uid;
				const ownerEmail = data.ownerEmail || auth.currentUser?.email;
				const role = data.role || 'admin';
				const accessRights = data.accessRights;

				setState({
					ownerId,
					ownerEmail,
					role,
					accessRights,
					isEmployee: ownerId !== auth.currentUser?.uid,
					loading: false
				});
			} else {
				// Fallback if user doc doesn't exist yet (shouldn't happen after valid login)
				setState({
					ownerId: auth.currentUser?.uid || '',
					ownerEmail: auth.currentUser?.email || '',
					role: 'admin',
					isEmployee: false,
					loading: false
				});
			}
		});

		return () => unsubscribe();
	}, [auth.currentUser]);

	return state;
};
