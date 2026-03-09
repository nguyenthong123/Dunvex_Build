import { NavLink } from 'react-router-dom';
import { useNavigationConfig } from '../../hooks/useNavigationConfig';

const BottomNav = () => {
	const { navItems, currentPath } = useNavigationConfig();

	return (
		<nav className="absolute bottom-0 w-full bg-white dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 pb-8 pt-2 px-6 z-30">
			<div className="flex justify-between items-end relative">
				{navItems.map((item) => {
					const isActive = currentPath === item.path;

					if (item.isCenter) {
						return (
							<div key={item.path} className="absolute left-1/2 -translate-x-1/2 -top-10">
								<NavLink to={item.path}>
									<button className="h-16 w-16 bg-[#FF6D00] rounded-full shadow-lg shadow-orange-500/40 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform border-4 border-white dark:border-background-dark">
										<span className="material-symbols-outlined text-3xl font-bold">{item.icon}</span>
									</button>
								</NavLink>
								<span className="text-[10px] font-bold text-[#FF6D00] text-center block mt-1">{item.label}</span>
							</div>
						);
					}

					return (
						<NavLink
							key={item.path}
							to={item.path}
							className={`flex flex-col items-center justify-center w-12 gap-1 transition-colors ${isActive ? 'text-[#1A237E]' : 'text-gray-400'}`}
						>
							<span className="material-symbols-outlined">{item.icon}</span>
							<span className="text-[10px] font-medium">{item.label}</span>
						</NavLink>
					);
				})}
			</div>
		</nav>
	);
};

export default BottomNav;
