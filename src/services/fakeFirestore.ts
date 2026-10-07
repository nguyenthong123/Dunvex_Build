/**
 * Fake Firestore — Tận dụng RAM Store & Local DB của máy Mac (0ms)
 * 
 * Giữ nguyên Firebase API interface (db, collection, query, where, getDocs, addDoc, onSnapshot, ...)
 * Tự động đọc/ghi vào RAM & Local Database trên máy Mac trước, đồng bộ ngầm với VPS.
 */

import * as api from './apiClient';
import { ramStore, type QueryFilter } from './ramStore';
import { localDb } from './localDb/localDatabase';
import { syncEngine } from './syncEngine';
import { isAndroidNativeApp, isNativeApp } from '../utils/platform';

// ─── Fake Firestore Instance ────────────────────────────────

export class FakeFirestore {
  type = 'fake-firestore';
  app = { name: 'dunvex' };
  toJSON() { return {}; }
}

export const db = new FakeFirestore();

// ─── Fake Collection Reference ──────────────────────────────

export class FakeCollectionRef {
  id: string;
  path: string;
  type = 'collection';
  converter = null;
  firestore: FakeFirestore;

  constructor(collectionName: string) {
    this.id = collectionName;
    this.path = collectionName;
    this.firestore = db;
  }

  withConverter() { return this; }
  toJSON() { return {}; }

  doc(id?: string) {
    return new FakeDocRef(this.id, id || generateRandomId());
  }
}

// ─── Fake Document Reference ────────────────────────────────

export class FakeDocRef {
  id: string;
  path: string;
  type = 'document';
  firestore: any;
  converter = null;
  parent: FakeCollectionRef;

  constructor(collectionName: string, docId: string) {
    this.id = docId;
    this.path = `${collectionName}/${docId}`;
    this.firestore = db;
    this.parent = new FakeCollectionRef(collectionName);
  }

  withConverter() { return this; }
  toJSON() { return {}; }

  collection(name: string) {
    return new FakeCollectionRef(`${this.path}/${name}`);
  }
}

// ─── Fake Query ─────────────────────────────────────────────

export class FakeQuery {
  _collectionName: string;
  _filters: QueryFilter[] = [];
  _orderByField: string | null = null;
  _orderDir: 'asc' | 'desc' = 'asc';
  _limitCount: number | null = null;
  _startAfterDoc: any = null;
  _offsetVal: number | null = null;
  _searchKeyword: string | null = null;
  type = 'query';
  converter = null;
  firestore: FakeFirestore;

  constructor(collectionName: string) {
    this._collectionName = collectionName;
    this.firestore = db;
  }

  withConverter() { return this; }
  toJSON() { return {}; }
}

// ─── Re-exported Firebase-compatible functions ──────────────

export function collection(dbRef: FakeFirestore, name: string): FakeCollectionRef {
  return new FakeCollectionRef(name);
}

export function doc(dbRef: any, collectionName: string, docId: string): FakeDocRef;
export function doc(collectionRef: FakeCollectionRef, docId?: string): FakeDocRef;
export function doc(dbRef: any, arg1?: any, arg2?: string): FakeDocRef {
  if (dbRef instanceof FakeCollectionRef) {
    return new FakeDocRef(dbRef.id, arg1 || generateRandomId());
  }
  if (typeof arg1 === 'string') {
    return new FakeDocRef(arg1, arg2 || generateRandomId());
  }
  return new FakeDocRef(arg1?.id || String(arg1), arg2 || generateRandomId());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function query(collectionRef: FakeCollectionRef, ...constraints: any[]): FakeQuery {
  const q = new FakeQuery(collectionRef.id);
  for (const c of constraints) {
    if (typeof c === 'object' && c !== null) {
      if (c.type === 'where') {
        q._filters.push({ field: c.field, op: c.op, value: c.value });
      } else if (c.type === 'orderBy') {
        q._orderByField = c.field;
        q._orderDir = c.direction || 'asc';
      } else if (c.type === 'limit') {
        q._limitCount = c.limit;
      } else if (c.type === 'startAfter') {
        q._startAfterDoc = c.doc;
      } else if (c.type === 'offset') {
        q._offsetVal = c.offset;
      } else if (c.type === 'search') {
        q._searchKeyword = c.keyword;
      }
    }
  }
  return q;
}

export function where(field: string, op: string, value: unknown) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction?: 'asc' | 'desc') {
  return { type: 'orderBy', field, direction: direction || 'asc' };
}

