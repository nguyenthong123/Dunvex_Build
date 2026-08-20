import React from 'react';

export const AuditTab = ({ logs }: any) => {
    return (
						<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
							<div className="p-6 border-b border-slate-50 dark:border-slate-800">
								<h3 className="font-bold dark:text-white">Nhật ký hoạt động hệ thống</h3>
							</div>
							<div className="divide-y divide-slate-50 dark:divide-slate-800 overflow-y-auto max-h-[600px]">
								{logs.map((log: any) => (
									<div key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
										<div className="flex justify-between items-start mb-1">
											<span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{log.action}</span>
											<span className="text-[10px] text-slate-400 font-bold">{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Just now'}</span>
										</div>
										<p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{log.details}</p>
										<p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-tighter">Thực hiện bởi: {log.user}</p>
									</div>
								))}
							</div>
						</div>
    );
};
