import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { onSQLiteAuthStateChanged } from './services/sqliteSession';
import { auth } from './services/firebase';
import { apiUrl, setApiCredentials, setupSSE } from './services/apiClient';
import { clearSQLiteSession, getSessionToken } from './services/sqliteSession';
import { syncEngine } from './services/syncEngine';
import { useSwipeBack } from './hooks/useSwipeBack';
import { routeModules } from './routeModules';

// Lazy load components
const Home = lazy(routeModules.home);
const QuickOrder = lazy(routeModules.quickOrder);
const Debts = lazy(routeModules.debts);
const AdminSettings = lazy(routeModules.adminSettings);
const AppSettings = lazy(routeModules.appSettings);
const Login = lazy(routeModules.login);
const CustomerList = lazy(routeModules.customers);
const SupplierList = lazy(routeModules.suppliers);
const SupplierDebts = lazy(routeModules.supplierDebts);
const PurchaseOrders = lazy(routeModules.purchaseOrders);
const ProductList = lazy(routeModules.products);
const InventoryPage = lazy(routeModules.inventory);
const OrderList = lazy(routeModules.orders);
const Checkin = lazy(routeModules.checkin);
const Attendance = lazy(routeModules.attendance);
const LeaveManagement = lazy(routeModules.leaves);
const Pricing = lazy(routeModules.pricing);
const PriceList = lazy(routeModules.priceList);
const SubscriptionServices = lazy(routeModules.services);
const Coupons = lazy(routeModules.coupons);
const NexusControl = lazy(routeModules.nexus);
const Profile = lazy(routeModules.profile);
const Backup = lazy(routeModules.backup);
const Trash = lazy(routeModules.trash);
const DownloadApp = lazy(routeModules.download);

import MainLayout from './components/layout/MainLayout';
import ReloadPrompt from './components/ReloadPrompt';
import { ToastProvider } from './components/shared/Toast';
import OfflineBanner from './components/shared/OfflineBanner';
import { P2PSyncBanner } from './components/shared/P2PSyncBanner';
import { isNativeApp } from './utils/platform';
import { LoadingBar, DashboardSkeleton } from './components/shared/UISkeleton';
import ErrorBoundary from './components/ErrorBoundary';

interface AndroidAppUpdaterBridge {
  getVersionCode: () => number;
  downloadAndInstallApk: (apkUrl: string) => void;
  getLastPromptedBuild?: () => number;
  markBuildPrompted?: (buildNumber: number) => void;
}

