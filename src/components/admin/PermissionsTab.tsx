import React from 'react';

export const PermissionsTab = ({ filteredUserList, handleTogglePermission }: any) => {
    return (
						<div className="space-y-6">
							<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-x-auto custom-scrollbar">
								<table className="w-full text-left min-w-[1000px]">
									<thead>
										<tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
											<th className="px-6 py-4">Nhân viên</th>
											{['Dashboard', 'Xem Đơn', 'Lên Đơn', 'Check-in', 'Xem Kho', 'Quản SP', 'Khách hàng', 'Thu Nợ', 'Tài chính', 'Nhân sự', 'Hệ thống Admin', 'Nâng cao'].map(h => <th key={h} className="px-2 py-4 text-center">{h}</th>)}
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
										{filteredUserList.map((u: any) => (
											<tr key={u.id}>
												<td className="px-6 py-4 font-bold text-sm text-slate-700 dark:text-white">{u.displayName || u.email}</td>
												{['dashboard', 'orders_view', 'orders_create', 'checkin_create', 'inventory_view', 'inventory_manage', 'customers_manage', 'debts_manage', 'users_manage', 'admin', 'system_manage'].map(p => {
													// Determine visual state
													const sensitiveKeys = ['admin', 'users_manage', 'system_manage'];
													const defaultBtnVal = sensitiveKeys.includes(p) ? false : true;
													const isActive = u.accessRights?.[p] ?? defaultBtnVal;
													
													return (
														<td key={p} className="px-2 py-4">
															<div onClick={() => handleTogglePermission(u, p)} className={`w-10 h-5 rounded-full p-0.5 cursor-pointer mx-auto transition-colors ${isActive ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
																<div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
															</div>
														</td>
													);
												})}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
    );
};
