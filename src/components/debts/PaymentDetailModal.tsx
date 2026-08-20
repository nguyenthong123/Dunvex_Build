import React from 'react';
import { FileText, X, Image } from 'lucide-react';

interface PaymentDetailModalProps {
	showPaymentDetail: boolean;
	selectedPayment: any;
	setShowPaymentDetail: (show: boolean) => void;
	setSelectedPayment: (payment: any) => void;
	formatDate: (date: any) => string;
	formatPrice: (price: number) => string;
	getImageUrl: (url: string) => string;
}

export const PaymentDetailModal: React.FC<PaymentDetailModalProps> = ({
	showPaymentDetail,
	selectedPayment,
	setShowPaymentDetail,
	setSelectedPayment,
	formatDate,
	formatPrice,
	getImageUrl
}) => {
	if (!showPaymentDetail || !selectedPayment) return null;

	return (
		<div className="fixed inset-0 z-[170] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
			<div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
				<div className="px-8 py-6 bg-[#1A237E] text-white flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="size-10 bg-white/10 rounded-xl flex items-center justify-center">
							<FileText size={20} />
						</div>
						<h3 className="text-lg font-black uppercase tracking-tight">Chi tiết lệnh thu</h3>
					</div>
					<button onClick={() => { setShowPaymentDetail(false); setSelectedPayment(null); }} className="size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
						<X size={20} />
					</button>
				</div>
				<div className="p-8 space-y-6">
					<div className="space-y-4">
						<div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Khách hàng</span>
							<span className="text-base font-black text-slate-900 dark:text-indigo-400 uppercase">{selectedPayment.customerName}</span>
						</div>
						<div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày thu</span>
							<span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatDate(selectedPayment.date || selectedPayment.createdAt)}</span>
						</div>
						<div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số tiền</span>
							<span className="text-xl font-black text-emerald-600 tracking-tight">{formatPrice(selectedPayment.amount)}</span>
						</div>
						<div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hình thức</span>
							<span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-black text-[#1A237E] dark:text-indigo-400 uppercase">{selectedPayment.paymentMethod}</span>
						</div>
					</div>

					{selectedPayment.note && (
						<div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 italic text-slate-600 dark:text-slate-400 text-sm">
							"{selectedPayment.note}"
						</div>
					)}

					{selectedPayment.proofImage && (
						<div className="space-y-3">
							<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Bằng chứng thanh toán</span>
							<div className="rounded-3xl overflow-hidden border-4 border-slate-50 dark:border-slate-800 shadow-xl group relative">
								<img src={getImageUrl(selectedPayment.proofImage)} alt="Proof" className="w-full aspect-[4/3] object-cover transition-transform duration-500 group-hover:scale-110"  loading="lazy" />
								<a
									href={getImageUrl(selectedPayment.proofImage)}
									target="_blank"
									rel="noopener noreferrer"
									className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-xs uppercase tracking-[2px]"
								>
									<Image size={24} className="mr-2" /> Xem ảnh gốc
								</a>
							</div>
						</div>
					)}

					<button
						onClick={() => { setShowPaymentDetail(false); setSelectedPayment(null); }}
						className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
					>
						Đóng chi tiết
					</button>
				</div>
			</div>
		</div>
	);
};
