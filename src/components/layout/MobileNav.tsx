import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationConfig } from '../../hooks/useNavigationConfig';
import { useScroll } from '../../context/ScrollContext';
import { preloadNativeRoute } from '../../routeModules';
import { isAndroidNativeApp } from '../../utils/platform';

const MobileNav: React.FC = () => {
	const isAndroidNative = isAndroidNativeApp();
	const navigate = useNavigate();
	const { navItems, currentPath } = useNavigationConfig();
	const { isNavVisible } = useScroll();

	return (
		<nav
			className={`lg:hidden fixed bottom-0 left-0 right-0 border-t border-slate-100 dark:border-slate-800 z-[50] print:hidden select-none ${
				isAndroidNative
					? 'bg-white dark:bg-slate-900 shadow-none'
					: 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_-4px_25px_rgba(0,0,0,0.06)] transition-colors duration-300'
			}`}
			style={{
				...(isAndroidNative ? {} : { WebkitBackdropFilter: 'blur(20px)' }),
				paddingBottom: 'env(safe-area-inset-bottom, 0px)'
			}}
		>
			<div className="grid grid-cols-5 h-16 w-full max-w-lg mx-auto items-stretch px-1">
				{navItems.map((item, idx) => {
					const fullCurrentPath = window.location.pathname + window.location.search;
					const isActive = fullCurrentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
					const labelText = item.mobileLabel || item.label;

					if (item.isCenter) {
						return (
							<div
								key={`nav-${idx}`}
								className="relative flex flex-col items-center justify-end pb-1.5 h-full"
							>
								{/* Floating Center Action Button */}
								<button
									type="button"
									onPointerEnter={() => !isAndroidNative && preloadNativeRoute(item.path)}
									onClick={() => {
										if (item.path.startsWith('event:')) {
											window.dispatchEvent(new CustomEvent(item.path.split(':')[1]));
										} else {
											navigate(item.path);
										}
									}}
									className={`absolute -top-5 size-12 bg-gradient-to-br from-[#1A237E] to-[#283593] dark:from-indigo-600 dark:to-indigo-800 text-white rounded-full shadow-[0_6px_18px_rgba(26,35,126,0.35)] flex items-center justify-center border-[3.5px] border-white dark:border-slate-900 z-10 cursor-pointer ${
										isAndroidNative ? '' : 'active:scale-90 transition-transform'
									}`}
									aria-label={labelText}
								>
									<span className="material-symbols-outlined text-[22px] font-bold leading-none">{item.icon}</span>
								</button>

								{/* Center Label at exact same baseline as other tabs */}
								<span className="text-[10px] font-black tracking-tight text-[#1A237E] dark:text-indigo-400 truncate w-full text-center leading-none">
									{labelText}
								</span>
							</div>
						);
					}

					return (
						<button
							type="button"
							key={`nav-${idx}`}
							onPointerEnter={() => !isAndroidNative && preloadNativeRoute(item.path)}
							onClick={() => {
								if (item.path.startsWith('event:')) {
									window.dispatchEvent(new CustomEvent(item.path.split(':')[1]));
									return;
								}

								const isSearchBtn = item.path.includes('search=focus');
								if (isSearchBtn) {
									const searchablePaths = ['/customers', '/debts', '/orders', '/inventory', '/price-list', '/products', '/suppliers', '/supplier-debts', '/purchase-orders'];
									const isSearchable = searchablePaths.some(p => currentPath.startsWith(p));
									if (isSearchable) {
										window.dispatchEvent(new CustomEvent('open-mobile-search'));
									} else {
										navigate('/orders?search=focus');
									}
								} else {
									navigate(item.path);
								}
							}}
							className={`flex flex-col items-center justify-center gap-1 h-full py-1.5 cursor-pointer ${
								isAndroidNative ? '' : 'transition-all duration-200'
							} ${
								isActive ? 'text-[#1A237E] dark:text-indigo-400 font-black' : 'text-slate-400 dark:text-slate-500 font-semibold hover:text-slate-600'
							}`}
						>
							<div className={`relative flex items-center justify-center ${
								isAndroidNative ? '' : `transition-transform duration-200 ${isActive ? 'scale-105' : ''}`
							}`}>
								<span
									className={`material-symbols-outlined text-[22px] leading-none ${isActive ? 'filled' : ''}`}
									style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
								>
									{item.icon}
								</span>
								{isActive && (
									<div className={`absolute -bottom-1 size-1 bg-[#1A237E] dark:bg-indigo-400 rounded-full ${
										isAndroidNative ? '' : 'animate-pulse'
									}`} />
								)}
							</div>
							<span className={`text-[10px] tracking-tight truncate w-full text-center leading-none px-0.5 ${isActive ? 'opacity-100' : 'opacity-80'}`}>
								{labelText}
							</span>
						</button>
					);
				})}
			</div>
		</nav>
	);
};

export default MobileNav;
