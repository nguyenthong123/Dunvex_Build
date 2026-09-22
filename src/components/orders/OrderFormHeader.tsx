import React from 'react';
import { ChevronDown, CheckCircle } from 'lucide-react';
import { OrderCustomerPicker } from './OrderCustomerPicker';

interface OrderFormHeaderProps {
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
	orderStatus: string;
	setOrderStatus: (status: string) => void;
	orderDate: string;
	setOrderDate: (date: string) => void;
	orderNote: string;
	setOrderNote: (note: string) => void;
	deliveryLocation?: string;
	setDeliveryLocation?: (loc: string) => void;
	parsedLocation?: { lat: number, lng: number } | null;
	setParsedLocation?: (loc: { lat: number, lng: number } | null) => void;
	normalizeSmart: (text: string) => string;
}

const OrderFormHeader: React.FC<OrderFormHeaderProps> = ({
	selectedCustomer, setSelectedCustomer,
	searchCustomerQuery, setSearchCustomerQuery,
	showCustomerResults, setShowCustomerResults,
	filteredCustomers, debtMap, customerSearchRef,
	formatPrice, showToast,
	orderStatus, setOrderStatus,
	orderDate, setOrderDate,
	orderNote, setOrderNote,
	deliveryLocation, setDeliveryLocation,
	parsedLocation, setParsedLocation,
	normalizeSmart
}) => {
	const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		if (setDeliveryLocation) setDeliveryLocation(val);
		
		if (!setParsedLocation) return;
		
		if (!val.trim()) {
			setParsedLocation(null);
			return;
		}
		
		const match = val.match(/@?(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
		if (match) {
			setParsedLocation({ lat: parseFloat(match[1]), lng: parseFloat(match[2]) });
		} else {
			setParsedLocation(null);
		}
	};

	return (
		<div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 md:p-6 transition-colors duration-300">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
				{/* CUSTOMER SEARCH */}
				<div className="flex flex-col gap-1">
					<OrderCustomerPicker
						selectedCustomer={selectedCustomer}
						setSelectedCustomer={setSelectedCustomer}
						searchCustomerQuery={searchCustomerQuery}
						setSearchCustomerQuery={setSearchCustomerQuery}
						showCustomerResults={showCustomerResults}
						setShowCustomerResults={setShowCustomerResults}
						filteredCustomers={filteredCustomers}
						debtMap={debtMap}
						customerSearchRef={customerSearchRef}
						formatPrice={formatPrice}
						showToast={showToast}
						normalizeSmart={normalizeSmart}
					/>
					{(() => {
						if (!selectedCustomer) return null;
						const customerDebt = debtMap[selectedCustomer.id] || 0;
						const hasLimit = typeof selectedCustomer.creditLimit === 'number' && selectedCustomer.creditLimit > 0;
						if (!hasLimit) return null;
						const isOverLimit = customerDebt >= selectedCustomer.creditLimit;

						return (
							<div className={`p-3 rounded-xl border text-[11px] font-bold leading-normal flex items-start gap-2 mt-1.5 transition-all ${
								isOverLimit 
									? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400' 
									: 'bg-indigo-50/50 dark:bg-indigo-900/5 border-indigo-100/50 dark:border-indigo-950/20 text-indigo-600 dark:text-indigo-400'
							}`}>
								<span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0">
									{isOverLimit ? 'warning' : 'info'}
								</span>
								<div>
									{isOverLimit ? (
										<span>
											⚠️ Hạn mức nợ: <strong>{formatPrice(selectedCustomer.creditLimit)}</strong>. 
											Đang nợ vượt hạn mức: <strong>{formatPrice(customerDebt)}</strong> (Vượt <strong>{formatPrice(customerDebt - selectedCustomer.creditLimit)}</strong>).
										</span>
									) : (
										<span>
											ℹ️ Công nợ hiện tại: <strong>{formatPrice(customerDebt)}</strong> / Hạn mức: <strong>{formatPrice(selectedCustomer.creditLimit)}</strong> (Còn lại: <strong>{formatPrice(selectedCustomer.creditLimit - customerDebt)}</strong>).
										</span>
									)}
								</div>
							</div>
						);
					})()}
				</div>

				{/* STATUS SELECT */}
				<div>
					<label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">TRẠNG THÁI ĐƠN</label>
					<div className="relative">
						<select
							className="w-full px-4 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/10 appearance-none transition-all"
							value={orderStatus}
							onChange={(e) => setOrderStatus(e.target.value)}
						>
							<option value="Đơn chốt">Đơn chốt</option>
							<option value="Đơn nháp">Đơn nháp</option>
						</select>
						<ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
					</div>
				</div>

				{/* ORDER DATE */}
				<div>
					<label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">NGÀY LÊN ĐƠN</label>
					<input
						type="date"
						className="w-full px-4 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/10 appearance-none transition-all"
						value={orderDate}
						onChange={(e) => setOrderDate(e.target.value)}
					/>
				</div>

				{/* NOTE */}
				<div className="md:col-span-1">
					<label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">GHI CHÚ ĐƠN HÀNG</label>
					<textarea
						rows={2}
						autoComplete="off"
						placeholder="Yêu cầu giao hàng sớm..."
						className="w-full px-4 py-2.5 h-11 min-h-[44px] max-h-[80px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#f27121]/10 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none resize-none leading-normal"
						value={orderNote}
						onChange={(e) => setOrderNote(e.target.value)}
					/>
				</div>

				{/* DELIVERY LOCATION */}
				<div className="md:col-span-1">
					<div className="flex justify-between items-end mb-1.5 ml-1">
						<label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">VỊ TRÍ GIAO HÀNG (TOẠ ĐỘ)</label>
						{parsedLocation && (
							<span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
								<CheckCircle size={12} /> Hợp lệ
							</span>
						)}
					</div>
					<div className="relative">
						<input
							type="text"
							autoComplete="off"
							placeholder="Dán link Google Maps hoặc Toạ độ Zalo..."
							className={`w-full px-4 h-11 bg-white dark:bg-slate-800 border ${parsedLocation ? 'border-emerald-500/50 focus:ring-emerald-500/10' : 'border-slate-200 dark:border-slate-700 focus:ring-[#f27121]/10'} rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none`}
							value={deliveryLocation || ''}
							onChange={handleLocationChange}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default OrderFormHeader;
