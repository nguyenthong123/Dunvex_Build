import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

const Home = () => {
	const navigate = useNavigate();

	const handleLogout = async () => {
		if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
			await signOut(auth);
			navigate('/login');
		}
	};

	return (
		<div className="bg-[#F0F2F5] min-h-screen text-slate-900 overflow-x-hidden">
			{/* Navigation */}
			<nav className="fixed top-0 left-0 right-0 z-50 bg-[#1A237E]/95 backdrop-blur-md text-white h-16 flex items-center px-4 lg:px-8 shadow-xl">
				<div className="flex items-center gap-4 flex-1">
					<div className="bg-[#FF6D00] p-1.5 rounded-lg rotate-12">
						<span className="material-symbols-outlined block text-white font-bold">architecture</span>
					</div>
					<span className="font-black text-xl tracking-tighter uppercase">Dunvex<span className="text-[#FF6D00]">Build</span></span>
				</div>

				<div className="hidden lg:flex items-center gap-8 text-sm font-semibold tracking-wide">
					<a className="border-b-2 border-[#FF6D00] text-[#FF6D00] pb-1 uppercase" href="#" onClick={() => navigate('/')}>Quản Lý Công Nợ</a>
					<a className="text-white/70 hover:text-white transition-colors uppercase" href="#" onClick={() => navigate('/inventory')}>Kho hàng</a>
					<a className="text-white/70 hover:text-white transition-colors uppercase" href="#" onClick={() => navigate('/orders')}>Đơn hàng</a>
					<a className="text-white/70 hover:text-white transition-colors uppercase" href="#" onClick={() => navigate('/checkin')}>Check-in</a>
				</div>

				<div className="flex flex-1 justify-end items-center gap-4">
					<button className="p-2 hover:bg-white/10 rounded-full relative">
						<span className="material-symbols-outlined">notifications</span>
						<span className="absolute top-2 right-2 w-2 h-2 bg-[#FF6D00] rounded-full border-2 border-[#1A237E]"></span>
					</button>
					<div className="flex items-center gap-3 pl-4 border-l border-white/20">
						<div className="text-right hidden sm:block">
							<p className="text-xs font-bold leading-none">{auth.currentUser?.displayName || 'User'}</p>
							<p className="text-[10px] text-white/50">Admin</p>
						</div>
						<img
							alt="Profile"
							className="w-9 h-9 rounded-full object-cover border-2 border-white/20 cursor-pointer hover:opacity-80 transition-opacity"
							src={auth.currentUser?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100"}
							onClick={handleLogout}
						/>
					</div>
				</div>
			</nav>

			<main className="pt-20 pb-24 lg:pb-8 px-4 lg:px-8 max-w-[1600px] mx-auto">
				{/* Alerts Section */}
				<div className="mb-8 flex flex-col md:flex-row gap-4">
					<div className="flex-1 bg-white border-l-4 border-[#FF6D00] p-4 rounded-r-xl shadow-sm flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="bg-orange-50 p-2 rounded-lg text-[#FF6D00]">
								<span className="material-symbols-outlined">warning</span>
							</div>
							<div>
								<h4 className="text-sm font-bold">Cảnh báo tồn kho</h4>
								<p className="text-xs text-slate-500">Xi măng Hà Tiên dưới mức an toàn (50 bao)</p>
							</div>
						</div>
						<button className="text-xs font-bold text-[#FF6D00] px-3 py-1 hover:bg-orange-50 rounded-lg">Xử lý ngay</button>
					</div>

					<div className="hidden md:flex flex-1 bg-white border-l-4 border-blue-600 p-4 rounded-r-xl shadow-sm items-center gap-3">
						<div className="bg-blue-50 p-2 rounded-lg text-blue-600">
							<span className="material-symbols-outlined">payments</span>
						</div>
						<div>
							<h4 className="text-sm font-bold">Công nợ cần thu</h4>
							<p className="text-xs text-slate-500">3 khách hàng đến hạn thanh toán trong hôm nay</p>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-12 gap-6">
					{/* Revenue and Shortcuts */}
					<div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
						<div className="bg-[#1A237E] text-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
							<div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-[#FF6D00]/20 transition-all duration-700"></div>
							<p className="text-white/60 text-sm font-medium mb-1">Doanh thu hôm nay</p>
							<div className="flex items-baseline gap-2">
								<h2 className="text-4xl font-black tracking-tighter">152.0M</h2>
								<span className="text-sm font-bold text-[#FF6D00]">VND</span>
							</div>
							<div className="mt-6 flex gap-4">
								<div className="bg-white/10 px-3 py-2 rounded-xl">
									<p className="text-[10px] text-white/50 uppercase font-bold">Đơn hàng</p>
									<p className="text-lg font-bold">45</p>
								</div>
								<div className="bg-white/10 px-3 py-2 rounded-xl">
									<p className="text-[10px] text-white/50 uppercase font-bold">Tăng trưởng</p>
									<p className="text-lg font-bold text-green-400">+12%</p>
								</div>
							</div>
						</div>

						<div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
							<h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
								Phím tắt nhanh
								<span className="material-symbols-outlined text-slate-300">apps</span>
							</h3>
							<div className="grid grid-cols-2 gap-3">
								<button
									onClick={() => navigate('/orders')}
									className="aspect-square bg-slate-50 hover:bg-[#1A237E] hover:text-white transition-all rounded-3xl flex flex-col items-center justify-center gap-2 group"
								>
									<div className="p-3 bg-white rounded-full text-[#1A237E] group-hover:bg-[#FF6D00] group-hover:text-white shadow-sm">
										<span className="material-symbols-outlined">shopping_cart</span>
									</div>
									<span className="text-xs font-bold">Đơn Hàng</span>
								</button>
								<button
									onClick={() => navigate('/inventory')}
									className="aspect-square bg-slate-50 hover:bg-[#1A237E] hover:text-white transition-all rounded-3xl flex flex-col items-center justify-center gap-2 group"
								>
									<div className="p-3 bg-white rounded-full text-[#1A237E] group-hover:bg-[#FF6D00] group-hover:text-white shadow-sm">
										<span className="material-symbols-outlined">inventory_2</span>
									</div>
									<span className="text-xs font-bold">Sản Phẩm</span>
								</button>
								<button
									onClick={() => navigate('/customers')}
									className="aspect-square bg-slate-50 hover:bg-[#1A237E] hover:text-white transition-all rounded-3xl flex flex-col items-center justify-center gap-2 group"
								>
									<div className="p-3 bg-white rounded-full text-[#1A237E] group-hover:bg-[#FF6D00] group-hover:text-white shadow-sm">
										<span className="material-symbols-outlined">group</span>
									</div>
									<span className="text-xs font-bold">Khách Hàng</span>
								</button>
								<button
									onClick={() => navigate('/checkin')}
									className="aspect-square bg-slate-50 hover:bg-[#1A237E] hover:text-white transition-all rounded-3xl flex flex-col items-center justify-center gap-2 group"
								>
									<div className="p-3 bg-white rounded-full text-[#1A237E] group-hover:bg-[#FF6D00] group-hover:text-white shadow-sm">
										<span className="material-symbols-outlined">location_on</span>
									</div>
									<span className="text-xs font-bold">Checkin</span>
								</button>
							</div>
						</div>
					</div>

					{/* Chart and Recent Activity */}
					<div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
						<div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 flex-1">
							<div className="flex justify-between items-center mb-8">
								<div>
									<h3 className="font-bold text-lg text-slate-900">Biểu đồ tăng trưởng doanh thu</h3>
									<p className="text-xs text-slate-400">Dữ liệu tổng hợp theo thời gian thực</p>
								</div>
								<select className="bg-slate-100 border-none rounded-lg text-xs font-bold px-4 py-2 outline-none cursor-pointer">
									<option>7 ngày qua</option>
									<option>Tháng này</option>
								</select>
							</div>
							<div className="h-48 w-full flex items-end justify-between gap-2 lg:gap-4 px-2">
								{[40, 65, 50, 85, 70, 95].map((height, i) => (
									<div key={i} className="flex-1 bg-slate-100 rounded-t-xl relative group" style={{ height: `${height}%` }}>
										<div className={`absolute bottom-0 w-full rounded-t-xl transition-all ${i === 5 ? 'bg-[#FF6D00] shadow-lg shadow-orange-200' : 'bg-[#1A237E] opacity-20 group-hover:opacity-40'}`} style={{ height: '100%' }}></div>
										{i === 5 && <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Hôm nay</div>}
									</div>
								))}
							</div>
						</div>

						<div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-200">
							<div className="p-6 border-b border-slate-100 flex justify-between items-center">
								<h3 className="font-bold text-slate-900">Hoạt động mới nhất</h3>
								<button className="text-xs font-bold text-[#1A237E] flex items-center gap-1">Xem tất cả <span className="material-symbols-outlined text-xs">arrow_forward</span></button>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-left font-['Inter']">
									<thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
										<tr>
											<th className="px-6 py-4">Nhân viên / Khách</th>
											<th className="px-6 py-4 hidden md:table-cell">Nội dung</th>
											<th className="px-6 py-4">Giá trị</th>
											<th className="px-6 py-4 text-right">Thời gian</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-50">
										<ActivityRow icon="NV" color="bg-blue-100 text-blue-600" name="Nguyễn Văn A" task="Tạo đơn hàng #HD2901" value="+12.5tr" time="2p trước" />
										<ActivityRow icon="KH" color="bg-green-100 text-green-600" name="Trần Thị B" task="Thanh toán công nợ" value="+5.2tr" time="15p trước" />
										<ActivityRow icon="K" color="bg-purple-100 text-purple-600" name="Kho Tổng" task="Nhập kho Xi măng HT" value="500 bao" time="32p trước" />
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			</main>

			{/* Mobile Bottom Nav */}
			<div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center z-50 pb-8">
				<NavButton icon="attach_money" label="Công nợ" active onClick={() => navigate('/')} />
				<NavButton icon="inventory_2" label="Kho" onClick={() => navigate('/inventory')} />
				<div className="relative -top-8">
					<button
						onClick={() => navigate('/quick-order')}
						className="w-14 h-14 bg-[#FF6D00] text-white rounded-full shadow-2xl shadow-orange-500/40 flex items-center justify-center scale-110 border-4 border-[#F0F2F5]"
					>
						<span className="material-symbols-outlined text-3xl">add</span>
					</button>
				</div>
				<NavButton icon="analytics" label="Báo cáo" />
				<NavButton icon="settings" label="Cài đặt" onClick={() => navigate('/settings')} />
			</div>
		</div>
	);
};

const ActivityRow = ({ icon, color, name, task, value, time }: any) => (
	<tr className="hover:bg-slate-50 transition-colors">
		<td className="px-6 py-4">
			<div className="flex items-center gap-3">
				<div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center font-bold text-xs shadow-sm`}>{icon}</div>
				<span className="text-sm font-black text-slate-700 uppercase tracking-tight">{name}</span>
			</div>
		</td>
		<td className="px-6 py-4 hidden md:table-cell">
			<span className="text-sm text-slate-500 font-medium">{task}</span>
		</td>
		<td className="px-6 py-4">
			<span className="text-sm font-black text-slate-900 tracking-tight">{value}</span>
		</td>
		<td className="px-6 py-4 text-right">
			<span className="text-[10px] text-slate-400 font-bold uppercase">{time}</span>
		</td>
	</tr>
);

const NavButton = ({ icon, label, active, onClick }: any) => (
	<button
		onClick={onClick}
		className={`flex flex-col items-center gap-1 ${active ? 'text-[#1A237E]' : 'text-slate-400'}`}
	>
		<span className={`material-symbols-outlined ${active ? 'filled' : ''}`} style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
		<span className="text-[9px] font-bold">{label}</span>
	</button>
);

export default Home;
