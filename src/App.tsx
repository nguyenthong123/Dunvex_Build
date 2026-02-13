import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import Home from './views/Home';
import QuickOrder from './views/QuickOrder';
import Debts from './views/Debts';
import AdminSettings from './views/AdminSettings';
import AppSettings from './views/AppSettings';
import Login from './views/Login';

import CustomerList from './views/CustomerList';
import ProductList from './views/ProductList';
import OrderList from './views/OrderList';
import Checkin from './views/Checkin';
import MainLayout from './components/layout/MainLayout';
import Pricing from './views/Pricing';
import NexusControl from './views/NexusControl';

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
		<div className="min-h-screen bg-[#f8f9fb] transition-colors duration-300 dark:bg-slate-950">
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

				{/* Catch all */}
				<Route path="*" element={<Navigate to="/" />} />
			</Routes>
		</div>
	);
}

export default App;