/** Suspense fallback — loading bar + skeleton on homepage, spinner elsewhere */
function RouteFallback() {
  const path = window.location.pathname;
  const isHome = path === '/' || path === '';

  return (
    <>
      <LoadingBar />
      {isHome ? (
        <DashboardSkeleton />
      ) : (
        <div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-[#1A237E] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Đang tải...</p>
          </div>
        </div>
      )}
    </>
  );
}

function NativeRouteLayout() {
	return (
		<MainLayout>
			<Suspense fallback={
				<div className="flex-1 min-h-0 flex items-center justify-center bg-[#f8f9fb] dark:bg-slate-950">
					<LoadingBar />
					<div className="flex flex-col items-center gap-3 text-slate-400">
						<div className="size-8 border-2 border-[#1A237E] border-t-transparent rounded-full animate-spin" />
						<p className="text-xs font-bold uppercase tracking-widest">Đang mở trang...</p>
					</div>
				</div>
			}>
				<Outlet />
			</Suspense>
		</MainLayout>
	);
}

function App() {
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('dunvex_user_session');
      return auth.currentUser;
    } catch (e) {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(true);

  // Kích hoạt hỗ trợ vuốt back 2 ngón trên Mac, vuốt chạm và phím tắt điều hướng
  useSwipeBack();

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    let disposed = false;
    let backButtonListener: PluginListenerHandle | undefined;

    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        void CapacitorApp.exitApp().catch((error) => {
          console.error('[Android back]', error);
        });
      }
    }).then((listener) => {
      if (disposed) {
        void listener.remove().catch((error) => {
          console.error('[Android back]', error);
        });
      } else {
        backButtonListener = listener;
      }
    }).catch((error) => {
      console.error('[Android back]', error);
    });

    return () => {
      disposed = true;
      void backButtonListener?.remove().catch((error) => {
        console.error('[Android back]', error);
      });
    };
  }, []);

  // Đồng bộ phiên người dùng tập trung, đảm bảo lưu đủ ownerId và dữ liệu trước khi hoàn tất loading
  // SQLite owns the session and tenant mapping; never create a user in the client.
  const syncUserSession = async (user: any) => {
    try {
      const token = getSessionToken();
      if (!token) {
        if (user) {
          setCurrentUser(user);
          setApiCredentials('', user.ownerId || user.uid);
        }
        return user;
      }
      const response = await fetch(apiUrl('/api/auth/session'), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (response.status === 401) {
        // Only clear if server actively revoked the session
        clearSQLiteSession();
        setCurrentUser(null);
        return null;
      }
      if (!response.ok) {
        // Network or server temporary issue: keep local valid session
        if (user) {
          setCurrentUser(user);
          setApiCredentials('', user.ownerId || user.uid);
        }
        return user;
      }
      const result = await response.json();
      const sessionUser = result.user;
      if (sessionUser?.uid && sessionUser?.ownerId) {
        setApiCredentials('', sessionUser.ownerId);
        localStorage.setItem('dunvex_user_session', JSON.stringify(sessionUser));
        setCurrentUser(sessionUser);
        return sessionUser;
      }
      return user;
    } catch {
      // Offline-First: Keep user logged in with cached SQLite credentials
      if (user) {
        setCurrentUser(user);
        setApiCredentials('', user.ownerId || user.uid);
      }
      return user;
    }
  };

  useEffect(() => {
    let isMounted = true;
    let isCheckingForAndroidUpdate = false;
    let unsubAuth: (() => void) | null = null;

    const handleLogoutEvent = () => {
      setCurrentUser(null);
      setApiCredentials('', '');
      import('./services/licenseService').then(({ licenseService }) => licenseService.clearLicense()).catch(() => {});
    };
    const handleLoginEvent = (e: CustomEvent) => {
      if (e.detail) {
        setCurrentUser(e.detail);
        import('./services/licenseService').then(({ licenseService }) => licenseService.refreshLicense(true)).catch(() => {});
      }
    };
    const checkForPlatformUpdate = async (manual: boolean) => {
      if (isCheckingForAndroidUpdate) return;
      isCheckingForAndroidUpdate = true;
      try {
        const isMacNative = typeof window !== 'undefined' && Boolean((window as any).webkit?.messageHandlers?.nativeBridge);
        const isWindowsNative = typeof window !== 'undefined' && Boolean((window as any).chrome?.webview);
        const updater = (window as Window & { AndroidAppUpdater?: AndroidAppUpdaterBridge }).AndroidAppUpdater;

        // 1. macOS Native App
        if (isMacNative) {
          (window as any).webkit.messageHandlers.nativeBridge.postMessage({
            action: 'checkForUpdates',
            silent: !manual,
          });
          return;
        }

        // 2. Android Native App
        if (updater) {
          const res = await fetch(apiUrl('/api/releases/android/version'), { cache: 'no-store' });
          if (!res.ok) {
            throw new Error(`Update check failed: HTTP ${res.status}`);
          }

          const info: { version?: string; buildNumber?: number; releaseNotes?: string; downloadUrl?: string } = await res.json();
          const installedBuild = updater.getVersionCode();
          const availableBuild = Number(info.buildNumber);
          if (!Number.isInteger(installedBuild) || installedBuild < 0 ||
              !Number.isInteger(availableBuild) || availableBuild <= 0) {
            throw new Error('Invalid Android or server build number');
          }

          if (availableBuild <= installedBuild) {
            if (manual) {
              window.alert(`Ứng dụng Android của bạn đang ở phiên bản mới nhất (v${info.version}, Build ${installedBuild}).`);
            }
            return;
          }

          const promptedBuildKey = 'dunvex_android_update_prompted_build';
          const lastPromptedBuild = typeof updater.getLastPromptedBuild === 'function'
            ? updater.getLastPromptedBuild()
            : Number(localStorage.getItem(promptedBuildKey) || 0);
          if (!manual && lastPromptedBuild >= availableBuild) return;
          if (typeof updater.markBuildPrompted === 'function') {
            updater.markBuildPrompted(availableBuild);
          }
          localStorage.setItem(promptedBuildKey, String(availableBuild));

          if (window.confirm(
            `Đã có bản cập nhật Dunvex Android v${info.version} (Build ${availableBuild}):\n` +
            `${info.releaseNotes || 'Cải tiến và vá lỗi hệ thống'}\n\n` +
            'Bạn có muốn tải và cài đặt ngay không?'
          )) {
            updater.downloadAndInstallApk(apiUrl(info.downloadUrl || '/downloads/dunvex_app.apk'));
          }
          return;
        }

        // 3. Windows Native App
        if (isWindowsNative) {
          const webView = (window as Window & {
            chrome?: { webview?: { postMessage: (message: { action: string }) => void } };
          }).chrome?.webview;
          if (!webView) throw new Error('Windows WebView update bridge is unavailable');
          webView.postMessage({ action: 'checkForUpdates' });
          return;
        }

        // 4. Web Browser
        const res = await fetch(apiUrl('/api/releases/web/version'), { cache: 'no-store' });
        if (res.ok) {
          const info = await res.json();
          if (manual) {
            window.alert(`Bạn đang dùng bản Web v${info.version} (Build ${info.buildNumber}).\nBản Web luôn tự động cập nhật phiên bản mới nhất từ máy chủ VPS mỗi khi tải lại trang.`);
          }
        }
      } catch (error) {
        console.error('[App update]', error);
        if (manual) {
          window.alert('Không thể kiểm tra cập nhật lúc này. Vui lòng thử lại khi có kết nối mạng.');
        }
      } finally {
        isCheckingForAndroidUpdate = false;
      }
    };
    const handleCheckUpdates = (event: Event) => {
      const manual = (event as CustomEvent<{ manual?: boolean }>).detail?.manual === true;
      void checkForPlatformUpdate(manual);
    };
    const handleApkDownloadError = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      window.alert(message || 'Không thể tải hoặc mở trình cài đặt bản cập nhật.');
    };
    const handleAppUpdatedReady = (event: Event) => {
      const detail = (event as CustomEvent<{ version?: string; buildNumber?: number; releaseNotes?: string }>).detail;
      const ver = detail?.version ? `v${detail.version}` : '';
      const build = detail?.buildNumber ? ` (Build ${detail.buildNumber})` : '';
      const notes = detail?.releaseNotes ? `\nNội dung: ${detail.releaseNotes}` : '';
      if (window.confirm(`Đã tải xong bản cập nhật mới ${ver}${build}!${notes}\n\nBạn có muốn tải lại ứng dụng để áp dụng ngay không?`)) {
        window.location.reload();
      }
    };

    const handleTriggerFullSync = () => {
      if (!isNativeApp()) return;
      syncEngine.syncNow(false, true).then(res => {
        if (res.success) {
          window.dispatchEvent(new CustomEvent('collection_changed', { detail: { collection: 'all' } }));
        }
      });
    };

    window.addEventListener('dunvex_logout', handleLogoutEvent);
    window.addEventListener('dunvex_login', handleLoginEvent as EventListener);
    window.addEventListener('check_app_updates', handleCheckUpdates as EventListener);
    window.addEventListener('app_updated_ready', handleAppUpdatedReady as EventListener);
    window.addEventListener('apk_download_error', handleApkDownloadError as EventListener);
    window.addEventListener('trigger_full_sync', handleTriggerFullSync);
    const updateCheckTimer = window.setTimeout(() => void checkForPlatformUpdate(false), 3000);

    const handleNoUser = () => {
      setCurrentUser(null);
      setApiCredentials('', '');
    };

    unsubAuth = onSQLiteAuthStateChanged(async (user) => {
      if (!isMounted) return;
      if (user) {
        setCurrentUser(user);
        setApiCredentials('', user.ownerId || user.uid);
        if (isNativeApp()) {
          // Native can open from its persisted session and validate with the VPS in the background.
          setAuthLoading(false);
          void syncUserSession(user);
        } else {
          try {
            await syncUserSession(user);
          } catch {
            // offline mode
          }
        }
        import('./services/licenseService').then(({ licenseService }) => licenseService.refreshLicense(false)).catch(() => {});
        setupSSE().catch(() => {});
      } else {
        handleNoUser();
      }
      if (isMounted) setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      if (unsubAuth) unsubAuth();
      window.removeEventListener('dunvex_logout', handleLogoutEvent);
      window.removeEventListener('dunvex_login', handleLoginEvent as EventListener);
      window.removeEventListener('check_app_updates', handleCheckUpdates as EventListener);
      window.removeEventListener('app_updated_ready', handleAppUpdatedReady as EventListener);
      window.removeEventListener('apk_download_error', handleApkDownloadError as EventListener);
      window.removeEventListener('trigger_full_sync', handleTriggerFullSync);
      window.clearTimeout(updateCheckTimer);
    };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 border-[3px] border-[#1A237E]/20 rounded-full"></div>
            <div className="absolute inset-0 w-14 h-14 border-[3px] border-[#1A237E] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-[#1A237E] dark:text-indigo-400 font-black text-sm tracking-[0.25em] uppercase animate-pulse">Dunvex Build</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="min-h-screen bg-[#f8f9fb] transition-colors duration-300 dark:bg-slate-950">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
			  {isNativeApp() ? (
				<>
				  <Route
					path="/login"
					element={currentUser ? <Navigate to="/" replace /> : <Login />}
				  />
				  <Route element={currentUser ? <NativeRouteLayout /> : <Navigate to="/login" replace />}>
					<Route index element={<Home />} />
					<Route path="debts" element={<Debts />} />
					<Route path="customers" element={<CustomerList />} />
					<Route path="suppliers" element={<SupplierList />} />
					<Route path="supplier-debts" element={<SupplierDebts />} />
					<Route path="purchase-orders" element={<PurchaseOrders />} />
					<Route path="products" element={<ProductList />} />
					<Route path="inventory" element={<InventoryPage />} />
					<Route path="orders" element={<OrderList />} />
					<Route path="checkin" element={<Checkin />} />
					<Route path="attendance" element={<Attendance />} />
					<Route path="leaves" element={<LeaveManagement />} />
					<Route path="quick-order" element={<QuickOrder />} />
					<Route path="quick-order/:id" element={<QuickOrder />} />
					<Route path="admin" element={<AdminSettings />} />
					<Route path="settings" element={<AppSettings />} />
					<Route path="price-list" element={<PriceList />} />
					<Route path="coupons" element={<Coupons />} />
					<Route path="services" element={<SubscriptionServices />} />
					<Route path="nexus-control" element={<NexusControl />} />
					<Route path="profile" element={<Profile />} />
					<Route path="backup" element={<Backup />} />
					<Route path="trash" element={<Trash />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				  </Route>
				  <Route path="/download" element={currentUser ? <MainLayout><DownloadApp /></MainLayout> : <DownloadApp isPublic />} />
				  <Route path="/downloads" element={currentUser ? <MainLayout><DownloadApp /></MainLayout> : <DownloadApp isPublic />} />
				  <Route path="/tai-ung-dung" element={currentUser ? <MainLayout><DownloadApp /></MainLayout> : <DownloadApp isPublic />} />
				  <Route path="/pricing" element={currentUser ? <Pricing /> : <Navigate to="/login" replace />} />
				  <Route path="*" element={currentUser ? <Navigate to="/" replace /> : <Navigate to="/login" replace />} />
				</>
			  ) : (
				<>
              <Route
                path="/login"
                element={currentUser ? <Navigate to="/" /> : <Login />}
              />

              <Route path="/" element={currentUser ? <MainLayout><Home /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/debts" element={currentUser ? <MainLayout><Debts /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/customers" element={currentUser ? <MainLayout><CustomerList /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/suppliers" element={currentUser ? <MainLayout><SupplierList /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/supplier-debts" element={currentUser ? <MainLayout><SupplierDebts /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/purchase-orders" element={currentUser ? <MainLayout><PurchaseOrders /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/products" element={currentUser ? <MainLayout><ProductList /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/inventory" element={currentUser ? <MainLayout><InventoryPage /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/orders" element={currentUser ? <MainLayout><OrderList /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/checkin" element={currentUser ? <MainLayout><Checkin /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/attendance" element={currentUser ? <MainLayout><Attendance /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/leaves" element={currentUser ? <MainLayout><LeaveManagement /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/quick-order" element={currentUser ? <MainLayout><QuickOrder /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/quick-order/:id" element={currentUser ? <MainLayout><QuickOrder /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/admin" element={currentUser ? <MainLayout><AdminSettings /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/settings" element={currentUser ? <MainLayout><AppSettings /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/pricing" element={currentUser ? <Pricing /> : <Navigate to="/login" />} />
              <Route path="/price-list" element={currentUser ? <MainLayout><PriceList /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/coupons" element={currentUser ? <MainLayout><Coupons /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/services" element={currentUser ? <MainLayout><SubscriptionServices /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/nexus-control" element={currentUser ? <MainLayout><NexusControl /></MainLayout> : <Navigate to="/login" />} />

              <Route path="/profile" element={currentUser ? <MainLayout><Profile /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/backup" element={currentUser ? <MainLayout><Backup /></MainLayout> : <Navigate to="/login" />} />
              <Route path="/trash" element={currentUser ? <MainLayout><Trash /></MainLayout> : <Navigate to="/login" />} />

              {/* Public & In-App Application Download Center (Auto OS Detection) */}
              <Route path="/download" element={currentUser ? <MainLayout><DownloadApp /></MainLayout> : <DownloadApp isPublic />} />
              <Route path="/downloads" element={currentUser ? <MainLayout><DownloadApp /></MainLayout> : <DownloadApp isPublic />} />
              <Route path="/tai-ung-dung" element={currentUser ? <MainLayout><DownloadApp /></MainLayout> : <DownloadApp isPublic />} />

              <Route path="*" element={<Navigate to="/" />} />
				</>
			  )}
            </Routes>
          </Suspense>
          <ReloadPrompt />
          <OfflineBanner />
          {isNativeApp() && <P2PSyncBanner />}
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
