import React from 'react';

interface InventoryLogsTableProps {
	inventoryLogs: any[];
}

const InventoryLogsTable: React.FC<InventoryLogsTableProps> = ({ inventoryLogs }) => {
	return (
		<div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
			{/* Desktop Table */}
			<div className="hidden md:block overflow-x-auto">
				<table className="w-full text-left">
					<thead>
						<tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
							<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Thời gian</th>
							<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Loại</th>
							<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Sản phẩm</th>
							<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Số lượng</th>
							<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Chi tiết</th>
							<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Người thực hiện</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100 dark:divide-slate-800">
						{inventoryLogs.length === 0 ? (
							<tr><td colSpan={6} className="py-12 text-center text-slate-400">Chưa có lịch sử giao dịch kho</td></tr>
						) : (
							inventoryLogs.map((log) => (
								<tr key={log.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
									<td className="py-4 px-6 font-medium text-slate-500">
										{log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleString('vi-VN') : '...'}
									</td>
									<td className="py-4 px-6">
										<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
											(log.type === 'in' || log.type === 'import') ? 'bg-green-50 text-green-600' :
											(log.type === 'out' || log.type === 'export') ? 'bg-orange-50 text-orange-600' :
											log.type === 'transfer' ? 'bg-blue-50 text-blue-600' :
											log.type === 'audit' ? (log.diffType === 'increase' ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600') :
											'bg-slate-50 text-slate-600'
										}`}>
											{(log.type === 'in' || log.type === 'import') ? 'Nhập kho' :
											 (log.type === 'out' || log.type === 'export') ? 'Xuất kho' :
											 log.type === 'transfer' ? 'Chuyển kho' :
											 log.type === 'audit' ? (log.diffType === 'increase' ? 'Nhập thêm' : 'Điều chỉnh giảm') : 
											 log.action || 'Khởi tạo'}
										</span>
									</td>
									<td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
										{log.items ? (
											<div className="flex flex-col gap-1">
												{log.items.map((item: any, idx: number) => (
													<span key={idx}>{item.name} {item.quantity > 1 ? `(x${item.quantity})` : ''}</span>
												))}
											</div>
										) : (
											log.productName
										)}
									</td>
									<td className={`py-4 px-6 font-black ${
										(log.type === 'in' || log.type === 'import') || (log.type === 'audit' && log.diffType === 'increase') ? 'text-green-600' : 'text-orange-600'
									}`}>
										{(log.type === 'in' || log.type === 'import') || (log.type === 'audit' && log.diffType === 'increase') ? '+' : '-'}
										{log.items ? log.items.reduce((acc: number, curr: any) => acc + curr.quantity, 0) : log.qty}
									</td>
									<td className="py-4 px-6 text-slate-500 italic max-w-xs truncate">{log.note}</td>
									<td className="py-4 px-6 font-bold text-[#1A237E] dark:text-indigo-400">{log.user}</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Mobile List View */}
			<div className="block md:hidden divide-y divide-gray-100 dark:divide-slate-800">
				{inventoryLogs.length === 0 ? (
					<div className="py-12 text-center text-slate-400">Chưa có lịch sử giao dịch kho</div>
				) : (
					inventoryLogs.map((log) => (
						<div key={log.id} className="p-4 flex flex-col gap-2 bg-white dark:bg-slate-900">
							<div className="flex justify-between items-start">
								<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
									(log.type === 'in' || log.type === 'import') ? 'bg-green-50 text-green-600' :
									(log.type === 'out' || log.type === 'export') ? 'bg-orange-50 text-orange-600' :
									log.type === 'transfer' ? 'bg-blue-50 text-blue-600' :
									log.type === 'audit' ? (log.diffType === 'increase' ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600') :
									'bg-slate-50 text-slate-600'
								}`}>
									{(log.type === 'in' || log.type === 'import') ? 'Nhập kho' :
									 (log.type === 'out' || log.type === 'export') ? 'Xuất kho' :
									 log.type === 'transfer' ? 'Chuyển kho' :
									 log.type === 'audit' ? (log.diffType === 'increase' ? 'Nhập thêm' : 'Điều chỉnh giảm') : 
									 log.action || 'Khởi tạo'}
								</span>
								<span className="text-xs text-slate-500">
									{log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '...'}
								</span>
							</div>
							
							<div className="font-bold text-slate-900 dark:text-white text-sm">
								{log.items ? (
									<div className="flex flex-col gap-0.5">
										{log.items.map((item: any, idx: number) => (
											<span key={idx} className="line-clamp-2">{item.name} {item.quantity > 1 ? <span className="text-blue-500">(x{item.quantity})</span> : ''}</span>
										))}
									</div>
								) : (
									<span className="line-clamp-2">{log.productName}</span>
								)}
							</div>

							<div className="flex justify-between items-center mt-1 border-t border-dashed border-slate-100 dark:border-slate-800 pt-2">
								<div className="flex flex-col">
									<span className="text-[10px] text-slate-400 uppercase tracking-wider">Số lượng</span>
									<span className={`font-black text-sm ${
										(log.type === 'in' || log.type === 'import') || (log.type === 'audit' && log.diffType === 'increase') ? 'text-green-600' : 'text-orange-600'
									}`}>
										{(log.type === 'in' || log.type === 'import') || (log.type === 'audit' && log.diffType === 'increase') ? '+' : '-'}
										{log.items ? log.items.reduce((acc: number, curr: any) => acc + curr.quantity, 0) : log.qty}
									</span>
								</div>
								<div className="flex flex-col items-end">
									<span className="text-[10px] text-slate-400 uppercase tracking-wider">Người thực hiện</span>
									<span className="font-bold text-xs text-[#1A237E] dark:text-indigo-400 truncate max-w-[120px]">{log.user}</span>
								</div>
							</div>
							
							{log.note && (
								<div className="mt-1 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg text-xs text-slate-500 italic">
									{log.note}
								</div>
							)}
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default InventoryLogsTable;
