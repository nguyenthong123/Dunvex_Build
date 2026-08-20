import React from 'react';

export interface CustomerPaginationProps {
    loading: boolean;
    totalPages: number;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    getPageNumbers: () => (number | string)[];
    filteredCustomersLength: number;
    ITEMS_PER_PAGE: number;
}

export const CustomerPagination: React.FC<CustomerPaginationProps> = ({
    loading,
    totalPages,
    currentPage,
    setCurrentPage,
    getPageNumbers,
    filteredCustomersLength,
    ITEMS_PER_PAGE
}) => {
    if (loading || totalPages <= 1) return null;

    return (
        <>
            {/* Pagination UI - Desktop */}
            <div className="hidden md:flex items-center justify-between mt-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-500 p-2">
                    Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredCustomersLength)} của {filteredCustomersLength} khách hàng
                </div>
                <div className="flex gap-2">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    {getPageNumbers().map((page, idx) => (
                        <button
                            key={idx}
                            onClick={() => typeof page === 'number' && setCurrentPage(page)}
                            disabled={page === '...'}
                            className={`size-10 rounded-xl font-black text-xs transition-all ${page === currentPage
                                ? 'bg-[#1A237E] text-white shadow-lg shadow-blue-500/20'
                                : page === '...'
                                    ? 'text-slate-400 cursor-default'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            {page}
                        </button>
                    ))}
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                </div>
            </div>

            {/* Pagination UI - Mobile */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 mt-4 md:hidden">
                <button
                    disabled={currentPage === 1}
                    onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev - 1); window.scrollTo(0, 0); }}
                    className="size-12 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30"
                >
                    <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <div className="text-sm font-black text-[#1A237E] dark:text-indigo-400">
                    Trang {currentPage} / {totalPages}
                </div>
                <button
                    disabled={currentPage === totalPages}
                    onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev + 1); window.scrollTo(0, 0); }}
                    className="size-12 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 disabled:opacity-30"
                >
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>
            </div>
        </>
    );
};
