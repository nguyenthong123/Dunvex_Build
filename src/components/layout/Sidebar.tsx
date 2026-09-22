import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../services/firebase';
import { useNavigationConfig } from '../../hooks/useNavigationConfig';
import { Moon, Sun, LogOut, User } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useOwner } from '../../hooks/useOwner';

interface SidebarProps {
	onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onToggle }) => {
	const navigate = useNavigate();
	const { sidebarItems, currentPath } = useNavigationConfig();
	const { theme, toggleTheme } = useTheme();
	const owner = useOwner();

	const handleLogout = () => {
		navigate('/settings?action=logout');
	};

	const menuItems = sidebarItems;

	return (
		<aside className="w-20 lg:w-72 bg-[#1A237E] dark:bg-slate-900 h-full flex flex-col justify-between shrink-0 shadow-2xl relative z-40 transition-colors duration-300">
			{/* Logo section */}
			<div className="p-4 lg:p-6 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="size-10 bg-[#FF6D00] rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
						<span className="material-symbols-outlined text-white text-2xl font-bold">architecture</span>
					</div>
					<div className="hidden lg:block">
						<h1 className="text-xl font-black tracking-tight text-white uppercase flex items-center gap-1">
							Dunvex<span className="text-[#FF6D00]">Build</span>
						</h1>
						<p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Hệ thống sản xuất & bán hàng</p>
					</div>
				</div>
				{onToggle && (
					<button
						onClick={onToggle}
						className="hidden lg:flex size-8 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/20 items-center justify-center transition-colors"
						title="Ẩn menu"
					>
						<span className="material-symbols-outlined text-lg">chevron_left</span>
					</button>
				)}
			</div>

			{/* Navigation links */}
			<div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto no-scrollbar">
				{menuItems.map((item) => {
					const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
					return (
						<button
							key={item.path}
							onClick={() => navigate(item.path)}
							className={`w-full flex items-center gap-4 px-3.5 py-3 rounded-xl transition-all duration-200 group relative ${isActive
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
				<div className="flex items-center gap-2">
					<button
						onClick={toggleTheme}
						className="flex-1 flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all group overflow-hidden"
					>
						<div className="relative size-6 flex items-center justify-center">
							<Sun className={`absolute transition-all duration-300 ${theme === 'dark' ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`} size={20} />
							<Moon className={`absolute transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`} size={20} />
						</div>
						<span className="hidden lg:block text-sm font-bold uppercase tracking-tight">
							{theme === 'dark' ? 'Giao diện Sáng' : 'Giao diện Tối'}
						</span>
					</button>
				</div>

				{/* User Profile & Logout */}
				<div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
					<div
						className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
						onClick={() => navigate('/profile')}
						title="Xem hồ sơ cá nhân"
					>
						<div className="relative">
							<img
								className="rounded-full size-10 shrink-0 border-2 border-[#FF6D00] object-cover group-hover:border-white transition-colors"
								src={auth.currentUser?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100"}
								alt="User"
							/>
							<div className="absolute -bottom-1 -right-1 bg-indigo-600 rounded-full p-1 border border-white">
								<User size={8} className="text-white" />
							</div>
						</div>
						<div className="hidden lg:flex flex-col overflow-hidden">
							<p className="text-sm font-black truncate leading-none uppercase tracking-tight text-white group-hover:text-[#FF6D00] transition-colors">{owner.userDisplayName || auth.currentUser?.displayName || 'Admin'}</p>
							<span className="text-[10px] text-white/50 truncate uppercase font-bold mt-1 text-left">Hồ sơ cá nhân</span>
						</div>
					</div>
					<button
						onClick={handleLogout}
						className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-[#FF6D00] transition-all ml-2"
						title="Đăng xuất"
					>
						<LogOut size={20} />
					</button>
				</div>
			</div>
		</aside>
	);
};

export default Sidebar;
