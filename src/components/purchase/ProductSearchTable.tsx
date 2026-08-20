import React, { useState, useEffect, useRef } from 'react';
import { Package, Trash, Search, Plus, X, ChevronDown } from 'lucide-react';

interface ProductSearchTableProps {
    items: any[];
    categories: any[];
    filteredProducts: any[];
    activeRow: number | null;
    setActiveRow: (index: number | null) => void;
    productDropdownRef: React.RefObject<HTMLDivElement | null>;
    productSearchQuery: string;
    setProductSearchQuery: (query: string) => void;
    handleRemoveRow: (id: string) => void;
    updateRow: (id: string, field: string, value: any) => void;
    handleSelectProduct: (rowId: string, product: any) => void;
    handleQuickAddProduct: (rowId: string, name: string) => void;
    handleAddRow: () => void;
    formatCurrency: (val: any) => string;
}

export const ProductSearchTable = ({
    items,
    categories,
    filteredProducts,
    activeRow,
    setActiveRow,
    productDropdownRef,
    productSearchQuery,
    setProductSearchQuery,
    handleRemoveRow,
    updateRow,
    handleSelectProduct,
    handleQuickAddProduct,
    handleAddRow,
    formatCurrency
}: ProductSearchTableProps) => {
    const [activeCatRow, setActiveCatRow] = useState<number | null>(null);
    const [catSearchQuery, setCatSearchQuery] = useState('');
    const catDropdownRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (activeCatRow !== null && catDropdownRef.current && !catDropdownRef.current.contains(event.target as Node)) {
                setActiveCatRow(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeCatRow]);

    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Package size={18} className="text-[#FF6D00]" /> 2. Sản Phẩm Nhập
                </h3>
            </div>

            <div className="space-y-4" ref={productDropdownRef}>
                {items.map((item, index) => (
                    <div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl relative group">
                        {/* Delete Button */}
                        {items.length > 1 && (
                            <button onClick={() => handleRemoveRow(item.id)} className="absolute -top-2.5 -right-2.5 size-9 bg-red-50 dark:bg-red-950 text-red-500 border border-red-200 dark:border-red-900/40 rounded-full flex items-center justify-center shadow-sm md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-all hover:bg-red-100 dark:hover:bg-red-900/20 active:scale-90 cursor-pointer">
                                <Trash size={16} />
                            </button>
                        )}

                    {/* Category Filter */}
                    {categories.length > 1 && (
                        <div className="mb-3 relative" ref={activeCatRow === index ? catDropdownRef : null}>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Danh mục</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={activeCatRow === index ? catSearchQuery : (item.category || 'Tất cả')}
                                    onChange={(e) => {
                                        setCatSearchQuery(e.target.value);
                                    }}
                                    onFocus={() => {
                                        setActiveCatRow(index);
                                        setCatSearchQuery(item.category || 'Tất cả');
                                    }}
                                    placeholder="Tìm hoặc chọn danh mục..."
                                    className="w-full h-10 pl-3 pr-10 bg-white dark:bg-slate-900 border border-slate-350 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white text-sm font-medium"
                                />
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 size-4 pointer-events-none" />
                            </div>

                            {activeCatRow === index && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                    {categories
                                        .filter((cat: string) => 
                                            cat.toLowerCase().includes(catSearchQuery.toLowerCase()) || 
                                            catSearchQuery === ''
                                        )
                                        .map((cat: string) => (
                                            <div
                                                key={cat}
                                                onClick={() => {
                                                    updateRow(item.id, 'category', cat);
                                                    setActiveCatRow(null);
                                                }}
                                                className={`px-3 py-2.5 text-sm cursor-pointer transition-colors hover:bg-orange-50 dark:hover:bg-orange-900/10 font-bold ${
                                                    (item.category || 'Tất cả') === cat 
                                                        ? 'text-[#FF6D00] bg-orange-50/50 dark:bg-orange-900/5' 
                                                        : 'text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                {cat}
                                            </div>
                                        ))}
                                    {categories.filter((cat: string) => 
                                        cat.toLowerCase().includes(catSearchQuery.toLowerCase())
                                    ).length === 0 && (
                                        <div className="px-3 py-3 text-xs text-slate-400 text-center font-bold">
                                            Không tìm thấy danh mục "{catSearchQuery}"
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* Tên sản phẩm */}
                            <div className="md:col-span-6 relative">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên SP (Kho đang có: {item.currentStock || 0})</label>
                                {item.productId ? (
                                    <div className="flex items-center justify-between w-full h-12 px-4 bg-white dark:bg-slate-900 border border-emerald-500 rounded-xl shadow-sm">
                                        <span className="font-bold text-slate-800 dark:text-white whitespace-normal break-words">{item.name}</span>
                                        <button onClick={() => updateRow(item.id, 'productId', '')} className="text-slate-400 hover:text-red-500">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Tìm hoặc chọn tên sản phẩm..."
                                                value={activeRow === index ? productSearchQuery : ''}
                                                onChange={(e) => { setProductSearchQuery(e.target.value); setActiveRow(index); }}
                                                onFocus={() => setActiveRow(index)}
                                                className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
                                            />
                                            {activeRow === index && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto">
                                                    {!productSearchQuery && (
                                                        <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10">
                                                            📋 Gợi ý {filteredProducts.length} sản phẩm gần đây (gõ để lọc)
                                                        </div>
                                                    )}
                                                    {filteredProducts.length > 0 ? (
                                                        <>
                                                        {filteredProducts.map(product => (
                                                            <div
                                                                key={product.id}
                                                                onClick={() => handleSelectProduct(item.id, product)}
                                                                className="p-3 hover:bg-orange-50 dark:hover:bg-orange-900/10 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-0 transition-colors"
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-bold text-slate-800 dark:text-white text-sm whitespace-normal break-words">{product.name}</div>
                                                                        <div className="flex items-center gap-3 mt-1">
                                                                            {product.sku && <span className="text-[10px] text-slate-400 font-mono">{product.sku}</span>}
                                                                            {(product as any).category && (product as any).category !== 'Chưa phân loại' && (
                                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 font-medium">{(product as any).category}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <div className="font-black text-[#FF6D00] text-sm">{formatCurrency(product.priceImport)} đ</div>
                                                                        <div className="text-[10px] text-slate-400">Tồn: <span className={product.stock > 0 ? 'text-emerald-500 font-bold' : 'text-red-400 font-bold'}>{product.stock || 0}</span></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        </>
                                                    ) : (
                                                        <div className="p-4 text-center">
                                                            <p className="text-sm text-slate-500 mb-3">🔍 Không tìm thấy sản phẩm "{productSearchQuery}"</p>
                                                            <button
                                                                onClick={() => handleQuickAddProduct(item.id, productSearchQuery)}
                                                                className="w-full py-2.5 bg-[#FF6D00] text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-[#E66000] transition-colors shadow-lg shadow-orange-500/20"
                                                            >
                                                                <Plus size={16} /> Thêm nhanh "{productSearchQuery}"
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                )}
                            </div>

                            {/* Số lượng */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số lượng</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={item.qty}
                                    onChange={(e) => updateRow(item.id, 'qty', e.target.value)}
                                    className="w-full h-12 px-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white"
                                    placeholder="0"
                                />
                            </div>

                            {/* Giá nhập */}
                            <div className="md:col-span-4">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Giá nhập (Cập nhật nếu đổi)</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={item.priceImport ? Number(item.priceImport).toLocaleString('vi-VN') : ''}
                                        onChange={(e) => updateRow(item.id, 'priceImport', e.target.value.replace(/\D/g, ''))}
                                        className="w-full h-12 pl-4 pr-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white text-right font-bold text-[#FF6D00]"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">đ</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={handleAddRow} className="mt-4 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <Plus size={18} /> Thêm dòng
            </button>
        </div>
    );
};
