import React from 'react';
import { FileText, PlusCircle } from 'lucide-react';

interface DebtCustomerTableProps {
	loading: boolean;
	paginatedData: any[];
	openStatement: (row: any) => void;
	formatPrice: (val: number) => string;
	formatDate: (val: any) => string;
	setPaymentData: (val: any) => void;
	paymentData: any;
	setShowPaymentForm: (val: boolean) => void;
	totalPages: number;
	currentPage: number;
	setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
	aggregatedData: any[];
	ITEMS_PER_PAGE: number;
	getPageNumbers: () => any[];
}

export const DebtCustomerTable: React.FC<DebtCustomerTableProps> = ({
	loading,
	paginatedData,
	openStatement,
	formatPrice,
	formatDate,
	setPaymentData,
	paymentData,
	setShowPaymentForm,
	totalPages,
	currentPage,
	setCurrentPage,
	aggregatedData,
	ITEMS_PER_PAGE,
	getPageNumbers
}) => {
	return (
		<>
			<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-blue-900/5 dark:shadow-indigo-900/5 border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
				{/* Desktop Table */}
				<div className="overflow-x-auto hidden lg:block">
					<table className="w-full text-left">
						<thead>
							<tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
								<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Đối tác / Mã KH</th>
								<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Tổng Mua</th>
								<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Đã Trả</th>
								<th className="px-8 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Dư nợ hiện tại</th>
								<th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Hành động</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
							{loading ? (
								[1, 2, 3, 4, 5].map(i => (
									<tr key={i} className="animate-pulse">
										<td className="px-8 py-5 border-b border-slate-50 dark:border-slate-800">
											<div className="flex items-center gap-4">
												<div className="size-12 rounded-2xl skeleton" />
												<div className="space-y-2">
													<div className="w-32 h-4 skeleton" />
													<div className="w-20 h-3 skeleton opacity-50" />
												</div>
											</div>
										</td>
										<td className="px-8 py-5 border-b border-slate-50 dark:border-slate-800"><div className="w-20 h-4 skeleton ml-auto" /></td>
										<td className="px-8 py-5 border-b border-slate-50 dark:border-slate-800"><div className="w-20 h-4 skeleton ml-auto" /></td>
										<td className="px-8 py-5 border-b border-slate-50 dark:border-slate-800"><div className="w-24 h-5 skeleton ml-auto" /></td>
										<td className="px-6 py-5 border-b border-slate-50 dark:border-slate-800">
											<div className="flex justify-end gap-2">
												<div className="size-10 rounded-xl skeleton" />
												<div className="size-10 rounded-xl skeleton" />
											</div>
										</td>
									</tr>
								))
							) : paginatedData.length === 0 ? (
								<tr><td colSpan={5} className="py-20 text-center text-slate-400 dark:text-slate-500 uppercase font-black text-xs tracking-[4px]">Không tìm thấy đối tác nào</td></tr>
							) : paginatedData.map((row) => (
								<tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => openStatement(row)}>
									<td className="px-8 py-5">
										<div className="flex items-center gap-4">
											<div className={`size-12 rounded-2xl bg-[#1A237E]/10 dark:bg-indigo-500/10 flex items-center justify-center text-[#1A237E] dark:text-indigo-400 font-black text-sm shrink-0 shadow-sm border border-slate-200 dark:border-slate-800`}>
												{(row.name || 'KH').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
											</div>
											<div>
												<p className="text-sm font-black text-slate-900 dark:text-indigo-400 uppercase tracking-tight leading-tight">{row.name}</p>
												<p className="text-[10px] text-slate-500 dark:text-slate-500 font-black mt-1 tracking-wider uppercase">{row.phone || row.id.slice(-6)}</p>
											</div>
										</div>
									</td>
									<td className="px-8 py-5 text-right">
										<span className="text-xs font-black text-slate-600 dark:text-slate-400">{formatPrice(row.totalOrdersAmount)}</span>
									</td>
									<td className="px-8 py-5 text-right">
										<span className="text-xs font-black text-green-700 dark:text-green-400">{formatPrice(row.totalPaymentsAmount)}</span>
									</td>
									<td className="px-8 py-5 text-right">
										<span className={`text-sm font-black tracking-tight ${row.currentDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#10b981] dark:text-emerald-400'}`}>
											{formatPrice(row.currentDebt)}
										</span>
									</td>
									<td className="px-6 py-5 text-right">
										<div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
											<button
												onClick={() => openStatement(row)}
												className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-[#1A237E] dark:hover:text-indigo-400 hover:border-[#1A237E] dark:hover:border-indigo-400 transition-all shadow-sm"
												title="Xem chi tiết"
											>
												<FileText size={20} />
											</button>
											<button
												onClick={() => {
													setPaymentData({ ...paymentData, customerId: row.id, customerName: row.name });
													setShowPaymentForm(true);
												}}
												className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-[#FF6D00] hover:border-[#FF6D00] transition-all shadow-sm"
												title="Thu nợ"
											>
												<PlusCircle size={20} />
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Mobile Cards */}
				<div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-950">
					{loading ? (
						[1, 2, 3].map(i => (
							<div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 animate-pulse">
								<div className="flex items-center gap-4 mb-4">
									<div className="size-12 rounded-2xl skeleton" />
									<div className="space-y-2 flex-1">
										<div className="w-32 h-4 skeleton" />
										<div className="w-20 h-3 skeleton opacity-50" />
									</div>
								</div>
								<div className="h-10 skeleton rounded-xl" />
							</div>
						))
					) : paginatedData.length === 0 ? (
						<div className="py-20 text-center text-slate-400 dark:text-slate-500 uppercase font-black text-xs tracking-[4px] col-span-full">
							Không tìm thấy đối tác nào
						</div>
					) : paginatedData.map((row) => (
						<div key={row.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:scale-[0.99] active:scale-[0.98] transition-all cursor-pointer" onClick={() => openStatement(row)}>
							<div className="flex items-center gap-4 mb-4">
								<div className={`size-12 rounded-2xl bg-[#1A237E]/10 dark:bg-indigo-500/10 flex items-center justify-center text-[#1A237E] dark:text-indigo-400 font-black text-sm shrink-0 border border-slate-200 dark:border-slate-800 transition-colors`}>
									{(row.name || 'KH').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-black text-slate-900 dark:text-indigo-400 uppercase tracking-tight leading-tight truncate">{row.name}</p>
									<p className="text-[10px] text-slate-500 dark:text-slate-500 font-bold mt-1 tracking-wider uppercase">{row.phone || '#' + row.id.slice(-6).toUpperCase()}</p>
								</div>
								<div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${row.debtHealth === 'critical' ? 'bg-rose-100 text-rose-600' :
										row.debtHealth === 'risk' ? 'bg-orange-100 text-orange-600' :
											row.debtHealth === 'slow' ? 'bg-amber-100 text-amber-600' :
												'bg-emerald-100 text-emerald-600'
									}`}>
									{row.debtHealth === 'critical' ? 'Rủi ro cao' :
										row.debtHealth === 'risk' ? 'Chậm trả' :
											row.debtHealth === 'slow' ? 'Theo dõi' : 'An toàn'}
								</div>
							</div>

							<div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-50 dark:border-slate-800/50">
								<div className="flex flex-col">
									<span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Tổng mua</span>
									<span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{formatPrice(row.totalOrdersAmount)}</span>
								</div>
								<div className="flex flex-col">
									<span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Đã trả</span>
									<span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">{formatPrice(row.totalPaymentsAmount)}</span>
								</div>
								<div className="flex flex-col text-right">
									<span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Dư nợ</span>
									<span className={`text-[11px] font-black ${row.currentDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
										{formatPrice(row.currentDebt)}
									</span>
								</div>
							</div>

							<div className="flex items-center justify-between mt-4" onClick={(e) => e.stopPropagation()}>
								<div className="flex flex-col">
									<span className="text-[9px] font-bold text-slate-400 uppercase">GD cuối</span>
									<span className="text-[10px] font-black text-slate-600 dark:text-slate-400">{row.lastTx ? formatDate(row.lastTx) : '---'}</span>
								</div>
								<div className="flex items-center gap-2">
									<button
										onClick={() => openStatement(row)}
										className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-[#1A237E] transition-all"
									>
										<FileText size={18} />
									</button>
									<button
										onClick={() => {
											setPaymentData({ ...paymentData, customerId: row.id, customerName: row.name });
											setShowPaymentForm(true);
										}}
										className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 hover:bg-orange-100 transition-all"
									>
										<PlusCircle size={18} />
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Pagination Controls - Desktop & Mobile */}
			{!loading && totalPages > 1 && (
				<div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
					<p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">
						Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, aggregatedData.length)} của {aggregatedData.length} đối tác
					</p>
					<div className="flex items-center gap-2">
						<button
							onClick={() => { setCurrentPage((prev: number) => Math.max(prev - 1, 1)); window.scrollTo(0, 0); }}
							disabled={currentPage === 1}
							className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
						>
							<span className="material-symbols-outlined">chevron_left</span>
						</button>
						<div className="flex items-center gap-1">
							{getPageNumbers().map((page, idx) => (
								<button
									key={idx}
									onClick={() => typeof page === 'number' && setCurrentPage(page)}
									disabled={page === '...'}
									className={`size-10 rounded-xl font-black text-xs transition-all ${page === currentPage
											? 'bg-[#1A237E] text-white shadow-lg shadow-blue-500/20'
											: page === '...'
												? 'text-slate-400 cursor-default'
												: 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
										}`}
								>
									{page}
								</button>
							))}
						</div>
						<button
							onClick={() => { setCurrentPage((prev: number) => Math.min(prev + 1, totalPages)); window.scrollTo(0, 0); }}
							disabled={currentPage === totalPages}
							className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
						>
							<span className="material-symbols-outlined">chevron_right</span>
						</button>
					</div>
				</div>
			)}
		</>
	);
};
