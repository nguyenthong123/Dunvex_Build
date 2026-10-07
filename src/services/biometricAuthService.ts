/**
 * Biometric & Credential Authentication Service
 * Supports Native Touch ID (macOS Native WKWebView), Face ID, and WebAuthn (Browsers).
 * Provides safe device-level credential storage and autofill.
 */

const BIOMETRIC_KEY = 'dunvex_biometric_auth';
const REMEMBERED_EMAIL_KEY = 'dunvex_remembered_email';
const SAVED_CREDS_KEY = 'dunvex_saved_credentials';
const REMEMBER_PASSWORD_KEY = 'dunvex_remember_password';

export interface BiometricProfile {
  credentialId?: string;
  email: string;
  displayName: string;
  userSession?: any;
  token?: string;
  enabledAt: number;
}

export interface SavedCredential {
  email: string;
  password: string;
  savedAt: number;
}

class BiometricAuthService {
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private initialized = false;

  constructor() {
    this.setupCallback();
  }

  private setupCallback() {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    // Swift calls: window.__biometricBridgeCallback(requestId, result, error)
    (window as any).__biometricBridgeCallback = (
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

  /**
   * Check if Native macOS Touch ID bridge is available (Dunvex Native App)
   */
  public isNativeBridgeAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window as any).webkit?.messageHandlers?.biometricBridge !== undefined
    );
  }

  private sendNative<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
    this.setupCallback();

    if (!this.isNativeBridgeAvailable()) {
      return Promise.reject(new Error('Native Biometric Bridge không khả dụng trên môi trường này.'));
    }

    return new Promise<T>((resolve, reject) => {
      const requestId = `bio_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Yêu cầu Touch ID quá thời gian chờ (30s): ${action}`));
        }
      }, 30000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      try {
        (window as any).webkit.messageHandlers.biometricBridge.postMessage({
          requestId,
          action,
          ...payload,
        });
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(err);
      }
    });
  }

  /**
   * Check if the device hardware supports biometric authentication (Touch ID, Face ID, Windows Hello)
   */
  async isAvailable(): Promise<boolean> {
    const details = await this.getBiometricDetails();
    return details.available;
  }

  /**
   * Nhận diện thiết bị đang bảo mật bằng phương thức gì (Touch ID, Face ID, Windows Hello, hoặc Mật mã thiết bị)
   */
  async getBiometricDetails(): Promise<{
    available: boolean;
    hasTouchId: boolean;
    biometryType: 'touchID' | 'faceID' | 'passcode' | 'webauthn' | 'none';
    label: string;
  }> {
    if (typeof window === 'undefined') {
      return { available: false, hasTouchId: false, biometryType: 'none', label: 'Sinh trắc học' };
    }

    // 1. Kiểm tra Native macOS Apple LocalAuthentication bridge trước
    if (this.isNativeBridgeAvailable()) {
      try {
        const res = await this.sendNative<{ available: boolean; hasTouchId: boolean; biometryType: string }>('isAvailable');
        const bType = res?.biometryType === 'touchID' ? 'touchID' : (res?.biometryType === 'faceID' ? 'faceID' : 'passcode');
        let label = 'Vân tay (Touch ID)';
        if (bType === 'faceID') label = 'Khuôn mặt (Face ID)';
        else if (bType === 'passcode') label = 'Mật mã máy Mac';

        return {
          available: !!res?.available,
          hasTouchId: !!res?.hasTouchId,
          biometryType: bType,
          label,
        };
      } catch {
        return { available: false, hasTouchId: false, biometryType: 'none', label: 'Sinh trắc học' };
      }
    }

    // 2. Fallback WebAuthn cho trình duyệt (Chrome, Safari, Edge, Android...)
    if (window.PublicKeyCredential) {
      try {
        const avail = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return {
          available: avail,
          hasTouchId: false,
          biometryType: avail ? 'webauthn' : 'none',
          label: 'Vân tay / Face ID / Mật mã máy',
        };
      } catch {
        return { available: false, hasTouchId: false, biometryType: 'none', label: 'Sinh trắc học' };
      }
    }

    return { available: false, hasTouchId: false, biometryType: 'none', label: 'Sinh trắc học' };
  }

  /**
   * Check if user has previously registered biometric credentials on this device
   */
  hasBiometricProfile(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return !!localStorage.getItem(BIOMETRIC_KEY);
  }

  getBiometricProfile(): BiometricProfile | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(BIOMETRIC_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as BiometricProfile;
    } catch {
      return null;
    }
  }

  getSavedBiometricEmail(): string {
    const profile = this.getBiometricProfile();
    return profile?.email || '';
  }

  getRememberedEmail(): string {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
  }

  saveRememberedEmail(email: string): void {
    if (typeof localStorage === 'undefined') return;
    if (email) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  }

  // ─── Ghi nhớ tài khoản & mật khẩu (Credentials Storage) ───

  private encodePass(raw: string): string {
    try {
      return btoa(unescape(encodeURIComponent(raw)));
    } catch {
      return raw;
    }
  }

  private decodePass(encoded: string): string {
    try {
      return decodeURIComponent(escape(atob(encoded)));
    } catch {
      return encoded;
    }
  }

  /**
   * Lưu tài khoản và mật khẩu an toàn trên thiết bị này
   */
  saveCredentials(email: string, password: string): void {
    if (typeof localStorage === 'undefined' || !email) return;

    try {
      const raw = localStorage.getItem(SAVED_CREDS_KEY);
      const credsMap: Record<string, { email: string; enc: string; savedAt: number }> = raw ? JSON.parse(raw) : {};

      credsMap[email.toLowerCase().trim()] = {
        email: email.trim(),
        enc: this.encodePass(password),
        savedAt: Date.now(),
      };

      localStorage.setItem(SAVED_CREDS_KEY, JSON.stringify(credsMap));
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      localStorage.setItem(REMEMBER_PASSWORD_KEY, 'true');
    } catch (err) {
      console.warn('Lỗi khi lưu mật khẩu thiết bị:', err);
    }
  }

  /**
   * Lấy mật khẩu đã lưu theo email (hoặc email gần nhất)
   */
  getSavedCredentials(targetEmail?: string): SavedCredential | null {
    if (typeof localStorage === 'undefined') return null;

    try {
      const raw = localStorage.getItem(SAVED_CREDS_KEY);
      if (!raw) return null;

      const credsMap: Record<string, { email: string; enc: string; savedAt: number }> = JSON.parse(raw);
      const emailToFind = (targetEmail || this.getRememberedEmail() || '').toLowerCase().trim();

      if (!emailToFind || !credsMap[emailToFind]) return null;

      const item = credsMap[emailToFind];
      return {
        email: item.email,
        password: this.decodePass(item.enc),
        savedAt: item.savedAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Kiểm tra có mật khẩu đã lưu hay không
   */
  hasSavedCredentials(targetEmail?: string): boolean {
    return !!this.getSavedCredentials(targetEmail);
  }

  /**
   * Xóa mật khẩu đã lưu của một tài khoản hoặc toàn bộ
   */
  removeSavedCredentials(targetEmail?: string): void {
    if (typeof localStorage === 'undefined') return;

    try {
      if (!targetEmail) {
        localStorage.removeItem(SAVED_CREDS_KEY);
        localStorage.removeItem(REMEMBER_PASSWORD_KEY);
        return;
      }

      const raw = localStorage.getItem(SAVED_CREDS_KEY);
      if (!raw) return;

      const credsMap: Record<string, any> = JSON.parse(raw);
      delete credsMap[targetEmail.toLowerCase().trim()];
      localStorage.setItem(SAVED_CREDS_KEY, JSON.stringify(credsMap));
    } catch {
      // ignore
    }
  }

  isRememberPasswordEnabled(): boolean {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(REMEMBER_PASSWORD_KEY) !== 'false';
  }

  // ─── Đăng ký & Xác thực Sinh trắc học (Touch ID / Face ID) ───

  /**
   * Đăng ký nhận diện sinh trắc học cho người dùng hiện tại
   */
  async registerBiometrics(email: string, userSession: any, token: string): Promise<boolean> {
    if (!(await this.isAvailable())) return false;

    // 1. Trên macOS Native App: Đã có phần cứng Touch ID của máy Mac
    if (this.isNativeBridgeAvailable()) {
      const profile: BiometricProfile = {
        email: email.trim(),
        displayName: userSession.displayName || email,
        userSession,
        token,
        enabledAt: Date.now(),
      };
      localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(profile));
      this.saveRememberedEmail(email.trim());
      return true;
    }

    // 2. Trên Web Browser: Dùng WebAuthn
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new TextEncoder().encode(userSession.uid || email);
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'Dunvex Build',
          id: isLocal ? 'localhost' : window.location.hostname,
        },
        user: {
          id: userId,
          name: email,
          displayName: userSession.displayName || email,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      };

      const credential = (await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      })) as PublicKeyCredential;

      if (credential) {
        const profile: BiometricProfile = {
          credentialId: credential.id,
          email,
          displayName: userSession.displayName || email,
          userSession,
          token,
          enabledAt: Date.now(),
        };

        localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(profile));
        this.saveRememberedEmail(email);
        return true;
      }
    } catch (err: any) {
      console.warn('[Biometrics] WebAuthn registration cancelled or error:', err.message);
    }
    return false;
  }

  /**
   * Xác thực bằng Vân tay Touch ID / Face ID
   */
  async authenticate(reason?: string): Promise<{
    success: boolean;
    profile?: BiometricProfile;
    savedCredential?: SavedCredential;
    error?: string;
  }> {
    // 1. Xác thực bằng Native macOS Touch ID bridge
    if (this.isNativeBridgeAvailable()) {
      try {
        const res = await this.sendNative<{ success: boolean }>('authenticate', {
          reason: reason || 'Đăng nhập vào Dunvex Build bằng vân tay Touch ID',
        });

        if (res?.success) {
          const profile = this.getBiometricProfile();
          const savedCred = this.getSavedCredentials(profile?.email);

          return {
            success: true,
            profile: profile || undefined,
            savedCredential: savedCred || undefined,
          };
        }
        return { success: false, error: 'Xác thực vân tay không thành công.' };
      } catch (err: any) {
        return { success: false, error: err.message || 'Xác thực vân tay bị từ chối hoặc thất bại.' };
      }
    }

    // 2. Xác thực bằng WebAuthn trên trình duyệt
    if (!this.hasBiometricProfile()) {
      return { success: false, error: 'Chưa đăng ký sinh trắc học trên thiết bị này.' };
    }

    try {
      const raw = localStorage.getItem(BIOMETRIC_KEY);
      if (!raw) return { success: false, error: 'Dữ liệu sinh trắc học không tìm thấy.' };

      const profile = JSON.parse(raw) as BiometricProfile;
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 60000,
        rpId: isLocal ? 'localhost' : window.location.hostname,
        userVerification: 'required',
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      });

      if (assertion) {
        return { success: true, profile };
      }
    } catch (err: any) {
      console.warn('[Biometrics] WebAuthn Authentication cancelled or failed:', err.message);
      return { success: false, error: err.message || 'Xác thực sinh trắc học thất bại.' };
    }

    return { success: false, error: 'Không nhận diện được sinh trắc học.' };
  }

  /**
   * Xóa hồ sơ sinh trắc học
   */
  disableBiometrics(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(BIOMETRIC_KEY);
    }
  }
}

export const biometricAuth = new BiometricAuthService();
export default biometricAuth;
