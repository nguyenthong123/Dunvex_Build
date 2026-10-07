export { auth } from './sqliteSession';

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
  refreshCollection,
} from './fakeFirestore';

