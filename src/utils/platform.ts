import { Capacitor } from '@capacitor/core';

/**
 * Kiểm tra xem môi trường hiện tại có phải là ứng dụng Native
 * (Android APK, macOS Desktop App, Windows Desktop App) hay không.
 * Trả về false nếu đang chạy trên Trình duyệt Web (Chrome, Safari, Firefox...).
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;

  // 1. Android Native (Capacitor / Android Bridge)
  if (typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) {
    return true;
  }
  if (w.AndroidAppUpdater !== undefined || w.AndroidClipboard !== undefined || w.AndroidPrint !== undefined) {
    return true;
  }

  // 2. macOS Native App (WebKit Bridge / Port 41738 / DunvexMac)
  if (w.webkit?.messageHandlers?.sqliteBridge !== undefined ||
      w.webkit?.messageHandlers?.nativeBridge !== undefined ||
      w.webkit?.messageHandlers?.printHandler !== undefined ||
      w.webkit?.messageHandlers?.biometricBridge !== undefined ||
      w.webkit?.messageHandlers?.fileBridge !== undefined ||
      w.webkit?.messageHandlers?.dunvex !== undefined ||
      w.DunvexMac !== undefined ||
      w.isNativeMac !== undefined) {
    return true;
  }

  // 3. Windows Native App (.NET 8 WebView2 / Dunvex Bridge / Tauri / Electron)
  if (w.chrome?.webview !== undefined || w.DunvexWindows !== undefined || w.Dunvex !== undefined || w.isNativeWindows !== undefined || w.__TAURI__ !== undefined || w.electron !== undefined || w.isElectron !== undefined) {
    return true;
  }

  // 4. Standalone Desktop Port / Custom Protocols / Local Server
  if (w.location?.port === '41738' || w.location?.hostname === '127.0.0.1') {
    return true;
  }
  if (w.location?.protocol === 'capacitor:' || w.location?.protocol === 'app:' || w.location?.protocol === 'tauri:' || w.location?.protocol === 'dunvex:') {
    return true;
  }

  return false;
}

export function isAndroidNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;

  if (
    typeof Capacitor !== 'undefined' &&
    typeof Capacitor.isNativePlatform === 'function' &&
    Capacitor.isNativePlatform()
  ) {
    return Capacitor.getPlatform() === 'android';
  }

  return w.AndroidAppUpdater !== undefined ||
    w.AndroidClipboard !== undefined ||
    w.AndroidPrint !== undefined;
}

declare const __APP_BUILD_INFO__: {
  version: string;
  buildNumber: number;
  builtAt: string;
};

export function getAppPlatformName(): string {
  if (typeof window === 'undefined') return 'Web App';
  const w = window as any;

  if (typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) {
    return 'Android Native';
  }
  if (w.AndroidAppUpdater !== undefined || w.AndroidClipboard !== undefined || w.AndroidPrint !== undefined) {
    return 'Android Native';
  }
  if (w.webkit?.messageHandlers?.sqliteBridge !== undefined || w.webkit?.messageHandlers?.nativeBridge !== undefined || w.DunvexMac !== undefined || w.isNativeMac !== undefined) {
    return 'macOS Native (Apple Silicon)';
  }
  if (w.chrome?.webview !== undefined || w.DunvexWindows !== undefined || w.isNativeWindows !== undefined) {
    return 'Windows Native (x64)';
  }
  if (w.location?.port === '41738' || w.location?.hostname === '127.0.0.1') {
    return 'macOS Native';
  }
  return 'Web App (Trình duyệt)';
}

export function getAppVersionInfo(): { version: string; buildNumber: number; platformName: string } {
  const platformName = getAppPlatformName();
  const info = typeof __APP_BUILD_INFO__ !== 'undefined' ? __APP_BUILD_INFO__ : { version: '1.0.1', buildNumber: 135, builtAt: '' };
  let buildNumber = info.buildNumber;

  if (typeof window !== 'undefined') {
    const w = window as any;
    if (w.AndroidAppUpdater && typeof w.AndroidAppUpdater.getVersionCode === 'function') {
      const androidCode = w.AndroidAppUpdater.getVersionCode();
      if (androidCode > 0) buildNumber = androidCode;
    }
  }

  return {
    version: info.version || '1.0.1',
    buildNumber,
    platformName
  };
}
