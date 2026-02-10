import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const MobileNav = () => {
	const navigate = useNavigate();
	const location = useLocation();

	const navItems = [
		{ icon: 'home', label: 'Trang chủ', path: '/dashboard' },
		{ icon: 'location_on', label: 'Check-in', path: '/checkin' },
		{ icon: 'add', label: 'Lên đơn', path: '/quick-order', isCenter: true },
		{ icon: 'shopping_cart', label: 'Đơn hàng', path: '/orders' },
		{ icon: 'settings', label: 'Cài đặt', path: '/settings' },
	];

	return (
		<div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-2 flex justify-between items-center z-50 pb-6 h-24">
			{navItems.map((item) => {
				const isActive = location.pathname === item.path;

				if (item.isCenter) {
					return (
						<div key={item.path} className="relative -top-8 flex flex-col items-center">
							<button
								onClick={() => navigate(item.path)}
								className="w-14 h-14 bg-[#FF6D00] text-white rounded-full shadow-2xl flex items-center justify-center scale-110 border-4 border-white active:scale-95 transition-transform"
							>
								<span className="material-symbols-outlined text-3xl font-bold">{item.icon}</span>
							</button>
							<span className="text-[10px] font-black uppercase text-[#FF6D00] mt-2 tracking-tighter">Lên đơn</span>
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
