import React from 'react';
import { Store, Search, X } from 'lucide-react';

interface SupplierSelectionProps {
    selectedSupplier: any;
    setSelectedSupplier: (supplier: any) => void;
    supplierSearchRef: React.RefObject<HTMLDivElement | null>;
    supplierSearchQuery: string;
    setSupplierSearchQuery: (query: string) => void;
    showSupplierResults: boolean;
    setShowSupplierResults: (show: boolean) => void;
    filteredSuppliers: any[];
}

export const SupplierSelection = ({
    selectedSupplier,
    setSelectedSupplier,
    supplierSearchRef,
    supplierSearchQuery,
    setSupplierSearchQuery,
    showSupplierResults,
    setShowSupplierResults,
    filteredSuppliers
}: SupplierSelectionProps) => {
    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                <Store size={18} className="text-[#FF6D00]" /> 1. Chọn Nhà Cung Cấp
            </h3>
            <div className="relative" ref={supplierSearchRef}>
                {selectedSupplier ? (
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                        <div>
                            <div className="font-bold text-slate-800 dark:text-white">{selectedSupplier.name}</div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedSupplier.phone || 'Không có SĐT'}</div>
                        </div>
                        <button onClick={() => setSelectedSupplier(null)} className="p-2 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                            <X size={18} />
                        </button>
                    </div>
                ) : (
                    <div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Tìm kiếm nhà cung cấp..."
                                value={supplierSearchQuery}
                                onChange={(e) => { setSupplierSearchQuery(e.target.value); setShowSupplierResults(true); }}
                                onFocus={() => setShowSupplierResults(true)}
                                className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
                            />
                        </div>
                        {showSupplierResults && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                                {filteredSuppliers.map(supplier => (
                                    <div
                                        key={supplier.id}
                                        onClick={() => { setSelectedSupplier(supplier); setShowSupplierResults(false); setSupplierSearchQuery(''); }}
                                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                                    >
                                        <div className="font-bold text-slate-800 dark:text-white">{supplier.name}</div>
                                        <div className="text-sm text-slate-500">{supplier.phone}</div>
                                    </div>
                                ))}
                                {filteredSuppliers.length === 0 && (
                                    <div className="p-4 text-center text-slate-500">
                                        Không tìm thấy nhà cung cấp này. 
                                        <span className="text-[#FF6D00] font-bold block mt-1">Gợi ý: Cần qua mục Nhà Cung Cấp để tạo mới trước.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
