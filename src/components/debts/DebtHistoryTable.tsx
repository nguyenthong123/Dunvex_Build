import React from 'react';
import { FileText, Edit2, Trash2 } from 'lucide-react';

interface DebtHistoryTableProps {
	loading: boolean;
	paginatedHistory: any[];
	formatPrice: (val: number) => string;
	formatDate: (val: any) => string;
	setSelectedPayment: (val: any) => void;
	setShowPaymentDetail: (val: boolean) => void;
	setEditingPaymentId: (val: string | null) => void;
	setPaymentData: (val: any) => void;
	setShowPaymentForm: (val: boolean) => void;
	handleDeletePayment: (id: string) => void;
	historyTotalPages: number;
	historyCurrentPage: number;
	setHistoryCurrentPage: React.Dispatch<React.SetStateAction<number>>;
	filteredHistory: any[];
	ITEMS_PER_PAGE: number;
	getHistoryPageNumbers: () => any[];
}

export const DebtHistoryTable: React.FC<DebtHistoryTableProps> = ({
	loading,
	paginatedHistory,
	formatPrice,
	formatDate,
	setSelectedPayment,
	setShowPaymentDetail,
	setEditingPaymentId,
	setPaymentData,
	setShowPaymentForm,
	handleDeletePayment,
	historyTotalPages,
	historyCurrentPage,
	setHistoryCurrentPage,
	filteredHistory,
	ITEMS_PER_PAGE,
	getHistoryPageNumbers
}) => {
	return (
		<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-blue-900/5 dark:shadow-indigo-900/5 border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
			<div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
				<h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Danh sách phiếu thu gần đây</h3>
			</div>
			<div className="overflow-x-auto custom-scrollbar">
				{/* Desktop Table */}
				<table className="w-full text-left hidden md:table min-w-[800px]">
					<thead>
						<tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
							<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-left">Khách hàng</th>
							<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Số tiền</th>
							<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-center">Phương thức</th>
							<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Ngày thu</th>
							<th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Hành động</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
						{paginatedHistory.map((pay) => (
							<tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
								<td className="px-8 py-5">
									<div>
										<p className="text-sm font-black text-slate-900 dark:text-indigo-400 tracking-tight leading-tight uppercase">{pay.displayCustomerName}</p>
										<p className="text-[10px] text-slate-500 dark:text-slate-500 font-bold mt-1 tracking-wider uppercase truncate max-w-[200px]">{pay.note || '---'}</p>
									</div>
								</td>
								<td className="px-8 py-5 text-right">
									<span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatPrice(pay.amount)}</span>
								</td>
								<td className="px-8 py-5 text-center">
									<span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${pay.paymentMethod === 'Tiền mặt' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
										{pay.paymentMethod}
									</span>
								</td>
								<td className="px-8 py-5 text-right text-xs font-bold text-slate-500 dark:text-slate-400">
									{formatDate(pay.date || pay.createdAt)}
								</td>
								<td className="px-6 py-5 text-right">
									<div className="flex items-center justify-end gap-2">
										<button
											onClick={() => {
												setSelectedPayment(pay);
												setShowPaymentDetail(true);
											}}
											className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
											title="Chi tiết lệnh thu"
										>
											<FileText size={16} />
										</button>
										<button
											onClick={() => {
												setEditingPaymentId(pay.id);
												setPaymentData({
													customerId: pay.customerId,
													customerName: pay.customerName,
													amount: pay.amount,
													date: pay.date || (pay.createdAt?.seconds ? new Date(pay.createdAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
													note: pay.note || '',
													paymentMethod: pay.paymentMethod || 'Tiền mặt',
													proofImage: pay.proofImage || ''
												});
												setShowPaymentForm(true);
											}}
											className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
											title="Sửa"
										>
											<Edit2 size={16} />
										</button>
										<button
											onClick={() => handleDeletePayment(pay.id)}
											className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
											title="Xóa"
										>
											<Trash2 size={16} />
										</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>

				{/* Mobile Cards */}
				<div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
					{paginatedHistory.map((pay) => (
						<div key={pay.id} className="p-4 bg-white dark:bg-slate-900">
							<div className="flex justify-between items-start mb-3">
								<div className="flex flex-col gap-1">
									<p className="text-sm font-black text-slate-900 dark:text-indigo-400 uppercase leading-tight">{pay.displayCustomerName}</p>
									<div className="flex items-center gap-2">
										<span className="text-[10px] font-bold text-slate-400">{formatDate(pay.date || pay.createdAt)}</span>
										<span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${pay.paymentMethod === 'Tiền mặt' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
											{pay.paymentMethod}
										</span>
									</div>
								</div>
								<div className="text-right">
									<p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatPrice(pay.amount)}</p>
								</div>
							</div>

							{pay.note && (
								<p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg mb-3 italic">
									{pay.note}
								</p>
							)}

							<div className="flex justify-end gap-3 pt-2">
								<button
									onClick={() => {
										setSelectedPayment(pay);
										setShowPaymentDetail(true);
									}}
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 text-[10px] font-black uppercase transition-colors"
								>
									<FileText size={12} /> Chi tiết
								</button>
								<button
									onClick={() => {
										setEditingPaymentId(pay.id);
										setPaymentData({
											customerId: pay.customerId,
											customerName: pay.customerName,
											amount: pay.amount,
											date: pay.date || (pay.createdAt?.seconds ? new Date(pay.createdAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
											note: pay.note || '',
											paymentMethod: pay.paymentMethod || 'Tiền mặt',
											proofImage: pay.proofImage || ''
										});
										setShowPaymentForm(true);
									}}
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 text-[10px] font-black uppercase transition-colors"
								>
									<Edit2 size={12} /> Sửa
								</button>
								<button
									onClick={() => handleDeletePayment(pay.id)}
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-50 dark:border-rose-900/20 text-rose-500 text-[10px] font-black uppercase transition-colors"
								>
									<Trash2 size={12} /> Xóa
								</button>
							</div>
						</div>
					))}
				</div>

				{filteredHistory.length === 0 && (
					<div className="py-20 text-center text-slate-400 dark:text-slate-500 uppercase font-black text-xs tracking-widest">
						Chưa có dữ liệu phiếu thu
					</div>
				)}
			</div>

			{/* History Pagination Controls */}
			{!loading && historyTotalPages > 1 && (
				<div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30 p-4 border-t border-slate-100 dark:border-slate-800">
					<p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">
						Hiển thị {(historyCurrentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(historyCurrentPage * ITEMS_PER_PAGE, filteredHistory.length)} của {filteredHistory.length} phiếu thu
					</p>
					<div className="flex items-center gap-2">
						<button
							onClick={() => { setHistoryCurrentPage((prev: number) => Math.max(prev - 1, 1)); window.scrollTo(0, 0); }}
							disabled={historyCurrentPage === 1}
							className="size-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all shadow-sm"
						>
							<span className="material-symbols-outlined text-sm">chevron_left</span>
						</button>
						<div className="flex items-center gap-1">
							{getHistoryPageNumbers().map((page, idx) => (
								<button
									key={idx}
									onClick={() => typeof page === 'number' && setHistoryCurrentPage(page)}
									disabled={page === '...'}
									className={`size-10 rounded-xl font-black text-xs transition-all ${page === historyCurrentPage
											? 'bg-[#1A237E] text-white shadow-lg shadow-blue-500/20'
											: page === '...'
												? 'text-slate-400 cursor-default'
												: 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 shadow-sm'
										}`}
								>
									{page}
								</button>
							))}
						</div>
						<button
							onClick={() => { setHistoryCurrentPage((prev: number) => Math.min(prev + 1, historyTotalPages)); window.scrollTo(0, 0); }}
							disabled={historyCurrentPage === historyTotalPages}
							className="size-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all shadow-sm"
						>
							<span className="material-symbols-outlined text-sm">chevron_right</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
};
