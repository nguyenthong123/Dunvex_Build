import React from 'react';
import { ChevronDown, CheckCircle, Package, Trash2, Plus, QrCode } from 'lucide-react';

interface OrderLineItemsProps {
    lineItems: any[];
    updateLineItem: (index: number, field: string, value: any) => void;
    removeLineItem: (index: number) => void;
    addLineItem: () => void;
    activeRow: number | null;
    setActiveRow: (index: number | null) => void;
    activeField: string | null;
    setActiveField: (field: string | null) => void;
    dropdownRef: React.RefObject<HTMLDivElement | null>;
    lineSearchQuery: string;
    setLineSearchQuery: (query: string) => void;
    categories: any[];
    products: any[];
    getEffectiveStock: (product: any) => number;
    copyToClipboard: (text: string, label: string) => void;
    setShowScanner: (show: boolean) => void;
    normalizeText: (text: string) => string;
    isMatch: (str: string, query: string) => boolean;
}

const OrderLineItems: React.FC<OrderLineItemsProps> = ({
    lineItems, updateLineItem, removeLineItem, addLineItem,
    activeRow, setActiveRow,
    activeField, setActiveField,
    dropdownRef,
    lineSearchQuery, setLineSearchQuery,
    categories, products,
    getEffectiveStock, copyToClipboard, setShowScanner,
    normalizeText, isMatch
}) => {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300 relative z-10">
            <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">DANH SÁCH SẢN PHẨM</h3>
            </div>
            <div className="p-4 md:p-6">
                {/* DESKTOP HEADER - HIDDEN ON MOBILE */}
                <div className="hidden md:grid md:grid-cols-[110px_1.5fr_80px_1.2fr_40px] lg:grid-cols-[130px_1fr_90px_1.2fr_40px] gap-3 lg:gap-4 mb-2.5 text-[9px] lg:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800 pb-2.5">
                    <div>DANH MỤC</div>
                    <div>SẢN PHẨM</div>
                    <div className="text-center">SỐ LƯỢNG</div>
                    <div>ĐƠN GIÁ / TỔNG</div>
                    <div></div>
                </div>

                {/* LIST OF ITEMS */}
                <div className="space-y-6 md:space-y-0">
                    {lineItems.map((item, index) => (
                        <div key={index} className="group relative bg-[#fcfdfe] dark:bg-slate-800/30 md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border border-slate-100 dark:border-slate-800/50 md:border-t-0 md:border-x-0 md:border-b md:border-slate-100 md:dark:border-slate-800 md:grid md:grid-cols-[110px_1.5fr_80px_1.2fr_40px] lg:grid-cols-[130px_1fr_90px_1.2fr_40px] gap-3 lg:gap-4 md:items-start md:py-3.5 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-all">
                                    {/* SELECTION AREA (CATEGORY & PRODUCT) */}
                                    <div className="grid grid-cols-1 md:contents gap-4">
                                        {/* CATEGORY SELECT */}
                                        <div className="relative" ref={activeRow === index && activeField === 'category' ? dropdownRef : null}>
                                    <label className="md:hidden text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-1.5 block ml-1">DANH MỤC</label>
                                    <div
                                        className="w-full h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 flex items-center justify-between cursor-pointer hover:border-[#1A237E] transition-all"
                                        onClick={() => {
                                            setActiveRow(index);
                                            setActiveField('category');
                                            setLineSearchQuery('');
                                        }}
                                    >
                                        <span className={`text-[10px] lg:text-[12px] font-semibold break-words whitespace-normal ${item.category ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
                                            {item.category || 'Tìm danh mục...'}
                                        </span>
                                        <ChevronDown size={14} className="text-slate-300 shrink-0 hidden lg:block" />
                                    </div>

                                    {activeRow === index && activeField === 'category' && (
                                        <div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden min-w-[280px]">
                                            <div className="p-2 border-b border-slate-50 dark:border-slate-700">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Gõ để tìm nhanh..."
                                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-base font-bold focus:ring-0"
                                                    value={lineSearchQuery}
                                                    onChange={(e) => setLineSearchQuery(e.target.value)}
                                                />
                                            </div>
                                            <div className="max-h-64 overflow-y-auto py-2 overscroll-contain custom-scrollbar border-b border-slate-50 dark:border-slate-700/50">
                                                <div
                                                    className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-xs font-bold text-slate-400 border-b border-slate-50 dark:border-slate-700"
                                                    onClick={() => {
                                                        updateLineItem(index, 'category', '');
                                                        setActiveRow(null);
                                                        setActiveField(null);
                                                    }}
                                                >
                                                    -- Tất cả danh mục --
                                                </div>
                                                {categories
                                                    .filter(cat => String(cat).toLowerCase().includes(lineSearchQuery.toLowerCase()))
                                                    .map(cat => (
                                                        <div
                                                            key={cat}
                                                            className="px-5 py-4 hover:bg-[#1A237E]/5 dark:hover:bg-indigo-500/10 hover:text-[#1A237E] cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between transition-colors"
                                                            onClick={() => {
                                                                 updateLineItem(index, 'category', cat);
                                                                 setActiveRow(null);
                                                                 setActiveField(null);
                                                            }}
                                                        >
                                                            {cat}
                                                            {item.category === cat && <CheckCircle size={14} className="text-[#1A237E]" />}
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {item.unit && (
                                        <div className="mt-1.5 pl-1 select-none">
                                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md leading-none" title={`Đơn vị tính: ${item.unit}`}>
                                                ĐVT: {item.unit}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* PRODUCT SELECT */}
                                <div className="relative md:pl-0" ref={activeRow === index && activeField === 'productId' ? dropdownRef : null}>
                                    <label className="md:hidden text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-1.5 block ml-1">SẢN PHẨM</label>
                                    <div
                                        className="w-full h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 flex items-center justify-between cursor-pointer hover:border-[#1A237E] transition-all"
                                        onClick={() => {
                                            setActiveRow(index);
                                            setActiveField('productId');
                                            setLineSearchQuery('');
                                        }}
                                    >
                                        <div className="flex items-center gap-1.5 w-full min-w-0 overflow-hidden">
                                            <span className={`text-[11px] lg:text-xs font-semibold truncate ${item.name ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
                                                {item.name || 'Tìm sản phẩm...'}
                                            </span>
                                            {item.serialNumber && (
                                                <span className="shrink-0 text-[9px] font-black text-[#B48C00] uppercase bg-amber-50 dark:bg-amber-900/30 px-1 py-0.5 rounded">
                                                    SN:{item.serialNumber}
                                                </span>
                                            )}
                                        </div>
                                        <ChevronDown size={14} className="text-slate-300 shrink-0 hidden lg:block ml-1" />
                                    </div>

                                    {item.specification && (
                                        <div className="mt-1.5 pl-1 select-none">
                                            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-md leading-none max-w-[200px] truncate" title={`Quy cách: ${item.specification}`}>
                                                QC: {item.specification}
                                            </span>
                                        </div>
                                    )}

                                    {activeRow === index && activeField === 'productId' && (
                                        <div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden min-w-[320px] md:min-w-[400px]">
                                            <div className="p-2 border-b border-slate-50 dark:border-slate-700">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Tìm theo tên, SKU hoặc Số Seri..."
                                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-base font-bold focus:ring-0"
                                                    value={lineSearchQuery}
                                                    onChange={(e) => setLineSearchQuery(e.target.value)}
                                                />
                                            </div>
                                            <div className="max-h-80 overflow-y-auto py-2 overscroll-contain custom-scrollbar border-b border-slate-50 dark:border-slate-700/50">
                                                {(() => {
                                                     const normalizedSearch = normalizeText(lineSearchQuery);
                                                     const currentCategory = normalizeText(item.category);

                                                     const matches = products.filter(p => {
                                                          const isCatMatch = !item.category || normalizeText(p.category) === currentCategory;
                                                          const isProductMatch = isMatch(p.name || '', lineSearchQuery) ||
                                                              isMatch(p.sku || '', lineSearchQuery) ||
                                                              isMatch(p.serialNumber || '', lineSearchQuery) ||
                                                              isMatch(p.category || '', lineSearchQuery) ||
                                                              isMatch(p.note || '', lineSearchQuery) ||
                                                              isMatch(p.specification || '', lineSearchQuery) ||
                                                              isMatch(p.packaging || '', lineSearchQuery) ||
                                                              isMatch(p.density || '', lineSearchQuery);
                                                          return isCatMatch && isProductMatch;
                                                      });

                                                      return matches
                                                          .sort((a, b) => {
                                                              const aStarts = normalizeText(a.name).startsWith(normalizedSearch);
                                                              const bStarts = normalizeText(b.name).startsWith(normalizedSearch);
                                                              if (aStarts && !bStarts) return -1;
                                                              if (!aStarts && bStarts) return 1;
                                                              return a.name.localeCompare(b.name);
                                                          })
                                                          .slice(0, 50)
                                                          .map(p => {
                                                            const effStock = getEffectiveStock(p);
                                                            return (
                                                                <div
                                                                    key={p.id}
                                                                    className={`px-5 py-4 hover:bg-[#1A237E]/5 dark:hover:bg-indigo-500/10 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-none transition-all flex items-center justify-between group/prod`}
                                                                    onClick={() => {
                                                                        updateLineItem(index, 'productId', p.id);
                                                                        setActiveRow(null);
                                                                        setActiveField(null);
                                                                    }}
                                                                >
                                                                    <div className="flex flex-col gap-1 max-w-[70%]">
                                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 group-hover/prod:text-[#1A237E] dark:group-hover/prod:text-indigo-400 transition-colors uppercase leading-tight line-clamp-2">{p.name}</span>
                                                                        {p.serialNumber && (
                                                                            <span className="text-[9px] font-black text-[#B48C00] uppercase leading-none">
                                                                                SN: {p.serialNumber}
                                                                            </span>
                                                                        )}
                                                                        {p.specification && (
                                                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
                                                                                QC: {p.specification}
                                                                            </span>
                                                                        )}
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-black text-slate-500 uppercase">
                                                                                {p.sku || 'N/A'}
                                                                            </span>
                                                                            <span className="text-[9px] font-bold text-slate-400">{p.unit}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-xs font-black text-[#f27121] mb-0.5">{p.priceSell.toLocaleString('vi-VN')} đ</div>
                                                                        <div className={`text-[9px] font-black uppercase tracking-widest ${effStock > 0 ? 'text-green-500' : 'text-rose-500'}`}>
                                                                            {effStock > 0 ? `TỒN: ${effStock}` : 'HẾT HÀNG'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* NUMERIC AREA (QTY & PRICE) */}
                            <div className="grid grid-cols-2 md:contents gap-2 lg:gap-3 mt-4 md:mt-0">

                                {/* QUANTITY */}
                                <div className="flex flex-col md:items-center">
                                    <label className="md:hidden text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-1.5 block ml-1">SỐ LƯỢNG</label>
                                    <div className="relative w-full">
                                        <input
                                            type="number"
                                            step="any"
                                            className="w-full h-10 px-2 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-[#f27121]/30 focus:border-[#f27121] transition-all outline-none"
                                            value={item.qty}
                                            onChange={(e) => updateLineItem(index, 'qty', e.target.value)}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                             {/* PRICE */}
                                <div className="flex flex-col">
                                    <label className="md:hidden text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-1.5 block ml-1">ĐƠN GIÁ</label>
                                    <div className="relative w-full">
                                        <input
                                            type="number"
                                            className="w-full h-10 px-2 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-[#1A237E]/30 focus:border-[#1A237E] transition-all outline-none"
                                            value={item.price === 0 ? '' : item.price}
                                            onChange={(e) => updateLineItem(index, 'price', e.target.value === '' ? 0 : Number(e.target.value))}
                                            placeholder="Giá"
                                        />
                                    </div>

                                    {/* Desktop-only Package & Item Total labels directly below the input */}
                                    <div className="hidden md:flex items-center justify-between gap-1.5 mt-1.5 px-1 select-none text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                        <span className="flex items-center gap-0.5">
                                            Kiện: {(() => {
                                                const pkg = parseFloat(item.packaging) || 0;
                                                if (pkg <= 0) return '0';
                                                return (Number(item.qty) / pkg).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
                                            })()}
                                            {item.aiValidated && <Package size={10} className="text-slate-400" />}
                                        </span>
                                        <span className="text-[10px] font-black text-[#f27121] tabular-nums">
                                            = {(Number(item.price) * Number(item.qty || 0)).toLocaleString('vi-VN')} đ
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* MOBILE ONLY TOTAL PER ITEM - HIDDEN ON DESKTOP */}
                            <div className="md:hidden mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">THÀNH TIỀN</span>
                                    <span className="text-[10px] font-bold text-slate-300 uppercase flex items-center gap-1">
                                        Kiện: {(() => {
                                            const pkg = parseFloat(item.packaging) || 0;
                                            if (pkg <= 0) return '0';
                                            return (Number(item.qty) / pkg).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
                                        })()} KIỆN
                                        {item.aiValidated && (
                                            <Package size={8} className="text-slate-400" />
                                        )}
                                    </span>
                                </div>
                                <span className="text-base font-black text-[#f27121] tabular-nums">
                                    {(Number(item.price) * Number(item.qty || 0)).toLocaleString('vi-VN')} đ
                                </span>
                            </div>

                            {/* REMOVE BUTTON */}
                            <div className="absolute top-2 right-2 md:static md:flex md:justify-end">
                                <button
                                    onClick={() => removeLineItem(index)}
                                    className="size-9 md:size-10 rounded-xl flex items-center justify-center text-rose-500 bg-rose-50 dark:bg-rose-900/20 md:bg-transparent md:text-slate-200 md:dark:text-slate-700 md:hover:bg-rose-50 md:dark:hover:bg-rose-900/20 md:hover:text-rose-500 transition-all active:scale-90"
                                    title="Xóa dòng"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ADD BUTTONS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    <button
                        onClick={addLineItem}
                        className="group relative h-16 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-3 transition-all hover:border-[#f27121] hover:bg-orange-50/30 dark:hover:bg-orange-950/10 active:scale-[0.98]"
                    >
                        <div className="size-8 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-[#f27121] group-hover:scale-110 transition-transform">
                            <Plus size={18} strokeWidth={3} />
                        </div>
                        <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Thêm Sản Phẩm</span>
                    </button>

                    <button
                        onClick={() => setShowScanner(true)}
                        className="group relative h-16 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-3 transition-all hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 active:scale-[0.98]"
                    >
                        <div className="size-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                            <QrCode size={18} strokeWidth={3} />
                        </div>
                        <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Quét Mã QR</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderLineItems;
