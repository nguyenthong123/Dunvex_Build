import { NavLink } from 'react-router-dom';
import { useNavigationConfig } from '../../hooks/useNavigationConfig';

const BottomNav = () => {
	const { navItems, currentPath } = useNavigationConfig();

	return (
		<nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe-area-inset-bottom z-[100] md:hidden">
			<div className="flex justify-between items-end relative px-6 py-2">
				{navItems.map((item) => {
					const isActive = item.path === '/' ? currentPath === '/' : currentPath.startsWith(item.path);

					if (item.isCenter) {
						return (
							<div key={`${item.path}-${item.label}`} className="absolute left-1/2 -translate-x-1/2 -top-10">
								<NavLink to={item.path}>
									<button className="h-16 w-16 bg-[#FF6D00] rounded-full shadow-lg shadow-orange-500/40 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform border-4 border-white dark:border-slate-900">
										<span className="material-symbols-outlined text-3xl font-bold">{item.icon}</span>
									</button>
								</NavLink>
								<span className="text-[10px] font-bold text-[#FF6D00] text-center block mt-1 uppercase">{item.label}</span>
							</div>
						);
					}

					return (
						<NavLink
							key={`${item.path}-${item.label}`}
							to={item.path}
							className={`flex flex-col items-center justify-center w-12 gap-1 transition-colors ${isActive ? 'text-[#1A237E] dark:text-indigo-400' : 'text-slate-400'}`}
						>
							<span className="material-symbols-outlined text-2xl">{item.icon}</span>
							<span className="text-[10px] whitespace-nowrap font-bold uppercase tracking-tighter">{item.label}</span>
						</NavLink>
					);
				})}
			</div>
		</nav>
	);
};

export default BottomNav;
