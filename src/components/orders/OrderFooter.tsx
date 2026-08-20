import React from 'react';
import { CheckCircle } from 'lucide-react';

interface OrderFooterProps {
	finalTotal: number;
	editId?: string;
	handleConfirmOrder: () => void;
	isSubmitting: boolean;
	showSuccessModal: boolean;
	setShowSuccessModal: (show: boolean) => void;
	onNavigateOrders: () => void;
}

export const OrderFooter: React.FC<OrderFooterProps> = ({
	finalTotal,
	editId,
	handleConfirmOrder,
	isSubmitting,
	showSuccessModal,
	setShowSuccessModal,
	onNavigateOrders,
}) => {
	return (
		<>
			{/* STICKY BOTTOM BAR FOR MOBILE */}
			<div className="fixed bottom-24 left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between md:hidden z-[1001] shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-3xl animate-in slide-in-from-bottom-5 duration-700">
				<div className="flex flex-col">
					<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">TỔNG CỘNG:</span>
					<span className="text-xl font-black text-[#00a859] leading-none">{finalTotal.toLocaleString('vi-VN')} đ</span>
				</div>
				<button
					onClick={handleConfirmOrder}
					disabled={isSubmitting}
					className="bg-[#1A237E] hover:bg-[#121858] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white h-14 px-8 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-indigo-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isSubmitting ? 'ĐANG LÊN ĐƠN...' : 'XÁC NHẬN LÊN ĐƠN'}
				</button>
			</div>

			{/* SUCCESS MODAL */}
			{showSuccessModal && (
				<div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
					<div
						className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
						onClick={onNavigateOrders}
					></div>
					<div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-md p-10 relative z-10 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
						<div className="flex flex-col items-center text-center">
							<div className="size-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-8 relative">
								<div className="absolute inset-0 bg-green-100 dark:bg-green-900/30 rounded-full animate-ping opacity-20"></div>
								<div className="size-16 bg-[#00a859] rounded-full flex items-center justify-center text-white shadow-lg shadow-green-200 dark:shadow-green-900/50">
									<CheckCircle size={32} strokeWidth={3} />
								</div>
							</div>

							<h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Thành Công!</h3>
							<p className="text-slate-500 dark:text-slate-400 font-medium mb-10 leading-relaxed px-4">
								{editId ? 'Đơn hàng đã được cập nhật thay đổi thành công.' : 'Đơn hàng mới của bạn đã được ghi nhận vào hệ thống.'}
							</p>

							<div className="w-full space-y-3">
								<button
									onClick={onNavigateOrders}
									className="w-full h-14 bg-[#1A237E] dark:bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-900 dark:hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20"
								>
									Xem danh sách đơn
								</button>
								<button
									onClick={() => {
										setShowSuccessModal(false);
										if (!editId) {
											window.location.reload();
										}
									}}
									className="w-full h-14 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-300 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
								>
									{editId ? 'Đóng thông báo' : 'Lên đơn mới'}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
};
