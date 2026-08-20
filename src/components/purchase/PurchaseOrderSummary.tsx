import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface PurchaseOrderSummaryProps {
    orderNote: string;
    setOrderNote: (note: string) => void;
    subTotal: number;
    shippingFee: string;
    setShippingFee: (fee: string) => void;
    totalAmount: number;
    paidAmount: string;
    setPaidAmount: (amount: string) => void;
    unpaidAmount: number;
    handleSubmit: () => void;
    editingPO: any;
    formatCurrency: (val: any) => string;
}

export const PurchaseOrderSummary = ({
    orderNote,
    setOrderNote,
    subTotal,
    shippingFee,
    setShippingFee,
    totalAmount,
    paidAmount,
    setPaidAmount,
    unpaidAmount,
    handleSubmit,
    editingPO,
    formatCurrency
}: PurchaseOrderSummaryProps) => {
    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-8">
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ghi chú phiếu nhập</label>
                    <input
                        type="text"
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
                        placeholder="Ví dụ: Nhập hàng đợt 1 tháng 11..."
                    />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Cộng tiền hàng:</span>
                        <span className="font-bold text-slate-800 dark:text-white text-base">{formatCurrency(subTotal)} đ</span>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Phí vận chuyển:</span>
                        <div className="relative w-48">
                            <input
                                type="text"
                                value={shippingFee}
                                onChange={(e) => setShippingFee(e.target.value ? Number(e.target.value.replace(/\D/g, '')).toLocaleString('vi-VN') : '')}
                                className="w-full h-10 pl-4 pr-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white text-right font-bold text-slate-700 dark:text-slate-300"
                                placeholder="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">đ</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-dotted border-slate-200 dark:border-slate-700 pt-2">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Tổng thanh toán:</span>
                        <span className="font-bold text-slate-800 dark:text-white text-lg">{formatCurrency(totalAmount)} đ</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Tiền trả ngay NCC:</span>
                        <div className="relative w-48">
                            <input
                                type="text"
                                value={paidAmount}
                                onChange={(e) => setPaidAmount(e.target.value ? Number(e.target.value.replace(/\D/g, '')).toLocaleString('vi-VN') : '')}
                                className="w-full h-10 pl-4 pr-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white text-right font-bold text-emerald-600 dark:text-emerald-400"
                                placeholder="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">đ</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-300 font-black uppercase">Còn nợ lại:</span>
                        <span className="font-black text-red-600 dark:text-red-400 text-xl">{formatCurrency(unpaidAmount)} đ</span>
                    </div>
                </div>

                <button type="button"
                    onClick={handleSubmit}
                    className="w-full mt-6 py-4 bg-[#FF6D00] text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:bg-[#E66000] active:scale-[0.98] transition-all flex justify-center items-center gap-2 uppercase tracking-wide text-lg"
                >
                    <CheckCircle2 size={24} /> {editingPO ? 'Cập Nhật Đơn Nhập' : 'Hoàn Thành Nhập Kho'}
                </button>
            </div>
        </div>
    );
};
