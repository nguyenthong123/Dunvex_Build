import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { openDB, type IDBPDatabase } from 'idb';

const IMAGE_DB_NAME = 'dunvex_offline_images';
const CHUNK_SIZE = 64 * 1024; // 64KB chunks as defined in technical architecture

export interface LocalFileSaveResult {
  localPath: string;
  url: string;
}

export interface LocalStorageStats {
  directory?: string;
  count: number;
  totalBytes: number;
  totalMB: string;
}

class LocalFileService {
  private idbPromise: Promise<IDBPDatabase> | null = null;
  private isNativeMobile: boolean;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private initializedBridge = false;
  private urlCache = new Map<string, string>(); // remoteUrl -> localUrl

  constructor() {
    this.isNativeMobile = Capacitor.isNativePlatform();
    this.setupNativeBridge();
  }

  private isNativeDesktop(): boolean {
    return (
      typeof window !== 'undefined' &&
      ((window as any).webkit?.messageHandlers?.fileBridge !== undefined ||
       (window as any).chrome?.webview !== undefined)
    );
  }

  private setupNativeBridge() {
    if (typeof window === 'undefined' || this.initializedBridge) return;
    this.initializedBridge = true;

    (window as any).__fileBridgeCallback = (
      requestId: string,
      result: any,
      error: string | null
    ) => {
      const pending = this.pendingRequests.get(requestId);
      if (!pending) return;

      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);

      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    };
  }

  private sendNative<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
    this.setupNativeBridge();

    if (!this.isNativeDesktop()) {
      return Promise.reject(new Error('Native file bridge is not available.'));
    }

    return new Promise<T>((resolve, reject) => {
      const requestId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Native file request timed out after 30s: ${action}`));
        }
      }, 30000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      try {
        if ((window as any).webkit?.messageHandlers?.fileBridge) {
          (window as any).webkit.messageHandlers.fileBridge.postMessage({
            requestId,
            action,
            ...payload,
          });
        } else if ((window as any).chrome?.webview) {
          (window as any).chrome.webview.postMessage({
            bridge: 'fileBridge',
            requestId,
            action,
            ...payload,
          });
        }
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(err);
      }
    });
  }

  private async getIdb(): Promise<IDBPDatabase> {
    if (!this.idbPromise) {
      this.idbPromise = openDB(IMAGE_DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('images')) {
            db.createObjectStore('images');
          }
          if (!db.objectStoreNames.contains('url_map')) {
            db.createObjectStore('url_map');
          }
        },
      });
    }
    return this.idbPromise;
  }

  /**
   * Save an image Blob or File to local device storage.
   * Priority 1: Native macOS Local SSD Directory (~/Library/Application Support/Dunvex/images/)
   * Priority 2: Native Mobile Filesystem (@capacitor/filesystem)
   * Priority 3: Browser IndexedDB Blob store
   */
  async saveImage(blobOrFile: Blob | File | string, customName?: string): Promise<LocalFileSaveResult> {
    let blob: Blob;
    if (typeof blobOrFile === 'string') {
      blob = this.base64ToBlob(blobOrFile);
    } else {
      blob = blobOrFile;
    }

    const filename = customName || `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;

    // 1. macOS Standalone Native Desktop
    if (this.isNativeDesktop()) {
      try {
        const base64Data = await this.blobToBase64(blob);
        const res = await this.sendNative<{ success: boolean; localPath: string; url: string }>('saveImage', {
          fileName: filename,
          base64: base64Data,
        });
        if (res && res.url) {
          return { localPath: res.localPath, url: res.url };
        }
      } catch (err) {
        console.warn('[LocalFileService] macOS Native save failed, falling back to IDB:', err);
      }
    }

    // 2. Mobile (iOS / Android Capacitor)
    if (this.isNativeMobile) {
      try {
        const base64Data = await this.blobToBase64(blob);
        const saved = await Filesystem.writeFile({
          path: `dunvex_images/${filename}`,
          data: base64Data,
          directory: Directory.Data,
          recursive: true,
        });

        return {
          localPath: saved.uri || `dunvex_images/${filename}`,
          url: Capacitor.convertFileSrc(saved.uri || `dunvex_images/${filename}`),
        };
      } catch (err) {
        console.warn('[LocalFileService] Mobile Native save failed, falling back to IDB:', err);
      }
    }

    // 3. Web / PWA Fallback (IndexedDB)
    const idb = await this.getIdb();
    const localPath = `local_blob://${filename}`;
    await idb.put('images', blob, localPath);
    const url = URL.createObjectURL(blob);

    return { localPath, url };
  }

  /**
   * Retrieve Image Blob from local storage
   */
  async getImageBlob(localPath: string): Promise<Blob | null> {
    if (!localPath) return null;

    // macOS native
    if (this.isNativeDesktop() && (localPath.startsWith('/local-images/') || localPath.includes('/local-images/'))) {
      try {
        const fileName = localPath.split('/local-images/').pop() || localPath;
        const res = await this.sendNative<{ success: boolean; base64: string }>('getImage', { fileName });
        if (res && res.base64) {
          return this.base64ToBlob(res.base64, 'image/jpeg');
        }
      } catch (err) {
        console.warn('[LocalFileService] macOS Native getImage error:', err);
      }
    }

    // Mobile native
    if (this.isNativeMobile && !localPath.startsWith('local_blob://')) {
      try {
        const path = localPath.replace(/^file:\/\//, '');
        const fileResult = await Filesystem.readFile({
          path: path.includes('dunvex_images') ? path : `dunvex_images/${localPath}`,
          directory: Directory.Data,
        });
        return this.base64ToBlob(fileResult.data as string, 'image/jpeg');
      } catch (err) {
        console.warn('[LocalFileService] Native readFile error:', err);
      }
    }

    // Read from IndexedDB
    try {
      const idb = await this.getIdb();
      const blob = await idb.get('images', localPath);
      return blob || null;
    } catch {
      return null;
    }
  }

  /**
   * Convert localPath or remoteUrl to a high-speed local display URL
   */
  async getDisplayUrl(localPath: string): Promise<string> {
    if (!localPath) return '';
    
    // Direct URL formats
    if (localPath.startsWith('data:') || localPath.startsWith('blob:')) {
      return localPath;
    }

    // macOS Native embedded server URL
    if (localPath.startsWith('/local-images/')) {
      return `http://127.0.0.1:41738${localPath}`;
    }
    if (localPath.startsWith('http://127.0.0.1:41738/local-images/')) {
      return localPath;
    }

    // Mobile native
    if (this.isNativeMobile && !localPath.startsWith('local_blob://') && !localPath.startsWith('http')) {
      return Capacitor.convertFileSrc(localPath);
    }

    // Local blob in IDB
    if (localPath.startsWith('local_blob://')) {
      const blob = await this.getImageBlob(localPath);
      if (blob) {
        return URL.createObjectURL(blob);
      }
      return '';
    }

    return localPath;
  }

  /**
   * Cache a remote image (e.g. from legacy VPS URL or Cloudinary) locally to local disk
   * so it works 100% offline on the next view without re-fetching from VPS.
   */
  async cacheRemoteImageLocally(remoteUrl: string): Promise<string> {
    if (!remoteUrl || remoteUrl.startsWith('data:') || remoteUrl.startsWith('blob:') || remoteUrl.startsWith('file:')) {
      return remoteUrl;
    }
    if (remoteUrl.startsWith('/local-images/') || remoteUrl.includes('127.0.0.1:41738/local-images/')) {
      return remoteUrl;
    }

    // Check memory cache
    if (this.urlCache.has(remoteUrl)) {
      return this.urlCache.get(remoteUrl)!;
    }

    try {
      // Check IDB url mapping
      const idb = await this.getIdb();
      const cached = await idb.get('url_map', remoteUrl);
      if (cached) {
        this.urlCache.set(remoteUrl, cached);
        return cached;
      }

      // Download image blob in background
      const res = await fetch(remoteUrl, { mode: 'cors' });
      if (!res.ok) return remoteUrl;
      const blob = await res.blob();

      // Extract original file name
      const urlObj = new URL(remoteUrl, window.location.origin);
      const pathname = urlObj.pathname;
      const origName = pathname.split('/').pop() || `cached_${Date.now()}.jpg`;

      // Save locally
      const saved = await this.saveImage(blob, origName);
      const localResultUrl = saved.url || saved.localPath;

      // Store mapping
      await idb.put('url_map', localResultUrl, remoteUrl);
      this.urlCache.set(remoteUrl, localResultUrl);

      return localResultUrl;
    } catch {
      return remoteUrl;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<LocalStorageStats> {
    if (this.isNativeDesktop()) {
      try {
        const stats = await this.sendNative<LocalStorageStats>('getStats');
        if (stats) return stats;
      } catch (e) {}
    }

    try {
      const idb = await this.getIdb();
      const count = await idb.count('images');
      return {
        directory: 'IndexedDB (Local Browser)',
        count,
        totalBytes: 0,
        totalMB: 'N/A',
      };
    } catch {
      return { count: 0, totalBytes: 0, totalMB: '0' };
    }
  }

  /**
   * Open the native image directory in Finder (macOS)
   */
  async openFinderFolder(): Promise<void> {
    if (this.isNativeDesktop()) {
      await this.sendNative('openFolder');
    }
  }

  /**
   * Copy an image Base64/DataURL directly to the native macOS/Windows clipboard
   */
  async copyImageToClipboard(base64Data: string): Promise<boolean> {
    if (!this.isNativeDesktop()) return false;
    const res = await this.sendNative<{ success: boolean }>('copyImage', {
      base64: base64Data,
    });
    return !!res?.success;
  }

  // ─── Zalo-Style P2P Binary Chunking (64KB Chunks) ──────────

  /**
   * Split an image Blob into 64KB ArrayBuffer chunks for direct P2P streaming
   */
  async splitFileIntoChunks(blob: Blob, chunkSize: number = CHUNK_SIZE): Promise<ArrayBuffer[]> {
    const arrayBuffer = await blob.arrayBuffer();
    const totalBytes = arrayBuffer.byteLength;
    const chunks: ArrayBuffer[] = [];

    for (let offset = 0; offset < totalBytes; offset += chunkSize) {
      const chunk = arrayBuffer.slice(offset, offset + chunkSize);
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Reassemble binary chunks into a complete Blob
   */
  assembleChunks(chunks: ArrayBuffer[], mimeType: string = 'image/jpeg'): Blob {
    return new Blob(chunks, { type: mimeType });
  }

  // ─── Helpers ──────────────────────────────────────────────

  public blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  public base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const byteCharacters = atob(cleanBase64);
    const byteArrays: Uint8Array[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays as BlobPart[], { type: mimeType });
  }
}

export const localFileService = new LocalFileService();
