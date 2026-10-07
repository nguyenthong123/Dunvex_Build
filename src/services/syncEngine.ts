import { localDb } from './localDb/localDatabase';
import { getCurrentSessionUser, getSessionToken } from './sqliteSession';
import { apiUrl } from './apiClient';
import { offlineImageCache } from './offlineImageCache';
import { ramStore } from './ramStore';
import { isNativeApp } from '../utils/platform';

export interface SyncState {
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncTime: number;
  lastSyncAttemptAt: number | null;
  lastSuccessfulSyncAt: number | null;
  retryCount: number;
  conflictCount: number;
  nextRetryDelayMs: number | null;
  pendingCount: number;
  error: string | null;
  progressMessage: string | null;
}

type SyncListener = (state: SyncState) => void;

class SyncEngine {
  private isSyncing = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastSyncTime = 0;
  private lastSyncAttemptAt: number | null = null;
  private lastSuccessfulSyncAt: number | null = null;
  private retryCount = 0;
  private conflictCount = 0;
  private nextRetryDelayMs: number | null = null;
  private pendingCount = 0;
  private error: string | null = null;
  private progressMessage: string | null = null;
  private activeOwnerId = this.resolveOwnerId();
  private accountGeneration = 0;
  private lastSyncCompletedAt = 0;
  private listeners = new Set<SyncListener>();
  private syncTimer: any = null;
  private syncRequestedWhileBusy = false;
  private queuedSyncForceFull = false;
  private currentSyncForceFull = false;
  private retryTimer: any = null;
  private static readonly BACKGROUND_SYNC_COOLDOWN_MS = 30_000;

  constructor() {
    if (!isNativeApp()) {
      // Nền tảng Web chạy trực tiếp với VPS SQLite qua HTTP API.
      // Tuyệt đối không chạy bộ đếm đồng bộ ngầm 15s hoặc visibilitychange trên Web để tránh giật lag.
      return;
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notify();
        this.syncNow();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notify();
      });
      window.addEventListener('dunvex_login', (event) => {
        void this.handleLogin(event as CustomEvent);
      });
      window.addEventListener('dunvex_logout', () => {
        this.accountGeneration++;
        this.activeOwnerId = '';
        this.lastSyncTime = 0;
        this.lastSyncCompletedAt = 0;
        this.pendingCount = 0;
        this.progressMessage = null;
        this.syncRequestedWhileBusy = false;
        this.queuedSyncForceFull = false;
        if (this.mutationDebounceTimer) clearTimeout(this.mutationDebounceTimer);
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = null;
        this.nextRetryDelayMs = null;
        ramStore.clear();
        this.notify();
      });

