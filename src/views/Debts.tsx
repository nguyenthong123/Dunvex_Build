import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

interface DataRow {
	id: string;
	initials: string;
	avatarBg: string;
	avatarText: string;
	name: string;
	invoiceId: string;
	amount: string;
	lastTransaction: string;
	dueDate: string;
	riskLevel: string;
	riskColor: string;
	riskBg: string;
}

const Debts: React.FC = () => {
	const navigate = useNavigate();
	const [currentTime, setCurrentTime] = useState(new Date());

	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 60000);
		return () => clearInterval(timer);
	}, []);

	const handleLogout = async () => {
		if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
			await signOut(auth);
			navigate('/login');
		}
	};

	const dataRows: DataRow[] = [
		{
			id: '1',
			initials: 'HB',
			avatarBg: 'bg-blue-100',
			avatarText: 'text-blue-700',
			name: 'Công ty XD Hòa Bình',
			invoiceId: '#INV-2023-001',
			amount: '500.000.000 đ',
			lastTransaction: '20/10/2023',
			dueDate: '30/10/2023',
			riskLevel: 'Cao',
			riskColor: 'text-red-800',
			riskBg: 'bg-red-100',
		},
		{
			id: '2',
			initials: 'VN',
			avatarBg: 'bg-green-100',
			avatarText: 'text-green-700',
			name: 'Thép Việt Nhật',
			invoiceId: '#INV-2023-045',
			amount: '120.000.000 đ',
			lastTransaction: '22/10/2023',
			dueDate: '15/11/2023',
			riskLevel: 'Thấp',
			riskColor: 'text-green-800',
			riskBg: 'bg-green-100',
		},
		{
			id: '3',
			initials: 'AP',
			avatarBg: 'bg-orange-100',
			avatarText: 'text-orange-700',
			name: 'Cửa hàng VLXD An Phú',
			invoiceId: '#INV-2023-089',
			amount: '85.000.000 đ',
			lastTransaction: '18/10/2023',
			dueDate: '25/10/2023',
			riskLevel: 'Trung bình',
			riskColor: 'text-yellow-800',
			riskBg: 'bg-yellow-100',
		},
		{
			id: '4',
			initials: 'CT',
			avatarBg: 'bg-indigo-100',
			avatarText: 'text-indigo-700',
			name: 'Tập đoàn Coteccons',
			invoiceId: '#INV-2023-112',
			amount: '1.200.000.000 đ',
			lastTransaction: '15/10/2023',
			dueDate: '01/11/2023',
			riskLevel: 'Thấp',
			riskColor: 'text-green-800',
			riskBg: 'bg-green-100',
		},
	];

	return (
		<div className="bg-[#f8f9fa] text-slate-900 h-screen w-full overflow-hidden flex flex-col md:flex-row font-['Manrope']">

			{/* Sidebar Navigation */}
			<aside className="hidden md:flex flex-col h-screen bg-[#1A237E] text-white transition-all duration-300 z-40 md:w-20 lg:w-64 flex-shrink-0">
				<div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-white/10">
					<div className="size-10 bg-[#FF6D00] rounded-xl flex items-center justify-center shrink-0 shadow-lg">
						<span className="material-symbols-outlined text-white text-2xl font-bold">architecture</span>
					</div>
					<div className="ml-3 hidden lg:flex flex-col">
						<h1 className="text-base font-black leading-none uppercase tracking-tighter">Dunvex<span className="text-[#FF6D00]">Build</span></h1>
						<p className="text-white/60 text-[10px] mt-1 uppercase font-bold tracking-widest">Management System</p>
					</div>
				</div>
				<div className="flex-1 overflow-y-auto py-6 flex flex-col gap-2 px-3">
					<button onClick={() => navigate('/dashboard')} className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors group text-left">
						<span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">grid_view</span>
						<span className="hidden lg:block text-sm font-bold uppercase tracking-tight">Tổng quan</span>
					</button>
					<button className="flex items-center gap-3 px-3 py-3 rounded-xl bg-[#FF6D00] text-white shadow-lg shadow-orange-500/30 group text-left">
						<span className="material-symbols-outlined text-2xl fill-1">attach_money</span>
						<span className="hidden lg:block text-sm font-bold uppercase tracking-tight">Công nợ</span>
					</button>
					<button onClick={() => navigate('/orders')} className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors group text-left">
						<span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">shopping_cart</span>
						<span className="hidden lg:block text-sm font-bold uppercase tracking-tight">Bán hàng</span>
					</button>
					<button onClick={() => navigate('/inventory')} className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors group text-left">
						<span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">inventory_2</span>
						<span className="hidden lg:block text-sm font-bold uppercase tracking-tight">Kho hàng</span>
					</button>
					<button onClick={() => navigate('/customers')} className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors group text-left">
						<span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">group</span>
						<span className="hidden lg:block text-sm font-bold uppercase tracking-tight">Khách hàng</span>
					</button>
					<button onClick={() => navigate('/checkin')} className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors group text-left">
						<span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">location_on</span>
						<span className="hidden lg:block text-sm font-bold uppercase tracking-tight">Check-in</span>
					</button>
				</div>
				<div className="p-4 border-t border-white/10">
					<div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer" onClick={handleLogout}>
						<img
							className="rounded-full size-10 shrink-0 border-2 border-[#FF6D00] object-cover"
							src={auth.currentUser?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100"}
							alt="User"
						/>
						<div className="hidden lg:flex flex-col overflow-hidden">
							<p className="text-sm font-black truncate leading-none uppercase tracking-tight">{auth.currentUser?.displayName || 'Admin'}</p>
							<p className="text-[10px] text-white/50 truncate uppercase font-bold mt-1">Quản trị viên</p>
						</div>
					</div>
				</div>
			</aside>

			{/* Main Content Area */}
			<main className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
				{/* Header */}
				<header className="h-16 md:h-20 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 shrink-0">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<h2 className="text-[#1A237E] text-lg md:text-2xl font-black uppercase tracking-tight">Quản Lý Công Nợ</h2>
							<p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden md:block">
								Cập nhật lúc: {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — {currentTime.toLocaleDateString('vi-VN')}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3 md:gap-6">
						<div className="hidden md:flex items-center bg-slate-50 rounded-xl px-4 py-2 w-64 lg:w-96 border border-transparent focus-within:border-[#FF6D00]/50 transition-all shadow-inner">
							<span className="material-symbols-outlined text-slate-400">search</span>
							<input className="bg-transparent border-none focus:ring-0 text-sm w-full text-slate-700 ml-2 font-bold" placeholder="Tìm kiếm đối tác, mã đơn..." type="text" />
						</div>

						<div className="flex items-center gap-2">
							<button className="p-2 relative text-slate-400 hover:bg-slate-50 rounded-xl transition-colors">
								<span className="material-symbols-outlined">notifications</span>
								<span className="absolute top-2 right-2 size-2 bg-[#FF6D00] rounded-full border-2 border-white"></span>
							</button>
							<button className="hidden md:flex items-center justify-center gap-2 bg-[#1A237E] hover:bg-[#0D47A1] text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-900/20 transition-all active:scale-95">
								<span className="material-symbols-outlined text-xl">add_card</span>
								<span>Ghi nhận thu nợ</span>
							</button>
						</div>
					</div>
				</header>

				{/* Scrollable Content */}
				<div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 bg-[#f8f9fa]">
					<div className="max-w-7xl mx-auto flex flex-col gap-6 md:gap-8">
						{/* KPI Cards Section */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
							{/* KPI Card 1 */}
							<div className="bg-white rounded-3xl p-6 shadow-sm border-l-[6px] border-[#10b981] relative overflow-hidden group">
								<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
									<span className="material-symbols-outlined text-7xl text-[#10b981]">download</span>
								</div>
								<div className="relative z-10 flex flex-col">
									<p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Tổng Phải thu</p>
									<p className="text-[#1A237E] text-2xl lg:text-3xl font-black tracking-tighter">2.540.0</p>
									<p className="text-[10px] font-black text-[#10b981] mt-2 flex items-center gap-1 uppercase">
										<span className="material-symbols-outlined text-xs">arrow_upward</span> 12% THÁNG NÀY
									</p>
								</div>
							</div>

							{/* KPI Card 2 */}
							<div className="bg-white rounded-3xl p-6 shadow-sm border-l-[6px] border-[#3b82f6] relative overflow-hidden group">
								<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
									<span className="material-symbols-outlined text-7xl text-[#3b82f6]">upload</span>
								</div>
								<div className="relative z-10 flex flex-col">
									<p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Tổng Phải trả</p>
									<p className="text-[#1A237E] text-2xl lg:text-3xl font-black tracking-tighter">1.200.0</p>
									<p className="text-[10px] font-black text-rose-500 mt-2 flex items-center gap-1 uppercase">
										<span className="material-symbols-outlined text-xs">arrow_downward</span> 5% THÁNG NÀY
									</p>
								</div>
							</div>

							{/* KPI Card 3 */}
							<div className="bg-white rounded-3xl p-6 shadow-sm border-l-[6px] border-rose-500 relative overflow-hidden group">
								<div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
									<span className="material-symbols-outlined text-7xl text-rose-500">warning</span>
								</div>
								<div className="relative z-10 flex flex-col">
									<p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Nợ Quá hạn</p>
									<p className="text-rose-600 text-2xl lg:text-3xl font-black tracking-tighter">350.0</p>
									<div className="bg-rose-50 text-rose-600 text-[8px] font-black uppercase px-2 py-1 rounded-full w-fit mt-2 animate-pulse">
										Cần xử lý gấp
									</div>
								</div>
							</div>
						</div>

						{/* Filters */}
						<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
							<div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
								<button className="px-6 py-2.5 rounded-xl bg-[#1A237E] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20">Tất cả</button>
								<button className="px-6 py-2.5 rounded-xl bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-[#1A237E] transition-all border border-slate-100">Quá hạn</button>
								<button className="px-6 py-2.5 rounded-xl bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-[#1A237E] transition-all border border-slate-100">Rủi ro</button>
							</div>
							<div className="flex items-center gap-2 w-full md:w-auto">
								<button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-100 hover:border-[#1A237E] transition-all">
									<span className="material-symbols-outlined text-lg">filter_list</span> Lọc
								</button>
								<button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF6D00] rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20">
									<span className="material-symbols-outlined text-lg">download</span> Xuất File
								</button>
							</div>
						</div>

						{/* Table */}
						<div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
							<div className="overflow-x-auto">
								<table className="w-full text-left">
									<thead>
										<tr className="bg-slate-50/50 border-b border-slate-100">
											<th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Đối tác / Mã đơn</th>
											<th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Dư nợ</th>
											<th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Rủi ro</th>
											<th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hạn cuối</th>
											<th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{dataRows.map((row) => (
											<tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
												<td className="px-8 py-5">
													<div className="flex items-center gap-4">
														<div className={`size-12 rounded-2xl ${row.avatarBg} flex items-center justify-center ${row.avatarText} font-black text-sm shrink-0 shadow-sm`}>{row.initials}</div>
														<div>
															<p className="text-sm font-black text-[#1A237E] uppercase tracking-tight leading-tight">{row.name}</p>
															<p className="text-[10px] text-slate-400 font-bold mt-1 tracking-wider uppercase">{row.invoiceId}</p>
														</div>
													</div>
												</td>
												<td className="px-8 py-5 text-right">
													<span className="text-sm font-black text-slate-800 tracking-tight">{row.amount}</span>
												</td>
												<td className="px-8 py-5 text-center">
													<span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${row.riskLevel === 'Cao' ? 'bg-rose-50 text-rose-500' :
														row.riskLevel === 'Thấp' ? 'bg-[#10b981]/10 text-[#10b981]' :
															'bg-amber-50 text-amber-600'
														}`}>
														{row.riskLevel}
													</span>
												</td>
												<td className="px-8 py-5">
													<div className="flex flex-col">
														<span className={`text-xs font-black uppercase tracking-tight ${row.riskLevel === 'Cao' ? 'text-rose-500' : 'text-slate-600'}`}>{row.dueDate}</span>
														<span className="text-[9px] text-slate-400 font-bold uppercase mt-1">CK: {row.lastTransaction}</span>
													</div>
												</td>
												<td className="px-6 py-5 text-right">
													<div className="flex items-center justify-end gap-2">
														<button className="bg-white border border-slate-100 p-2.5 rounded-xl text-slate-400 hover:text-[#1A237E] hover:border-[#1A237E] transition-all shadow-sm">
															<span className="material-symbols-outlined text-[20px]">notifications_active</span>
														</button>
														<button className="bg-white border border-slate-100 p-2.5 rounded-xl text-slate-400 hover:text-[#1A237E] hover:border-[#1A237E] transition-all shadow-sm">
															<span className="material-symbols-outlined text-[20px]">more_vert</span>
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			</main>

			{/* Mobile Bottom Nav */}
			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center z-50 pb-8">
				<NavButton icon="grid_view" label="Tổng quan" onClick={() => navigate('/')} />
				<NavButton icon="attach_money" label="Công nợ" active />
				<div className="relative -top-8">
					<button onClick={() => navigate('/quick-order')} className="w-14 h-14 bg-[#FF6D00] text-white rounded-full shadow-2xl flex items-center justify-center scale-110 border-4 border-white">
						<span className="material-symbols-outlined text-3xl font-bold">add</span>
					</button>
				</div>
				<button className="flex flex-col items-center gap-1 text-slate-400">
					<span className="material-symbols-outlined">inventory_2</span>
					<span className="text-[9px] font-bold uppercase">Kho</span>
				</button>
				<button className="flex flex-col items-center gap-1 text-slate-400" onClick={() => navigate('/settings')}>
					<span className="material-symbols-outlined">settings</span>
					<span className="text-[9px] font-bold uppercase">Cài đặt</span>
				</button>
			</div>
		</div>
	);
};

const NavButton = ({ icon, label, active, onClick }: any) => (
	<button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-[#1A237E]' : 'text-slate-400'}`}>
		<span className={`material-symbols-outlined ${active ? 'filled' : ''}`} style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
		<span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
	</button>
);

export default Debts;
