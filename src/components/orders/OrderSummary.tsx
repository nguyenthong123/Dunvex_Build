import React, { useState } from 'react';
import { Ticket, Eye, EyeOff, X, Check, Gift, Tag, Sparkles } from 'lucide-react';

interface OrderSummaryProps {
    couponCode: string;
    setCouponCode: (c: string) => void;
    handleApplyCoupon: () => void;
    appliedCoupon?: any;
    availableCoupons?: any[];
    handleSelectCoupon?: (coupon: any) => void;
    handleRemoveCoupon?: () => void;
    appliedRebate?: any;
    handleRemoveRebate?: () => void;
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
    appliedCoupon, availableCoupons = [], handleSelectCoupon, handleRemoveCoupon,
    appliedRebate, handleRemoveRebate,
    shippingFee, setShippingFee,
    discountAmt, setDiscountAmt,
    subTotal, finalTotal, totalWeight,
    totalCostActual, totalProfitActual, overheadRate, hasOverheadItems,
    isAdmin, showProfitPreview, setShowProfitPreview,
    handleConfirmOrder, isSubmitting
}) => {
    const [showVoucherModal, setShowVoucherModal] = useState(false);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 md:p-6 transition-colors duration-300">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* ADJUSTMENTS LEFT */}
                <div className="flex-1 space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">ĐIỀU CHỈNH ĐƠN HÀNG</h4>
                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center justify-between ml-1 mb-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Mã giảm giá / Voucher</label>
                                {availableCoupons.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowVoucherModal(true)}
                                        className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 uppercase"
                                    >
                                        <Sparkles size={12} /> Chọn mã ({availableCoupons.length})
                                    </button>
                                )}
                            </div>
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
                                    className="px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10px] uppercase shadow-sm transition-all active:scale-95 shrink-0"
                                >
                                    ÁP DỤNG
                                </button>
                            </div>

                            {/* Banner mã coupon đang áp dụng */}
                            {appliedCoupon && (
                                <div className="mt-2.5 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between gap-2 animate-fadeIn">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Tag size={16} className="text-emerald-600 shrink-0" />
                                        <div className="truncate">
                                            <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 truncate">
                                                [{appliedCoupon.code}] {appliedCoupon.title}
                                            </p>
                                            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                {appliedCoupon.scope === 'product' ? 'Chiết khấu sản phẩm' : 'Chiết khấu toàn đơn'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRemoveCoupon}
                                        className="px-2.5 py-1 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 text-[10px] font-black rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-50 shrink-0"
                                    >
                                        Gỡ mã
                                    </button>
                                </div>
                            )}

                            {/* Banner chiết khấu trả sau của khách hàng */}
                            {appliedRebate && (
                                <div className="mt-2.5 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-2 animate-fadeIn">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Sparkles size={16} className="text-[#FF6D00] shrink-0" />
                                        <div className="truncate">
                                            <p className="text-xs font-black text-amber-900 dark:text-amber-200 truncate">
                                                Chiết khấu trả sau: {appliedRebate.customerName}
                                            </p>
                                            <p className="text-[10px] font-semibold text-[#FF6D00]">
                                                Trừ {Number(appliedRebate.rebateAmount).toLocaleString('vi-VN')}đ (Lượt {appliedRebate.usedCount || 0}/{appliedRebate.maxUsage || 1})
                                            </p>
                                        </div>
                                    </div>
                                    {handleRemoveRebate && (
                                        <button
                                            type="button"
                                            onClick={handleRemoveRebate}
                                            className="px-2.5 py-1 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 text-[10px] font-black rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-50 shrink-0"
                                        >
                                            Gỡ CK
                                        </button>
                                    )}
                                </div>
                            )}
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

            {/* Voucher Selector Modal */}
            {showVoucherModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                            <div className="flex items-center gap-2">
                                <Gift className="text-indigo-600 dark:text-indigo-400" size={20} />
                                <h3 className="font-black text-slate-800 dark:text-white uppercase text-base">Voucher & Ưu đãi có sẵn</h3>
                            </div>
                            <button onClick={() => setShowVoucherModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="overflow-y-auto space-y-3 flex-1 pr-1">
                            {availableCoupons.length > 0 ? (
                                availableCoupons.map((coupon: any) => {
                                    const isApplied = appliedCoupon?.id === coupon.id || couponCode.toUpperCase() === coupon.code?.toUpperCase();
                                    return (
                                        <div
                                            key={coupon.id}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                                                isApplied
                                                    ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                                                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 hover:border-indigo-400'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm tracking-wide">
                                                            {coupon.code}
                                                        </span>
                                                        <span className="text-[9px] font-black uppercase tracking-tight px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                            {coupon.scope === 'product' ? `Theo SP (${coupon.targetProductIds?.length || 0})` : 'Toàn đơn'}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-xs font-bold text-slate-800 dark:text-white mt-1">{coupon.title}</h4>
                                                    {coupon.description && (
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{coupon.description}</p>
                                                    )}
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                        {coupon.type === 'percentage' ? `-${coupon.discount}%` : `-${Number(coupon.discount).toLocaleString('vi-VN')}đ`}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                                                <span className="text-[10px] text-slate-400 font-semibold">
                                                    Hạn: {coupon.expiry || 'Vô thời hạn'}
                                                </span>
                                                {isApplied ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (handleRemoveCoupon) handleRemoveCoupon();
                                                            setShowVoucherModal(false);
                                                        }}
                                                        className="px-3 py-1.5 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 text-[10px] font-black rounded-xl hover:bg-rose-200"
                                                    >
                                                        Gỡ áp dụng
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (handleSelectCoupon) handleSelectCoupon(coupon);
                                                            setShowVoucherModal(false);
                                                        }}
                                                        className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 shadow-sm"
                                                    >
                                                        Áp dụng ngay
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-center text-xs text-slate-400 py-8 italic">Không có voucher nào đang khả dụng</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderSummary;
