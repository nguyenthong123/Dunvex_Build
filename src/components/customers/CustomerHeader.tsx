import React from 'react';
import { useNavigate } from 'react-router-dom';

export interface CustomerHeaderProps {
    showMobileSearch: boolean;
    setShowMobileSearch: (v: boolean) => void;
    selectedRoute: string;
    setSelectedRoute: (v: string) => void;
    salesRoutes: string[];
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    searchInputRef: React.RefObject<HTMLInputElement>;
    setShowImport: (v: boolean) => void;
    setShowMap: (v: boolean) => void;
    resetForm: () => void;
    setShowAddForm: (v: boolean) => void;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({
    showMobileSearch,
    setShowMobileSearch,
    selectedRoute,
    setSelectedRoute,
    salesRoutes,
    searchTerm,
    setSearchTerm,
    searchInputRef,
    setShowImport,
    setShowMap,
    resetForm,
    setShowAddForm
}) => {
    const navigate = useNavigate();
    return (
        <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 h-16 md:h-20 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300 relative">
            {!showMobileSearch ? (
                <>
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => navigate('/')}
                            className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-[#1A237E] dark:hover:text-indigo-400 transition-all group flex-shrink-0"
                            title="Về Trang Chủ"
                        >
                            <span className="material-symbols-outlined text-xl group-hover:rotate-[-45deg] transition-transform">home</span>
                        </button>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 flex-shrink-0"></div>
                        <h2 className="text-lg md:text-xl font-black text-[#1A237E] dark:text-indigo-400 uppercase tracking-tight truncate">Khách Hàng</h2>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 ml-auto">
                        {/* Route & Search on Desktop */}
                        <div className="hidden lg:flex items-center gap-2">
                            <div className="relative">
                                <select
                                    className="pl-4 pr-10 py-2.5 bg-indigo-50 dark:bg-slate-800 border-none rounded-xl text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/30 appearance-none transition-all cursor-pointer"
                                    value={selectedRoute}
                                    onChange={(e) => setSelectedRoute(e.target.value)}
                                >
                                    <option value="All">Tốt cả Tuyến</option>
                                    {salesRoutes.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-2 text-indigo-300 pointer-events-none text-lg">expand_more</span>
                            </div>

                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">search</span>
                                <input
                                    type="text"
                                    placeholder="Tìm khách hàng..."
                                    className="pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#FF6D00]/30 w-64 transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Search Trigger for Mobile */}
                        <button
                            onClick={() => setShowMobileSearch(true)}
                            className="lg:hidden size-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-[#FF6D00] shadow-sm active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined text-xl">search</span>
                        </button>

                        <button
                            onClick={() => setShowImport(true)}
                            className="hidden lg:flex bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold border border-slate-200 dark:border-slate-800 transition-all items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            <span className="material-symbols-outlined">file_upload</span>
                            <span className="hidden sm:inline">Nhập Excel</span>
                        </button>
                        <button
                            onClick={() => setShowMap(true)}
                            className="size-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-[#FF6D00] hover:bg-[#FF6D00] hover:text-white transition-all shadow-lg shadow-orange-500/10"
                            title="Xem bản đồ"
                        >
                            <span className="material-symbols-outlined">map</span>
                        </button>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                        <button
                            onClick={() => { resetForm(); setShowAddForm(true); }}
                            className="bg-[#FF6D00] hover:bg-orange-600 text-white px-3 md:px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">person_add</span>
                            <span className="hidden lg:inline">Thêm mới</span>
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex items-center gap-3 w-full animate-in slide-in-from-right-4 duration-300">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#FF6D00]">search</span>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Nhập tên, SĐT hoặc cơ sở..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#FF6D00]/30"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => {
                            setShowMobileSearch(false);
                            setSearchTerm('');
                            navigate('/customers', { replace: true });
                        }}
                        className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold"
                    >
                        Đóng
                    </button>
                </div>
            )}
        </header>
    );
};
