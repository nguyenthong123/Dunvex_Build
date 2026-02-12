import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

interface MainLayoutProps {
	children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
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
			<main className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 relative transition-colors duration-300">
				{!isSidebarVisible && (
					<button
						onClick={() => setIsSidebarVisible(true)}
						className="fixed top-5 left-5 z-[60] size-10 bg-[#1A237E] text-white rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all hidden md:flex items-center justify-center group"
						title="Hiện Menu"
					>
						<span className="material-symbols-outlined text-2xl group-hover:rotate-90 transition-transform">menu</span>
					</button>
				)}
				<div className="flex-1 overflow-y-auto no-scrollbar">
					{children}
				</div>
				<MobileNav />
			</main>
		</div>
	);
};

export default MainLayout;
