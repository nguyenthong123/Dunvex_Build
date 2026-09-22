import React from 'react';

interface InventoryLogsTableProps {
	inventoryLogs: any[];
}

const parseDate = (d: any): Date | null => {
	if (!d) return null;
	if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
	if (typeof d?.toDate === 'function') {
		const res = d.toDate();
		return res instanceof Date && !isNaN(res.getTime()) ? res : null;
	}
	if (typeof d?.toMillis === 'function') {
		const ms = d.toMillis();
		return typeof ms === 'number' && !isNaN(ms) ? new Date(ms) : null;
	}
	if (typeof d === 'object' && typeof d.seconds === 'number') {
		return new Date(d.seconds * 1000);
	}
	const parsed = new Date(d);
	return isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (d: any) => {
	const date = parseDate(d);
	if (!date) return '---';
	return date.toLocaleString('vi-VN', {
		hour: '2-digit',
		minute: '2-digit',
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
};

const getLogBadge = (log: any) => {
	const type = log?.type;
	if (type === 'in' || type === 'import') {
		return { label: 'Nhập kho', className: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' };
	}
	if (type === 'out') {
		return { label: 'Bán hàng', className: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' };
	}
	if (type === 'export') {
		return { label: 'Xuất kho', className: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' };
	}
	if (type === 'init') {
		return { label: 'Tồn đầu kỳ', className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' };
	}
	if (type === 'transfer') {
		return { label: 'Chuyển kho', className: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' };
	}
	if (type === 'audit') {
		const isInc = log?.diffType === 'increase';
		return {
			label: isInc ? 'Nhập thêm' : 'Điều chỉnh giảm',
			className: isInc ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
		};
	}
	return { label: log?.action || 'Biến động', className: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
};

const InventoryLogsTable: React.FC<InventoryLogsTableProps> = ({ inventoryLogs }) => {
	return (
		<div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
			{/* Desktop Table */}
			<div className="hidden lg:block overflow-x-auto">
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
							inventoryLogs.map((log) => {
								const badge = getLogBadge(log);
								const isOut = log.type === 'out' || log.type === 'export' || (log.type === 'audit' && log.diffType === 'decrease');
								return (
								<tr key={log.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
									<td className="py-4 px-6 font-medium text-slate-500">
										{formatDateTime(log.timestamp || log.createdAt)}
									</td>
									<td className="py-4 px-6">
										<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${badge.className}`}>
											{badge.label}
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
										{log.items ? log.items.reduce((acc: number, curr: any) => acc + curr.quantity, 0) : (log.qty ?? log.change)}
									</td>
									<td className="py-4 px-6 text-slate-500 italic max-w-xs truncate">{log.note}</td>
									<td className="py-4 px-6 font-bold text-[#1A237E] dark:text-indigo-400">{log.user}</td>
								</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			{/* Mobile List View */}
			<div className="block lg:hidden divide-y divide-gray-100 dark:divide-slate-800">
				{inventoryLogs.length === 0 ? (
					<div className="py-12 text-center text-slate-400">Chưa có lịch sử giao dịch kho</div>
				) : (
					inventoryLogs.map((log) => {
						const badge = getLogBadge(log);
						return (
						<div key={log.id} className="p-4 flex flex-col gap-2 bg-white dark:bg-slate-900">
							<div className="flex justify-between items-start">
								<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${badge.className}`}>
									{badge.label}
								</span>
								<span className="text-xs text-slate-500">
									{formatDateTime(log.timestamp || log.createdAt)}
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
										{log.items ? log.items.reduce((acc: number, curr: any) => acc + curr.quantity, 0) : (log.qty ?? log.change)}
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
						);
					})
				)}
			</div>
		</div>
	);
};

export default InventoryLogsTable;
