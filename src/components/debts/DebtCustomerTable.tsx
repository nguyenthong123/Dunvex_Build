import React from 'react';
import { FileText, PlusCircle, Calendar, Phone, CheckCircle2, AlertCircle } from 'lucide-react';

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
	getPageNumbers,
}) => {
	return (
		<>
			<div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-blue-900/5 dark:shadow-indigo-900/5 border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
				{/* Desktop Table */}
				<div className="overflow-x-auto hidden lg:block">
					<table className="w-full text-left">
						<thead>
							<tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800">
								<th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
									Đối tác / Khách hàng
								</th>
								<th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">
									Tổng mua
								</th>
								<th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">
									Đã trả
								</th>
								<th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">
									Dư nợ hiện tại
								</th>
								<th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">
									Thao tác
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
							{loading ? (
								[1, 2, 3, 4, 5].map((i) => (
									<tr key={i} className="animate-pulse">
										<td className="px-6 py-4 border-b border-slate-50 dark:border-slate-800">
											<div className="flex items-center gap-4">
												<div className="size-11 rounded-2xl skeleton" />
												<div className="space-y-2">
													<div className="w-32 h-4 skeleton" />
													<div className="w-20 h-3 skeleton opacity-50" />
												</div>
											</div>
										</td>
										<td className="px-6 py-4 border-b border-slate-50 dark:border-slate-800">
											<div className="w-20 h-4 skeleton ml-auto" />
										</td>
										<td className="px-6 py-4 border-b border-slate-50 dark:border-slate-800">
											<div className="w-20 h-4 skeleton ml-auto" />
										</td>
										<td className="px-6 py-4 border-b border-slate-50 dark:border-slate-800">
											<div className="w-24 h-5 skeleton ml-auto" />
										</td>
										<td className="px-6 py-4 border-b border-slate-50 dark:border-slate-800">
											<div className="flex justify-end gap-2">
												<div className="size-9 rounded-xl skeleton" />
												<div className="size-9 rounded-xl skeleton" />
											</div>
										</td>
									</tr>
								))
							) : paginatedData.length === 0 ? (
								<tr>
									<td
										colSpan={5}
										className="py-20 text-center text-slate-400 dark:text-slate-500 uppercase font-black text-xs tracking-[4px]"
									>
										Không tìm thấy đối tác nào phù hợp
									</td>
								</tr>
							) : (
								paginatedData.map((row) => (
									<tr
										key={row.id}
										className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
										onClick={() => openStatement(row)}
									>
										<td className="px-6 py-4">
											<div className="flex items-center gap-3.5">
												<div
													className={`size-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-[#1A237E] dark:text-indigo-400 font-black text-xs shrink-0 shadow-sm border border-indigo-100 dark:border-indigo-900/50`}
												>
													{(row.name || 'KH')
														.split(' ')
														.map((n: string) => n[0])
														.join('')
														.slice(0, 2)
														.toUpperCase()}
												</div>
												<div className="min-w-0">
													<div className="flex items-center gap-2">
														<p className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-tight truncate">
															{row.name}
														</p>
														{row.isGuest && (
															<span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold border border-amber-200/60 dark:border-amber-900/40">
																Vãng lai
															</span>
														)}
													</div>
													<div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
														{row.phone ? (
															<span className="flex items-center gap-1">
																<Phone size={11} className="text-slate-400" />
																{row.phone}
															</span>
														) : (
															<span className="text-slate-400">
																#{row.id.replace('guest_', '').slice(-6).toUpperCase()}
															</span>
														)}
														{row.lastTxDate && (
															<span className="text-slate-400 dark:text-slate-500 text-[10px] flex items-center gap-1">
																<span>•</span>
																<Calendar size={10} />
																GD gần nhất:{' '}
																<strong className="text-slate-600 dark:text-slate-300 font-semibold">
																	{row.lastTxDate}
																</strong>
															</span>
														)}
													</div>
												</div>
											</div>
										</td>
										<td className="px-6 py-4 text-right">
											<span className="text-xs font-black text-slate-600 dark:text-slate-400">
												{formatPrice(row.totalOrdersAmount)}
											</span>
										</td>
										<td className="px-6 py-4 text-right">
											<span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
												{formatPrice(row.totalPaymentsAmount)}
											</span>
										</td>
										<td className="px-6 py-4 text-right">
											<div className="flex flex-col items-end">
												<span
													className={`text-sm font-black tracking-tight ${
														row.currentDebt > 0
															? 'text-rose-600 dark:text-rose-400'
															: 'text-emerald-600 dark:text-emerald-400'
													}`}
												>
													{formatPrice(row.currentDebt)}
												</span>
												{row.currentDebt > 0 ? (
													<span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 dark:text-rose-400 mt-0.5">
														<span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
														Còn nợ
													</span>
												) : (
													<span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
														<CheckCircle2 size={10} />
														Đã hết nợ
													</span>
												)}
											</div>
										</td>
										<td className="px-6 py-4 text-right">
											<div
												className="flex items-center justify-end gap-1.5"
												onClick={(e) => e.stopPropagation()}
											>
												<button
													onClick={() => openStatement(row)}
													className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-[#1A237E] dark:hover:text-indigo-400 hover:border-[#1A237E] dark:hover:border-indigo-400 hover:bg-slate-50 transition-all shadow-sm"
													title="Xem bảng kê công nợ"
												>
													<FileText size={17} />
												</button>
												<button
													onClick={() => {
														setPaymentData({
															...paymentData,
															customerId: row.id,
															customerName: row.name,
														});
														setShowPaymentForm(true);
													}}
													className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-[#FF6D00] hover:border-[#FF6D00] hover:bg-orange-50/50 transition-all shadow-sm"
													title="Ghi nhận thu nợ"
												>
													<PlusCircle size={17} />
												</button>
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				{/* Mobile Cards */}
				<div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-950">
					{loading ? (
						[1, 2, 3].map((i) => (
							<div
								key={i}
								className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 animate-pulse"
							>
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
							Không tìm thấy đối tác nào phù hợp
						</div>
					) : (
						paginatedData.map((row) => (
							<div
								key={row.id}
								className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer"
								onClick={() => openStatement(row)}
							>
								<div className="flex items-center gap-3.5 mb-3.5">
									<div
										className="size-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-[#1A237E] dark:text-indigo-400 font-black text-xs shrink-0 border border-indigo-100 dark:border-indigo-900/50"
									>
										{(row.name || 'KH')
											.split(' ')
											.map((n: string) => n[0])
											.join('')
											.slice(0, 2)
											.toUpperCase()}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-1.5">
											<p className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-tight truncate">
												{row.name}
											</p>
											{row.isGuest && (
												<span className="text-[8px] px-1 py-0.5 rounded bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 font-bold shrink-0">
													Vãng lai
												</span>
											)}
										</div>
										<p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 tracking-wider uppercase">
											{row.phone || '#' + row.id.replace('guest_', '').slice(-6).toUpperCase()}
										</p>
									</div>
									<div
										className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0 ${
											row.currentDebt > 0
												? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
												: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'
										}`}
									>
										{row.currentDebt > 0 ? 'Còn nợ' : 'Hết nợ'}
									</div>
								</div>

								<div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl px-3 my-1">
									<div className="flex flex-col">
										<span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
											Tổng mua
										</span>
										<span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
											{formatPrice(row.totalOrdersAmount)}
										</span>
									</div>
									<div className="flex flex-col">
										<span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
											Đã trả
										</span>
										<span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
											{formatPrice(row.totalPaymentsAmount)}
										</span>
									</div>
									<div className="flex flex-col text-right">
										<span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
											Dư nợ
										</span>
										<span
											className={`text-[11px] font-black ${
												row.currentDebt > 0
													? 'text-rose-600 dark:text-rose-400'
													: 'text-emerald-600 dark:text-emerald-400'
											}`}
										>
											{formatPrice(row.currentDebt)}
										</span>
									</div>
								</div>

								<div
									className="flex items-center justify-between mt-3 pt-1"
									onClick={(e) => e.stopPropagation()}
								>
									<div className="flex flex-col">
										<span className="text-[9px] font-bold text-slate-400 uppercase">
											GD gần nhất
										</span>
										<span className="text-[11px] font-black text-slate-600 dark:text-slate-300">
											{row.lastTxDate || '---'}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<button
											onClick={() => openStatement(row)}
											className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#1A237E] transition-all"
											title="Xem bảng kê"
										>
											<FileText size={16} />
										</button>
										<button
											onClick={() => {
												setPaymentData({
													...paymentData,
													customerId: row.id,
													customerName: row.name,
												});
												setShowPaymentForm(true);
											}}
											className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-[#FF6D00] hover:bg-orange-100 transition-all font-bold"
											title="Thu nợ"
										>
											<PlusCircle size={16} />
										</button>
									</div>
								</div>
							</div>
						))
					)}
				</div>
			</div>

			{/* Pagination Controls - Desktop & Mobile */}
			{!loading && totalPages > 1 && (
				<div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
					<p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">
						Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
						{Math.min(currentPage * ITEMS_PER_PAGE, aggregatedData.length)} của{' '}
						{aggregatedData.length} đối tác
					</p>
					<div className="flex items-center gap-2">
						<button
							onClick={() => {
								setCurrentPage((prev: number) => Math.max(prev - 1, 1));
								window.scrollTo(0, 0);
							}}
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
									className={`size-10 rounded-xl font-black text-xs transition-all ${
										page === currentPage
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
							onClick={() => {
								setCurrentPage((prev: number) => Math.min(prev + 1, totalPages));
								window.scrollTo(0, 0);
							}}
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
