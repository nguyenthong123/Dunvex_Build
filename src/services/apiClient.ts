/**
 * API Client — Thay thế Firebase Firestore SDK
 * 
 * Gọi REST API đến Express backend thay vì Firestore trực tiếp.
 * Giữ interface tương tự Firebase để dataAccess.ts dễ migrate.
 */

import { Capacitor } from '@capacitor/core';
import { clearSQLiteSession, getCurrentSessionUser, getSessionToken } from './sqliteSession';

const isStandaloneDesktopOrMobile = typeof window !== 'undefined' && (
  window.location.port === '41738' ||
  (window as any).webkit?.messageHandlers !== undefined ||
  Capacitor.isNativePlatform()
);

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || (isStandaloneDesktopOrMobile ? 'https://dunvex.com' : '');

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

const API_BASE = apiUrl(import.meta.env.VITE_API_URL || '/api/data');

// ─── Auth Headers ───────────────────────────────────────────

export function getAuthHeaders() {
  // Lấy từ localStorage (được set khi login)
  const apiKey = localStorage.getItem('dunvex_api_key') || '';
  let ownerId = localStorage.getItem('dunvex_owner_id') || '';
  if (!ownerId) {
    try {
      ownerId = getCurrentSessionUser()?.uid || '';
    } catch (e) {}
  }
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'x-owner-id': ownerId,
  };
}

export function setApiCredentials(apiKey: string, ownerId: string) {
  localStorage.setItem('dunvex_api_key', apiKey);
  localStorage.setItem('dunvex_owner_id', ownerId);
}

