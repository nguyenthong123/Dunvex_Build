import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";

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
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Functions (used by AdminSettings)
import { getFunctions } from "firebase/functions";
export const functions = getFunctions(app);

// Dummy db ref — required for compatibility with doc(db, col, id) pattern.
// All actual data operations go through fakeFirestore (REST API → SQLite).
export const db = {} as any;

// ─── Fake Firestore (API-based, replaces Firestore SDK) ───
// All reads/writes go through the local REST API
export {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  runTransaction,
  writeBatch,
  increment,
  serverTimestamp,
  Timestamp,
  startAfter,
  offset,
  search,
  getCountFromServer,
  getCollectionStats,
} from './fakeFirestore';

export default app;
