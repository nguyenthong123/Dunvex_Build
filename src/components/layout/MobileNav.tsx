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
			className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 flex items-center z-[100] h-20 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] print:hidden"
			style={{
				WebkitBackdropFilter: 'blur(20px)',
				paddingBottom: 'env(safe-area-inset-bottom, 0px)'
			}}
		>
			{navItems.map((item, idx) => {
				const fullCurrentPath = window.location.pathname + window.location.search;
				const isActive = fullCurrentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));

				if (item.isCenter) {
					return (
						<div key={`nav-${idx}`} className="flex-1 relative flex flex-col items-center justify-center h-full">
							<button
								onClick={() => {
									if (item.path.startsWith('event:')) {
										window.dispatchEvent(new CustomEvent(item.path.split(':')[1]));
									} else {
										navigate(item.path);
									}
								}}
								className="absolute -top-7 w-14 h-14 bg-gradient-to-br from-[#FF6D00] to-[#FF9100] text-white rounded-full shadow-[0_8px_25px_rgba(255,109,0,0.4)] flex items-center justify-center border-4 border-white dark:border-slate-900 active:scale-90 transition-all z-10"
							>
								<span className="material-symbols-outlined text-2xl font-black">{item.icon}</span>
							</button>
							<span className="mt-10 text-[8px] font-black uppercase tracking-tighter text-[#FF6D00] dark:text-orange-500 whitespace-nowrap overflow-hidden w-full text-center px-1">
								{item.label}
							</span>
						</div>
					);
				}

				return (
					<button
						key={`nav-${idx}`}
						onClick={() => {
							const isSearchBtn = item.path.includes('search=focus');
							if (isSearchBtn) {
								const searchablePaths = ['/customers', '/debts', '/orders', '/inventory', '/price-list', '/products'];
								const isSearchable = searchablePaths.some(p => currentPath.startsWith(p));
								if (isSearchable) {
									window.dispatchEvent(new CustomEvent('open-mobile-search'));
								} else {
									navigate('/products?search=focus');
								}
							} else {
								navigate(item.path);
							}
						}}
						className={`flex-1 flex flex-col items-center justify-center gap-1 h-full transition-all duration-300 ${isActive ? 'text-[#1A237E] dark:text-indigo-400' : 'text-slate-400'}`}
					>
						<div className={`relative flex items-center justify-center transition-transform duration-300 ${isActive ? 'scale-110' : 'hover:scale-105'}`}>
							<span
								className={`material-symbols-outlined text-[24px] ${isActive ? 'filled' : ''}`}
								style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
							>
								{item.icon}
							</span>
							{isActive && (
								<div className="absolute -bottom-1 w-1 h-1 bg-[#1A237E] dark:bg-indigo-400 rounded-full animate-pulse"></div>
							)}
						</div>
						<span className={`text-[9px] font-black uppercase tracking-tight whitespace-nowrap overflow-hidden w-full text-center px-1 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
							{item.label}
						</span>
					</button>
				);
			})}
		</div>
	);
};

export default MobileNav;
