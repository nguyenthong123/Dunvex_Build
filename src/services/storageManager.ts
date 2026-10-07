import { localDb } from './localDb/localDatabase';
import { localFileService } from './localFileService';
import { offlineImageCache } from './offlineImageCache';
import { p2pSync } from './p2pSync';
import { getCurrentSessionUser } from './sqliteSession';

// 5 GB Local Storage Partition Cap per App installation
export const TOTAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5.0 GB

export interface AppStorageBreakdown {
  totalQuotaBytes: number;
  totalQuotaFormatted: string;
  totalUsedBytes: number;
  totalUsedFormatted: string;
  freeQuotaBytes: number;
  freeQuotaFormatted: string;
  usedPercentage: number;
  dbUsageBytes: number;
  dbUsageFormatted: string;
  dbRecordCount: number;
  imageUsageBytes: number;
  imageUsageFormatted: string;
  imageCount: number;
  otherUsageBytes: number;
  otherUsageFormatted: string;
  isWarningThreshold: boolean;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i === 0) return `${bytes} B`;
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

class StorageManager {
  /**
   * Get detailed storage usage breakdown for the 5 GB quota partition
   */
  public async getStorageBreakdown(ownerId = getCurrentSessionUser()?.ownerId || getCurrentSessionUser()?.uid || ''): Promise<AppStorageBreakdown> {
    if (!ownerId) {
      throw new Error('Chưa xác định được tài khoản để đọc phân vùng dữ liệu.');
    }

    let dbUsageBytes = 0;
    let dbRecordCount = 0;
    let imageUsageBytes = 0;
    let imageCount = 0;
    let otherUsageBytes = 0;

    // 1. Calculate Local Database (SQLite / IndexedDB tables)
    const localStats = await localDb.getLocalDataStats(ownerId);
    dbRecordCount = localStats.recordCount;
    dbUsageBytes = localStats.estimatedBytes;

    // 2. Calculate Offline Image Cache (Local files + IndexedDB blobs)
    try {
      const fileStats = await localFileService.getStorageStats();
      const idbImgStats = await offlineImageCache.getStorageStats();

      imageCount = (fileStats.count || 0) + (idbImgStats.count || 0);
      imageUsageBytes = (fileStats.totalBytes || 0) + (idbImgStats.totalBytes || 0);

      // If bytes not exposed by native bridge, estimate based on image count (~250KB per compressed image)
      if (imageUsageBytes === 0 && imageCount > 0) {
        imageUsageBytes = imageCount * 250 * 1024;
      }
    } catch {
      imageUsageBytes = 0;
    }

    // 3. System / Browser storage estimation
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const browserUsage = estimate.usage || 0;
        if (browserUsage > (dbUsageBytes + imageUsageBytes)) {
          otherUsageBytes = browserUsage - (dbUsageBytes + imageUsageBytes);
        }
      } catch {}
    }

    const totalUsedBytes = dbUsageBytes + imageUsageBytes + otherUsageBytes;
    const freeQuotaBytes = Math.max(0, TOTAL_STORAGE_QUOTA_BYTES - totalUsedBytes);
    const usedPercentage = Math.min(100, Math.round((totalUsedBytes / TOTAL_STORAGE_QUOTA_BYTES) * 1000) / 10);
    const isWarningThreshold = usedPercentage >= 90;

    return {
      totalQuotaBytes: TOTAL_STORAGE_QUOTA_BYTES,
      totalQuotaFormatted: '5.0 GB',
      totalUsedBytes,
      totalUsedFormatted: formatBytes(totalUsedBytes),
      freeQuotaBytes,
      freeQuotaFormatted: formatBytes(freeQuotaBytes),
      usedPercentage,
      dbUsageBytes,
      dbUsageFormatted: formatBytes(dbUsageBytes),
      dbRecordCount,
      imageUsageBytes,
      imageUsageFormatted: formatBytes(imageUsageBytes),
      imageCount,
      otherUsageBytes,
      otherUsageFormatted: formatBytes(otherUsageBytes),
      isWarningThreshold,
    };
  }

  /**
   * Clear offline image cache to reclaim space
   */
  public async clearImageCache(): Promise<{ success: boolean; message: string }> {
    try {
      await offlineImageCache.clearCache();
      return { success: true, message: 'Đã dọn dẹp bộ nhớ đệm hình ảnh thành công.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Lỗi dọn dẹp bộ nhớ đệm.' };
    }
  }

  /**
   * Trigger P2P Image & Data Sync with another peer device
   */
  public async triggerP2PSync(): Promise<boolean> {
    return await p2pSync.requestImageSyncFromPhone();
  }
}

export const storageManager = new StorageManager();
