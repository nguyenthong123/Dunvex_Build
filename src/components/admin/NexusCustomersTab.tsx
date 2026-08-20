import React from 'react';
import { Users, Search, XCircle, Lock, Unlock } from 'lucide-react';

interface NexusCustomersTabProps {
	customers: any[];
	addons: any[];
	searchQuery: string;
	onSearchChange: (query: string) => void;
	onUpdatePlan: (ownerId: string, newPlan: string) => void;
	onToggleLock: (ownerId: string, field: string, currentVal: boolean) => void;
	getEffectiveStatus: (c: any) => any;
}

export function NexusCustomersTab({
	customers,
	addons,
	searchQuery,
	onSearchChange,
	onUpdatePlan,
	onToggleLock,
	getEffectiveStatus,
}: NexusCustomersTabProps) {
	return (
		<div className="bg-white dark:bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
			<div className="px-6 lg:px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-slate-800/20">
				<div>
					<h4 className="text-[10px] lg:text-xs font-black text-indigo-400 uppercase tracking-[4px] mb-1">Doanh nghiệp & Thành viên</h4>
					<p className="text-[9px] lg:text-[10px] text-slate-500 font-bold uppercase tracking-wider">Danh sách tài khoản đăng nhập và quản lý gói</p>
				</div>
				<div className="flex items-center gap-4">
					<div className="relative w-full md:w-80">
						<div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
							<Search size={16} />
						</div>
						<input
							type="text"
							placeholder="Tìm theo tên, email hoặc UID..."
							value={searchQuery}
							onChange={(e) => onSearchChange(e.target.value)}
							className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs text-slate-900 dark:text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-all font-medium"
						/>
						{searchQuery && (
							<button
								onClick={() => onSearchChange('')}
								className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-900 dark:text-white transition-colors"
							>
								<XCircle size={16} />
							</button>
						)}
					</div>
					<div className="size-10 shrink-0 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
						<Users size={20} />
					</div>
				</div>
			</div>

			{/* Desktop Table */}
			<div className="hidden lg:block overflow-x-auto custom-scrollbar">
				<table className="w-full text-left min-w-[900px]">
					<thead>
						<tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
							<th className="px-6 py-5">Doanh nghiệp</th>
							<th className="px-3 py-5 w-20">Loại TK</th>
							<th className="px-6 py-5">Email Owner</th>
							<th className="px-6 py-5">Gói</th>
							<th className="px-6 py-5 whitespace-nowrap">Ngày vào (Tạo TK)</th>
							<th className="px-6 py-5 whitespace-nowrap">Ngày gia hạn</th>
							<th className="px-6 py-5">Trạng thái / Hết hạn</th>
							<th className="px-3 py-5 text-center">Đơn</th>
							<th className="px-3 py-5 text-center">Nợ</th>
							<th className="px-3 py-5 text-center">Sheet</th>
							<th className="px-3 py-5 text-center">AI</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
						{customers.map((c) => {
							const eff = getEffectiveStatus(c);
							const planId = c.planId || (c.isPro ? 'premium_monthly' : 'free');
							let planBg = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
							if (planId.includes('premium')) planBg = "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/30";
							if (planId === 'free_trial' || planId === 'free') planBg = "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30";

							return (
								<tr key={c.id} className="hover:bg-slate-800/30 transition-colors text-xs">
									<td className="px-6 py-6 font-bold text-slate-900 dark:text-white uppercase truncate max-w-[150px]">
										{eff.isStaff && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mr-1">NV</span>}{c.displayName || 'No Name'}
									</td>
									<td className="px-6 py-6 text-slate-400">{c.email}</td>
									<td className="px-3 py-6">{eff.isStaff ? (<span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg">Nhân viên</span>) : (<span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg">Admin</span>)}</td>
									<td className="px-6 py-6">
										<select
											className={`text-[10px] font-black rounded-lg px-2 py-1.5 outline-none border transition-colors cursor-pointer uppercase ${planBg}`}
											value={planId}
											onChange={(e) => onUpdatePlan(c.uid, e.target.value)}
										>
											<option value="test_expire">TEST HẾT HẠN</option>
											<option value="free">FREE (30d)</option>
											{addons.map(addon => (
												<option key={addon.id} value={addon.id}>{addon.name} ({addon.durationDays || addon.durationMonths * 30}d)</option>
											))}
											<option value="cancel_payment">⛔ HUỶ ĐĂNG KÝ (KHÓA)</option>
										</select>
									</td>
									<td className="px-6 py-6 text-slate-500 font-medium whitespace-nowrap">
										{eff.createdAt ? eff.createdAt.toLocaleDateString('vi-VN') : '---'}
									</td>
									<td className="px-6 py-6 text-indigo-500 dark:text-indigo-400 font-bold whitespace-nowrap">
										{eff.isStaff ? 'Theo Admin' : eff.paymentConfirmedAt ? eff.paymentConfirmedAt.toLocaleDateString('vi-VN') : '---'}
									</td>
									<td className="px-6 py-6 text-slate-500 whitespace-nowrap">
										<div className={`font-bold text-[10px] mb-1 ${eff.isExpired ? 'text-rose-500' : eff.isStaff ? 'text-amber-500' : 'text-emerald-500'}`}>
											{eff.isExpired ? 'ĐÃ HẾT HẠN' : eff.isStaff ? 'THEO ADMIN' : 'ĐANG HIỆU LỰC'}
										</div>
										<div className="text-[10px] uppercase font-black tracking-tighter">
											{eff.expireAt ? eff.expireAt.toLocaleDateString('vi-VN') : '---'}
											<span className={`ml-1 ${eff.isExpired ? 'text-rose-400' : eff.isStaff ? 'text-amber-400' : 'text-slate-400'}`}>({eff.isExpired ? `Trễ ${eff.daysExpired}D` : eff.isStaff ? `Theo Admin - Còn ${eff.daysRemaining}D` : `Còn ${eff.daysRemaining}D`})</span>
										</div>
									</td>
									<td className="px-3 py-6 text-center">
										<button
											onClick={eff.isStaff ? undefined : () => onToggleLock(c.uid, 'manualLockOrders', c.manualLockOrders)}
											className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockOrders ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-white'}`}
											title={c.manualLockOrders ? "Đã khóa" : "Khóa thủ công"}
										>
											{c.manualLockOrders ? <Lock size={12} /> : <Unlock size={12} />}
										</button>
									</td>
									<td className="px-3 py-6 text-center">
										<button
											onClick={eff.isStaff ? undefined : () => onToggleLock(c.uid, 'manualLockDebts', c.manualLockDebts)}
											className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockDebts ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-white'}`}
											title={c.manualLockDebts ? "Đã khóa" : "Khóa thủ công"}
										>
											{c.manualLockDebts ? <Lock size={12} /> : <Unlock size={12} />}
										</button>
									</td>
									<td className="px-3 py-6 text-center">
										<button
											onClick={eff.isStaff ? undefined : () => onToggleLock(c.uid, 'manualLockSheets', c.manualLockSheets)}
											className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockSheets ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-white'}`}
											title={c.manualLockSheets ? "Đã khóa" : "Khóa thủ công"}
										>
											{c.manualLockSheets ? <Lock size={12} /> : <Unlock size={12} />}
										</button>
									</td>
									<td className="px-3 py-6 text-center">
										<button
											onClick={eff.isStaff ? undefined : () => onToggleLock(c.uid, 'manualLockAi', c.manualLockAi)}
											className={`size-8 rounded-lg flex items-center justify-center mx-auto transition-all ${c.manualLockAi ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-white'}`}
											title={c.manualLockAi ? "Đã khóa" : "Khóa thủ công"}
										>
											{c.manualLockAi ? <Lock size={12} /> : <Unlock size={12} />}
										</button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* Mobile/Tablet Card Layout */}
			<div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
				{customers.map((c) => {
					const eff = getEffectiveStatus(c);
					return (
						<div key={c.id} className="p-6 space-y-5">
							<div className="flex items-center justify-between">
								<div>
									<p className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight mb-1">{eff.isStaff && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mr-1">NV</span>}{c.displayName || 'No Name'}</p>
									<p className="text-[10px] text-slate-500 font-medium">{c.email}</p>
								</div>
								<div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${eff.isExpired ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
									{eff.isExpired ? 'Hết hạn' : 'Active'}
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
									<p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Gói dịch vụ</p>
									{(() => {
										const planId = c.planId || (c.isPro ? 'premium_monthly' : 'free');
										let planBg = "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-700";
										if (planId.includes('premium')) planBg = "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/30";
										if (planId === 'free_trial' || planId === 'free') planBg = "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30";
										return (
											<select
												className={`w-full text-[10px] font-black rounded-lg px-2 py-1.5 outline-none border uppercase ${planBg}`}
												value={planId}
												onChange={(e) => onUpdatePlan(c.uid, e.target.value)}
											>
												<option value="test_expire">TEST HẾT HẠN</option>
												<option value="free">FREE (30d)</option>
												{addons.map(addon => (
													<option key={addon.id} value={addon.id}>{addon.name} ({addon.durationDays || addon.durationMonths * 30}d)</option>
												))}
												<option value="cancel_payment">⛔ HUỶ ĐĂNG KÝ (KHÓA)</option>
											</select>
										);
									})()}
								</div>
								<div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-center">
									<p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{eff.isExpired ? 'Đã dùng' : 'Còn lại'}</p>
									<p className={`font-black text-sm uppercase mb-1 ${eff.isExpired ? 'text-rose-400' : 'text-slate-900 dark:text-white'}`}>{eff.isExpired ? `${eff.daysUsed} ngày` : `${eff.daysRemaining} ngày`}</p>
									<div className="flex flex-col gap-0.5">
										{eff.createdAt && <p className="text-[8px] text-slate-500 font-medium">Tạo TK: {eff.createdAt.toLocaleDateString('vi-VN')}</p>}
										{eff.paymentConfirmedAt && <p className="text-[8px] text-indigo-400 font-medium">Gia hạn: {eff.paymentConfirmedAt.toLocaleDateString('vi-VN')}</p>}
									</div>
								</div>
							</div>

							<div className="flex items-center justify-between bg-slate-800/30 p-4 rounded-2xl border border-slate-700/30">
								<div className="flex flex-col items-center gap-1.5">
									<p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Đơn hàng</p>
									<button
										onClick={eff.isStaff ? undefined : () => onToggleLock(c.uid, 'manualLockOrders', c.manualLockOrders)}
										className={`size-10 rounded-xl flex items-center justify-center transition-all ${c.manualLockOrders ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}
									>
										{c.manualLockOrders ? <Lock size={16} /> : <Unlock size={16} />}
									</button>
								</div>
								<div className="flex flex-col items-center gap-1.5">
									<p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Công nợ</p>
									<button
										onClick={eff.isStaff ? undefined : () => onToggleLock(c.uid, 'manualLockDebts', c.manualLockDebts)}
										className={`size-10 rounded-xl flex items-center justify-center transition-all ${c.manualLockDebts ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}
									>
										{c.manualLockDebts ? <Lock size={16} /> : <Unlock size={16} />}
									</button>
								</div>
								<div className="flex flex-col items-center gap-1.5">
									<p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Sheets</p>
									<button
										onClick={eff.isStaff ? undefined : () => onToggleLock(c.uid, 'manualLockSheets', c.manualLockSheets)}
										className={`size-10 rounded-xl flex items-center justify-center transition-all ${c.manualLockSheets ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}
									>
										{c.manualLockSheets ? <Lock size={16} /> : <Unlock size={16} />}
									</button>
								</div>
								<div className="flex flex-col items-center gap-1.5">
									<p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">AI</p>
									<button
										onClick={eff.isStaff ? undefined : () => onToggleLock(c.uid, 'manualLockAi', c.manualLockAi)}
										className={`size-10 rounded-xl flex items-center justify-center transition-all ${c.manualLockAi ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}
									>
										{c.manualLockAi ? <Lock size={16} /> : <Unlock size={16} />}
									</button>
								</div>
							</div>
						</div>
					);
				})}
				{customers.length === 0 && (
					<div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs opacity-40">
						{searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có doanh nghiệp nào'}
					</div>
				)}
			</div>
		</div>
	);
}
