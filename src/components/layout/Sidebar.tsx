import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';
import { useNavigationConfig } from '../../hooks/useNavigationConfig';
import { Moon, Sun, LogOut } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const Sidebar = () => {
	const navigate = useNavigate();
	const { sidebarItems, currentPath } = useNavigationConfig();
	const { theme, toggleTheme } = useTheme();

	const handleLogout = async () => {
		if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
			await signOut(auth);
			navigate('/login');
		}
	};

	const menuItems = sidebarItems;

	return (
		<aside className="hidden md:flex flex-col h-screen bg-[#1A237E] dark:bg-slate-900 text-white transition-all duration-300 z-40 md:w-20 lg:w-64 flex-shrink-0 border-r border-white/10">
			<div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-white/10">
				<div
					className="size-10 bg-[#FF6D00] rounded-xl flex items-center justify-center shrink-0 shadow-lg cursor-pointer hover:scale-105 transition-transform"
					onClick={() => navigate('/')}
				>
					<span className="material-symbols-outlined text-white text-2xl font-bold">architecture</span>
				</div>
				<div className="ml-3 hidden lg:flex flex-col">
					<h1 className="text-base font-black leading-none uppercase tracking-tighter">Dunvex<span className="text-[#FF6D00]">Build</span></h1>
					<p className="text-white/60 text-[10px] mt-1 uppercase font-bold tracking-widest">Management System</p>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto py-6 flex flex-col gap-2 px-3 custom-scrollbar">
				{menuItems.map((item) => {
					// Check exact path match or if it's a sub-route (e.g. /products vs /products/new)
					// The simplest check for active state:
					const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));

					return (
						<button
							key={item.path}
							onClick={() => navigate(item.path)}
							className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group text-left relative overflow-hidden ${isActive
								? 'bg-[#FF6D00] text-white shadow-lg shadow-orange-500/30 font-bold'
								: 'text-white/70 hover:bg-white/10 hover:text-white'
								}`}
						>
							<span
								className={`material-symbols-outlined text-2xl group-hover:scale-110 transition-transform ${isActive ? 'fill-1' : ''}`}
								style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
							>
								{item.icon}
							</span>
							<span className="hidden lg:block text-sm font-bold uppercase tracking-tight">{item.label}</span>
							{isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full"></div>}
						</button>
					);
				})}
			</div>

			<div className="p-4 border-t border-white/10 space-y-2">
				{/* Theme Toggle */}
				<button
					onClick={toggleTheme}
					className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all group"
				>
					<div className="relative size-6 flex items-center justify-center">
						<Sun className={`absolute transition-all duration-300 ${theme === 'dark' ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`} size={20} />
						<Moon className={`absolute transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`} size={20} />
					</div>
					<span className="hidden lg:block text-sm font-bold uppercase tracking-tight">
						{theme === 'dark' ? 'Giao diện Sáng' : 'Giao diện Tối'}
					</span>
				</button>

				{/* User Profile / Logout */}
				<div
					className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group"
					onClick={handleLogout}
					title="Đăng xuất"
				>
					<div className="relative">
						<img
							className="rounded-full size-10 shrink-0 border-2 border-[#FF6D00] object-cover group-hover:border-white transition-colors"
							src={auth.currentUser?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100"}
							alt="User"
						/>
						<div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-1 border-2 border-[#1A237E]">
							<LogOut size={10} className="text-white" />
						</div>
					</div>
					<div className="hidden lg:flex flex-col overflow-hidden">
						<p className="text-sm font-black truncate leading-none uppercase tracking-tight">{auth.currentUser?.displayName || 'Admin'}</p>
						<button className="text-[10px] text-white/50 truncate uppercase font-bold mt-1 text-left group-hover:text-[#FF6D00] transition-colors">Đăng xuất</button>
					</div>
				</div>
			</div>
		</aside>
	);
};

export default Sidebar;
