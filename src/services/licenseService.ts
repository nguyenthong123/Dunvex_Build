import { localDb } from './localDb/localDatabase';
import { getCurrentSessionUser, getSessionToken } from './sqliteSession';
import { apiUrl } from './apiClient';

export interface AppLicenseCertificate {
  licenseId: string;
  ownerId: string;
  userEmail: string;
  planId: string;
  planName: string;
  subscriptionStatus: 'active' | 'trial' | 'expired';
  isSuperAdmin?: boolean;
  issuedAt: number;
  expiresAt: number;
  maxOfflineDays: number;
  features: {
    lockOrders: boolean;
    lockDebts: boolean;
    lockSheets: boolean;
    lockAi: boolean;
  };
  systemConfig: {
    lock_free_orders: boolean;
    lock_free_debts: boolean;
    lock_free_sheets: boolean;
  };
  signature: string;
}

export interface LicenseStatus {
  isValid: boolean;
  isExpired: boolean;
  isClockTampered: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  planId: string;
  planName: string;
  subscriptionStatus: 'active' | 'trial' | 'expired';
  features: {
    lockOrders: boolean;
    lockDebts: boolean;
    lockSheets: boolean;
  };
  expiresAt: number | null;
  issuedAt: number;
  statusMessage: string;
}

type LicenseListener = (status: LicenseStatus) => void;

const CERT_STORAGE_KEY = 'dunvex_license_cert';
const CLOCK_STORAGE_KEY = 'dunvex_license_last_clock';

