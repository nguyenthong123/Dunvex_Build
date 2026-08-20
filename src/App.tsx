import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { setApiCredentials } from './services/apiClient';

// Lazy load components
const Home = lazy(() => import('./views/Home'));
const QuickOrder = lazy(() => import('./views/QuickOrder'));
const Debts = lazy(() => import('./views/Debts'));
const AdminSettings = lazy(() => import('./views/AdminSettings'));
const AppSettings = lazy(() => import('./views/AppSettings'));
const Login = lazy(() => import('./views/Login'));
const CustomerList = lazy(() => import('./views/CustomerList'));
const SupplierList = lazy(() => import('./views/SupplierList'));
const SupplierDebts = lazy(() => import('./views/SupplierDebts'));
const PurchaseOrders = lazy(() => import('./views/PurchaseOrders'));
const ProductList = lazy(() => import('./views/ProductList'));
const InventoryPage = lazy(() => import('./views/InventoryPage'));
const OrderList = lazy(() => import('./views/OrderList'));
const Checkin = lazy(() => import('./views/Checkin'));
const Attendance = lazy(() => import('./views/Attendance'));
const LeaveManagement = lazy(() => import('./views/LeaveManagement'));
const Pricing = lazy(() => import('./views/Pricing'));
const PriceList = lazy(() => import('./views/PriceList'));
const SubscriptionServices = lazy(() => import('./views/SubscriptionServices'));
const Coupons = lazy(() => import('./views/Coupons'));
const NexusControl = lazy(() => import('./views/NexusControl'));
const Profile = lazy(() => import('./views/Profile'));
const Backup = lazy(() => import('./views/Backup'));

import MainLayout from './components/layout/MainLayout';
import ReloadPrompt from './components/ReloadPrompt';
import { ToastProvider } from './components/shared/Toast';
import OfflineBanner from './components/shared/OfflineBanner';
import { LoadingBar, DashboardSkeleton } from './components/shared/UISkeleton';
import ErrorBoundary from './components/ErrorBoundary';

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

function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setApiCredentials('', user.uid);
      }
      setAuthLoading(false);
    });

    return unsubscribe;
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

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
          <ReloadPrompt />
          <OfflineBanner />
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