export function limit(n: number) {
  return { type: 'limit', limit: n };
}

export function startAfter(doc: FakeDocSnapshot) {
  return { type: 'startAfter', doc };
}

export function offset(n: number) {
  return { type: 'offset', offset: n };
}

export function search(keyword: string) {
  return { type: 'search', keyword };
}

// ─── Helpers ─────────────────────────────────────────────────

function serializeValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const rec = v as Record<string, unknown>;
  if (rec.seconds !== undefined && typeof rec.seconds === 'number') {
    return new Date((rec.seconds as number) * 1000).toISOString();
  }
  if (typeof rec.toDate === 'function') {
    return (rec.toDate as () => Date)().toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/**
 * Ensure collection is populated in RAM from Local DB or Remote
 */
const windowsCollectionLoads = new Map<string, Promise<void>>();

function isWindowsNativeApp(): boolean {
  return typeof window !== 'undefined' && (window as any).chrome?.webview !== undefined;
}

async function loadCollectionIntoRAM(collectionName: string): Promise<void> {
  if (ramStore.isCollectionInitialized(collectionName)) {
    return;
  }

  // 1. Trên Native Apps: Thử tải từ Local DB (Mac SSD / SQLite cục bộ) để hiển thị tức thì 0ms offline
  if (isNativeApp()) {
    const localDocs = await localDb.getAllDocs(collectionName);
    if (localDocs && localDocs.length > 0) {
      ramStore.loadDocuments(collectionName, localDocs, true);
      if (isOnline() && !isAndroidNativeApp() && !isWindowsNativeApp()) {
        syncEngine.syncNow(true).catch(() => {});
      }
      return;
    }
  }

  // 2. Trên Web (hoặc Native App chưa có dữ liệu offline): Tải trực tiếp từ VPS SQLite
  try {
    const remoteDocs = await api.getCollection(collectionName, { limit: 10000 });
    if (remoteDocs && remoteDocs.length > 0) {
      ramStore.loadDocuments(collectionName, remoteDocs, true);
      // Chỉ ghi vào localDb nếu đang chạy Native App
      if (isNativeApp()) {
        for (const d of remoteDocs) {
          if (d && d.id) {
            localDb.saveDoc(collectionName, d.id, d, 1).catch(() => {});
          }
        }
      }
    } else {
      ramStore.markCollectionInitialized(collectionName);
    }
  } catch (err) {
    console.error(`Failed to load collection ${collectionName} from VPS:`, err);
    throw err;
  }
}

async function ensureCollectionInRAM(collectionName: string): Promise<void> {
  if (ramStore.isCollectionInitialized(collectionName) || !isNativeApp() || !isWindowsNativeApp()) {
    await loadCollectionIntoRAM(collectionName);
    return;
  }

  const pendingLoad = windowsCollectionLoads.get(collectionName);
  if (pendingLoad) {
    await pendingLoad;
    return;
  }

  const load = loadCollectionIntoRAM(collectionName).finally(() => {
    if (windowsCollectionLoads.get(collectionName) === load) {
      windowsCollectionLoads.delete(collectionName);
    }
  });
  windowsCollectionLoads.set(collectionName, load);
  await load;
}

/**
 * Force refresh a collection directly from VPS SQLite (cực kỳ hữu ích cho Web khi cần làm mới ngay)
 */
export async function refreshCollection(collectionName: string): Promise<void> {
  try {
    const remoteDocs = await api.getCollection(collectionName, { limit: 10000 });
    if (remoteDocs) {
      ramStore.loadDocuments(collectionName, remoteDocs, true);
      if (isNativeApp()) {
        for (const d of remoteDocs) {
          if (d && d.id) {
            localDb.saveDoc(collectionName, d.id, d, 1).catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.error(`Failed to refresh collection ${collectionName}:`, err);
    throw err;
  }
}

// ─── Tự động đồng bộ RAM khi nhận sự kiện thay đổi từ VPS SSE ─────────
const refreshTimeouts = new Map<string, any>();

if (typeof window !== 'undefined') {
  window.addEventListener('collection_changed', (e: any) => {
    const col = e.detail?.collection;
    if (!col || !ramStore.isCollectionInitialized(col)) return;

    if (refreshTimeouts.has(col)) {
      clearTimeout(refreshTimeouts.get(col));
    }

    refreshTimeouts.set(col, setTimeout(() => {
      refreshTimeouts.delete(col);
      refreshCollection(col).catch(() => {});
    }, 150));
  });
}

// ─── Data Operations ────────────────────────────────────────

export async function getDocs(queryOrCollection: FakeQuery | FakeCollectionRef): Promise<FakeQuerySnapshot> {
  const collectionName = queryOrCollection instanceof FakeQuery
    ? queryOrCollection._collectionName
    : queryOrCollection.id;

  await ensureCollectionInRAM(collectionName);

  let filters: QueryFilter[] = [];
  let orderByField: string | null = null;
  let orderDir: 'asc' | 'desc' = 'asc';
  let limitCount: number | null = null;
  let offsetVal: number | null = null;
  let searchKeyword: string | null = null;

  if (queryOrCollection instanceof FakeQuery) {
    filters = queryOrCollection._filters;
    orderByField = queryOrCollection._orderByField;
    orderDir = queryOrCollection._orderDir;
    limitCount = queryOrCollection._limitCount;
    offsetVal = queryOrCollection._offsetVal;
    searchKeyword = queryOrCollection._searchKeyword;
  }

  // Query in RAM (0ms latency, CPU-accelerated)
  const docs = ramStore.query(collectionName, {
    filters,
    orderByField,
    orderDir,
    limitCount,
    offsetVal,
    searchKeyword,
  });

  const fakeDocs = docs.map(d => new FakeQueryDocSnapshot(collectionName, d));
  return new FakeQuerySnapshot(fakeDocs);
}

export async function getCountFromServer(queryOrCollection: FakeQuery | FakeCollectionRef): Promise<{ data: () => { count: number } }> {
  const collectionName = queryOrCollection instanceof FakeQuery
    ? queryOrCollection._collectionName
    : queryOrCollection.id;

  await ensureCollectionInRAM(collectionName);

  const filters = queryOrCollection instanceof FakeQuery ? queryOrCollection._filters : [];
  const searchKeyword = queryOrCollection instanceof FakeQuery ? queryOrCollection._searchKeyword : null;

  const stats = ramStore.getStats(collectionName, { filters, searchKeyword });
  return { data: () => ({ count: stats.count }) };
}

export async function getCollectionStats(queryOrCollection: FakeQuery | FakeCollectionRef): Promise<{ count: number; totalAmount: number; totalProfit: number }> {
  const collectionName = queryOrCollection instanceof FakeQuery
    ? queryOrCollection._collectionName
    : queryOrCollection.id;

  await ensureCollectionInRAM(collectionName);

  const filters = queryOrCollection instanceof FakeQuery ? queryOrCollection._filters : [];
  const searchKeyword = queryOrCollection instanceof FakeQuery ? queryOrCollection._searchKeyword : null;

  return ramStore.getStats(collectionName, { filters, searchKeyword });
}

export async function getDoc(docRef: FakeDocRef): Promise<FakeDocSnapshot> {
  const parts = docRef.path.split('/');
  const collectionName = parts[0];
  const docId = parts[1];

  let data = ramStore.getDocument(collectionName, docId);
  if (!data) {
    data = await localDb.getDoc(collectionName, docId);
  }
  if (!data) {
    try {
      data = await api.getDocument(collectionName, docId);
      if (data) {
        ramStore.setDocument(collectionName, docId, data);
        localDb.saveDoc(collectionName, docId, data, 1).catch(() => {});
      }
    } catch {
      data = null;
    }
  }

  return new FakeDocSnapshot(collectionName, docId, data);
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

const SYNC_ENGINE_COLLECTIONS = new Set([
  'customers',
  'products',
  'orders',
  'order_items',
  'payments',
  'debts',
  'suppliers',
  'supplier_debts',
  'purchase_orders',
  'inventory_logs',
  'checkins',
  'attendance_logs',
  'price_lists',
  'coupons',
  'settings',
  'system_config',
  'users',
  'rebate_tiers',
  'customer_rebates',
  'notifications',
  'categories',
  'units',
  'specifications',
  'packagings',
  'densities',
]);

function requireOnlineWebWrite(): void {
  if (!isNativeApp() && !isOnline()) {
    throw new Error('Không có kết nối mạng. Thao tác chưa được lưu lên máy chủ; vui lòng kết nối lại rồi thử lại.');
  }
}

function restoreRamDocument(collectionName: string, id: string, previous: any | null): void {
  if (previous) {
    ramStore.setDocument(collectionName, id, previous);
  } else {
    ramStore.deleteDocument(collectionName, id, false);
  }
}

export async function addDoc(collectionRef: FakeCollectionRef, data: Record<string, unknown>): Promise<FakeDocRef> {
  requireOnlineWebWrite();

  const collectionName = collectionRef.id;
  const id = generateRandomId();
  const fullDoc = { ...data, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  // 1. Update RAM immediately (0ms UI latency)
  ramStore.setDocument(collectionName, id, fullDoc);

  // 2. Persist to Local DB / Native SQLite (chỉ trên Native App để hỗ trợ offline)
  if (isNativeApp()) {
    try {
      await localDb.saveDoc(collectionName, id, fullDoc, 0);
    } catch (error) {
      restoreRamDocument(collectionName, id, null);
      throw error;
    }
    syncEngine.triggerSyncOnMutation();
  }

  // Native app writes for sync-managed collections are durable locally first;
  // the sync engine pushes them to VPS in the background.
  if (isNativeApp() && SYNC_ENGINE_COLLECTIONS.has(collectionName)) {
    return new FakeDocRef(collectionName, id);
  }

  // 3. Gửi thẳng lên VPS SQLite nếu đang có mạng
  if (isOnline()) {
    try {
      await api.createDocument(collectionName, { ...fullDoc, id });
      if (isNativeApp()) {
        await localDb.markAsSynced(collectionName, [id]);
        void syncEngine.updatePendingCount();
      }
    } catch (err) {
      if (!isNativeApp()) {
        restoreRamDocument(collectionName, id, null);
      }
      throw err;
    }
  }

  return new FakeDocRef(collectionName, id);
}

export async function setDoc(docRef: FakeDocRef, data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void> {
  requireOnlineWebWrite();

  const parts = docRef.path.split('/');
  const collectionName = parts[0];
  const docId = parts[1];
  const existing = ramStore.getDocument(collectionName, docId) || {};
  const previous = ramStore.getDocument(collectionName, docId);
  const merged = options?.merge ? { ...existing, ...data, id: docId, updatedAt: new Date().toISOString() } : { ...data, id: docId, updatedAt: new Date().toISOString() };

  ramStore.setDocument(collectionName, docId, merged);
  if (isNativeApp()) {
    await localDb.saveDoc(collectionName, docId, merged, 0);
    syncEngine.triggerSyncOnMutation();
  }
  if (isOnline()) {
    try {
      await api.setDocument(collectionName, docId, merged);
      if (isNativeApp()) {
        await localDb.markAsSynced(collectionName, [docId]);
        void syncEngine.updatePendingCount();
      }
    } catch (err) {
      if (!isNativeApp()) {
        restoreRamDocument(collectionName, docId, previous);
      }
      throw err;
    }
  }
}

export async function updateDoc(docRef: FakeDocRef, data: Record<string, unknown>): Promise<void> {
  requireOnlineWebWrite();

  const parts = docRef.path.split('/');
  const collectionName = parts[0];
  const docId = parts[1];
  const previous = ramStore.getDocument(collectionName, docId);

  ramStore.updateDocument(collectionName, docId, { ...data, updatedAt: new Date().toISOString() });
  const updated = ramStore.getDocument(collectionName, docId) || { ...data, id: docId };
  if (isNativeApp()) {
    await localDb.saveDoc(collectionName, docId, updated, 0);
    syncEngine.triggerSyncOnMutation();
  }
  if (isOnline()) {
    try {
      await api.updateDocument(collectionName, docId, data);
      if (isNativeApp()) {
        await localDb.markAsSynced(collectionName, [docId]);
        void syncEngine.updatePendingCount();
      }
    } catch (err) {
      if (!isNativeApp()) {
        restoreRamDocument(collectionName, docId, previous);
      }
      throw err;
    }
  }
}

export async function deleteDoc(docRef: FakeDocRef): Promise<void> {
  requireOnlineWebWrite();

  const parts = docRef.path.split('/');
  const collectionName = parts[0];
  const docId = parts[1];
  const previous = ramStore.getDocument(collectionName, docId);

  ramStore.deleteDocument(collectionName, docId, true);
  if (isNativeApp()) {
    await localDb.removeDoc(collectionName, docId, true);
    syncEngine.triggerSyncOnMutation();
  }
  if (isOnline()) {
    try {
      await api.deleteDocument(collectionName, docId);
      if (isNativeApp()) {
        void syncEngine.updatePendingCount();
      }
    } catch (err) {
      if (!isNativeApp()) {
        restoreRamDocument(collectionName, docId, previous);
      }
      throw err;
    }
  }
}

export async function runTransaction<T = void>(dbRef: FakeFirestore, fn: (transaction: any) => Promise<T>): Promise<T> {
  const ops: Array<{ collection: string; id: string; data: any; type: 'create' | 'update' | 'delete' }> = [];
  const localWrites: Promise<unknown>[] = [];
  const previousDocuments = new Map<string, { collection: string; id: string; data: any | null }>();
  const rememberDocument = (collectionName: string, id: string) => {
    const key = `${collectionName}:${id}`;
    if (!previousDocuments.has(key)) {
      previousDocuments.set(key, {
        collection: collectionName,
        id,
        data: ramStore.getDocument(collectionName, id),
      });
    }
  };
  const rollbackWebWrites = () => {
    if (isNativeApp()) return;
    for (const previous of previousDocuments.values()) {
      restoreRamDocument(previous.collection, previous.id, previous.data);
    }
  };
  const tx = {
    get: async (docRef: FakeDocRef) => {
      return getDoc(docRef);
    },
    set: (docRef: FakeDocRef, data: any, options?: any) => {
      const parts = docRef.path.split('/');
      rememberDocument(parts[0], parts[1]);
      ops.push({ type: 'create', collection: parts[0], id: parts[1], data });
      ramStore.setDocument(parts[0], parts[1], data);
      if (isNativeApp()) {
        localWrites.push(localDb.saveDoc(parts[0], parts[1], data, 0));
      }
      return tx;
    },
    update: (docRef: FakeDocRef, data: any) => {
      const parts = docRef.path.split('/');
      rememberDocument(parts[0], parts[1]);
      ops.push({ type: 'update', collection: parts[0], id: parts[1], data });
      ramStore.updateDocument(parts[0], parts[1], data);
      const updated = ramStore.getDocument(parts[0], parts[1]) || { ...data, id: parts[1] };
      if (isNativeApp()) {
        localWrites.push(localDb.saveDoc(parts[0], parts[1], updated, 0));
      }
      return tx;
    },
    delete: (docRef: FakeDocRef) => {
      const parts = docRef.path.split('/');
      rememberDocument(parts[0], parts[1]);
      ops.push({ type: 'delete', collection: parts[0], id: parts[1], data: {} });
      ramStore.deleteDocument(parts[0], parts[1], true);
      if (isNativeApp()) {
        localWrites.push(localDb.removeDoc(parts[0], parts[1], true));
      }
      return tx;
    },
  };

  let result: T;
  try {
    result = await fn(tx);
  } catch (err) {
    rollbackWebWrites();
    throw err;
  }
  if (ops.length > 0) {
    try {
      requireOnlineWebWrite();
    } catch (err) {
      rollbackWebWrites();
      throw err;
    }
    if (isNativeApp() && localWrites.length > 0) {
      await Promise.all(localWrites);
      syncEngine.triggerSyncOnMutation();
    }
    try {
      await api.batchWrite(ops.map(o => ({
        type: o.type,
        collection: o.collection,
        id: o.id,
        data: o.data,
      })));
      if (isNativeApp()) {
        for (const o of ops) {
          if (o.type !== 'delete') {
            await localDb.markAsSynced(o.collection, [o.id]);
          }
        }
        void syncEngine.updatePendingCount();
      }
    } catch (err) {
      rollbackWebWrites();
      throw err;
    }
  }
  return result;
}

export function writeBatch(dbRef: any) {
  const ops: Array<{ collection: string; id: string; data: any; type: 'create' | 'update' | 'delete' }> = [];
  const localWrites: Promise<unknown>[] = [];
  const previousDocuments = new Map<string, { collection: string; id: string; data: any | null }>();
  const rememberDocument = (collectionName: string, id: string) => {
    const key = `${collectionName}:${id}`;
    if (!previousDocuments.has(key)) {
      previousDocuments.set(key, {
        collection: collectionName,
        id,
        data: ramStore.getDocument(collectionName, id),
      });
    }
  };
  const rollbackWebWrites = () => {
    if (isNativeApp()) return;
    for (const previous of previousDocuments.values()) {
      restoreRamDocument(previous.collection, previous.id, previous.data);
    }
  };
  const batch = {
    set: (docRef: FakeDocRef, data: any, _options?: any) => {
      const parts = docRef.path.split('/');
      rememberDocument(parts[0], parts[1]);
      ops.push({ collection: parts[0], id: parts[1], data, type: 'create' });
      ramStore.setDocument(parts[0], parts[1], data);
      if (isNativeApp()) {
        localWrites.push(localDb.saveDoc(parts[0], parts[1], data, 0));
      }
      return batch;
    },
    update: (docRef: FakeDocRef, data: any) => {
      const parts = docRef.path.split('/');
      rememberDocument(parts[0], parts[1]);
      ops.push({ collection: parts[0], id: parts[1], data, type: 'update' });
      ramStore.updateDocument(parts[0], parts[1], data);
      const updated = ramStore.getDocument(parts[0], parts[1]) || { ...data, id: parts[1] };
      if (isNativeApp()) {
        localWrites.push(localDb.saveDoc(parts[0], parts[1], updated, 0));
      }
      return batch;
    },
    delete: (docRef: FakeDocRef) => {
      const parts = docRef.path.split('/');
      rememberDocument(parts[0], parts[1]);
      ops.push({ collection: parts[0], id: parts[1], data: {}, type: 'delete' });
      ramStore.deleteDocument(parts[0], parts[1], true);
      if (isNativeApp()) {
        localWrites.push(localDb.removeDoc(parts[0], parts[1], true));
      }
      return batch;
    },
    commit: async () => {
      if (ops.length > 0) {
        try {
          requireOnlineWebWrite();
        } catch (err) {
          rollbackWebWrites();
          throw err;
        }
        if (isNativeApp() && localWrites.length > 0) {
          await Promise.all(localWrites);
          syncEngine.triggerSyncOnMutation();
        }
        try {
          await api.batchWrite(ops.map(o => ({
            type: o.type,
            collection: o.collection,
            id: o.id,
            data: o.data,
          })));
          if (isNativeApp()) {
            for (const o of ops) {
              if (o.type !== 'delete') {
                await localDb.markAsSynced(o.collection, [o.id]);
              }
            }
            void syncEngine.updatePendingCount();
          }
        } catch (err) {
          rollbackWebWrites();
          throw err;
        }
      }
    },
  };
  return batch;
}

export const increment = (n: number) => `__inc__${n}`;

// ─── Realtime / Event Subscriptions ─────────────────────────

export function onSnapshot(
  docRef: FakeDocRef,
  callback: (snapshot: FakeDocSnapshot) => void,
  onError?: (err: Error) => void
): () => void;
export function onSnapshot(
  queryOrCollection: FakeQuery | FakeCollectionRef,
  callback: (snapshot: FakeQuerySnapshot) => void,
  onError?: (err: Error) => void
): () => void;
export function onSnapshot(
  queryOrCollection: FakeQuery | FakeCollectionRef | FakeDocRef,
  callback: (snapshot: any) => void,
  onError?: (err: Error) => void,
): () => void {
  if (queryOrCollection instanceof FakeDocRef) {
    const parts = queryOrCollection.path.split('/');
    const collName = parts[0];
    const docId = parts[1];

    // Initial emit from RAM
    getDoc(queryOrCollection).then(snap => callback(snap)).catch(err => onError?.(err));

    // Listen to collection changes
    return ramStore.subscribe(collName, () => {
      getDoc(queryOrCollection).then(snap => callback(snap)).catch(err => onError?.(err));
    });
  }

  const collectionName = queryOrCollection instanceof FakeQuery
    ? queryOrCollection._collectionName
    : queryOrCollection.id;

  // Initial emit from RAM
  getDocs(queryOrCollection).then(snap => callback(snap)).catch(err => onError?.(err));

  // Subscribe to RAM Store changes
  return ramStore.subscribe(collectionName, () => {
    getDocs(queryOrCollection).then(snap => callback(snap)).catch(err => onError?.(err));
  });
}

// ─── Snapshot Helpers ───────────────────────────────────────

export class FakeQuerySnapshot<T = any> {
  docs: FakeQueryDocSnapshot<T>[];
  size: number;
  empty: boolean;

  constructor(docs: FakeQueryDocSnapshot<T>[]) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }

  forEach(fn: (doc: FakeQueryDocSnapshot<T>) => void) {
    this.docs.forEach(fn);
  }
}

// Helper: Chuyển đổi chuỗi ngày ISO về dạng mock Firebase Timestamp để tương thích với UI cũ
function convertDates(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(convertDates);

  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && (k === 'createdAt' || k === 'updatedAt' || k === 'timestamp' || k === 'lastActive' || k === 'checkInAt' || k === 'checkOutAt' || k.endsWith('At'))) {
      const ms = Date.parse(v);
      if (!isNaN(ms)) {
        result[k] = {
          seconds: Math.floor(ms / 1000),
          nanoseconds: (ms % 1000) * 1000000,
          toDate: () => new Date(ms),
          toMillis: () => ms
        };
      } else {
        result[k] = v;
      }
    } else if (v && typeof v === 'object' && !Array.isArray(v) && (k === 'createdAt' || k === 'updatedAt' || k === 'timestamp' || k === 'lastActive')) {
      const rec = v as Record<string, number>;
      const sec = rec._seconds ?? rec.seconds;
      const ns = rec._nanoseconds ?? rec.nanoseconds ?? 0;
      if (sec !== undefined && sec !== null) {
        const ms = sec * 1000 + ns / 1e6;
        result[k] = {
          seconds: sec,
          nanoseconds: ns,
          toDate: () => new Date(ms),
          toMillis: () => ms
        };
      } else {
        result[k] = v;
      }
    } else {
      result[k] = convertDates(v);
    }
  }
  return result;
}

export class FakeQueryDocSnapshot<T = any> {
  id: string;
  data: () => T | undefined;
  exists: () => boolean;
  ref: FakeDocRef;
  _collectionName: string;

  constructor(collectionName: string, data: any) {
    this._collectionName = collectionName;
    this.id = data?.id || '';
    const converted = convertDates(data);
    this.data = () => (converted ? { ...converted } : undefined);
    this.exists = () => data !== null && data !== undefined;
    this.ref = new FakeDocRef(collectionName, data?.id || '');
  }
}

export class FakeDocSnapshot<T = any> {
  id: string;
  data: () => T | undefined;
  exists: () => boolean;
  ref: FakeDocRef;
  _collectionName: string;

  constructor(collectionName: string, docId: string, data: any) {
    this._collectionName = collectionName;
    this.id = docId;
    const converted = convertDates(data);
    this.data = () => (converted ? { ...converted } : undefined);
    this.exists = () => data !== null && data !== undefined;
    this.ref = new FakeDocRef(collectionName, docId);
  }
}

// ─── ID Generator ──────────────────────────────────────────

function generateRandomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ─── Server Timestamp ───────────────────────────────────────

export const serverTimestamp = () => new Date().toISOString();
export const Timestamp = {
  now: () => ({ toDate: () => new Date(), toMillis: () => Date.now(), seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }),
  fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime(), seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
  fromMillis: (ms: number) => ({ toDate: () => new Date(ms), toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 }),
};
