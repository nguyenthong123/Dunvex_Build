import React, { useState, useEffect } from 'react';

export interface CustomerDetailModalProps {
    showDetail: boolean;
    setShowDetail: (v: boolean) => void;
    selectedCustomer: any;
    showTaxDetail: boolean;
    setShowTaxDetail: (v: boolean) => void;
    openEdit: (c: any) => void;
    handleDeleteCustomer: (id: string, bypassConfirm?: boolean) => void;
    showToast: (msg: string, type: string) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
    showDetail,
    setShowDetail,
    selectedCustomer,
    showTaxDetail,
    setShowTaxDetail,
    openEdit,
    handleDeleteCustomer,
    showToast
}) => {
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (!showDetail) {
            setConfirmDelete(false);
        }
    }, [showDetail]);

    if (!showDetail || !selectedCustomer) return null;

    return (
        <div className="fixed inset-0 z-[160] bg-white dark:bg-slate-950 flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                <button onClick={() => setShowDetail(false)} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Chi tiết khách hàng</h2>
                <div className="size-10"></div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-2xl mx-auto px-5 py-6">
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="size-16 rounded-2xl bg-gradient-to-br from-[#1A237E] to-[#283593] text-white flex items-center justify-center text-2xl font-black shrink-0 shadow-md shadow-indigo-500/10">
                            {(selectedCustomer.name?.[0] || 'K').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{selectedCustomer.name}</h3>
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">store</span>
                                {selectedCustomer.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className={`size-2 rounded-full ${selectedCustomer.status === 'Hoạt động' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                <span className="text-xs font-bold text-slate-400 uppercase">{selectedCustomer.status}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Info Cards */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Tuyến</p>
                            <p className="text-sm font-bold text-[#1A237E] dark:text-indigo-400 uppercase">{selectedCustomer.route || 'Chưa phân'}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Loại</p>
                            <p className="text-sm font-bold text-[#FF6D00] uppercase">{selectedCustomer.type}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Số điện thoại</p>
                            <a href={`tel:${selectedCustomer.phone}`} className="text-sm font-bold text-[#1A237E] dark:text-indigo-300">{selectedCustomer.phone}</a>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Hạn mức</p>
                            <p className="text-sm font-bold text-rose-500">{(selectedCustomer.creditLimit && selectedCustomer.creditLimit > 0) ? `${selectedCustomer.creditLimit.toLocaleString('vi-VN')}đ` : 'Không GH'}</p>
                        </div>
                    </div>

                    {/* Detail Rows — 2 cột */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                        {/* Email */}
                        <div className="flex items-center gap-3 py-3 border-b border-slate-50 dark:border-slate-900">
                            <span className="material-symbols-outlined text-slate-400">mail</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Email</p>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{selectedCustomer.email || 'Chưa cung cấp'}</p>
                            </div>
                            {selectedCustomer.email && (
                                <button onClick={() => { navigator.clipboard.writeText(selectedCustomer.email); showToast('Đã chép email', 'success'); }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-[#FF6D00] transition-all">
                                    <span className="material-symbols-outlined text-lg">content_copy</span>
                                </button>
                            )}
                        </div>

                        {/* Address */}
                        <div className="flex items-center gap-3 py-3 border-b border-slate-50 dark:border-slate-900">
                            <span className="material-symbols-outlined text-slate-400">location_on</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Địa chỉ công trình</p>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedCustomer.address || 'Chưa cung cấp'}</p>
                            </div>
                        </div>

                        {/* Tax Info — span full width */}
                        <div className="col-span-2 py-3 border-b border-slate-50 dark:border-slate-900">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-slate-400">receipt</span>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Thông tin hóa đơn</p>
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setShowTaxDetail(!showTaxDetail); }} className={`w-11 h-6 rounded-full transition-all duration-300 relative ${showTaxDetail ? 'bg-[#FF6D00]' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                    <div className={`absolute top-1 size-4 bg-white rounded-full transition-all duration-300 ${showTaxDetail ? 'left-6 shadow-sm' : 'left-1'}`}></div>
                                </button>
                            </div>
                            {showTaxDetail && (
                                <div className="mt-3 space-y-3 pl-9 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <p className="text-[10px] font-black text-slate-400 uppercase">Tên đơn vị</p>
                                            <button onClick={() => { navigator.clipboard.writeText(selectedCustomer.taxName || ''); showToast('Đã chép', 'success'); }} className="text-[10px] font-bold text-[#FF6D00] uppercase">Chép</button>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase">{selectedCustomer.taxName || 'Chưa cập nhật'}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="flex items-center justify-between mb-0.5">
                                                <p className="text-[10px] font-black text-slate-400 uppercase">MST</p>
                                                <button onClick={() => { navigator.clipboard.writeText(selectedCustomer.taxCode || ''); showToast('Đã chép', 'success'); }} className="text-[10px] font-bold text-[#FF6D00] uppercase">Chép</button>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedCustomer.taxCode || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-0.5">
                                                <p className="text-[10px] font-black text-slate-400 uppercase">SĐT HĐ</p>
                                                <button onClick={() => { navigator.clipboard.writeText(selectedCustomer.taxPhone || selectedCustomer.phone || ''); showToast('Đã chép', 'success'); }} className="text-[10px] font-bold text-[#FF6D00] uppercase">Chép</button>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedCustomer.taxPhone || selectedCustomer.phone || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <p className="text-[10px] font-black text-slate-400 uppercase">Địa chỉ VAT</p>
                                            <button onClick={() => { navigator.clipboard.writeText(selectedCustomer.taxAddress || ''); showToast('Đã chép', 'success'); }} className="text-[10px] font-bold text-[#FF6D00] uppercase">Chép</button>
                                        </div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 italic">{selectedCustomer.taxAddress || 'Chưa cập nhật'}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Notes + NV phụ trách — 2 cột */}
                        {selectedCustomer.note && (
                            <div className="flex items-start gap-3 py-3 border-b border-slate-50 dark:border-slate-900">
                                <span className="material-symbols-outlined text-amber-500 mt-0.5">sticky_note_2</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Ghi chú</p>
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{selectedCustomer.note}</p>
                                </div>
                            </div>
                        )}

                        {/* NV phụ trách */}
                        <div className={`flex items-center gap-3 py-3 ${!selectedCustomer.note ? 'col-span-2' : ''}`}>
                            <span className="material-symbols-outlined text-slate-400">person</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase">NV phụ trách</p>
                                <p className="text-sm font-medium text-slate-500">{selectedCustomer.createdByEmail || 'N/A'}</p>
                            </div>
                            <span className="text-[10px] font-medium text-slate-300 dark:text-slate-600">{selectedCustomer.createdAt?.seconds ? new Date(selectedCustomer.createdAt.seconds * 1000).toLocaleDateString('vi-VN') : ''}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex-none px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex gap-3 items-center">
                {confirmDelete ? (
                    <div className="flex-1 flex gap-2 items-center bg-rose-50 dark:bg-rose-900/20 p-2.5 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                        <span className="text-[10px] sm:text-xs font-black text-rose-600 dark:text-rose-400 uppercase flex-1 leading-snug">
                            Xác nhận xóa khách hàng này? (Xóa cả lịch sử nợ liên quan)
                        </span>
                        <button 
                            onClick={() => setConfirmDelete(false)} 
                            className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                        >
                            Hủy
                        </button>
                        <button 
                            onClick={() => {
                                setConfirmDelete(false);
                                handleDeleteCustomer(selectedCustomer.id, true);
                            }} 
                            className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md"
                        >
                            Xóa
                        </button>
                    </div>
                ) : (
                    <>
                        <button onClick={() => { setShowDetail(false); openEdit(selectedCustomer); }} className="flex-1 bg-[#1A237E] hover:bg-[#283593] text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm">
                            <span className="material-symbols-outlined text-base">edit</span> Chỉnh sửa
                        </button>
                        <button onClick={() => setConfirmDelete(true)} className="bg-white dark:bg-slate-800 text-rose-500 border border-rose-100 dark:border-rose-900/30 py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-rose-50 dark:hover:bg-rose-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                        {!!(selectedCustomer.lat && selectedCustomer.lng) && (
                            <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedCustomer.lat},${selectedCustomer.lng}`, '_blank')} className="bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm">
                                <span className="material-symbols-outlined text-base">directions</span>
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
