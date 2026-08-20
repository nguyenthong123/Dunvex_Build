import React from 'react';
import { Ticket, Eye, EyeOff } from 'lucide-react';

interface OrderSummaryProps {
    couponCode: string;
    setCouponCode: (c: string) => void;
    handleApplyCoupon: () => void;
    shippingFee: number | string;
    setShippingFee: (f: number | string) => void;
    discountAmt: number | string;
    setDiscountAmt: (d: number | string) => void;
    subTotal: number;
    finalTotal: number;
    totalWeight: number;
    totalCostActual: number;
    totalProfitActual: number;
    overheadRate: number;
    hasOverheadItems: boolean;
    isAdmin: boolean;
    showProfitPreview: boolean;
    setShowProfitPreview: (show: boolean) => void;
    handleConfirmOrder: () => void;
    isSubmitting: boolean;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
    couponCode, setCouponCode, handleApplyCoupon,
    shippingFee, setShippingFee,
    discountAmt, setDiscountAmt,
    subTotal, finalTotal, totalWeight,
    totalCostActual, totalProfitActual, overheadRate, hasOverheadItems,
    isAdmin, showProfitPreview, setShowProfitPreview,
    handleConfirmOrder, isSubmitting
}) => {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 md:p-6 transition-colors duration-300">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* ADJUSTMENTS LEFT */}
                <div className="flex-1 space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">ĐIỀU CHỈNH ĐƠN HÀNG</h4>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Mã giảm giá / Voucher</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Ticket size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                    <input
                                        type="text"
                                        autoComplete="off"
                                        placeholder="Nhập mã..."
                                        className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 text-sm font-semibold text-indigo-600 uppercase focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleApplyCoupon}
                                    className="px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10px] uppercase shadow-sm transition-all active:scale-95"
                                >
                                    ÁP DỤNG
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Phí vận chuyển (+)</label>
                            <input
                                type="number"
                                autoComplete="off"
                                placeholder="0"
                                className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-[#f27121]/30 focus:border-[#f27121] transition-all outline-none"
                                value={shippingFee === 0 ? '' : shippingFee}
                                onChange={(e) => setShippingFee(e.target.value === '' ? 0 : Number(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Số tiền Chiết khấu (-)</label>
                            <input
                                type="number"
                                autoComplete="off"
                                placeholder="0"
                                className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-[#f27121]/30 focus:border-[#f27121] transition-all outline-none"
                                value={discountAmt === 0 ? '' : discountAmt}
                                onChange={(e) => setDiscountAmt(e.target.value === '' ? 0 : Number(e.target.value))}
                            />
                        </div>
                    </div>
                </div>

                {/* SUMMARY RIGHT */}
                <div className="flex-1">
                    <div className="space-y-4 text-right mb-10">
                        <div className="flex justify-end gap-12">
                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Tiền hàng:</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white w-32 tabular-nums">{subTotal.toLocaleString('vi-VN')} đ</span>
                        </div>
                        {Number(shippingFee) > 0 && (
                            <div className="flex justify-end gap-12">
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Phí vận chuyển:</span>
                                <span className="text-sm font-black text-slate-900 dark:text-white w-32 tabular-nums">+{Number(shippingFee).toLocaleString('vi-VN')} đ</span>
                            </div>
                        )}
                        {Number(discountAmt) > 0 && (
                            <div className="flex justify-end gap-12">
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Chiết khấu:</span>
                                <span className="text-sm font-black text-rose-600 w-32 tabular-nums">-{Number(discountAmt).toLocaleString('vi-VN')} đ</span>
                            </div>
                        )}
                        <div className="flex justify-end gap-12">
                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng trọng lượng:</span>
                            <span className="text-sm font-black text-[#1a237e] dark:text-indigo-400 w-32 tabular-nums">{totalWeight.toFixed(2)} kg</span>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-4xl md:text-[56px] font-black text-[#00a859] leading-none mb-4 md:mb-6 tracking-tighter tabular-nums flex items-baseline justify-end gap-2">
                            {finalTotal.toLocaleString('vi-VN')} <span className="text-xl">đ</span>
                        </div>

                        {isAdmin && (
                            <div className="flex flex-col items-end mb-8">
                                <button
                                    onClick={() => setShowProfitPreview(!showProfitPreview)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${showProfitPreview ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}
                                >
                                    {showProfitPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                                    {showProfitPreview ? 'Ẩn Lợi Nhuận' : 'Xem Lợi Nhuận Dự Kiến'}
                                </button>

                                {showProfitPreview && (
                                    <div className="mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl animate-in slide-in-from-right-5 duration-300">
                                        <div className="flex flex-col gap-1 items-end">
                                            <div className="flex items-center gap-4">
                                                <span className="text-[10px] font-bold text-indigo-400 uppercase">Giá vốn ước tính:</span>
                                                <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                    {totalCostActual.toLocaleString('vi-VN')} đ
                                                    {hasOverheadItems && (
                                                        <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-[9px] font-bold">+{overheadRate}% CP</span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-[10px] font-bold text-indigo-400 uppercase">Lợi nhuận ước tính:</span>
                                                <span className="text-lg font-black text-[#1A237E] dark:text-indigo-400">{totalProfitActual.toLocaleString('vi-VN')} đ</span>
                                            </div>
                                            <div className="mt-1 px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-[9px] font-black">
                                                BIÊN LỢI NHUẬN: {finalTotal > 0 ? ((totalProfitActual / finalTotal) * 100).toFixed(1) : 0}%
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            onClick={handleConfirmOrder}
                            disabled={isSubmitting}
                            className="hidden md:flex items-center justify-center w-[300px] ml-auto h-12 bg-[#1A237E] hover:bg-[#121858] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-xl font-bold text-sm uppercase tracking-wider shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN LÊN ĐƠN'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderSummary;
