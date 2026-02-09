import { NavLink } from 'react-router-dom';
import { Home, History, MessageSquare, User, Plus } from 'lucide-react';

const BottomNav = () => {
	return (
		<nav className="absolute bottom-0 w-full bg-white dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 pb-8 pt-2 px-6 z-30">
			<div className="flex justify-between items-end relative">
				<NavLink
					to="/"
					className={({ isActive }) =>
						`flex flex-col items-center justify-center w-12 gap-1 transition-colors ${isActive ? 'text-primary' : 'text-gray-400'}`
					}
				>
					<Home size={24} />
					<span className="text-[10px] font-semibold">Trang chủ</span>
				</NavLink>

				<NavLink
					to="/history"
					className={({ isActive }) =>
						`flex flex-col items-center justify-center w-12 gap-1 transition-colors ${isActive ? 'text-primary' : 'text-gray-400'}`
					}
				>
					<History size={24} />
					<span className="text-[10px] font-medium">Lịch sử</span>
				</NavLink>

				<div className="absolute left-1/2 -translate-x-1/2 -top-10">
					<NavLink to="/quick-order">
						<button className="h-16 w-16 bg-accent rounded-full shadow-lg shadow-orange-500/40 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform border-4 border-white dark:border-background-dark">
							<Plus size={32} strokeWidth={3} />
						</button>
					</NavLink>
					<span className="text-[10px] font-bold text-accent text-center block mt-1">Lên đơn</span>
				</div>

				<NavLink
					to="/messages"
					className={({ isActive }) =>
						`flex flex-col items-center justify-center w-12 gap-1 transition-colors ${isActive ? 'text-primary' : 'text-gray-400'}`
					}
				>
					<MessageSquare size={24} />
					<span className="text-[10px] font-medium">Tin nhắn</span>
				</NavLink>

				<NavLink
					to="/settings"
					className={({ isActive }) =>
						`flex flex-col items-center justify-center w-12 gap-1 transition-colors ${isActive ? 'text-primary' : 'text-gray-400'}`
					}
				>
					<User size={24} />
					<span className="text-[10px] font-medium">Tài khoản</span>
				</NavLink>
			</div>
		</nav>
	);
};

export default BottomNav;
