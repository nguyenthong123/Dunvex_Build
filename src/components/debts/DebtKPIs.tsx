import React from 'react';

interface DebtKPIsProps {
	totalWaitedAll: number;
	totalPaidAll: number;
	totalUnpaidAll: number;
	formatPrice: (price: number) => string;
	customersWithDebtCount: number;
}

export const DebtKPIs: React.FC<DebtKPIsProps> = ({
	totalWaitedAll,
	totalPaidAll,
	totalUnpaidAll,
	formatPrice,
	customersWithDebtCount
}) => {
	return (
		<div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6 mb-0 transition-colors duration-300">
			{/* KPI Card 1: Tổng tiền nợ */}
			<div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-2.5 sm:p-6 shadow-sm border-l-4 sm:border-l-[6px] border-[#3b82f6] relative overflow-hidden group transition-colors duration-300 flex flex-col justify-between h-full">
				<div className="hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
					<span className="material-symbols-outlined text-7xl text-[#3b82f6]">receipt_long</span>
				</div>
				<div className="relative z-10 flex flex-col">
					<p className="text-slate-400 dark:text-slate-500 text-[8px] sm:text-[10px] font-black uppercase tracking-widest mb-1 leading-tight line-clamp-2">Tổng tiền nợ</p>
					<p className="text-[#1A237E] dark:text-indigo-400 text-xs sm:text-2xl lg:text-3xl font-black tracking-tighter truncate" title={formatPrice(totalWaitedAll)}>{formatPrice(totalWaitedAll)}</p>
				</div>
			</div>

			{/* KPI Card 2: Tổng tiền đã trả */}
			<div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-2.5 sm:p-6 shadow-sm border-l-4 sm:border-l-[6px] border-[#10b981] relative overflow-hidden group transition-colors duration-300 flex flex-col justify-between h-full">
				<div className="hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
					<span className="material-symbols-outlined text-7xl text-[#10b981]">payments</span>
				</div>
				<div className="relative z-10 flex flex-col">
					<p className="text-slate-400 dark:text-slate-500 text-[8px] sm:text-[10px] font-black uppercase tracking-widest mb-1 leading-tight line-clamp-2">Tổng tiền đã trả</p>
					<p className="text-[#1A237E] dark:text-indigo-400 text-xs sm:text-2xl lg:text-3xl font-black tracking-tighter truncate" title={formatPrice(totalPaidAll)}>{formatPrice(totalPaidAll)}</p>
				</div>
			</div>

			{/* KPI Card 3: Tổng dư nợ chưa trả */}
			<div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-2.5 sm:p-6 shadow-sm border-l-4 sm:border-l-[6px] border-rose-500 relative overflow-hidden group transition-colors duration-300 flex flex-col justify-between h-full">
				<div className="hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10 group-hover:scale-110 transition-transform">
					<span className="material-symbols-outlined text-7xl text-rose-500">warning</span>
				</div>
				<div className="relative z-10 flex flex-col">
					<p className="text-slate-400 dark:text-slate-500 text-[8px] sm:text-[10px] font-black uppercase tracking-widest mb-1 leading-tight line-clamp-2">Tổng dư nợ chưa trả</p>
					<p className="text-rose-600 text-xs sm:text-2xl lg:text-3xl font-black tracking-tighter truncate" title={formatPrice(totalUnpaidAll)}>{formatPrice(totalUnpaidAll)}</p>
					<div className="hidden sm:block bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[8px] font-black uppercase px-2 py-1 rounded-full w-fit mt-2 animate-pulse">
						{customersWithDebtCount} KH ĐANG NỢ
					</div>
				</div>
			</div>
		</div>
	);
};
