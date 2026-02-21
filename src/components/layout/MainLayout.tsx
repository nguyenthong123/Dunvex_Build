import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import NotificationBell from '../NotificationBell';
import SystemAlertManager from '../SystemAlertManager';
import { useScroll } from '../../context/ScrollContext';

interface MainLayoutProps {
	children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
	const { isNavVisible, handleScroll } = useScroll();
	const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
		const saved = localStorage.getItem('sidebar-visible');
		return saved === null ? true : saved === 'true';
	});

	useEffect(() => {
		localStorage.setItem('sidebar-visible', String(isSidebarVisible));
	}, [isSidebarVisible]);

	return (
		<div className="bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 h-screen w-full overflow-hidden flex flex-col md:flex-row font-['Manrope'] transition-colors duration-300">
			{isSidebarVisible && <Sidebar onToggle={() => setIsSidebarVisible(false)} />}
			<SystemAlertManager />

			<main className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 relative transition-colors duration-300">
				{/* MOBILE TOP BAR - Premium Glassmorphism */}
				{!window.location.pathname.includes('/price-list') && (
					<header
						className="md:hidden flex items-center justify-between px-6 h-14 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl fixed top-0 left-0 right-0 z-[60] shadow-sm"
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

						<div className="flex items-center">
							<NotificationBell />
						</div>
					</header>
				)}

				{!isSidebarVisible && (
					<button
						onClick={() => setIsSidebarVisible(true)}
						className="fixed top-5 left-5 z-[60] size-10 bg-[#1A237E] text-white rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all hidden md:flex items-center justify-center group"
						title="Hiện Menu"
					>
						<span className="material-symbols-outlined text-2xl group-hover:rotate-90 transition-transform">menu</span>
					</button>
				)}

				<div
					onScroll={handleScroll}
					className={`flex-1 overflow-y-auto no-scrollbar md:pt-0 ${window.location.pathname.includes('/price-list') ? 'pt-0' : 'pt-20'}`}
				>
					<div className="min-h-full">
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
			</main>
		</div>
	);
};

export default MainLayout;
