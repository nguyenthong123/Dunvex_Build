import React from 'react';

export const TableSkeleton = () => (
    <>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <tr key={i} className="animate-pulse">
                <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full skeleton" />
                        <div className="space-y-2">
                            <div className="w-40 h-4 skeleton" />
                            <div className="w-20 h-3 skeleton opacity-50" />
                        </div>
                    </div>
                </td>
                <td className="py-4 px-6">
                    <div className="w-24 h-4 skeleton" />
                </td>
                <td className="py-4 px-6">
                    <div className="w-20 h-6 rounded-full skeleton" />
                </td>
                <td className="py-4 px-6">
                    <div className="w-16 h-4 skeleton mx-auto" />
                </td>
                <td className="py-4 px-6">
                    <div className="w-16 h-4 skeleton mx-auto opacity-50" />
                </td>
                <td className="py-4 px-6">
                    <div className="flex justify-end gap-2">
                        <div className="w-8 h-8 rounded-lg skeleton" />
                        <div className="w-8 h-8 rounded-lg skeleton" />
                    </div>
                </td>
            </tr>
        ))}
    </>
);

export interface CustomerDesktopTableProps {
    loading: boolean;
    paginatedCustomers: any[];
    openDetail: (c: any) => void;
    deleteConfirmId: string | null;
    setDeleteConfirmId: (id: string | null) => void;
    handleDeleteCustomer: (id: string, bypassConfirm: boolean) => void;
    openEdit: (c: any) => void;
}

export const CustomerDesktopTable: React.FC<CustomerDesktopTableProps> = ({
    loading,
    paginatedCustomers,
    openDetail,
    deleteConfirmId,
    setDeleteConfirmId,
    handleDeleteCustomer,
    openEdit
}) => {
    return (
        <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-x-auto custom-scrollbar overflow-y-hidden transition-colors duration-300">
            <table className="w-full text-left min-w-[800px]">
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Khách hàng</th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Liên hệ</th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Phân loại</th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-center">Tuyến</th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-center">Trạng thái</th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {loading ? (
                        <TableSkeleton />
                    ) : paginatedCustomers.length === 0 ? (
                        <tr><td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium tracking-wide">Không tìm thấy khách hàng nào</td></tr>
                    ) : paginatedCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => openDetail(customer)}>
                            <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black text-xs border border-blue-200 dark:border-blue-800">
                                        {(customer.name || 'K')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-900 dark:text-indigo-400 uppercase tracking-tight">{customer.name}</div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-500 font-black tracking-widest">
                                            {`#${customer.id.slice(-6)}`}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="py-4 px-6 font-medium text-slate-600 dark:text-slate-300">{customer.phone}</td>
                            <td className="py-4 px-6">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-50 dark:bg-orange-900/20 text-[#FF6D00] dark:text-orange-400 uppercase tracking-wider">
                                    {customer.type}
                                </span>
                            </td>
                            <td className="py-4 px-6 text-center">
                                {customer.route ? (
                                    <span className="px-2 py-0.5 text-[9px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg uppercase border border-indigo-100 dark:border-indigo-800">
                                        {customer.route}
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-bold text-slate-300 dark:text-slate-700 italic">--</span>
                                )}
                            </td>
                            <td className="py-4 px-6 text-center">
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded uppercase">
                                    {customer.status}
                                </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                    {deleteConfirmId === customer.id ? (
                                        <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-900/20 p-1 rounded-lg border border-rose-100 dark:border-rose-900/30 animate-in fade-in zoom-in duration-200">
                                            <button
                                                onClick={() => setDeleteConfirmId(null)}
                                                className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white dark:bg-slate-800 rounded shadow-sm"
                                            >
                                                Hủy
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleDeleteCustomer(customer.id, true);
                                                    setDeleteConfirmId(null);
                                                }}
                                                className="px-2 py-1 text-[10px] font-bold text-white bg-rose-500 hover:bg-rose-600 rounded shadow-sm"
                                            >
                                                Xác nhận
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button onClick={() => openEdit(customer)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                            </button>
                                            <button onClick={() => setDeleteConfirmId(customer.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
