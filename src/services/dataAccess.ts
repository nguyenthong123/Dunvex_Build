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
  startAfter,
  increment,
  offset,
  search,
  getCountFromServer,
} from './firebase';

// Type stubs for Firebase-compatible interfaces
type Unsubscribe = () => void;
type DocumentData = Record<string, any>;
type QueryConstraint = any;
type DocumentSnapshot = any;
type QuerySnapshot = any;

// ─── Type Helpers ───────────────────────────────────────────

export type WithId<T> = T & { id: string };

export function withId<T>(doc: DocumentSnapshot): WithId<T> {
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
  rebateTiers: () => collection(db, 'rebate_tiers'),
  customerRebates: () => collection(db, 'customer_rebates'),
  suppliers: () => collection(db, 'suppliers'),
  purchaseOrders: () => collection(db, 'purchase_orders'),
  supplierDebts: () => collection(db, 'supplier_debts'),
  customerDebts: () => collection(db, 'debts'),
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
  /** Lắng nghe products của owner (có limit an toàn, mặc định 2000) */
  listenByOwner(ownerId: string, onData: (products: WithId<DocumentData>[]) => void, onError?: (err: Error) => void, maxResults = 999999): Unsubscribe {
    const q = query(
      COLLECTIONS.products(),
      where('ownerId', '==', ownerId),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  async getProductsPaginated(
    ownerId: string,
    page: number = 1,
    pageSize: number = 50,
    searchKeyword?: string
  ): Promise<{ items: WithId<DocumentData>[]; totalItems: number; totalPages: number }> {
    const offsetVal = (page - 1) * pageSize;
    const constraints: any[] = [
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
      offset(offsetVal)
    ];
    if (searchKeyword) {
      constraints.push(search(searchKeyword));
    }
    const q = query(COLLECTIONS.products(), ...constraints);
    const [snap, countResult] = await Promise.all([
      getDocs(q),
      getCountFromServer(q)
    ]);
    const totalItems = countResult.data().count;
    const totalPages = Math.ceil(totalItems / pageSize);
    return { items: snap.docs.map(withId), totalItems, totalPages };
  },

  /** Tìm product theo SKU toàn cục */
  async findBySku(sku: string): Promise<WithId<DocumentData> | null> {
    const q = query(COLLECTIONS.products(), where('sku', '==', sku), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : withId(snap.docs[0]);
  },

  /** Thêm product mới */
  async create(data: DocumentData): Promise<string> {
    const ref = await addDoc(COLLECTIONS.products(), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  /** Cập nhật product */
  async update(id: string, data: DocumentData): Promise<void> {
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
  async getById(id: string): Promise<WithId<DocumentData> | null> {
    const snap = await getDoc(doc(COLLECTIONS.products(), id));
    return snap.exists() ? withId(snap) : null;
  },

  /** Lấy tất cả danh mục (category) duy nhất của owner */
  async getAllCategories(ownerId: string): Promise<string[]> {
    const q = query(
      COLLECTIONS.products(),
      where('ownerId', '==', ownerId),
      limit(2000),
    );
    const snap = await getDocs(q);
    const categories = new Set<string>();
    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.category && typeof data.category === 'string') {
        categories.add(data.category.trim());
      }
    });
    return Array.from(categories).sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  },
};

// ─── Order Service ──────────────────────────────────────────

/** Cursor-based pagination result */
export interface PaginatedResult<T> {
  items: WithId<T>[];
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
}

export const orderService = {
  /** Lắng nghe orders của owner (có limit, mặc định 999999) */
  listenByOwner(
    ownerId: string,
    onData: (orders: WithId<DocumentData>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 999999,
  ): Unsubscribe {
    const q = query(
      COLLECTIONS.orders(),
      where('ownerId', '==', ownerId),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      const docs = snap.docs.map(withId).sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      onData(docs);
    }, onError);
  },

  /** Get orders một lần */
  async getByOwner(ownerId: string, maxResults = 999999): Promise<WithId<DocumentData>[]> {
    const q = query(
      COLLECTIONS.orders(),
      where('ownerId', '==', ownerId),
      limit(maxResults),
    );
    const snap = await getDocs(q);
    return snap.docs.map(withId).sort((a: any, b: any) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
  },

  async getOrdersPaginated(
    ownerId: string,
    page: number = 1,
    pageSize: number = 50,
    searchKeyword?: string
  ): Promise<{ items: WithId<DocumentData>[]; totalItems: number; totalPages: number }> {
    const offsetVal = (page - 1) * pageSize;
    const constraints: any[] = [
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
      offset(offsetVal)
    ];
    if (searchKeyword) {
      constraints.push(search(searchKeyword));
    }
    // 🔧 Tách query: dùng query KHÔNG có limit/offset để đếm total
    const countQ = query(COLLECTIONS.orders(), where('ownerId', '==', ownerId), ...(searchKeyword ? [search(searchKeyword)] : []));
    const q = query(COLLECTIONS.orders(), ...constraints);
    const [snap, countResult] = await Promise.all([
      getDocs(q),
      getCountFromServer(countQ)
    ]);
    const totalItems = countResult.data().count;
    const totalPages = Math.ceil(totalItems / pageSize);
    return { items: snap.docs.map(withId), totalItems, totalPages };
  },

  /** 🔄 PHÂN TRANG: Load thêm orders (cursor-based, không ảnh hưởng realtime listener) */
  async getByOwnerPaginated(
    ownerId: string,
    pageSize = 200,
    startAfterDoc?: DocumentSnapshot | null,
  ): Promise<PaginatedResult<DocumentData>> {
    const constraints: QueryConstraint[] = [
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    if (startAfterDoc) {
      constraints.splice(2, 0, startAfter(startAfterDoc));
    }
    const q = query(COLLECTIONS.orders(), ...constraints);
    const snap = await getDocs(q);
    const items = snap.docs.map(withId);
    return {
      items,
      hasMore: !snap.empty && snap.docs.length === pageSize,
      lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    };
  },

  /** Thêm order */
  async create(data: DocumentData): Promise<string> {
    const ref = await addDoc(COLLECTIONS.orders(), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  /** Cập nhật order */
  async update(id: string, data: DocumentData): Promise<void> {
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
  listenByOwner(ownerId: string, onData: (customers: WithId<DocumentData>[]) => void, onError?: (err: Error) => void, maxResults = 999999): Unsubscribe {
    const q = query(
      COLLECTIONS.customers(),
      where('ownerId', '==', ownerId),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  async getCustomersPaginated(
    ownerId: string,
    page: number = 1,
    pageSize: number = 50,
    searchKeyword?: string
  ): Promise<{ items: WithId<DocumentData>[]; totalItems: number; totalPages: number }> {
    const offsetVal = (page - 1) * pageSize;
    const constraints: any[] = [
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
      offset(offsetVal)
    ];
    if (searchKeyword) {
      constraints.push(search(searchKeyword));
    }
    // 🔧 Tách query: dùng query KHÔNG có limit/offset để đếm total
    const countQ = query(COLLECTIONS.customers(), where('ownerId', '==', ownerId), ...(searchKeyword ? [search(searchKeyword)] : []));
    const q = query(COLLECTIONS.customers(), ...constraints);
    const [snap, countResult] = await Promise.all([
      getDocs(q),
      getCountFromServer(countQ)
    ]);
    const totalItems = countResult.data().count;
    const totalPages = Math.ceil(totalItems / pageSize);
    return { items: snap.docs.map(withId), totalItems, totalPages };
  },

  async create(data: DocumentData): Promise<string> {
    const ref = await addDoc(COLLECTIONS.customers(), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, data: DocumentData): Promise<void> {
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
    onData: (payments: WithId<DocumentData>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 999999,
  ): Unsubscribe {
    const q = query(
      COLLECTIONS.payments(),
      where('ownerId', '==', ownerId),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      const docs = snap.docs.map(withId).sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      onData(docs);
    }, onError);
  },

  /** 🔄 PHÂN TRANG: Load thêm payments */
  async getByOwnerPaginated(
    ownerId: string,
    pageSize = 200,
    startAfterDoc?: DocumentSnapshot | null,
  ): Promise<PaginatedResult<DocumentData>> {
    const constraints: QueryConstraint[] = [
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    if (startAfterDoc) {
      constraints.splice(2, 0, startAfter(startAfterDoc));
    }
    const q = query(COLLECTIONS.payments(), ...constraints);
    const snap = await getDocs(q);
    const items = snap.docs.map(withId);
    return {
      items,
      hasMore: !snap.empty && snap.docs.length === pageSize,
      lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    };
  },
};

// ─── Inventory Service ──────────────────────────────────────

/** 🔒 SAFETY: Số ngày tối đa lấy inventory_logs (tránh query toàn bộ lịch sử) */
const INVENTORY_LOG_MAX_DAYS = 90;

export const inventoryService = {
  /** Lắng nghe inventory_logs của owner (có limit an toàn) */
  listenByOwner(
    ownerId: string,
    onData: (logs: WithId<DocumentData>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 200,
  ): Unsubscribe {
    const q = query(
      COLLECTIONS.inventoryLogs(),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  /** 🔄 PHÂN TRANG: Load thêm inventory_logs (dùng cho xem lịch sử cũ) */
  async getByOwnerPaginated(
    ownerId: string,
    pageSize = 200,
    startAfterDoc?: DocumentSnapshot | null,
  ): Promise<PaginatedResult<DocumentData>> {
    const constraints: QueryConstraint[] = [
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    if (startAfterDoc) {
      constraints.splice(1, 0, startAfter(startAfterDoc));
    }
    const q = query(COLLECTIONS.inventoryLogs(), ...constraints);
    const snap = await getDocs(q);
    const items = snap.docs.map(withId);
    return {
      items,
      hasMore: !snap.empty && snap.docs.length === pageSize,
      lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    };
  },

  async addLog(data: DocumentData): Promise<string> {
    const ref = await addDoc(COLLECTIONS.inventoryLogs(), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async addLogWithId(id: string, data: DocumentData): Promise<void> {
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
    onData: (logs: WithId<DocumentData>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 999999,
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

  async addLog(data: DocumentData): Promise<string> {
    const ref = await addDoc(COLLECTIONS.auditLogs(), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async addLogWithId(id: string, data: DocumentData): Promise<void> {
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
    onData: (checkins: WithId<DocumentData>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 999999,
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
  listenByOwner(ownerId: string, onData: (coupons: WithId<DocumentData>[]) => void, onError?: (err: Error) => void, maxResults = 999999): Unsubscribe {
    const q = query(
      COLLECTIONS.coupons(),
      where('ownerId', '==', ownerId),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },
};

export const attendanceService = {
  listenByOwner(ownerId: string, onData: (logs: WithId<DocumentData>[]) => void, onError?: (err: Error) => void, maxResults = 999999): Unsubscribe {
    const q = query(
      COLLECTIONS.attendance(),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    );
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
  listenByOwner(ownerId: string, onData: (lists: WithId<DocumentData>[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const q = query(COLLECTIONS.priceLists(), where('ownerId', '==', ownerId));
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },
};

export const subscriptionPackageService = {
  listen(onData: (packages: WithId<DocumentData>[]) => void, onError?: (err: Error) => void): Unsubscribe {
    return onSnapshot(COLLECTIONS.subscriptionPackages(), (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },
};

// ─── Rebate Tier Service ────────────────────────────────────

export const rebateTierService = {
  listenByOwner(ownerId: string, onData: (tiers: WithId<DocumentData>[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const q = query(COLLECTIONS.rebateTiers(), where('ownerId', '==', ownerId));
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  async saveTiers(ownerId: string, customerType: string, tiers: { minAmount: number; percent: number }[]): Promise<void> {
    const docId = customerType.toLowerCase().replace(/\s+/g, '-');
    await setDoc(doc(COLLECTIONS.rebateTiers(), docId), {
      ownerId,
      customerType,
      tiers,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteTiers(docId: string): Promise<void> {
    await deleteDoc(doc(COLLECTIONS.rebateTiers(), docId));
  },
};

export interface CustomerRebateData {
  ownerId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerType?: string;
  rebateAmount: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  maxUsage: number; // default 1
  usedCount: number; // default 0
  usedOrderIds?: string[];
  status: 'active' | 'used' | 'expired' | 'disabled';
  note?: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const customerRebateService = {
  listenByOwner(ownerId: string, onData: (rebates: WithId<CustomerRebateData>[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const q = query(COLLECTIONS.customerRebates(), where('ownerId', '==', ownerId));
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId) as WithId<CustomerRebateData>[]);
    }, onError);
  },

  async createRebate(ownerId: string, data: Omit<CustomerRebateData, 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(COLLECTIONS.customerRebates(), {
      ...data,
      ownerId,
      usedCount: data.usedCount || 0,
      maxUsage: data.maxUsage || 1,
      usedOrderIds: data.usedOrderIds || [],
      status: data.status || 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateRebate(id: string, data: Partial<CustomerRebateData>): Promise<void> {
    await updateDoc(doc(COLLECTIONS.customerRebates(), id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteRebate(id: string): Promise<void> {
    await deleteDoc(doc(COLLECTIONS.customerRebates(), id));
  },

  async useRebate(rebateId: string, orderId: string): Promise<void> {
    const ref = doc(COLLECTIONS.customerRebates(), rebateId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const current = snap.data() as CustomerRebateData;
    const currentOrders = Array.isArray(current.usedOrderIds) ? current.usedOrderIds : [];
    if (currentOrders.includes(orderId)) return;
    const nextCount = (current.usedCount || 0) + 1;
    const nextStatus = nextCount >= (current.maxUsage || 1) ? 'used' : 'active';
    await updateDoc(ref, {
      usedCount: nextCount,
      usedOrderIds: [...currentOrders, orderId],
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  },

  async refundRebate(rebateId: string, orderId: string): Promise<void> {
    const ref = doc(COLLECTIONS.customerRebates(), rebateId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const current = snap.data() as CustomerRebateData;
    const currentOrders = Array.isArray(current.usedOrderIds) ? current.usedOrderIds : [];
    if (!currentOrders.includes(orderId)) return;
    const nextOrders = currentOrders.filter(id => id !== orderId);
    const nextCount = Math.max(0, (current.usedCount || 1) - 1);
    const nextStatus = nextCount >= (current.maxUsage || 1) ? 'used' : 'active';
    await updateDoc(ref, {
      usedCount: nextCount,
      usedOrderIds: nextOrders,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  },
};

// ─── Supplier Service ────────────────────────────────────────

export const supplierService = {
  listenByOwner(ownerId: string, onData: (suppliers: WithId<DocumentData>[]) => void, onError?: (err: Error) => void, maxResults = 999999): Unsubscribe {
    const q = query(
      COLLECTIONS.suppliers(),
      where('ownerId', '==', ownerId),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  async create(data: DocumentData): Promise<string> {
    const ref = await addDoc(COLLECTIONS.suppliers(), {
      ...data,
      totalDebt: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, data: DocumentData): Promise<void> {
    await updateDoc(doc(COLLECTIONS.suppliers(), id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(COLLECTIONS.suppliers(), id));
  },
};

// ─── Purchase Order Service ──────────────────────────────────

export const purchaseOrderService = {
  listenByOwner(
    ownerId: string,
    onData: (pos: WithId<DocumentData>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 999999,
  ): Unsubscribe {
    const q = query(
      COLLECTIONS.purchaseOrders(),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  async create(data: DocumentData): Promise<string> {
    const ref = await addDoc(COLLECTIONS.purchaseOrders(), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, data: DocumentData): Promise<void> {
    await updateDoc(doc(COLLECTIONS.purchaseOrders(), id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(COLLECTIONS.purchaseOrders(), id));
  },
};

// ─── Supplier Debt Service ───────────────────────────────────

export const supplierDebtService = {
  listenByOwner(
    ownerId: string,
    onData: (debts: WithId<DocumentData>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 999999,
  ): Unsubscribe {
    const q = query(
      COLLECTIONS.supplierDebts(),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  async create(data: DocumentData): Promise<string> {
    const ref = await addDoc(COLLECTIONS.supplierDebts(), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(COLLECTIONS.supplierDebts(), id));
  },

  async update(id: string, data: Partial<DocumentData>): Promise<void> {
    await updateDoc(doc(COLLECTIONS.supplierDebts(), id), data);
  },
};

// ─── Customer Debt Service ───────────────────────────────────

export const customerDebtService = {
  listenByOwner(
    ownerId: string,
    onData: (debts: WithId<DocumentData>[]) => void,
    onError?: (err: Error) => void,
    maxResults = 999999,
  ): Unsubscribe {
    const q = query(
      COLLECTIONS.customerDebts(),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    );
    return onSnapshot(q, (snap: QuerySnapshot) => {
      onData(snap.docs.map(withId));
    }, onError);
  },

  /** Ghi nhận 1 giao dịch công nợ KH (tăng/giảm) */
  async create(data: DocumentData): Promise<string> {
    const ref = await addDoc(COLLECTIONS.customerDebts(), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(COLLECTIONS.customerDebts(), id));
  },
};

// ─── Utility: Batch Write ───────────────────────────────────

export { writeBatch, runTransaction, serverTimestamp, doc, getDoc, getDocs, setDoc };
