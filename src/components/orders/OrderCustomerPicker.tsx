import React from 'react';
import { Search, CheckCircle, Plus } from 'lucide-react';

interface OrderCustomerPickerProps {
	selectedCustomer: any;
	setSelectedCustomer: (c: any) => void;
	searchCustomerQuery: string;
	setSearchCustomerQuery: (q: string) => void;
	showCustomerResults: boolean;
	setShowCustomerResults: (show: boolean) => void;
	filteredCustomers: any[];
	debtMap: Record<string, number>;
	customerSearchRef: React.RefObject<HTMLDivElement | null>;
	formatPrice: (num: number) => string;
	showToast: (msg: string, type: 'success' | 'warning' | 'error') => void;
	normalizeSmart: (text: string) => string;
}

export const OrderCustomerPicker: React.FC<OrderCustomerPickerProps> = ({
	selectedCustomer, setSelectedCustomer,
	searchCustomerQuery, setSearchCustomerQuery,
	showCustomerResults, setShowCustomerResults,
	filteredCustomers, debtMap, customerSearchRef,
	formatPrice, showToast,
	normalizeSmart
}) => {
	return (
		<div className="relative" ref={customerSearchRef}>
			<label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">KHÁCH HÀNG *</label>
			<div className="relative">
				<Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" />
				<input
					type="text"
					inputMode="search"
					autoComplete="off"
					placeholder="Nhập tên hoặc tìm khách hàng..."
					className="w-full pl-12 pr-4 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/10 focus:border-[#f27121] transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
					value={searchCustomerQuery}
					onChange={(e) => {
						setSearchCustomerQuery(e.target.value);
						if (selectedCustomer) {
							const norm = normalizeSmart(e.target.value);
							const match = normalizeSmart(selectedCustomer.name) === norm
								|| normalizeSmart(selectedCustomer.name || '') === norm
								|| selectedCustomer.phone === e.target.value;
							if (!match) setSelectedCustomer(null);
						}
						setShowCustomerResults(true);
					}}
					onFocus={() => setShowCustomerResults(true)}
				/>
			</div>
			{showCustomerResults && searchCustomerQuery && (
				<div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto overscroll-contain custom-scrollbar">
					{filteredCustomers.map(c => {
						const customerDebt = debtMap[c.id] || 0;
						const hasLimit = typeof c.creditLimit === 'number' && c.creditLimit > 0;
						const isOverLimit = hasLimit && (customerDebt >= c.creditLimit);

						return (
							<button
								key={c.id}
								className={`w-full px-6 py-4 text-left border-b border-slate-50 dark:border-slate-700 last:border-none flex items-center justify-between transition-colors ${isOverLimit ? 'opacity-40 grayscale cursor-not-allowed bg-slate-50/50' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 group'}`}
								onClick={() => {
									if (isOverLimit) {
										showToast(`Khách hàng ${c.name} đã vượt hạn mức nợ (${c.creditLimit.toLocaleString('vi-VN')} đ). Vui lòng thu nợ trước khi lên đơn mới.`, "warning");
										return;
									}
									setSelectedCustomer(c);
									setSearchCustomerQuery(c.name);
									setShowCustomerResults(false);
								}}
							>
								<div className="flex-1 min-w-0 pr-4">
									<div className="flex items-center gap-2 mb-0.5">
										<p className={`font-black text-sm uppercase truncate ${isOverLimit ? 'text-slate-500' : 'text-slate-800 dark:text-slate-200 group-hover:text-[#f27121]'}`}>
											{c.name}
										</p>
										{isOverLimit && (
											<span className="px-1.5 py-0.5 rounded-lg bg-rose-500 text-white text-[8px] font-black uppercase animate-pulse shrink-0">Vượt hạn mức</span>
										)}
									</div>
									<p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 uppercase">
										<span className="material-symbols-outlined text-[12px]">person</span>
										{c.name}
									</p>
									<div className="flex items-center gap-2 mt-1">
										<p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{c.phone}</p>
										{customerDebt > 0 && (
											<p className={`text-[10px] font-black uppercase ${isOverLimit ? 'text-rose-600' : 'text-rose-500'}`}>
												Nợ: {formatPrice(customerDebt)} {hasLimit && `/ Hạn mức: ${formatPrice(c.creditLimit)}`}
											</p>
										)}
									</div>
								</div>
								<CheckCircle size={18} className={`${isOverLimit ? 'text-rose-200' : 'text-slate-100 dark:text-slate-700 group-hover:text-[#f27121]'}`} />
							</button>
						);
					})}
					<button
						className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 border-t border-slate-50 dark:border-slate-700 text-[#f27121]"
						onClick={() => setShowCustomerResults(false)}
					>
						<Plus size={16} /> <span className="text-xs font-bold uppercase tracking-wider">Khách vãng lai mới</span>
					</button>
				</div>
			)}
		</div>
	);
};
