import React from 'react';
import { Activity } from 'lucide-react';

interface NexusLogsTabProps {
	logs: any[];
	loading?: boolean;
}

export function NexusLogsTab({ logs, loading }: NexusLogsTabProps) {
	return (
		<div className="space-y-6">
			<div className="bg-white dark:bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
				<div className="px-6 lg:px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-800/20">
					<div>
						<h4 className="text-[10px] lg:text-xs font-black text-indigo-400 uppercase tracking-[4px] mb-1">System Audit Logs</h4>
						<p className="text-[9px] lg:text-[10px] text-slate-500 font-bold uppercase tracking-wider">Theo dõi hoạt động toàn hệ thống</p>
					</div>
					<div className="size-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
						<Activity size={20} />
					</div>
				</div>

				{/* Desktop Table */}
				<div className="hidden md:block overflow-x-auto custom-scrollbar">
					<table className="w-full text-left min-w-[800px]" data-chatbot="audit-logs-table">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
								<th className="px-8 py-5">Thời gian</th>
								<th className="px-8 py-5">Người dùng</th>
								<th className="px-8 py-5">Trang</th>
								<th className="px-8 py-5">Hành động</th>
								<th className="px-8 py-5">Chi tiết</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
							{logs.map((log) => (
								<tr key={log.id} className="hover:bg-slate-800/30 transition-colors group text-xs" data-chatbot-row={log.id}>
									<td className="px-8 py-6 text-slate-400 font-medium whitespace-nowrap" data-chatbot-cell="time">
										{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('vi-VN', {
											hour: '2-digit',
											minute: '2-digit',
											day: '2-digit',
											month: '2-digit',
											year: '2-digit'
										}) : '---'}
									</td>
									<td className="px-8 py-6" data-chatbot-cell="user">
										<div className="flex items-center gap-3">
											<div className="size-8 rounded-lg bg-slate-800 flex items-center justify-center font-black text-slate-500 text-[10px]">
												{log.user?.[0].toUpperCase() || 'U'}
											</div>
											<div className="max-w-[200px] truncate">
												<p className="font-bold text-slate-900 dark:text-white truncate">{log.user || 'Hệ thống'}</p>
												<p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{log.ownerId?.slice(-8) || 'GLOBAL'}</p>
											</div>
										</div>
									</td>
									<td className="px-8 py-6">
										<span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">{log.path || '/home'}</span>
									</td>
									<td className="px-8 py-6" data-chatbot-cell="action">
										<span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-slate-800 text-indigo-400 border border-slate-700/50`}>
											{log.action}
										</span>
									</td>
									<td className="px-8 py-6 text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-md" data-chatbot-cell="details">
										{log.details}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Mobile Cards */}
				<div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
					{logs.map((log) => (
						<div key={log.id} className="p-6 space-y-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{log.user || 'Hệ thống'}</p>
									<span className="text-[9px] text-slate-500 font-bold px-1.5 py-0.5 bg-slate-800 rounded">{log.ownerId?.slice(-8) || 'GLOBAL'}</span>
								</div>
								<span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">{log.action}</span>
							</div>
							<p className="text-xs text-slate-400 font-medium leading-relaxed">{log.details}</p>
							<div className="flex items-center justify-between pt-2">
								<span className="text-[9px] text-slate-600 font-black uppercase tracking-tighter">{log.path || '/home'}</span>
								<span className="text-[9px] text-slate-600 font-medium">
									{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('vi-VN') : '---'}
								</span>
							</div>
						</div>
					))}
					{logs.length === 0 && (
						<div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs opacity-40">
							Chưa có dữ liệu nhật ký
						</div>
					)}

				</div>
			</div>
		</div>
	);
}
