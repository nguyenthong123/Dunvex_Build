import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';

// Lazy load components
const Home = lazy(() => import('./views/Home'));
const QuickOrder = lazy(() => import('./views/QuickOrder'));
const Debts = lazy(() => import('./views/Debts'));
const AdminSettings = lazy(() => import('./views/AdminSettings'));
const AppSettings = lazy(() => import('./views/AppSettings'));
const Login = lazy(() => import('./views/Login'));
const CustomerList = lazy(() => import('./views/CustomerList'));
const ProductList = lazy(() => import('./views/ProductList'));
const OrderList = lazy(() => import('./views/OrderList'));
const Checkin = lazy(() => import('./views/Checkin'));
const Attendance = lazy(() => import('./views/Attendance'));
const Pricing = lazy(() => import('./views/Pricing'));
const NexusControl = lazy(() => import('./views/NexusControl'));
const PriceList = lazy(() => import('./views/PriceList'));
const TrainingCatalog = lazy(() => import('./views/TrainingCatalog'));
const TrainingLab = lazy(() => import('./views/TrainingLab'));
const Finance = lazy(() => import('./views/Finance'));
const Coupons = lazy(() => import('./views/Coupons'));

import MainLayout from './components/layout/MainLayout';
import ReloadPrompt from './components/ReloadPrompt';
import { ToastProvider } from './components/shared/Toast';
import OfflineBanner from './components/shared/OfflineBanner';

const LoadingSpinner = () => (
	<div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center">
		<div className="flex flex-col items-center gap-4">
			<div className="w-12 h-12 border-4 border-[#1A237E] border-t-transparent rounded-full animate-spin"></div>
			<p className="text-[#1A237E] font-bold text-sm tracking-widest animate-pulse uppercase">Đang tải ứng dụng...</p>
		</div>
	</div>
);


function App() {
	const [currentUser, setCurrentUser] = useState<any>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		console.log("App: Monitoring Auth State...");
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			console.log("App: Auth state changed. User:", user ? user.email : "NULL");
			setCurrentUser(user);
			setLoading(false);
		});

		return unsubscribe;
	}, []);

	if (loading) {
		return (
			<div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center">
				<div className="flex flex-col items-center gap-4">
					<div className="w-12 h-12 border-4 border-[#1A237E] border-t-transparent rounded-full animate-spin"></div>
					<p className="text-[#1A237E] font-bold text-sm tracking-widest animate-pulse">DUNVEX BUILD</p>
				</div>
			</div>
		);
	}

	return (
		<ToastProvider>
			<div className="min-h-screen bg-[#f8f9fb] transition-colors duration-300 dark:bg-slate-950">
				<Suspense fallback={<LoadingSpinner />}>
					<Routes>
						<Route
							path="/login"
							element={currentUser ? <Navigate to="/" /> : <Login />}
						/>

						{/* Protected Routes wrapped in MainLayout */}
						<Route
							path="/"
							element={currentUser ? <MainLayout><Home /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/debts"
							element={currentUser ? <MainLayout><Debts /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/customers"
							element={currentUser ? <MainLayout><CustomerList /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/inventory"
							element={currentUser ? <MainLayout><ProductList /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/orders"
							element={currentUser ? <MainLayout><OrderList /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/checkin"
							element={currentUser ? <MainLayout><Checkin /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/attendance"
							element={currentUser ? <MainLayout><Attendance /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/quick-order"
							element={currentUser ? <MainLayout><QuickOrder /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/quick-order/:id"
							element={currentUser ? <MainLayout><QuickOrder /></MainLayout> : <Navigate to="/login" />}
						/>

						{/* Business Admin (Separated) */}
						<Route
							path="/admin"
							element={currentUser ? <MainLayout><AdminSettings /></MainLayout> : <Navigate to="/login" />}
						/>
						{/* General App Settings */}
						<Route
							path="/settings"
							element={currentUser ? <MainLayout><AppSettings /></MainLayout> : <Navigate to="/login" />}
						/>

						{/* NEXUS CONTROL & PRICING */}
						<Route
							path="/pricing"
							element={currentUser ? <Pricing /> : <Navigate to="/login" />}
						/>
						<Route
							path="/nexus-control"
							element={currentUser ? <NexusControl /> : <Navigate to="/login" />}
						/>
						<Route
							path="/price-list"
							element={currentUser ? <MainLayout><PriceList /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/finance"
							element={currentUser ? <MainLayout><Finance /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/coupons"
							element={currentUser ? <MainLayout><Coupons /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/khoa-dao-tao"
							element={currentUser ? <MainLayout><TrainingCatalog /></MainLayout> : <Navigate to="/login" />}
						/>
						<Route
							path="/khoa-dao-tao/:id"
							element={currentUser ? <TrainingLab /> : <Navigate to="/login" />}
						/>

						{/* Catch all */}
						<Route path="*" element={<Navigate to="/" />} />
					</Routes>
				</Suspense>
				<ReloadPrompt />
				<OfflineBanner />
			</div>
		</ToastProvider>
	);
}

export default App;
