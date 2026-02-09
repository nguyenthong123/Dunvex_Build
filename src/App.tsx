import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import Home from './views/Home';
import QuickOrder from './views/QuickOrder';
import Debts from './views/Debts';
import AdminSettings from './views/AdminSettings';
import Login from './views/Login';

import CustomerList from './views/CustomerList';
import ProductList from './views/ProductList';
import OrderList from './views/OrderList';
import Checkin from './views/Checkin';

function App() {
	const [currentUser, setCurrentUser] = useState<any>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
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
		<div className="min-h-screen bg-slate-50">
			<Routes>
				{/* Full screen routes like Login and Home (Command Center) */}
				<Route
					path="/login"
					element={currentUser ? <Navigate to="/" /> : <Login />}
				/>

				{/* Root is now Debt Management */}
				<Route
					path="/"
					element={currentUser ? <Debts /> : <Navigate to="/login" />}
				/>

				{/* Dashboard (Old Home/Command Center) is now at /dashboard */}
				<Route
					path="/dashboard"
					element={currentUser ? <Home /> : <Navigate to="/login" />}
				/>

				{/* Customer Management - Full Screen Responsive */}
				<Route
					path="/customers"
					element={currentUser ? <CustomerList /> : <Navigate to="/login" />}
				/>

				{/* Product Management - Full Screen Responsive */}
				<Route
					path="/inventory"
					element={currentUser ? <ProductList /> : <Navigate to="/login" />}
				/>

				{/* Order Management - Full Screen Responsive */}
				<Route
					path="/orders"
					element={currentUser ? <OrderList /> : <Navigate to="/login" />}
				/>

				<Route
					path="/checkin"
					element={currentUser ? <Checkin /> : <Navigate to="/login" />}
				/>

				{/* Other pages wrap in a mobile-first container for consistency with design */}
				<Route
					path="/quick-order"
					element={currentUser ? <QuickOrder /> : <Navigate to="/login" />}
				/>
				<Route
					path="/quick-order/:id"
					element={currentUser ? <QuickOrder /> : <Navigate to="/login" />}
				/>
				<Route
					path="/settings"
					element={
						currentUser ? (
							<div className="flex justify-center items-start min-h-screen">
								<div className="mobile-container bg-white">
									<AdminSettings />
								</div>
							</div>
						) : <Navigate to="/login" />
					}
				/>

				{/* Catch all */}
				<Route path="*" element={<Navigate to="/" />} />
			</Routes>
		</div>
	);
}

export default App;
