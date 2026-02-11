import React from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

interface MainLayoutProps {
	children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
	return (
		<div className="bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 h-screen w-full overflow-hidden flex flex-col md:flex-row font-['Manrope'] transition-colors duration-300">
			<Sidebar />
			<main className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 relative transition-colors duration-300">
				<div className="flex-1 overflow-y-auto no-scrollbar">
					{children}
				</div>
				<MobileNav />
			</main>
		</div>
	);
};

export default MainLayout;