class LicenseService {
  private certificate: AppLicenseCertificate | null = null;
  private isClockTampered = false;
  private listeners = new Set<LicenseListener>();
  private monotonicTimer: any = null;
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.refreshLicense(true);
      });
      window.addEventListener('dunvex_login', () => {
        setTimeout(() => void this.refreshLicense(true), 500);
      });
      window.addEventListener('focus', () => {
        this.verifyMonotonicClock();
        this.notify();
      });

      // Monotonic tick every 10 seconds (runs 100% offline)
      this.monotonicTimer = setInterval(() => {
        this.verifyMonotonicClock();
        this.notify();
      }, 10000);
    }

    void this.init();
  }

  private async init() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Load persisted certificate from LocalStorage & SQLite
    let rawCert = typeof localStorage !== 'undefined' ? localStorage.getItem(CERT_STORAGE_KEY) : null;
    if (!rawCert) {
      try {
        rawCert = await localDb.getMetadata(CERT_STORAGE_KEY);
      } catch {}
    }

    if (rawCert) {
      try {
        this.certificate = JSON.parse(rawCert);
      } catch {}
    }

    this.verifyMonotonicClock();
    this.notify();

    // 2. If online, fetch fresh signed certificate from server
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setTimeout(() => void this.refreshLicense(false), 800);
    }
  }

  /**
   * Anti-Clock Tampering Monotonic Timer
   * Detects if device system clock was rolled backwards to bypass expiration
   */
  private verifyMonotonicClock(): void {
    if (typeof window === 'undefined') return;

    const now = Date.now();
    const lastClockRaw = localStorage.getItem(CLOCK_STORAGE_KEY);
    const lastClock = lastClockRaw ? parseInt(lastClockRaw, 10) : now;

    // If current clock is more than 60 seconds BEHIND last recorded clock,
    // user has manually turned clock backwards to cheat expiration
    if (now < lastClock - 60000) {
      console.warn('[LicenseService] System clock tampering detected (rewind)!');
      this.isClockTampered = true;
    } else {
      // Normal monotonic progression
      localStorage.setItem(CLOCK_STORAGE_KEY, String(now));
      void localDb.setMetadata(CLOCK_STORAGE_KEY, String(now));
    }
  }

  /**
   * Evaluate effective status based on certificate and local clock
   */
  public getStatus(): LicenseStatus {
    const now = Date.now();

    if (!this.certificate) {
      return {
        isValid: false,
        isExpired: false,
        isClockTampered: this.isClockTampered,
        daysRemaining: 0,
        hoursRemaining: 0,
        planId: 'free',
        planName: 'Chưa cấp chứng chỉ',
        subscriptionStatus: 'trial',
        features: {
          lockOrders: this.isClockTampered,
          lockDebts: this.isClockTampered,
          lockSheets: this.isClockTampered,
        },
        expiresAt: null,
        issuedAt: now,
        statusMessage: this.isClockTampered
          ? 'Đồng hồ máy bị thay đổi lùi giờ. Vui lòng chỉnh lại đúng giờ chuẩn.'
          : 'Đang khởi tạo chứng chỉ bản quyền ứng dụng...',
      };
    }

    const { expiresAt, issuedAt, planId, planName, features, isSuperAdmin } = this.certificate;

    // Super Admin is always active
    if (isSuperAdmin) {
      return {
        isValid: true,
        isExpired: false,
        isClockTampered: false,
        daysRemaining: 9999,
        hoursRemaining: 9999 * 24,
        planId: 'enterprise',
        planName: 'Quản trị viên Tối cao',
        subscriptionStatus: 'active',
        features: {
          lockOrders: false,
          lockDebts: false,
          lockSheets: false,
        },
        expiresAt,
        issuedAt,
        statusMessage: 'Bản quyền Quản trị viên (Vĩnh viễn)',
      };
    }

    const isExpired = expiresAt <= now;
    const diffMs = Math.max(0, expiresAt - now);
    const daysRemaining = Math.floor(diffMs / 86400000);
    const hoursRemaining = Math.floor(diffMs / 3600000);

    const mustLock = isExpired || this.isClockTampered;

    const lockOrders = mustLock || Boolean(features.lockOrders);
    const lockDebts = mustLock || Boolean(features.lockDebts);
    const lockSheets = mustLock || Boolean(features.lockSheets);

    let statusMessage = 'Bản quyền đang hoạt động bình thường';
    if (this.isClockTampered) {
      statusMessage = '⚠️ Phát hiện đồng hồ máy bị chỉnh lùi giờ. Tính năng bị tạm khoá.';
    } else if (isExpired) {
      statusMessage = '🔒 Gói cước đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng.';
    } else if (daysRemaining <= 3) {
      statusMessage = `⏳ Gói cước còn ${daysRemaining > 0 ? `${daysRemaining} ngày` : `${hoursRemaining} giờ`} nữa là hết hạn.`;
    }

    return {
      isValid: !this.isClockTampered && !isExpired,
      isExpired,
      isClockTampered: this.isClockTampered,
      daysRemaining,
      hoursRemaining,
      planId,
      planName,
      subscriptionStatus: isExpired ? 'expired' : this.certificate.subscriptionStatus,
      features: {
        lockOrders,
        lockDebts,
        lockSheets,
      },
      expiresAt,
      issuedAt,
      statusMessage,
    };
  }

  public subscribe(listener: LicenseListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach(fn => fn(status));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('license_status_changed', { detail: status }));
    }
  }

  /**
   * Fetch latest signed certificate from server (when online)
   */
  public async refreshLicense(forceOnline = false): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine && !forceOnline) {
      return false;
    }

    const user = getCurrentSessionUser();
    const token = getSessionToken();
    const ownerId = user?.ownerId || user?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('dunvex_owner_id') : '');

    if (!ownerId) return false;

    try {
      const res = await fetch(apiUrl(`/api/license/certificate?ownerId=${encodeURIComponent(ownerId)}&email=${encodeURIComponent(user?.email || '')}`), {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'x-owner-id': ownerId,
        },
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.success && data.certificate) {
        this.certificate = data.certificate;
        this.isClockTampered = false; // Reset tamper flag upon authoritative server sync

        // Persist to local storage & SQLite for 100% offline enforcement
        const serialized = JSON.stringify(this.certificate);
        localStorage.setItem(CERT_STORAGE_KEY, serialized);
        await localDb.setMetadata(CERT_STORAGE_KEY, serialized);

        // Update last valid clock
        localStorage.setItem(CLOCK_STORAGE_KEY, String(Date.now()));
        await localDb.setMetadata(CLOCK_STORAGE_KEY, String(Date.now()));

        this.notify();
        return true;
      }
    } catch (err) {
      console.warn('[LicenseService] Failed to refresh license online:', err);
    }

    return false;
  }

  public async clearLicense(): Promise<void> {
    this.certificate = null;
    this.isClockTampered = false;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(CERT_STORAGE_KEY);
      }
      await localDb.setMetadata(CERT_STORAGE_KEY, '');
    } catch {}
    this.notify();
  }
}

export const licenseService = new LicenseService();
