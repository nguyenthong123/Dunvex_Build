import React from 'react';
import { PlusCircle, X, History, Camera, Image as ImageIcon } from 'lucide-react';

interface PaymentFormModalProps {
	showPaymentForm: boolean;
	setShowPaymentForm: (val: boolean) => void;
	editingPaymentId: string | null;
	setEditingPaymentId: (val: string | null) => void;
	handleRecordPayment: (e: React.FormEvent) => void;
	paymentCustomerRef: React.RefObject<HTMLDivElement>;
	paymentData: any;
	setPaymentData: (val: any) => void;
	paymentCustomerSearchQuery: string;
	setPaymentCustomerSearchQuery: (val: string) => void;
	showPaymentCustomerResults: boolean;
	setShowPaymentCustomerResults: (val: boolean) => void;
	aggregatedData: any[];
	isMatch: (target: string, query: string) => boolean;
	formatPrice: (price: number) => string;
	uploadingPaymentImage: boolean;
	handlePaymentImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
	getImageUrl: (url: string) => string;
	isSubmitting: boolean;
}

export const PaymentFormModal: React.FC<PaymentFormModalProps> = ({
	showPaymentForm,
	setShowPaymentForm,
	editingPaymentId,
	setEditingPaymentId,
	handleRecordPayment,
	paymentCustomerRef,
	paymentData,
	setPaymentData,
	paymentCustomerSearchQuery,
	setPaymentCustomerSearchQuery,
	showPaymentCustomerResults,
	setShowPaymentCustomerResults,
	aggregatedData,
	isMatch,
	formatPrice,
	uploadingPaymentImage,
	handlePaymentImageUpload,
	getImageUrl,
	isSubmitting
}) => {
	if (!showPaymentForm) return null;

	return (
		<div className="fixed inset-0 z-[150] bg-[#1A237E]/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
			<div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 transition-colors duration-300">
				<div className="px-8 py-6 bg-[#1A237E] dark:bg-indigo-900 text-white flex items-center justify-between">
					<div className="flex items-center gap-3">
						<PlusCircle size={24} className="text-[#FF6D00]" />
						<h3 className="text-xl font-black uppercase tracking-tight">{editingPaymentId ? 'Chỉnh sửa phiếu thu' : 'Ghi nhận thu nợ'}</h3>
					</div>
					<button onClick={() => { setShowPaymentForm(false); setEditingPaymentId(null); }} className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
						<X size={20} />
					</button>
				</div>
				<form onSubmit={handleRecordPayment} className="p-8 space-y-6">
					<div ref={paymentCustomerRef} className="relative">
						<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Tìm khách hàng / Cơ sở</label>
						<div className="relative">
							<History size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
							<input
								type="text"
								placeholder="Nhập tên khách hoặc tên cơ sở..."
								className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-base font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6D00]/20"
								value={paymentData.customerName || paymentCustomerSearchQuery}
								onFocus={() => {
									setShowPaymentCustomerResults(true);
									if (paymentData.customerName) {
										setPaymentCustomerSearchQuery('');
										setPaymentData({ ...paymentData, customerId: '', customerName: '' });
									}
								}}
								onChange={(e) => {
									setPaymentCustomerSearchQuery(e.target.value);
									setPaymentData({ ...paymentData, customerId: '', customerName: e.target.value });
								}}
							/>
							{showPaymentCustomerResults && (
								<div className="absolute z-[200] top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
									{aggregatedData
										.filter(c => isMatch(c.name || '', paymentCustomerSearchQuery))
										.slice(0, 50)
										.map(c => (
											<div
												key={c.id}
												className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors border-b border-slate-50 dark:border-slate-700 last:border-none"
												onClick={() => {
													setPaymentData({ ...paymentData, customerId: c.id, customerName: c.name });
													setPaymentCustomerSearchQuery(c.name);
													setShowPaymentCustomerResults(false);
												}}
											>
												<div className="flex flex-col">
													<span className="text-sm font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight">
														{c.name}
													</span>
													<div className="flex items-center gap-3 mt-1">
														<span className="text-[10px] text-slate-400 font-bold uppercase">{c.phone || '#' + c.id.slice(-6).toUpperCase()}</span>
														{c.currentDebt > 0 && (
															<span className="text-[10px] text-rose-500 font-black uppercase">Nợ: {formatPrice(c.currentDebt)}</span>
														)}
													</div>
												</div>
											</div>
										))}
									{aggregatedData.filter(c => isMatch(c.name || '', paymentCustomerSearchQuery)).length === 0 && (
										<div className="px-5 py-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
											Không tìm thấy khách hàng
										</div>
									)}
								</div>
							)}
						</div>
					</div>


					<div>
						<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Ngày thu nợ</label>
						<input
							type="date"
							className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6D00]/20"
							value={paymentData.date}
							onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Số tiền thu</label>
							<input
								type="number"
								className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-black text-[#FF6D00] focus:ring-2 focus:ring-[#FF6D00]/20"
								placeholder="0"
								value={paymentData.amount === 0 ? '' : paymentData.amount}
								onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
							/>
						</div>
						<div>
							<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Hình thức</label>
							<select
								className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6D00]/20 appearance-none"
								value={paymentData.paymentMethod}
								onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
							>
								<option value="Tiền mặt">Tiền mặt</option>
								<option value="Chuyển khoản">Chuyển khoản</option>
							</select>
						</div>
					</div>

					<div>
						<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Ghi chú</label>
						<textarea
							rows={3}
							className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6D00]/20 resize-none"
							placeholder="VD: Thu nợ đơn hàng tháng 10..."
							value={paymentData.note}
							onChange={(e) => setPaymentData({ ...paymentData, note: e.target.value })}
						/>
					</div>

					<div>
						<label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-2">Bằng chứng thanh toán (Lệnh chuyển tiền)</label>
						<div className="flex gap-4">
							<button
								type="button"
								onClick={() => document.getElementById('payment-proof-upload')?.click()}
								disabled={uploadingPaymentImage}
								className="flex-1 h-20 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
							>
								{uploadingPaymentImage ? (
									<div className="size-5 border-2 border-[#1A237E] dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
								) : (
									<>
										<Camera size={24} className="text-slate-400 dark:text-slate-500" />
										<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{paymentData.proofImage ? 'Chụp lại ảnh' : 'Chụp/Tải ảnh'}</span>
									</>
								)}
							</button>
							<input
								id="payment-proof-upload"
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handlePaymentImageUpload}
							/>
							{paymentData.proofImage && (
								<div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-700 shadow-lg shrink-0">
									<img src={getImageUrl(paymentData.proofImage)} alt="Proof" className="w-full h-full object-cover"  loading="lazy" />
								</div>
							)}
						</div>
					</div>

					<button
						type="submit"
						disabled={uploadingPaymentImage || isSubmitting}
						className="w-full h-16 bg-[#FF6D00] text-white rounded-2xl font-black uppercase tracking-[3px] shadow-xl shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
					>
						{isSubmitting ? 'ĐANG XỬ LÝ...' : (editingPaymentId ? 'CẬP NHẬT PHIẾU THU' : 'XÁC NHẬN PHIẾU THU')}
					</button>


				</form>
			</div>
		</div>
	);
};
