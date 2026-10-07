import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../services/firebase';
import { useNavigationConfig } from '../../hooks/useNavigationConfig';
import { Moon, Sun, LogOut, User } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useOwner } from '../../hooks/useOwner';
import { isAndroidNativeApp, isNativeApp } from '../../utils/platform';
import { SyncSidebarButton } from '../shared/SyncSidebarButton';
import { preloadNativeRoute } from '../../routeModules';

interface SidebarProps {
	onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onToggle }) => {
	const isAndroidNative = isAndroidNativeApp();
	const navigate = useNavigate();
	const { navGroups, currentPath } = useNavigationConfig();
	const { theme, toggleTheme } = useTheme();
	const owner = useOwner();

	const handleLogout = () => {
		navigate('/settings?action=logout');
	};

	return (
		<aside className="w-20 lg:w-72 bg-[#1A237E] dark:bg-slate-900 h-full flex flex-col justify-between shrink-0 shadow-2xl relative z-40 transition-colors duration-300 select-none">
			{/* Logo section */}
			<div className="p-4 lg:p-5 lg:pt-7 flex items-center justify-between border-b border-white/10">
				<div
					className="flex items-center gap-3 cursor-pointer group"
					onClick={() => navigate('/')}
					title="Về Trang chủ"
				>
					<div className="size-10 bg-[#FF6D00] rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0 group-hover:scale-105 transition-transform">
						<span className="material-symbols-outlined text-white text-2xl font-bold">architecture</span>
					</div>
					<div className="hidden lg:block">
						<h1 className="text-xl font-black tracking-tight text-white uppercase flex items-center gap-1">
							Dunvex<span className="text-[#FF6D00]">Build</span>
						</h1>
						<p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Hệ thống POS & Sản xuất</p>
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

			{/* Navigation Groups */}
			<div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto no-scrollbar">
				{navGroups.map((group) => (
					<div key={group.id} className="space-y-1">
						{/* Group Title for Desktop */}
						<div className="hidden lg:flex items-center justify-between px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white/40">
							<span>{group.title}</span>
						</div>

						{/* Group Items */}
						<div className="space-y-0.5">
							{group.items.map((item) => {
								const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
								return (
									<button
										key={item.path}
										onClick={() => navigate(item.path)}
										onPointerEnter={() => !isAndroidNative && preloadNativeRoute(item.path)}
										onFocus={() => !isAndroidNative && preloadNativeRoute(item.path)}
										className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 group relative ${isActive
											? 'bg-[#FF6D00] text-white shadow-lg shadow-orange-500/30 font-bold'
											: 'text-white/70 hover:bg-white/10 hover:text-white'
										}`}
										title={item.label}
									>
										<div className="flex items-center gap-3.5 min-w-0">
											<span
												className={`material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform shrink-0 ${isActive ? 'fill-1' : ''}`}
												style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
											>
												{item.icon}
											</span>
											<span className="hidden lg:block text-[13px] font-bold tracking-tight truncate text-left">
												{item.label}
											</span>
										</div>

										{/* Shortcut badge on desktop */}
										{item.shortcut && (
											<span className={`hidden lg:inline-block text-[10px] font-black px-1.5 py-0.5 rounded ${isActive ? 'bg-white/25 text-white' : 'bg-white/10 text-white/50 group-hover:text-white'}`}>
												{item.shortcut}
											</span>
										)}

										{isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-l-full"></div>}
									</button>
								);
							})}
						</div>
					</div>
				))}
			</div>

			{/* Footer: Theme & User */}
			<div className="p-3 border-t border-white/10 space-y-2 bg-[#151c68]/50 dark:bg-slate-950/50">
				{/* Footer Button: Nút Đồng Bộ trên Native App (Win/Mac/Android) | Giao Diện Sáng/Tối trên Web */}
				{isNativeApp() ? (
					<SyncSidebarButton />
				) : (
					<div className="flex items-center gap-2">
						<button
							onClick={toggleTheme}
							className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all group overflow-hidden"
							title={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
						>
							<div className="relative size-5 flex items-center justify-center">
								<Sun className={`absolute transition-all duration-300 ${theme === 'dark' ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`} size={18} />
								<Moon className={`absolute transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`} size={18} />
							</div>
							<span className="hidden lg:block text-xs font-bold uppercase tracking-tight">
								{theme === 'dark' ? 'Giao diện Sáng' : 'Giao diện Tối'}
							</span>
						</button>
					</div>
				)}

				{/* User Profile & Logout */}
				<div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
					<div
						className="flex items-center gap-2.5 cursor-pointer group flex-1 min-w-0"
						onClick={() => navigate('/profile')}
						title="Xem hồ sơ cá nhân"
					>
						<div className="relative">
							{auth.currentUser?.photoURL ? (
								<img
									className="rounded-full size-9 shrink-0 border-2 border-[#FF6D00] object-cover group-hover:border-white transition-colors"
									src={auth.currentUser.photoURL}
									alt=""
									onError={(e) => {
										const target = e.target as HTMLElement;
										target.style.display = 'none';
										if (target.parentElement) {
											const placeholder = target.parentElement.querySelector('.avatar-placeholder');
											if (placeholder) (placeholder as HTMLElement).style.display = 'flex';
										}
									}}
								/>
							) : null}
							<div className={`avatar-placeholder rounded-full size-9 shrink-0 border-2 border-[#FF6D00] bg-indigo-900/60 flex items-center justify-center text-white font-black text-xs group-hover:border-white transition-colors ${auth.currentUser?.photoURL ? 'hidden' : 'flex'}`}>
								{(owner.userDisplayName || auth.currentUser?.displayName || auth.currentUser?.email || 'A').charAt(0).toUpperCase()}
							</div>
							<div className="absolute -bottom-0.5 -right-0.5 bg-indigo-600 rounded-full p-0.5 border border-white">
								<User size={7} className="text-white" />
							</div>
						</div>
						<div className="hidden lg:flex flex-col overflow-hidden">
							<p className="text-xs font-black truncate leading-none uppercase tracking-tight text-white group-hover:text-[#FF6D00] transition-colors">{owner.userDisplayName || auth.currentUser?.displayName || 'Admin'}</p>
							<span className="text-[9px] text-white/50 truncate uppercase font-bold mt-1 text-left">Hồ sơ cá nhân</span>
						</div>
					</div>
					<button
						onClick={handleLogout}
						className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-[#FF6D00] transition-all"
						title="Đăng xuất"
					>
						<LogOut size={18} />
					</button>
				</div>
			</div>
		</aside>
	);
};

export default Sidebar;
