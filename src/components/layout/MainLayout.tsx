import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import NotificationBell from '../NotificationBell';
import SystemAlertManager from '../SystemAlertManager';
import { useScroll } from '../../context/ScrollContext';
import { useNavigationConfig } from '../../hooks/useNavigationConfig';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MainLayoutProps {
	children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
	const { isNavVisible, handleScroll } = useScroll();
	const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
		const saved = localStorage.getItem('sidebar-visible');
		return saved === null ? true : saved === 'true';
	});
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	useEffect(() => {
		localStorage.setItem('sidebar-visible', String(isSidebarVisible));
	}, [isSidebarVisible]);

	return (
		<div className="bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 h-screen w-full overflow-hidden flex flex-col lg:flex-row font-['Manrope'] transition-colors duration-300">
			<div className="hidden lg:block">
				{isSidebarVisible && <Sidebar onToggle={() => setIsSidebarVisible(false)} />}
			</div>
			<SystemAlertManager />

			<main className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 relative transition-colors duration-300 print:overflow-visible print:h-auto print:block">
				{/* MOBILE TOP BAR - Premium Glassmorphism */}
				{!window.location.pathname.includes('/price-list') && (
					<header
						className="lg:hidden flex items-center justify-between px-6 h-14 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl fixed top-0 left-0 right-0 z-[60] shadow-sm print:hidden"
						style={{ WebkitBackdropFilter: 'blur(20px)' }}
					>
						<div className="flex items-center gap-2">
							<div className="size-8 bg-gradient-to-br from-[#FF6D00] to-[#FF9100] rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20">
								<span className="material-symbols-outlined text-white text-lg font-bold">architecture</span>
							</div>
							<h1 className="text-[15px] font-black uppercase tracking-tight text-slate-800 dark:text-white">
								Dunvex<span className="text-[#FF6D00]">Build</span>
							</h1>
						</div>

						<div className="flex items-center gap-2">
							<NotificationBell />
							<button
								onClick={() => setMobileMenuOpen(true)}
								className="size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"
							>
								<span className="material-symbols-outlined text-xl">menu</span>
							</button>
						</div>
					</header>
				)}

				{!isSidebarVisible && (
					<button
						onClick={() => setIsSidebarVisible(true)}
						className="fixed top-5 left-5 z-[60] size-10 bg-[#1A237E] text-white rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all hidden lg:flex items-center justify-center group print:hidden"
						title="Hiện Menu"
					>
						<span className="material-symbols-outlined text-2xl group-hover:rotate-90 transition-transform">menu</span>
					</button>
				)}

				<div
					onScroll={handleScroll}
					className={`flex-1 overflow-y-auto no-scrollbar lg:pt-0 ${window.location.pathname.includes('/price-list') ? 'pt-0' : 'pt-20'} print:overflow-visible print:h-auto print:block print:pt-0`}
				>
					<div className="min-h-full print:block print:h-auto w-full max-w-[1920px] mx-auto px-4 md:px-6 lg:px-8 2xl:px-12 transition-all">
						{children}
					</div>

					{/* Footer Spacer & Branding */}
					<footer className="py-12 px-6 text-center border-t border-slate-50 dark:border-slate-800/50 mt-auto pb-32 md:pb-12 transition-colors duration-300">
						<div className="flex flex-col items-center gap-2 opacity-30 dark:opacity-20 hover:opacity-100 transition-opacity duration-500">
							<div className="size-8 bg-slate-400 dark:bg-slate-500 rounded-lg flex items-center justify-center mb-1">
								<span className="material-symbols-outlined text-white text-lg">architecture</span>
							</div>
							<p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
								Dunvex<span className="text-slate-900 dark:text-white">Build</span> Management System
							</p>
							<p className="text-[8px] font-bold text-slate-400">© 2026 Developed by Antigravity AI Engine</p>
						</div>
					</footer>
				</div>

				<MobileNav />
			{/* Mobile Menu Drawer */}
			{mobileMenuOpen && (
				<div className="fixed inset-0 z-[110] lg:hidden">
					<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
					<div className="absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col">
						<div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
							<h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">Menu</h3>
							<button onClick={() => setMobileMenuOpen(false)} className="size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
								<X size={16} className="text-slate-500" />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-2">
							<MobileDrawerItems onClose={() => setMobileMenuOpen(false)} />
						</div>
					</div>
				</div>
			)}
		</main>
	</div>
	);
};

const MobileDrawerItems = ({ onClose }: { onClose: () => void }) => {
	const navigate = useNavigate();
	const { sidebarItems, currentPath } = useNavigationConfig();
	const hasPermission = (key?: string) => {
		if (!key) return true;
		return true; // Simplified — permission handled by useNavigationConfig
	};

	return (
		<div className="space-y-1">
			{sidebarItems.map((item, idx) => {
				const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
				return (
					<button
						key={`drawer-${idx}`}
						onClick={() => {
							if (item.path.startsWith('event:')) {
								window.dispatchEvent(new CustomEvent(item.path.split(':')[1]));
							} else {
								navigate(item.path);
							}
							onClose();
						}}
						className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
							isActive
								? 'bg-indigo-50 dark:bg-indigo-900/20 text-[#1A237E] dark:text-indigo-400'
								: 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
						}`}
					>
						<span
							className={`material-symbols-outlined text-xl ${isActive ? 'filled' : ''}`}
							style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
						>
							{item.icon}
						</span>
						<span className="text-xs font-bold uppercase tracking-wide">{item.label}</span>
					</button>
				);
			})}
		</div>
	);
};

export default MainLayout;
