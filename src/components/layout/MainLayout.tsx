import React from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

interface MainLayoutProps {
	children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
	return (
		<div className="bg-[#f8f9fa] text-slate-900 h-screen w-full overflow-hidden flex flex-col md:flex-row font-['Manrope']">
			<Sidebar />
			<main className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
				<div className="flex-1 overflow-y-auto no-scrollbar">
					{children}
				</div>
				<MobileNav />
			</main>
		</div>
	);
};

export default MainLayout;
