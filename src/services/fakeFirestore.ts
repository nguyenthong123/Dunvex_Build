/**
 * Fake Firestore — Giữ nguyên Firebase API interface nhưng gọi local API
 * 
 * Cho phép tất cả views dùng `db`, `collection()`, `getDocs()`, v.v...
 * mà không cần sửa code.
 */

import * as api from './apiClient';
import type { OrderDoc, CustomerDoc, ProductDoc, PaymentDoc } from './docTypes';

// ─── Fake Firestore Instance ────────────────────────────────

export class FakeFirestore {
  type = 'fake-firestore';
  app = { name: 'dunvex' };
  toJSON() { return {}; }
}

export const db = new FakeFirestore();

// ─── Fake Collection Reference ──────────────────────────────

class FakeCollectionRef {
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

class FakeDocRef {
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

class FakeQuery {
  _collectionName: string;
  _filters: { field: string; op: string; value: any }[] = [];
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

// ─── Data Operations ────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────

function serializeValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  // Firebase Timestamp or mock Timestamp
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

export async function getDocs(queryOrCollection: FakeQuery | FakeCollectionRef): Promise<FakeQuerySnapshot> {
  const collectionName = queryOrCollection instanceof FakeQuery
    ? queryOrCollection._collectionName
    : queryOrCollection.id;

  const whereClauses: string[] = [];
  let orderByStr: string | undefined;
  let limitVal: number | undefined;
  let offsetVal: number | undefined;
  let searchVal: string | undefined;

  if (queryOrCollection instanceof FakeQuery) {
    for (const f of queryOrCollection._filters) {
      whereClauses.push(`${f.field}:${f.op}:${serializeValue(f.value)}`);
    }
    if (queryOrCollection._orderByField) {
      orderByStr = `${queryOrCollection._orderByField}:${queryOrCollection._orderDir}`;
    }
    if (queryOrCollection._limitCount) {
      limitVal = queryOrCollection._limitCount;
    }
    if (queryOrCollection._offsetVal) {
      offsetVal = queryOrCollection._offsetVal;
    }
    if (queryOrCollection._searchKeyword) {
      searchVal = queryOrCollection._searchKeyword;
    }
  }

  const docs = await api.getCollection(collectionName, {
    where: whereClauses.length > 0 ? whereClauses : undefined,
    orderBy: orderByStr,
    limit: limitVal,
    offset: offsetVal,
    search: searchVal,
  });

  const fakeDocs = docs.map(d => new FakeQueryDocSnapshot(collectionName, d));
  return new FakeQuerySnapshot(fakeDocs);
}

export async function getCountFromServer(queryOrCollection: FakeQuery | FakeCollectionRef): Promise<{ data: () => { count: number } }> {
  const collectionName = queryOrCollection instanceof FakeQuery
    ? queryOrCollection._collectionName
    : queryOrCollection.id;

  const whereClauses: string[] = [];
  let searchVal: string | undefined;

  if (queryOrCollection instanceof FakeQuery) {
    for (const f of queryOrCollection._filters) {
      whereClauses.push(`${f.field}:${f.op}:${serializeValue(f.value)}`);
    }
    if (queryOrCollection._searchKeyword) {
      searchVal = queryOrCollection._searchKeyword;
    }
  }

  const count = await api.getCollectionCount(collectionName, {
    where: whereClauses.length > 0 ? whereClauses : undefined,
    search: searchVal,
  });

  return { data: () => ({ count }) };
}

export async function getCollectionStats(queryOrCollection: FakeQuery | FakeCollectionRef): Promise<{ count: number; totalAmount: number; totalProfit: number }> {
  const collectionName = queryOrCollection instanceof FakeQuery
    ? queryOrCollection._collectionName
    : queryOrCollection.id;

  const whereClauses: string[] = [];
  let searchVal: string | undefined;

  if (queryOrCollection instanceof FakeQuery) {
    for (const f of queryOrCollection._filters) {
      whereClauses.push(`${f.field}:${f.op}:${serializeValue(f.value)}`);
    }
    if (queryOrCollection._searchKeyword) {
      searchVal = queryOrCollection._searchKeyword;
    }
  }

  return api.getCollectionStats(collectionName, {
    where: whereClauses.length > 0 ? whereClauses : undefined,
    search: searchVal,
  });
}

export async function getDoc(docRef: FakeDocRef): Promise<FakeDocSnapshot> {
  const parts = docRef.path.split('/');
  const collectionName = parts[0];
  const docId = parts[1];
  const data = await api.getDocument(collectionName, docId);
  return new FakeDocSnapshot(collectionName, docId, data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addDoc(collectionRef: FakeCollectionRef, data: Record<string, unknown>): Promise<FakeDocRef> {
  const id = await api.createDocument(collectionRef.id, data);
  return new FakeDocRef(collectionRef.id, id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setDoc(docRef: FakeDocRef, data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void> {
  const parts = docRef.path.split('/');
  if (options?.merge) {
    await api.updateDocument(parts[0], parts[1], data);
  } else {
    await api.setDocument(parts[0], parts[1], data);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateDoc(docRef: FakeDocRef, data: Record<string, unknown>): Promise<void> {
  const parts = docRef.path.split('/');
  await api.updateDocument(parts[0], parts[1], data);
}

export async function deleteDoc(docRef: FakeDocRef): Promise<void> {
  const parts = docRef.path.split('/');
  await api.deleteDocument(parts[0], parts[1]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runTransaction<T = void>(dbRef: FakeFirestore, fn: (transaction: any) => Promise<T>): Promise<T> {
  const ops: Array<{ collection: string; id: string; data: any; type: 'create' | 'update' | 'delete' }> = [];
  const tx = {
    get: async (docRef: FakeDocRef) => {
      const parts = docRef.path.split('/');
      const data = await api.getDocument(parts[0], parts[1]);
      return new FakeDocSnapshot(parts[0], parts[1], data);
    },
    set: (docRef: FakeDocRef, data: any, _options?: any) => {
      const parts = docRef.path.split('/');
      ops.push({ type: 'create', collection: parts[0], id: parts[1], data });
      return tx;
    },
    update: (docRef: FakeDocRef, data: any) => {
      const parts = docRef.path.split('/');
      ops.push({ type: 'update', collection: parts[0], id: parts[1], data });
      return tx;
    },
    delete: (docRef: FakeDocRef) => {
      const parts = docRef.path.split('/');
      ops.push({ type: 'delete', collection: parts[0], id: parts[1], data: {} });
      return tx;
    },
  };
  const result = await fn(tx);
  if (ops.length > 0) {
    await api.batchWrite(ops.map(o => ({
      type: o.type,
      collection: o.collection,
      id: o.id,
      data: o.data,
    })));
  }
  return result;
}

export function writeBatch(dbRef: any) {
  const ops: Array<{ collection: string; id: string; data: any; type: 'create' | 'update' | 'delete' }> = [];
  const batch = {
    set: (docRef: FakeDocRef, data: any, _options?: any) => {
      const parts = docRef.path.split('/');
      ops.push({ collection: parts[0], id: parts[1], data, type: 'create' });
      return batch;
    },
    update: (docRef: FakeDocRef, data: any) => {
      const parts = docRef.path.split('/');
      ops.push({ collection: parts[0], id: parts[1], data, type: 'update' });
      return batch;
    },
    delete: (docRef: FakeDocRef) => {
      const parts = docRef.path.split('/');
      ops.push({ collection: parts[0], id: parts[1], data: {}, type: 'delete' });
      return batch;
    },
    commit: async () => {
      if (ops.length > 0) {
        await api.batchWrite(ops.map(o => ({
          type: o.type,
          collection: o.collection,
          id: o.id,
          data: o.data,
        })));
      }
    },
  };
  return batch;
}

export const increment = (n: number) => `__inc__${n}`;

// ─── Realtime (Polling) ─────────────────────────────────────

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

    return api.onDocumentSnapshot(
      collName,
      docId,
      (data) => {
        callback(new FakeDocSnapshot(collName, docId, data));
      },
      onError
    );
  }

  const collectionName = queryOrCollection instanceof FakeQuery
    ? queryOrCollection._collectionName
    : queryOrCollection.id;

  const whereClauses: string[] = [];
  let orderByStr: string | undefined;
  let limitVal: number | undefined;

  if (queryOrCollection instanceof FakeQuery) {
    for (const f of queryOrCollection._filters) {
      whereClauses.push(`${f.field}:${f.op}:${serializeValue(f.value)}`);
    }
    if (queryOrCollection._orderByField) {
      orderByStr = `${queryOrCollection._orderByField}:${queryOrCollection._orderDir}`;
    }
    if (queryOrCollection._limitCount) {
      limitVal = queryOrCollection._limitCount;
    }
  }

  return api.onCollectionSnapshot(
    collectionName,
    { where: whereClauses.length > 0 ? whereClauses : undefined, orderBy: orderByStr, limit: limitVal },
    (docs) => {
      const fakeDocs = docs.map(d => new FakeQueryDocSnapshot(collectionName, d));
      callback(new FakeQuerySnapshot(fakeDocs));
    },
    onError,
  );
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
      // Handle legacy Timestamp objects with _seconds/_nanoseconds or seconds/nanoseconds
      const rec = v as Record<string,number>;
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

class FakeQueryDocSnapshot<T = any> {
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
    this.exists = () => data !== null;
    this.ref = new FakeDocRef(collectionName, data?.id || '');
  }
}

class FakeDocSnapshot<T = any> {
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
