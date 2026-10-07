import React from 'react';

interface OrderFooterProps {
	finalTotal: number;
	editId?: string;
	handleConfirmOrder: () => void;
	isSubmitting: boolean;
	showSuccessModal?: boolean;
	setShowSuccessModal?: (show: boolean) => void;
	onNavigateOrders?: () => void;
}

export const OrderFooter: React.FC<OrderFooterProps> = ({
	finalTotal,
	editId,
	handleConfirmOrder,
	isSubmitting,
}) => {
	return (
		/* STICKY BOTTOM BAR FOR MOBILE */
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
				{isSubmitting 
					? (editId ? 'ĐANG LƯU...' : 'ĐANG LÊN ĐƠN...') 
					: (editId ? 'LƯU THAY ĐỔI' : 'XÁC NHẬN LÊN ĐƠN')}
			</button>
		</div>
	);
};