export async function logoutSQLiteSession() {
  const token = getSessionToken();
  try {
    if (token) {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } finally {
    clearSQLiteSession();
  }
}

async function apiFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getSessionToken();

  const buildHeaders = () => {
    const headers: Record<string, string> = {
      ...getAuthHeaders(),
      ...(options.headers as any || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  let res = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: buildHeaders()
  });

  if (res.status === 401 && token) {
    clearSQLiteSession();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API Error: ${res.status}`);
  }

  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json as T;
}

// ─── Collection API (Firestore-compatible interface) ───────

export interface ApiDocument {
  id: string;
  [key: string]: any;
}

export interface ApiQueryResult {
  success: boolean;
  count: number;
  data: ApiDocument[];
}

/** Get all documents in a collection (with optional filters) */
export async function getCollection(
  collection: string,
  options?: {
    where?: string[];
    orderBy?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }
): Promise<ApiDocument[]> {
  const params = new URLSearchParams();
  if (options?.where) {
    options.where.forEach(w => params.append('where', w));
  }
  if (options?.orderBy) {
    params.set('orderBy', options.orderBy);
  }
  if (options?.limit) {
    params.set('limit', String(options.limit));
  }
  if (options?.offset) {
    params.set('offset', String(options.offset));
  }
  if (options?.search) {
    params.set('search', options.search);
  }
  const qs = params.toString();
  const url = `${API_BASE}/${collection}${qs ? '?' + qs : ''}`;
  const result = await apiFetch<ApiQueryResult>(url);
  return result.data || [];
}

/** Get total count of documents matching the filters */
export async function getCollectionCount(
  collection: string,
  options?: {
    where?: string[];
    search?: string;
  }
): Promise<number> {
  const params = new URLSearchParams();
  params.set('action', 'count');
  if (options?.where) {
    options.where.forEach(w => params.append('where', w));
  }
  if (options?.search) {
    params.set('search', options.search);
  }
  const qs = params.toString();
  const url = `${API_BASE}/${collection}${qs ? '?' + qs : ''}`;
  const result = await apiFetch<{ success: boolean; count: number }>(url);
  return result.count || 0;
}

/** Get aggregated stats (count, totalAmount, totalProfit) */
export async function getCollectionStats(
  collection: string,
  options?: {
    where?: string[];
    search?: string;
  }
): Promise<{ count: number; totalAmount: number; totalProfit: number }> {
  const params = new URLSearchParams();
  params.set('action', 'stats');
  if (options?.where) {
    options.where.forEach(w => params.append('where', w));
  }
  if (options?.search) {
    params.set('search', options.search);
  }
  const qs = params.toString();
  const url = `${API_BASE}/${collection}${qs ? '?' + qs : ''}`;
  const result = await apiFetch<{ success: boolean; count: number; totalAmount: number; totalProfit: number }>(url);
  return { count: result.count || 0, totalAmount: result.totalAmount || 0, totalProfit: result.totalProfit || 0 };
}

/** Get single document by ID */
export async function getDocument(collection: string, id: string): Promise<ApiDocument | null> {
  try {
    const result = await apiFetch<{ success: boolean; data: ApiDocument }>(
      `${API_BASE}/${collection}/${id}`
    );
    return result.data || null;
  } catch (e: any) {
    return null;
  }
}

function localInvalidate(collection: string) {
  try {
    triggerCollectionReload(collection);
    window.dispatchEvent(new CustomEvent('collection_changed', { detail: { collection } }));
  } catch (e) {
    console.warn('Failed to dispatch local collection_changed event', e);
  }
}

function stripImageBinaries(data: Record<string, any>): Record<string, any> {
  if (!data || typeof data !== 'object') return data;
  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string') {
      if (
        val.startsWith('data:image/') ||
        val.startsWith('blob:') ||
        val.startsWith('file:') ||
        val.startsWith('capacitor:') ||
        val.startsWith('/var/mobile') ||
        val.startsWith('/data/user') ||
        (val.length > 500 && /^[A-Za-z0-9+/=]+$/.test(val.substring(0, 100)))
      ) {
        sanitized[key] = ''; // Do NOT push binary or local image paths to VPS
        continue;
      }
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = stripImageBinaries(val);
      continue;
    }
    sanitized[key] = val;
  }
  return sanitized;
}

/** Create a new document (auto-generated ID if not provided) */
export async function createDocument(
  collection: string,
  data: Record<string, any>
): Promise<string> {
  const sanitizedData = stripImageBinaries(data);
  const result = await apiFetch<{ success: boolean; id: string }>(
    `${API_BASE}/${collection}`,
    {
      method: 'POST',
      body: JSON.stringify(sanitizedData),
    }
  );

  // Optimistic update: inject the new doc with its newly returned ID into cache
  const newDoc = { ...data, id: result.id };
  for (const [key, entry] of listeners.entries()) {
    if (entry.collection !== collection || !entry.lastData) continue;
    try {
      const prev = JSON.parse(entry.lastData);
      if (!Array.isArray(prev)) continue;
      const next = [newDoc, ...prev];
      entry.lastData = JSON.stringify(next);
      entry.callbacks.forEach(fn => fn(next));
    } catch (e) {}
  }

  localInvalidate(collection);
  return result.id;
}

/** Create document with specific ID */
export async function setDocument(
  collection: string,
  id: string,
  data: Record<string, any>
): Promise<void> {
  const rollbacks: Array<() => void> = [];
  const newDoc = { ...data, id };

  for (const [key, entry] of listeners.entries()) {
    if (entry.collection !== collection || !entry.lastData) continue;
    try {
      const prev = JSON.parse(entry.lastData);
      if (!Array.isArray(prev)) continue;
      
      const exists = prev.some((d: any) => d.id === id);
      let next;
      if (exists) {
        next = prev.map((d: any) => d.id === id ? newDoc : d);
      } else {
        next = [newDoc, ...prev];
      }
      
      entry.lastData = JSON.stringify(next);
      entry.callbacks.forEach(fn => fn(next));
      rollbacks.push(() => {
        entry.lastData = JSON.stringify(prev);
        entry.callbacks.forEach(fn => fn(prev));
      });
    } catch (e) {}
  }

  try {
    await apiFetch(`${API_BASE}/${collection}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(stripImageBinaries(data)),
    });
    localInvalidate(collection);
  } catch (e) {
    rollbacks.forEach(r => r());
    throw e;
  }
}

