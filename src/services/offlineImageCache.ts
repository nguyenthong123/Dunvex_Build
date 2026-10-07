import { openDB, type IDBPDatabase } from 'idb';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getOptimizedImageUrl, getRemoteOrigin } from '../utils/validation';
import { isNativeApp } from '../utils/platform';

const DB_NAME = 'dunvex_offline_images_v2';
const DB_VERSION = 1;
const STORE_BLOBS = 'blobs';
const STORE_DATA_URLS = 'data_urls';

// In-memory instant lookup maps (0ms)
const memoryBlobUrlMap = new Map<string, string>(); // remoteUrl -> blob:...
const memoryDataUrlMap = new Map<string, string>(); // remoteUrl -> data:image/...

class OfflineImageCache {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private isNativeMobile: boolean;
  private isPreCaching = false;

  constructor() {
    this.isNativeMobile = Capacitor.isNativePlatform();
  }

  private async getDb(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_BLOBS)) {
            db.createObjectStore(STORE_BLOBS);
          }
          if (!db.objectStoreNames.contains(STORE_DATA_URLS)) {
            db.createObjectStore(STORE_DATA_URLS);
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Normalize an image URL to a canonical key
   */
  public normalizeUrl(url: string): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('file:') || trimmed.startsWith('capacitor://')) {
      return trimmed;
    }
    return getOptimizedImageUrl(trimmed);
  }

  /**
   * Convert Blob to Base64 Data URL
   */
  public blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert Base64 Data URL to Blob
   */
  public dataUrlToBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(parts[1] || '');
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Synchronous check in memory map (returns instant blob/data URL or optimized URL)
   */
  public getCachedSync(url: string): string {
    if (!url) return '';
    if (!isNativeApp()) return url;
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('file:') || url.startsWith('capacitor://')) {
      return url;
    }
    const normalized = this.normalizeUrl(url);
    if (memoryBlobUrlMap.has(normalized)) {
      return memoryBlobUrlMap.get(normalized)!;
    }
    if (memoryDataUrlMap.has(normalized)) {
      return memoryDataUrlMap.get(normalized)!;
    }
    return normalized;
  }

  /**
   * Get an offline-ready Display URL (blob: or capacitor:// or data: URL)
   * Checks: Memory -> IndexedDB -> Native Filesystem -> Network fetch & cache
   */
  public async getDisplayUrl(url: string): Promise<string> {
    if (!url) return '';
    if (!isNativeApp()) return url;
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('file:') || url.startsWith('capacitor://')) {
      return url;
    }

    const normalized = this.normalizeUrl(url);

    // 1. Check memory cache
    if (memoryBlobUrlMap.has(normalized)) {
      return memoryBlobUrlMap.get(normalized)!;
    }
    if (memoryDataUrlMap.has(normalized)) {
      return memoryDataUrlMap.get(normalized)!;
    }

    try {
      const db = await this.getDb();

      // 2. Check IndexedDB blobs
      const cachedBlob = await db.get(STORE_BLOBS, normalized);
      if (cachedBlob && cachedBlob instanceof Blob) {
        const objectUrl = URL.createObjectURL(cachedBlob);
        memoryBlobUrlMap.set(normalized, objectUrl);
        return objectUrl;
      }

      // 3. Check IndexedDB data URLs
      const cachedDataUrl = await db.get(STORE_DATA_URLS, normalized);
      if (cachedDataUrl && typeof cachedDataUrl === 'string') {
        memoryDataUrlMap.set(normalized, cachedDataUrl);
        return cachedDataUrl;
      }

      // 4. Check Native Mobile Filesystem (Android / iOS)
      if (this.isNativeMobile) {
        try {
          const filename = this.urlToFilename(normalized);
          const fileStat = await Filesystem.stat({
            path: `dunvex_images/${filename}`,
            directory: Directory.Data,
          });
          if (fileStat && fileStat.uri) {
            const convertedSrc = Capacitor.convertFileSrc(fileStat.uri);
            memoryBlobUrlMap.set(normalized, convertedSrc);
            return convertedSrc;
          }
        } catch {
          // file does not exist locally yet
        }
      }

      // 5. If online, fetch from network and save locally into cache
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        return await this.cacheUrl(normalized);
      }
    } catch (e) {
      console.warn('[OfflineImageCache] Failed to load image from cache:', url, e);
    }

    return normalized;
  }

  /**
   * Get Base64 Data URL (guaranteed 100% offline access for canvas/printing)
   */
  public async getDataUrl(url: string): Promise<string> {
    if (!url) return '';
    if (url.startsWith('data:')) return url;

    const normalized = this.normalizeUrl(url);

    if (memoryDataUrlMap.has(normalized)) {
      return memoryDataUrlMap.get(normalized)!;
    }

    try {
      const db = await this.getDb();
      const cached = await db.get(STORE_DATA_URLS, normalized);
      if (cached && typeof cached === 'string') {
        memoryDataUrlMap.set(normalized, cached);
        return cached;
      }

      const cachedBlob = await db.get(STORE_BLOBS, normalized);
      if (cachedBlob && cachedBlob instanceof Blob) {
        const dataUrl = await this.blobToDataUrl(cachedBlob);
        memoryDataUrlMap.set(normalized, dataUrl);
        await db.put(STORE_DATA_URLS, dataUrl, normalized);
        return dataUrl;
      }

      // Fetch from network if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await this.cacheUrl(normalized);
        const refetched = await db.get(STORE_DATA_URLS, normalized);
        if (refetched) return refetched;
      }
    } catch (e) {
      console.warn('[OfflineImageCache] getDataUrl error:', url, e);
    }

    return normalized;
  }

  /**
   * Cache a single image URL into local storage & memory
   */
  public async cacheUrl(url: string): Promise<string> {
    if (!url) return '';
    if (!isNativeApp()) return url;
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    const normalized = this.normalizeUrl(url);
    const db = await this.getDb();

    // Check if already in DB
    const existingDataUrl = await db.get(STORE_DATA_URLS, normalized);
    if (existingDataUrl) {
      memoryDataUrlMap.set(normalized, existingDataUrl);
      return existingDataUrl;
    }

    try {
      // Try direct fetch or via proxy if needed
      let res: Response;
      try {
        res = await fetch(normalized, { mode: 'cors' });
      } catch (corsErr) {
        // If direct fetch fails (e.g. CORS on external image), use proxy
        const base = getRemoteOrigin();
        const proxyUrl = `${base}/api/image-proxy?url=${encodeURIComponent(normalized)}`;
        res = await fetch(proxyUrl);
      }

      if (!res.ok) {
        return normalized;
      }

      const blob = await res.blob();
      if (!blob || blob.size === 0) return normalized;

      const dataUrl = await this.blobToDataUrl(blob);
      const objectUrl = URL.createObjectURL(blob);

      // Save to IDB
      await db.put(STORE_BLOBS, blob, normalized);
      await db.put(STORE_DATA_URLS, dataUrl, normalized);

      // Save to Memory
      memoryBlobUrlMap.set(normalized, objectUrl);
      memoryDataUrlMap.set(normalized, dataUrl);

      // Save to Native Mobile Filesystem if on Android / iOS
      if (this.isNativeMobile) {
        try {
          const filename = this.urlToFilename(normalized);
          const rawBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          await Filesystem.writeFile({
            path: `dunvex_images/${filename}`,
            data: rawBase64,
            directory: Directory.Data,
            recursive: true,
          });
        } catch (nativeErr) {
          // IDB already saved, ignore native write error
        }
      }

      return objectUrl;
    } catch (err) {
      // Offline or network error
      return normalized;
    }
  }

  /**
   * Pre-cache an array of product records in the background
   */
  public async precacheProducts(products: Array<any>): Promise<number> {
    if (!products || !Array.isArray(products) || products.length === 0) return 0;
    if (this.isPreCaching) return 0;

    const urls: string[] = [];
    for (const p of products) {
      if (p.imageUrl && typeof p.imageUrl === 'string' && p.imageUrl.trim()) {
        urls.push(p.imageUrl.trim());
      }
      if (Array.isArray(p.additionalImages)) {
        for (const img of p.additionalImages) {
          if (img && typeof img === 'string') urls.push(img.trim());
        }
      }
    }

    return this.precacheUrls(urls);
  }

  /**
   * Pre-cache a batch of URLs with controlled concurrency
   */
  public async precacheUrls(urls: string[]): Promise<number> {
    if (!isNativeApp()) return 0;
    if (!urls || urls.length === 0) return 0;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

    this.isPreCaching = true;
    let cachedCount = 0;

    try {
      const uniqueUrls = Array.from(new Set(urls.map(u => this.normalizeUrl(u)).filter(Boolean)));
      const db = await this.getDb();

      // Filter out URLs that are already cached in IDB
      const unCached: string[] = [];
      for (const u of uniqueUrls) {
        if (memoryDataUrlMap.has(u) || memoryBlobUrlMap.has(u)) continue;
        const exists = await db.get(STORE_DATA_URLS, u);
        if (exists) {
          memoryDataUrlMap.set(u, exists);
        } else {
          unCached.push(u);
        }
      }

      // Download in batches of 3
      const CONCURRENCY = 3;
      for (let i = 0; i < unCached.length; i += CONCURRENCY) {
        const batch = unCached.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async (url) => {
            try {
              await this.cacheUrl(url);
              cachedCount++;
            } catch {}
          })
        );
      }
    } catch (err) {
      console.warn('[OfflineImageCache] precacheUrls error:', err);
    } finally {
      this.isPreCaching = false;
    }

    return cachedCount;
  }

  public async getStorageStats(): Promise<{ count: number; totalBytes: number }> {
    try {
      const db = await this.getDb();
      const keys = await db.getAllKeys(STORE_BLOBS);
      let totalBytes = 0;
      const blobs = await db.getAll(STORE_BLOBS);
      for (const b of blobs) {
        if (b instanceof Blob) {
          totalBytes += b.size;
        }
      }
      return { count: keys.length, totalBytes };
    } catch {
      return { count: 0, totalBytes: 0 };
    }
  }

  public async clearCache(): Promise<void> {
    try {
      const db = await this.getDb();
      await db.clear(STORE_BLOBS);
      await db.clear(STORE_DATA_URLS);
      memoryBlobUrlMap.clear();
      memoryDataUrlMap.clear();
    } catch (e) {
      console.warn('[OfflineImageCache] clearCache failed:', e);
    }
  }

  private urlToFilename(url: string): string {
    const clean = url.replace(/[^a-zA-Z0-9]/g, '_');
    return `${clean.slice(-50)}.jpg`;
  }
}

export const offlineImageCache = new OfflineImageCache();
