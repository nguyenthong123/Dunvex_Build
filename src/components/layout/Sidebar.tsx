import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';
import { useNavigationConfig } from '../../hooks/useNavigationConfig';

const Sidebar = () => {
	const navigate = useNavigate();
	const { sidebarItems, currentPath } = useNavigationConfig();

	const handleLogout = async () => {
		if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
			await signOut(auth);
			navigate('/login');
		}
	};

	const menuItems = sidebarItems;

	return (
		<aside className="hidden md:flex flex-col h-screen bg-[#1A237E] text-white transition-all duration-300 z-40 md:w-20 lg:w-64 flex-shrink-0">
			<div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-white/10">
				<div className="size-10 bg-[#FF6D00] rounded-xl flex items-center justify-center shrink-0 shadow-lg cursor-pointer" onClick={() => navigate('/')}>
					<span className="material-symbols-outlined text-white text-2xl font-bold">architecture</span>
				</div>
				<div className="ml-3 hidden lg:flex flex-col">
					<h1 className="text-base font-black leading-none uppercase tracking-tighter">Dunvex<span className="text-[#FF6D00]">Build</span></h1>
					<p className="text-white/60 text-[10px] mt-1 uppercase font-bold tracking-widest">Management System</p>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto py-6 flex flex-col gap-2 px-3">
				{menuItems.map((item) => {
					const isActive = currentPath === item.path;
					return (
						<button
							key={item.path}
							onClick={() => navigate(item.path)}
							className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group text-left ${isActive ? 'bg-[#FF6D00] text-white shadow-lg shadow-orange-500/30 font-bold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
						>
							<span className={`material-symbols-outlined text-2xl group-hover:scale-110 transition-transform ${isActive ? 'fill-1' : ''}`} style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
							<span className="hidden lg:block text-sm font-bold uppercase tracking-tight">{item.label}</span>
						</button>
					);
				})}
			</div>
			<div className="p-4 border-t border-white/10">
				<div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer" onClick={handleLogout}>
					<img
						className="rounded-full size-10 shrink-0 border-2 border-[#FF6D00] object-cover"
						src={auth.currentUser?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100"}
						alt="User"
					/>
					<div className="hidden lg:flex flex-col overflow-hidden">
						<p className="text-sm font-black truncate leading-none uppercase tracking-tight">{auth.currentUser?.displayName || 'Admin'}</p>
						<p className="text-[10px] text-white/50 truncate uppercase font-bold mt-1">Quản trị viên</p>
					</div>
				</div>
			</div>
		</aside>
	);
};

export default Sidebar;