/** Update a document */
export async function updateDocument(
  collection: string,
  id: string,
  data: Record<string, any>
): Promise<void> {
  const rollbacks: Array<() => void> = [];

  for (const [key, entry] of listeners.entries()) {
    if (entry.collection !== collection || !entry.lastData) continue;
    try {
      const prev = JSON.parse(entry.lastData);
      if (!Array.isArray(prev)) continue;
      const next = prev.map((d: any) => {
        if (d.id === id) {
          return { ...d, ...data };
        }
        return d;
      });
      entry.lastData = JSON.stringify(next);
      entry.callbacks.forEach(fn => fn(next));
      rollbacks.push(() => {
        entry.lastData = JSON.stringify(prev);
        entry.callbacks.forEach(fn => fn(prev));
      });
    } catch (e) {}
  }

  // Also update doc listeners if any
  const docKey = `${collection}:${id}`;
  const docEntry = docListeners.get(docKey);
  let docPrev: any = null;
  if (docEntry && docEntry.lastData) {
    try {
      docPrev = JSON.parse(docEntry.lastData);
      const docNext = { ...docPrev, ...data };
      docEntry.lastData = JSON.stringify(docNext);
      docEntry.callbacks.forEach(fn => fn(docNext));
      rollbacks.push(() => {
        docEntry.lastData = JSON.stringify(docPrev);
        docEntry.callbacks.forEach(fn => fn(docPrev));
      });
    } catch (e) {}
  }

  try {
    await apiFetch(`${API_BASE}/${collection}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(stripImageBinaries(data)),
    });
    localInvalidate(collection);
  } catch (e) {
    rollbacks.forEach(r => r());
    throw e;
  }
}

/** Delete a document */
export async function deleteDocument(collection: string, id: string): Promise<void> {
  // Optimistic update: remove the doc from all cached collection listeners immediately
  // so the UI updates instantly (before the network round-trip + SSE reconcile).
  const rollbacks: Array<() => void> = [];
  for (const [key, entry] of listeners.entries()) {
    if (entry.collection !== collection || !entry.lastData) continue;
    try {
      const prev = JSON.parse(entry.lastData);
      if (!Array.isArray(prev)) continue;
      const next = prev.filter((d: any) => d.id !== id);
      if (next.length === prev.length) continue;
      entry.lastData = JSON.stringify(next);
      entry.callbacks.forEach(fn => fn(next));
      rollbacks.push(() => {
        entry.lastData = JSON.stringify(prev);
        entry.callbacks.forEach(fn => fn(prev));
      });
    } catch (e) {
      // ignore malformed cache entries
    }
  }

  try {
    await apiFetch(`${API_BASE}/${collection}/${id}`, {
      method: 'DELETE',
    });
    localInvalidate(collection);
  } catch (e) {
    // Rollback optimistic update on failure
    rollbacks.forEach(r => r());
    throw e;
  }
}

/** Batch write operations */
export async function batchWrite(
  operations: Array<{
    type: 'create' | 'update' | 'delete';
    collection: string;
    id?: string;
    data?: Record<string, any>;
  }>
): Promise<void> {
  // Optimistic updates for listeners
  for (const op of operations) {
    if (op.type === 'delete' && op.id) {
      for (const [key, entry] of listeners.entries()) {
        if (entry.collection !== op.collection || !entry.lastData) continue;
        try {
          const prev = JSON.parse(entry.lastData);
          if (Array.isArray(prev)) {
            const next = prev.filter((d: any) => d.id !== op.id);
            entry.lastData = JSON.stringify(next);
            entry.callbacks.forEach(fn => fn(next));
          }
        } catch (e) {}
      }
    }
  }

  await apiFetch(`${API_BASE}/_batch`, {
    method: 'POST',
    body: JSON.stringify({ operations }),
  });
  const uniqueCollections = Array.from(new Set(operations.map(o => o.collection)));
  uniqueCollections.forEach(localInvalidate);
}

// ─── Realtime via Server-Sent Events (SSE) ───────────────────

const listeners = new Map<string, {
  collection: string;
  options: any;
  callbacks: Set<(data: ApiDocument[]) => void>;
  lastData: string;
}>();

const docListeners = new Map<string, {
  collection: string;
  id: string;
  callbacks: Set<(data: ApiDocument | null) => void>;
  lastData: string;
}>();

let sseConnection: AbortController | null = null;
let isConnecting = false;

export async function setupSSE() {
  if (sseConnection || isConnecting) return;
  isConnecting = true;
  
  const token = getSessionToken();

  const abortController = new AbortController();
  sseConnection = abortController;

  const url = `${API_BASE}/stream`;
  const headers: Record<string, string> = getAuthHeaders();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      headers,
      signal: abortController.signal,
    });
    if (!response.body) {
      throw new Error('SSE stream has no response body');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'change' && data.collection) {
              triggerCollectionReload(data.collection);
              // Dispatch global event for hooks that don't rely on strict snapshot matching
              window.dispatchEvent(new CustomEvent('collection_changed', { detail: { collection: data.collection } }));
            }
          } catch(e) {}
        }
      }
    }
  } catch (err) {
    // fetch failed or stream errored — will reconnect in finally
  } finally {
    isConnecting = false;
    if (sseConnection === abortController) {
      sseConnection = null;
    }
    // Reconnect after 5s on ANY disconnect (error, clean close, or no body)
    setTimeout(setupSSE, 5000);
  }
}

function triggerCollectionReload(collection: string) {
  for (const [key, entry] of listeners.entries()) {
    if (entry.collection === collection) {
      getCollection(entry.collection, entry.options).then(docs => {
        const dataStr = JSON.stringify(docs);
        if (entry.lastData !== dataStr) {
          entry.lastData = dataStr;
          entry.callbacks.forEach(cb => cb(docs));
        }
      }).catch(console.error);
    }
  }

  for (const [key, entry] of docListeners.entries()) {
    if (entry.collection === collection) {
      getDocument(entry.collection, entry.id).then(doc => {
        const dataStr = JSON.stringify(doc);
        if (entry.lastData !== dataStr) {
          entry.lastData = dataStr;
          entry.callbacks.forEach(cb => cb(doc));
        }
      }).catch(console.error);
    }
  }
}

/** 
 * Realtime listener sử dụng SSE
 * Trả về unsubscribe function
 */
export function onCollectionSnapshot(
  collection: string,
  options: {
    where?: string[];
    orderBy?: string;
    limit?: number;
  },
  onData: (docs: ApiDocument[]) => void,
  onError?: (err: Error) => void,
): () => void {
  setupSSE();

  const key = `${collection}:${JSON.stringify(options)}`;

  if (!listeners.has(key)) {
    const callbacks = new Set<(data: ApiDocument[]) => void>();
    
    listeners.set(key, { collection, options, callbacks, lastData: '' });

    // Initial load
    getCollection(collection, options).then(docs => {
      const entry = listeners.get(key);
      if (entry) {
        entry.lastData = JSON.stringify(docs);
        entry.callbacks.forEach(cb => cb(docs));
      }
    }).catch(e => onError?.(e));
  } else {
    const entry = listeners.get(key)!;
    if (entry.lastData) {
      try {
        onData(JSON.parse(entry.lastData));
      } catch(e) {}
    }
    // Background fetch to ensure fresh state (handles silent offline SSE disconnects)
    getCollection(collection, options).then(docs => {
      const e = listeners.get(key);
      if (e) {
        const dataStr = JSON.stringify(docs);
        if (e.lastData !== dataStr) {
          e.lastData = dataStr;
          e.callbacks.forEach(cb => cb(docs));
        }
      }
    }).catch(console.error);
  }

  const entry = listeners.get(key)!;
  entry.callbacks.add(onData);

  // Return unsubscribe
  return () => {
    const e = listeners.get(key);
    if (!e) return;
    e.callbacks.delete(onData);
    if (e.callbacks.size === 0) {
      listeners.delete(key);
    }
  };
}

/** 
 * Realtime listener sử dụng SSE cho 1 Document
 * Trả về unsubscribe function
 */
export function onDocumentSnapshot(
  collection: string,
  id: string,
  onData: (doc: ApiDocument | null) => void,
  onError?: (err: Error) => void,
): () => void {
  setupSSE();

  const key = `${collection}:${id}`;

  if (!docListeners.has(key)) {
    const callbacks = new Set<(data: ApiDocument | null) => void>();
    
    docListeners.set(key, { collection, id, callbacks, lastData: '' });

    // Initial load
    getDocument(collection, id).then(doc => {
      const entry = docListeners.get(key);
      if (entry) {
        entry.lastData = JSON.stringify(doc);
        entry.callbacks.forEach(cb => cb(doc));
      }
    }).catch(e => onError?.(e));
  } else {
    const entry = docListeners.get(key)!;
    if (entry.lastData) {
      try {
        onData(JSON.parse(entry.lastData));
      } catch(e) {}
    }
    // Background fetch to ensure fresh document state
    getDocument(collection, id).then(doc => {
      const e = docListeners.get(key);
      if (e) {
        const dataStr = JSON.stringify(doc);
        if (e.lastData !== dataStr) {
          e.lastData = dataStr;
          e.callbacks.forEach(cb => cb(doc));
        }
      }
    }).catch(console.error);
  }

  const entry = docListeners.get(key)!;
  entry.callbacks.add(onData);

  // Return unsubscribe
  return () => {
    const e = docListeners.get(key);
    if (!e) return;
    e.callbacks.delete(onData);
    if (e.callbacks.size === 0) {
      docListeners.delete(key);
    }
  };
}

// ─── Trash & Approvals REST API Helpers ─────────────────────

export async function restoreTrashItem(trashId: string): Promise<any> {
  return apiFetch(`${API_BASE}/trash/${trashId}/restore`, {
    method: 'POST',
  });
}

export async function purgeTrashItem(trashId: string): Promise<any> {
  return apiFetch(`${API_BASE}/trash/${trashId}/purge`, {
    method: 'DELETE',
  });
}

export async function decideApprovalRequest(
  collection: string,
  docId: string,
  decision: 'approve' | 'reject'
): Promise<any> {
  return apiFetch(`${API_BASE}/approvals/${collection}/${docId}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}


