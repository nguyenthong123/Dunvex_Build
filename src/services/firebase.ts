import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
export const googleProvider = new GoogleAuthProvider();

// Optimize Firestore connection to avoid ERR_QUIC_PROTOCOL_ERROR
import { initializeFirestore, enableIndexedDbPersistence } from "firebase/firestore";
export const db = initializeFirestore(app, {
	experimentalForceLongPolling: true,
});

// Enable Offline Persistence
enableIndexedDbPersistence(db).catch((err) => {
	if (err.code === 'failed-precondition') {
		console.warn('Persistence failed: Multiple tabs open');
	} else if (err.code === 'unimplemented') {
		console.warn('Persistence is not available in this browser');
	}
});

export const storage = getStorage(app);

export default app;