      // Tự động đồng bộ chiều ngược lại (VPS về App) định kỳ mỗi 2 phút (120 giây) một lần trên Native App
      const TWO_MINUTES_MS = 2 * 60 * 1000;
      this.syncTimer = setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          this.syncNow(true);
        }
      }, TWO_MINUTES_MS);

      // Auto sync immediately when switching to app or unlocking phone
      window.addEventListener('focus', () => {
        if (this.isOnline) void this.syncNow(true);
      });
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && this.isOnline) {
            void this.syncNow(true);
          }
        });
      }
    }

    this.initEngine();
  }

  private async initEngine() {
    if (!isNativeApp()) return;
    try {
      const ownerId = this.resolveOwnerId();
      if (!ownerId) return;
      this.activeOwnerId = ownerId;
      const lastSyncTime = await localDb.getLastSyncTime(ownerId);
      this.lastSyncTime = lastSyncTime;
      await this.updatePendingCount(ownerId);
      this.notify();
      const shouldForceFull = lastSyncTime === 0;
      if (this.isOnline) {
        setTimeout(() => this.syncNow(true, shouldForceFull), 800);
      }
    } catch (e) {
      console.warn('[SyncEngine] Init warning:', e);
    }
  }

  private resolveOwnerId(): string {
    const user = getCurrentSessionUser();
    return user?.ownerId || user?.uid ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('dunvex_owner_id') || '' : '');
  }

  private async handleLogin(event: CustomEvent): Promise<void> {
    const user = event.detail || getCurrentSessionUser();
    const ownerId = user?.ownerId || user?.uid || this.resolveOwnerId();
    if (!ownerId) return;

    const accountChanged = ownerId !== this.activeOwnerId;
    if (accountChanged) {
      this.accountGeneration++;
      this.activeOwnerId = ownerId;
      this.lastSyncTime = 0;
      this.lastSyncCompletedAt = 0;
      this.pendingCount = 0;
      this.progressMessage = 'Đang tải dữ liệu tài khoản...';
      ramStore.clear();
      this.notify();
      this.lastSyncTime = await localDb.getLastSyncTime(ownerId);
      await this.updatePendingCount(ownerId);
      this.notify();
    }

    if (this.isOnline && (accountChanged || this.lastSyncTime === 0)) {
      setTimeout(() => {
        void this.syncNow(false, this.lastSyncTime === 0);
      }, 300);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public getState(): SyncState {
    return {
      isSyncing: this.isSyncing,
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      lastSyncAttemptAt: this.lastSyncAttemptAt,
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      retryCount: this.retryCount,
      conflictCount: this.conflictCount,
      nextRetryDelayMs: this.nextRetryDelayMs,
      pendingCount: this.pendingCount,
      error: this.error,
      progressMessage: this.progressMessage,
    };
  }

  private scheduleRetry(): void {
    if (!isNativeApp() || !this.isOnline) {
      this.nextRetryDelayMs = null;
      this.notify();
      return;
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    const baseDelay = Math.min(5000 * Math.pow(2, this.retryCount), 30000);
    this.nextRetryDelayMs = baseDelay;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.nextRetryDelayMs = null;
      if (this.isOnline && !this.isSyncing) {
        void this.syncNow(true);
      }
    }, baseDelay);
    this.notify();
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(fn => fn(state));
  }

  public async updatePendingCount(ownerId = this.resolveOwnerId()): Promise<number> {
    if (!isNativeApp()) return 0;
    try {
      const pendingCount = await localDb.getUnsyncedCount(ownerId);
      if (ownerId === this.resolveOwnerId()) this.pendingCount = pendingCount;
      this.notify();
      return pendingCount;
    } catch (error) {
      console.error('[SyncEngine] Unable to count pending changes:', error);
      this.error = 'Không đọc được số thay đổi đang chờ đồng bộ';
      this.notify();
      return this.pendingCount;
    }
  }

  private mutationDebounceTimer: any = null;

  /**
   * Kích hoạt tự động đẩy dữ liệu lên VPS ngay khi có tác vụ tạo/sửa/xoá (lên đơn, công nợ, sản phẩm,...)
   * Sử dụng debounce 500ms để gom nhóm các thay đổi liên tiếp thành một lượt đồng bộ tối ưu
   */
  public triggerSyncOnMutation(): void {
    if (!isNativeApp()) return;

    if (this.mutationDebounceTimer) {
      clearTimeout(this.mutationDebounceTimer);
    }
    this.mutationDebounceTimer = setTimeout(() => {
      if (this.isOnline) {
        void this.updatePendingCount().finally(() => {
          void this.syncNow(false);
        });
      }
    }, 500);
  }

  private async pullPages(
    syncBaseUrl: string,
    since: number,
    token: string,
    ownerId: string,
    generation: number,
  ): Promise<{ changes: Record<string, any[]>; deletions: Record<string, string[]>; server_time: number; pulled: number } | null> {
    const remoteIds = new Map<string, Set<string>>();
    const imageUrlsToPrecache = new Set<string>();
    let cursor: string | null = null;
    let serverTime = 0;
    let pageNumber = 0;
    let pulledCount = 0;

    do {
      if (generation !== this.accountGeneration || ownerId !== this.resolveOwnerId()) return null;
      const params = new URLSearchParams({ since: String(since), limit: '150' });
      if (cursor) params.set('cursor', cursor);
      if (serverTime) params.set('until', String(serverTime));

      const response = await fetch(`${syncBaseUrl}/pull?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': token ? 'Bearer ' + token : '',
          'x-owner-id': ownerId,
        },
      });
      if (!response.ok) {
        if (pageNumber === 0) return null;
        throw new Error(`Đồng bộ bị gián đoạn ở đợt ${pageNumber + 1} (HTTP ${response.status}).`);
      }

      const data = await response.json();
      if (!data.changes) {
        if (pageNumber === 0) return null;
        throw new Error('Dữ liệu trả về từ máy chủ không đúng định dạng đồng bộ.');
      }
      if (generation !== this.accountGeneration || ownerId !== this.resolveOwnerId()) return null;

      serverTime = Number(data.server_time) || serverTime;
      await localDb.upsertRemoteChanges(data.changes, ownerId);
      for (const [table, rows] of Object.entries(data.changes)) {
        if (!Array.isArray(rows)) continue;
        let ids = remoteIds.get(table);
        if (!ids) {
          ids = new Set<string>();
          remoteIds.set(table, ids);
        }
        for (const row of rows as Array<{ id?: string }>) {
          if (row.id) ids.add(row.id);
        }
      }

      if (pageNumber === 0 && data.deletions) {
        await localDb.applyRemoteDeletions(data.deletions, ownerId);
      }

      const pageCount = Object.values(data.changes).reduce(
        (count: number, rows: any) => count + (Array.isArray(rows) ? rows.length : 0),
        0,
      );
      pulledCount += pageCount;
      this.progressMessage = `Đã tải ${pulledCount.toLocaleString('vi-VN')} bản ghi`;
      this.notify();

      for (const rows of Object.values(data.changes)) {
        if (!Array.isArray(rows)) continue;
        for (const row of rows as any[]) {
          if (typeof row?.imageUrl === 'string' && row.imageUrl.startsWith('http')) imageUrlsToPrecache.add(row.imageUrl);
          if (typeof row?.image_url === 'string' && row.image_url.startsWith('http')) imageUrlsToPrecache.add(row.image_url);
          if (Array.isArray(row?.additionalImages)) {
            for (const url of row.additionalImages) {
              if (typeof url === 'string' && url.startsWith('http')) imageUrlsToPrecache.add(url);
            }
          }
        }
      }

      const nextCursor = typeof data.next_cursor === 'string' ? data.next_cursor : null;
      if (nextCursor && nextCursor === cursor) {
        throw new Error('Máy chủ đồng bộ trả về cursor không tiến triển.');
      }
      cursor = nextCursor;
      pageNumber++;
      if (cursor) await new Promise((resolve) => setTimeout(resolve, 20));
    } while (cursor);

    if (imageUrlsToPrecache.size > 0) {
      void offlineImageCache.precacheUrls(Array.from(imageUrlsToPrecache)).catch((error) => {
        console.warn('[SyncEngine] Unable to pre-cache synced images:', error);
      });
    }

    if (since === 0 && generation === this.accountGeneration && ownerId === this.resolveOwnerId()) {
      for (const [table, ids] of remoteIds) {
        await localDb.reconcileFullSync(table, ids, ownerId);
      }
    }

    return { changes: {}, deletions: {}, server_time: serverTime, pulled: pulledCount };
  }

  /**
   * Execute full bidirectional Delta Sync (Push local unsynced -> Pull remote changes)
   */
  public async syncNow(isBackground = false, forceFull = false): Promise<{ success: boolean; pushed: number; pulled: number; error?: string }> {
    if (!isNativeApp()) {
      return { success: true, pushed: 0, pulled: 0 };
    }
    if (
      isBackground &&
      this.lastSyncCompletedAt > 0 &&
      Date.now() - this.lastSyncCompletedAt < SyncEngine.BACKGROUND_SYNC_COOLDOWN_MS
    ) {
      return { success: true, pushed: 0, pulled: 0 };
    }
    if (this.isSyncing) {
      if (!isBackground || (forceFull && !this.currentSyncForceFull)) {
        this.syncRequestedWhileBusy = true;
        this.queuedSyncForceFull ||= forceFull;
      }
      return { success: false, pushed: 0, pulled: 0 };
    }
     if (!this.isOnline) {
       return { success: false, pushed: 0, pulled: 0 };
     }

    const user = getCurrentSessionUser();
    const token = getSessionToken();
    const ownerId = user?.ownerId || user?.uid ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('dunvex_owner_id') : '') || '';
    let generation = this.accountGeneration;

    if (!ownerId || !token) {
      return { success: false, pushed: 0, pulled: 0, error: 'User not authenticated' };
    }
    if (ownerId !== this.activeOwnerId) {
      this.activeOwnerId = ownerId || '';
      this.accountGeneration++;
      this.lastSyncTime = 0;
      ramStore.clear();
      generation = this.accountGeneration;
    }

    this.isSyncing = true;
    this.currentSyncForceFull = forceFull;
    this.lastSyncAttemptAt = Date.now();
    this.error = null;
    this.progressMessage = 'Đang chuẩn bị đồng bộ...';
    this.notify();

    let pushedCount = 0;
    let pulledCount = 0;

    try {
      const deviceId = await localDb.getDeviceId();
      const syncBaseUrl = apiUrl('/api/sync');

      // ─── 1. PUSH DELTA (Local -> VPS) ───────────────────────
      const unsynced = await localDb.getUnsyncedPayload(ownerId);
      let totalUnsynced = 0;
      for (const arr of Object.values(unsynced)) {
        if (Array.isArray(arr)) totalUnsynced += arr.length;
      }

      // Sanitize payload: Strip heavy base64 image binaries and local paths to protect VPS disk space
      const sanitizeRecordForVPS = (item: any): any => {
        if (!item || typeof item !== 'object') return item;
        const copy = { ...item };
        for (const [k, v] of Object.entries(copy)) {
          if (typeof v === 'string') {
            if (
              v.startsWith('data:image/') ||
              v.startsWith('blob:') ||
              v.startsWith('file:') ||
              v.startsWith('capacitor:') ||
              v.startsWith('/var/mobile') ||
              v.startsWith('/data/user') ||
              (v.length > 500 && /^[A-Za-z0-9+/=]+$/.test(v.substring(0, 100)))
            ) {
              copy[k] = ''; // Do not upload binary or local image payloads to VPS
            }
          } else if (v && typeof v === 'object' && !Array.isArray(v)) {
            copy[k] = sanitizeRecordForVPS(v);
          }
        }
        return copy;
      };

      const sanitizedChanges: Record<string, any[]> = {};
      for (const [tbl, items] of Object.entries(unsynced)) {
        sanitizedChanges[tbl] = Array.isArray(items) ? items.map(sanitizeRecordForVPS) : [];
      }

      if (totalUnsynced > 0) {
        let pushHandled = false;
        let pushData: any = null;
        try {
          const pushRes = await fetch(`${syncBaseUrl}/push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? 'Bearer ' + token : '',
              'x-owner-id': ownerId || '',
            },
            body: JSON.stringify({
              deviceId,
              changes: sanitizedChanges,
            }),
          });

          if (pushRes.ok) {
            pushData = await pushRes.json();
          }
        } catch {
          // fallback below
        }

        if (pushData?.synced_ids) {
          pushHandled = true;
          for (const [table, ids] of Object.entries(pushData.synced_ids)) {
            if (Array.isArray(ids) && ids.length > 0) {
              await localDb.markAsSynced(table, ids as string[], ownerId);
              pushedCount += ids.length;
            }
          }
          if (Array.isArray(pushData.rejected_ids)) {
            this.conflictCount = pushData.rejected_ids.length;
          }
        }

        // Fallback: If VPS /api/sync/push is not available, push individual items via REST API
        if (!pushHandled) {
          for (const [col, items] of Object.entries(sanitizedChanges)) {
            if (!Array.isArray(items) || items.length === 0) continue;
            const syncedIds: string[] = [];
            for (const item of items) {
              if (!item.id) continue;
              try {
                const res = await fetch(apiUrl(`/api/data/${col}/${item.id}`), {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? 'Bearer ' + token : '',
                    'x-owner-id': ownerId || '',
                  },
                  body: JSON.stringify(item),
                });
                if (res.ok) {
                  syncedIds.push(item.id);
                  pushedCount++;
                }
              } catch {}
            }
            if (syncedIds.length > 0) {
              await localDb.markAsSynced(col, syncedIds, ownerId);
            }
          }
        }
      }

      // ─── 2. PULL DELTA / FULL (VPS -> Local) ─────────────────
      let pullHandled = false;
      try {
        const lastSync = forceFull ? 0 : await localDb.getLastSyncTime(ownerId || '');
        const pullData = await this.pullPages(syncBaseUrl, lastSync, token, ownerId || '', generation);

        if (pullData) {
          pulledCount = pullData.pulled;
          if (pullData.changes) {
            await localDb.upsertRemoteChanges(pullData.changes);
            for (const arr of Object.values(pullData.changes)) {
              if (Array.isArray(arr)) pulledCount += arr.length;
            }
            const urlsToPrecache: string[] = [];
            for (const rows of Object.values(pullData.changes)) {
              if (Array.isArray(rows)) {
                for (const r of rows) {
                  if (r?.imageUrl && typeof r.imageUrl === 'string' && r.imageUrl.startsWith('http')) urlsToPrecache.push(r.imageUrl);
                  if (r?.image_url && typeof r.image_url === 'string' && r.image_url.startsWith('http')) urlsToPrecache.push(r.image_url);
                  if (Array.isArray(r?.additionalImages)) {
                    for (const img of r.additionalImages) {
                      if (img && typeof img === 'string' && img.startsWith('http')) urlsToPrecache.push(img);
                    }
                  }
                }
              }
            }
            if (urlsToPrecache.length > 0) {
              void offlineImageCache.precacheUrls(urlsToPrecache);
            }
          }

          // 2. Xóa triệt để các bản ghi đã bị xóa trên Web / VPS
          if (pullData.deletions) {
            const delCount = await localDb.applyRemoteDeletions(pullData.deletions);
            pulledCount += delCount;
          }

          // 3. Đối soát Full Sync: loại bỏ các bản ghi mồ côi đã bị xóa trên máy chủ
          if (lastSync === 0 && pullData.changes) {
            for (const [table, items] of Object.entries(pullData.changes)) {
              if (Array.isArray(items)) {
                const remoteIds = new Set((items as any[]).map(i => i.id).filter(Boolean));
                const removed = await localDb.reconcileFullSync(table, remoteIds, ownerId);
                pulledCount += removed;
              }
            }
          }

          if (pullData.server_time) {
            this.lastSyncTime = pullData.server_time;
            await localDb.setLastSyncTime(pullData.server_time, ownerId || '');
          }
          pullHandled = true;
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Đồng bộ dữ liệu bị gián đoạn.';
        pullHandled = true;
      }

      // Fallback: If VPS /api/sync/pull returned 404, pull directly from /api/data/:collection
      if (!pullHandled && generation === this.accountGeneration && ownerId === this.resolveOwnerId()) {
        const collectionsToPull = [
          'customers', 'products', 'orders', 'order_items', 'suppliers', 'supplier_debts', 
          'debts', 'payments', 'purchase_orders', 'inventory_logs', 'checkins', 'attendance_logs', 
          'price_lists', 'coupons', 'rebate_tiers', 'customer_rebates', 'users', 'system_config', 
          'settings', 'categories', 'units', 'specifications', 'packagings', 'densities'
        ];
        const changes: Record<string, any[]> = {};
        for (const col of collectionsToPull) {
          try {
            const res = await fetch(apiUrl(`/api/data/${col}?limit=10000`), {
              headers: {
                'Authorization': token ? 'Bearer ' + token : '',
                'x-owner-id': ownerId || '',
              },
            });
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.data)) {
                if (data.data.length > 0) {
                  changes[col] = data.data;
                  pulledCount += data.data.length;
                }
                const remoteIds = new Set((data.data as any[]).map(d => d.id).filter(Boolean));
                const removed = await localDb.reconcileFullSync(col, remoteIds, ownerId);
                pulledCount += removed;
              }
            }
          } catch {}
        }
        if (Object.keys(changes).length > 0) {
          await localDb.upsertRemoteChanges(changes, ownerId || '');
          if (Array.isArray(changes.products) && changes.products.length > 0) {
            offlineImageCache.precacheProducts(changes.products);
          }
          this.lastSyncTime = Date.now();
          await localDb.setLastSyncTime(this.lastSyncTime, ownerId || '');
        }
      }

      if (generation !== this.accountGeneration || ownerId !== this.resolveOwnerId()) {
        return { success: false, pushed: pushedCount, pulled: pulledCount };
      }
      await this.updatePendingCount(ownerId);
      if (this.error) {
        this.retryCount += 1;
        this.scheduleRetry();
        return { success: false, pushed: pushedCount, pulled: pulledCount, error: this.error };
      }
      this.lastSuccessfulSyncAt = Date.now();
      this.lastSyncCompletedAt = this.lastSuccessfulSyncAt;
      this.retryCount = 0;
      this.nextRetryDelayMs = null;
      this.conflictCount = 0;
      return { success: true, pushed: pushedCount, pulled: pulledCount };
    } catch (err: any) {
      console.warn('[SyncEngine] Sync error:', err.message);
      this.error = err.message || 'Sync failed';
      this.retryCount += 1;
      this.scheduleRetry();
      return { success: false, pushed: pushedCount, pulled: pulledCount, error: this.error || undefined };
    } finally {
      const runQueuedSync = this.syncRequestedWhileBusy;
      const queuedForceFull = this.queuedSyncForceFull;
      this.syncRequestedWhileBusy = false;
      this.queuedSyncForceFull = false;
      this.currentSyncForceFull = false;
      this.isSyncing = false;
      this.progressMessage = null;
      if (!this.error && generation === this.accountGeneration && ownerId === this.resolveOwnerId()) {
        this.lastSyncCompletedAt = Date.now();
      }
      this.notify();
      if (runQueuedSync && this.isOnline) {
        setTimeout(() => {
          void this.syncNow(false, queuedForceFull);
        }, 0);
      }
    }
  }
}

export const syncEngine = new SyncEngine();
