import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationConfig } from '../../hooks/useNavigationConfig';
import { useScroll } from '../../context/ScrollContext';

const MobileNav = () => {
	const navigate = useNavigate();
	const { navItems, currentPath } = useNavigationConfig();
	const { isNavVisible } = useScroll();

	return (
		<div
			className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 px-4 flex justify-between items-center z-[100] h-20 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] print:hidden"
			style={{
				WebkitBackdropFilter: 'blur(20px)',
				paddingBottom: 'env(safe-area-inset-bottom, 12px)'
			}}
		>
			{navItems.map((item) => {
				const isActive = currentPath === item.path;

				if (item.isCenter) {
					return (
						<div key={item.path} className="relative -top-8 flex flex-col items-center">
							<button
								onClick={() => navigate(item.path)}
								className="w-14 h-14 bg-[#FF6D00] text-white rounded-full shadow-[0_8px_25px_rgba(255,109,0,0.4)] flex items-center justify-center border-4 border-white dark:border-slate-900 active:scale-90 transition-all"
							>
								<span className="material-symbols-outlined text-2xl font-black">{item.icon}</span>
							</button>
						</div>
					);
				}

				return (
					<button
						key={item.path}
						onClick={() => navigate(item.path)}
						className={`flex flex-col items-center gap-1 min-w-[64px] transition-colors ${isActive ? 'text-[#1A237E]' : 'text-slate-400'}`}
					>
						<span
							className={`material-symbols-outlined text-2xl ${isActive ? 'filled' : ''}`}
							style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
						>
							{item.icon}
						</span>
						<span className="text-[9px] font-black uppercase tracking-tight">{item.label}</span>
					</button>
				);
			})}
		</div>
	);
};

export default MobileNav;
