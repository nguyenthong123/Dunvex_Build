/**
 * Data Access Layer — TẤT CẢ Firestore queries tập trung ở đây
 * 
 * 🔧 REFACTOR: Strangler Fig Pattern
 * - Mỗi collection chỉ được query ở 1 nơi duy nhất
 * - Views gọi qua hooks, hooks gọi qua service này
 * - Khi cần sửa query → chỉ sửa 1 file này
 */

import { db } from './firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
  runTransaction,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type DocumentData,
  type QueryConstraint,
  type DocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';

// ─── Type Helpers ───────────────────────────────────────────

export type WithId<T> = T & { id: string };

export function withId<T>(doc: DocumentSnapshot<DocumentData>): WithId<T> {
  return { id: doc.id, ...doc.data() } as WithId<T>;
}

// ─── Collection References (ĐỊNH NGHĨA 1 LẦN) ──────────────

export const COLLECTIONS = {
  products: () => collection(db, 'products'),
  orders: () => collection(db, 'orders'),
  customers: () => collection(db, 'customers'),
  auditLogs: () => collection(db, 'audit_logs'),
  payments: () => collection(db, 'payments'),
  inventoryLogs: () => collection(db, 'inventory_logs'),
  notifications: () => collection(db, 'notifications'),
  checkins: () => collection(db, 'checkins'),
  attendance: () => collection(db, 'attendance_logs'),
  coupons: () => collection(db, 'coupons'),
  users: () => collection(db, 'users'),
  settings: () => collection(db, 'settings'),
  systemConfig: () => collection(db, 'system_config'),
  priceLists: () => collection(db, 'price_lists'),
  paymentRequests: () => collection(db, 'payment_requests'),
  subscriptionPackages: () => collection(db, 'subscription_packages'),
  permissions: () => collection(db, 'permissions'),
  aiActions: () => collection(db, 'ai_actions'),
} as const;

// ─── Common Query Helpers ───────────────────────────────────

/** Query với ownerId + optional constraints */
export function ownerQuery(
  collectionName: keyof typeof COLLECTIONS,
  ownerId: string,
  ...extraConstraints: QueryConstraint[]
) {
  return query(
    COLLECTIONS[collectionName](),
    where('ownerId', '==', ownerId),
    ...extraConstraints,
  );
}

// ─── Product Service ────────────────────────────────────────

