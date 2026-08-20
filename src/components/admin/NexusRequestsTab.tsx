import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface NexusRequestsTabProps {
	requests: any[];
	onApprove: (request: any) => void;
	onReject: (request: any) => void;
	loading?: boolean;
}

export function NexusRequestsTab({ requests, onApprove, onReject, loading }: NexusRequestsTabProps) {
	return (
		<div className="space-y-6">
			<div className="bg-white dark:bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
				{/* Desktop Table */}
				<div className="hidden md:block overflow-x-auto custom-scrollbar">
					<table className="w-full text-left min-w-[800px]">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
								<th className="px-8 py-5">Khách hàng</th>
								<th className="px-8 py-5">Gói đăng ký</th>
								<th className="px-8 py-5">Ngày gửi</th>
								<th className="px-8 py-5">Coupon</th>
								<th className="px-8 py-5">Nội dung chuyển</th>
								<th className="px-8 py-5">Số tiền</th>
								<th className="px-8 py-5 text-right">Hành động</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
							{requests.map((req) => (
								<tr key={req.id} className="hover:bg-slate-800/30 transition-colors group text-xs">
									<td className="px-8 py-6">
										<div className="flex items-center gap-3">
											<div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-400">
												{req.userEmail?.[0].toUpperCase()}
											</div>
											<div className="max-w-[150px] truncate">
												<p className="font-bold text-slate-900 dark:text-white truncate">{req.userEmail}</p>
												<p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-tight">{req.ownerId?.slice(-8)}</p>
											</div>
										</div>
									</td>
									<td className="px-8 py-6">
										<span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${req.planId === 'premium_yearly' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
											{req.planName}
										</span>
									</td>
									<td className="px-8 py-6 text-slate-400 font-medium">
										{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString('vi-VN', {
											hour: '2-digit',
											minute: '2-digit',
											day: '2-digit',
											month: '2-digit'
										}) : '---'}
									</td>
									<td className="px-8 py-6 font-black text-rose-500 uppercase tracking-widest">
										{req.appliedCode || '---'}
									</td>
									<td className="px-8 py-6 text-indigo-400 font-black tracking-widest">{req.transferCode || '---'}</td>
									<td className="px-8 py-6 font-black text-slate-900 dark:text-white">{req.amount.toLocaleString()}đ</td>
									<td className="px-8 py-6 text-right">
										<div className="flex justify-end gap-2">
											<button
												onClick={() => onApprove(req)}
												className={`size-10 rounded-xl flex items-center justify-center transition-all ${req.status === 'approved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-slate-900 dark:text-white'}`}
											>
												<CheckCircle2 size={18} />
											</button>
											<button
												onClick={() => onReject(req)}
												className={`size-10 rounded-xl flex items-center justify-center transition-all ${req.status === 'rejected' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-slate-900 dark:text-white'}`}
											>
												<XCircle size={18} />
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Mobile Cards */}
				<div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
					{requests.map((req) => (
						<div key={req.id} className="p-6 space-y-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-400">
										{req.userEmail?.[0].toUpperCase()}
									</div>
									<div>
										<p className="font-bold text-slate-900 dark:text-white text-sm">{req.userEmail}</p>
										<p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{req.ownerId?.slice(-8)}</p>
									</div>
								</div>
								<span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${req.planId === 'premium_yearly' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
									{req.planName}
								</span>
							</div>
							<div className="grid grid-cols-2 gap-4 text-[10px] items-center">
								<div>
									<p className="text-slate-500 font-black uppercase tracking-widest mb-1">Số tiền</p>
									<p className="text-slate-900 dark:text-white font-black text-base">{req.amount.toLocaleString()}đ</p>
								</div>
								<div>
									<p className="text-slate-500 font-black uppercase tracking-widest mb-1">Mã CK</p>
									<p className="text-indigo-400 font-black tracking-widest uppercase">{req.transferCode || '---'}</p>
								</div>
							</div>
							<div className="flex items-center justify-between pt-2">
								<div className="text-[9px] text-slate-500 font-medium">
									{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString('vi-VN') : '---'}
								</div>
								<div className="flex gap-2">
									<button
										onClick={() => onApprove(req)}
										className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2"
									>
										<CheckCircle2 size={14} /> Duyệt
									</button>
									<button
										onClick={() => onReject(req)}
										className="bg-rose-500/10 text-rose-500 px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2"
									>
										<XCircle size={14} /> Loại
									</button>
								</div>
							</div>
						</div>
					))}
					{requests.length === 0 && (
						<div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs opacity-40">
							Không có yêu cầu nào
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