export const productService = {
  /** Lắng nghe tất cả products của owner */
  listenByOwner(ownerId: string, onData: (products: WithId<any>[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const q = query(COLLECTIONS.products(), where('ownerId', '==', ownerId));
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  /** Tìm product theo SKU toàn cục */
  async findBySku(sku: string): Promise<WithId<any> | null> {
    const q = query(COLLECTIONS.products(), where('sku', '==', sku), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : withId(snap.docs[0]);
  },

  /** Thêm product mới */
  async create(data: Record<string, any>): Promise<string> {
    const ref = await addDoc(COLLECTIONS.products(), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  /** Cập nhật product */
  async update(id: string, data: Record<string, any>): Promise<void> {
    await updateDoc(doc(COLLECTIONS.products(), id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /** Xoá product */
  async remove(id: string): Promise<void> {
    await deleteDoc(doc(COLLECTIONS.products(), id));
  },

  /** Get single product */
  async getById(id: string): Promise<WithId<any> | null> {
    const snap = await getDoc(doc(COLLECTIONS.products(), id));
    return snap.exists() ? withId(snap) : null;
  },
};

// ─── Order Service ──────────────────────────────────────────

export const orderService = {
  /** Lắng nghe orders của owner (có phân trang) */
  listenByOwner(
    ownerId: string,
    onData: (orders: WithId<any>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 500,
  ): Unsubscribe {
    const q = query(
      COLLECTIONS.orders(),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  /** Get orders một lần */
  async getByOwner(ownerId: string, maxResults = 500): Promise<WithId<any>[]> {
    const q = query(
      COLLECTIONS.orders(),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    );
    const snap = await getDocs(q);
    return snap.docs.map(withId);
  },

  /** Thêm order */
  async create(data: Record<string, any>): Promise<string> {
    const ref = await addDoc(COLLECTIONS.orders(), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  /** Cập nhật order */
  async update(id: string, data: Record<string, any>): Promise<void> {
    await updateDoc(doc(COLLECTIONS.orders(), id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /** Xoá order */
  async remove(id: string): Promise<void> {
    await deleteDoc(doc(COLLECTIONS.orders(), id));
  },
};

// ─── Customer Service ───────────────────────────────────────

export const customerService = {
  listenByOwner(ownerId: string, onData: (customers: WithId<any>[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const q = query(COLLECTIONS.customers(), where('ownerId', '==', ownerId));
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  async create(data: Record<string, any>): Promise<string> {
    const ref = await addDoc(COLLECTIONS.customers(), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, data: Record<string, any>): Promise<void> {
    await updateDoc(doc(COLLECTIONS.customers(), id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },
};

// ─── Payment Service ────────────────────────────────────────

export const paymentService = {
  listenByOwner(
    ownerId: string,
    onData: (payments: WithId<any>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 500,
  ): Unsubscribe {
    const q = query(
      COLLECTIONS.payments(),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },
};

// ─── Inventory Service ──────────────────────────────────────

export const inventoryService = {
  listenByOwner(ownerId: string, onData: (logs: WithId<any>[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const q = query(COLLECTIONS.inventoryLogs(), where('ownerId', '==', ownerId));
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  async addLog(data: Record<string, any>): Promise<string> {
    const ref = await addDoc(COLLECTIONS.inventoryLogs(), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async addLogWithId(id: string, data: Record<string, any>): Promise<void> {
    await setDoc(doc(COLLECTIONS.inventoryLogs(), id), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },
};

// ─── Audit Service ──────────────────────────────────────────

export const auditService = {
  listenByOwner(
    ownerId: string,
    onData: (logs: WithId<any>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 100,
  ): Unsubscribe {
    const q = query(
      COLLECTIONS.auditLogs(),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  async addLog(data: Record<string, any>): Promise<string> {
    const ref = await addDoc(COLLECTIONS.auditLogs(), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async addLogWithId(id: string, data: Record<string, any>): Promise<void> {
    await setDoc(doc(COLLECTIONS.auditLogs(), id), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },
};

// ─── Notification Service ───────────────────────────────────

export const notificationService = {
  /** Gửi notification cho user */
  async send(notificationData: {
    userId: string;
    title: string;
    body: string;
    type?: string;
    priority?: string;
    read?: boolean;
  }): Promise<string> {
    const ref = await addDoc(COLLECTIONS.notifications(), {
      ...notificationData,
      read: notificationData.read ?? false,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },
};

// ─── Checkin Service ────────────────────────────────────────

export const checkinService = {
  listenByOwner(
    ownerId: string,
    onData: (checkins: WithId<any>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 500,
  ): Unsubscribe {
    const q = query(
      COLLECTIONS.checkins(),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },
};

// ─── Coupon Service ─────────────────────────────────────────

export const couponService = {
  listenByOwner(ownerId: string, onData: (coupons: WithId<any>[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const q = query(COLLECTIONS.coupons(), where('ownerId', '==', ownerId));
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },
};

export const attendanceService = {
  listenByOwner(ownerId: string, onData: (logs: WithId<any>[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const q = query(COLLECTIONS.attendance(), where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },
  async create(data: any): Promise<string> {
    const ref = await addDoc(COLLECTIONS.attendance(), { ...data, createdAt: serverTimestamp() });
    return ref.id;
  },
};

export const priceListService = {
  listenByOwner(ownerId: string, onData: (lists: WithId<any>[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const q = query(COLLECTIONS.priceLists(), where('ownerId', '==', ownerId));
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },
};

export const subscriptionPackageService = {
  listen(onData: (packages: WithId<any>[]) => void, onError?: (err: Error) => void): Unsubscribe {
    return onSnapshot(COLLECTIONS.subscriptionPackages(), (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },
};

// ─── Utility: Batch Write ───────────────────────────────────

export { writeBatch, runTransaction, serverTimestamp, doc, getDoc, getDocs, setDoc };
