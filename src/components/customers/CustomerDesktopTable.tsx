import React from 'react';
import { Phone, PhoneCall, Copy, MapPin, Edit, Trash2 } from 'lucide-react';
import { ApprovalBadge } from '../shared/ApprovalBadge';

export const TableSkeleton = () => (
    <>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <tr key={i} className="animate-pulse">
                <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                        <div className="size-11 rounded-full skeleton" />
                        <div className="space-y-2">
                            <div className="w-40 h-4 skeleton" />
                            <div className="w-20 h-3 skeleton opacity-50" />
                        </div>
                    </div>
                </td>
                <td className="py-4 px-6">
                    <div className="w-28 h-4 skeleton" />
                </td>
                <td className="py-4 px-6">
                    <div className="w-24 h-6 rounded-full skeleton" />
                </td>
                <td className="py-4 px-6">
                    <div className="w-20 h-4 skeleton mx-auto opacity-50" />
                </td>
                <td className="py-4 px-6">
                    <div className="w-20 h-6 rounded-full skeleton mx-auto" />
                </td>
                <td className="py-4 px-6">
                    <div className="flex justify-end gap-2">
                        <div className="size-8 rounded-lg skeleton" />
                        <div className="size-8 rounded-lg skeleton" />
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
        <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-x-auto custom-scrollbar overflow-y-hidden transition-colors duration-300">
            <table className="w-full text-left min-w-[850px]">
                <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800">
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            Khách hàng
                        </th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
                            Liên hệ / Điện thoại
                        </th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
                            Phân loại
                        </th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">
                            Tuyến đường
                        </th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">
                            Trạng thái
                        </th>
                        <th className="py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">
                            Thao tác
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loading ? (
                        <TableSkeleton />
                    ) : paginatedCustomers.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500 uppercase font-black text-xs tracking-widest">
                                Không tìm thấy khách hàng nào
                            </td>
                        </tr>
                    ) : (
                        paginatedCustomers.map((customer) => (
                            <tr
                                key={customer.id}
                                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                                onClick={() => openDetail(customer)}
                            >
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3.5">
                                        <div className="size-11 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-[#1A237E] dark:text-indigo-400 flex items-center justify-center font-black text-xs border border-indigo-100 dark:border-indigo-900/60 shadow-sm shrink-0">
                                            {(customer.name || 'K')[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-black text-sm text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-tight group-hover:text-[#1A237E] dark:group-hover:text-indigo-400 transition-colors truncate">
                                                {customer.name}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                                <span className="font-mono">#{customer.id.slice(-6).toUpperCase()}</span>
                                                {customer.businessName && (
                                                    <span className="text-slate-500 dark:text-slate-400 truncate">
                                                        • {customer.businessName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 px-6 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    {customer.phone ? (
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={`tel:${customer.phone}`}
                                                className="inline-flex items-center gap-1.5 font-bold text-sm text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                title="Bấm để gọi điện"
                                            >
                                                <Phone size={13} className="text-slate-400" />
                                                <span>{customer.phone}</span>
                                            </a>
                                            <a
                                                href={`https://zalo.me/${customer.phone.replace(/\D/g, '')}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/40 hover:bg-blue-100 transition-colors"
                                                title="Nhắn Zalo"
                                            >
                                                Zalo
                                            </a>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-300 dark:text-slate-700 italic">Chưa có SĐT</span>
                                    )}
                                </td>
                                <td className="py-4 px-6 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        customer.type === 'Thầu Thợ' || customer.type === 'Thầu thợ'
                                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40'
                                            : customer.type === 'Chủ nhà'
                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40'
                                                : 'bg-orange-50 text-[#FF6D00] dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40'
                                    }`}>
                                        {customer.type || 'Chủ nhà'}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-center whitespace-nowrap">
                                    {customer.route ? (
                                        <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg uppercase border border-indigo-100 dark:border-indigo-800">
                                            {customer.route}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-300 dark:text-slate-700 italic">--</span>
                                    )}
                                </td>
                                <td className="py-4 px-6 text-center whitespace-nowrap">
                                    <ApprovalBadge status={customer.approvalStatus} />
                                    {(!customer.approvalStatus || customer.approvalStatus === 'approved') && (
                                        <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black uppercase rounded-full tracking-wide border ${
                                            customer.status === 'Hoạt động' || !customer.status
                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50'
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                        }`}>
                                            {customer.status || 'Hoạt động'}
                                        </span>
                                    )}
                                </td>
                                <td className="py-4 px-6 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                        {deleteConfirmId === customer.id ? (
                                            <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-900/20 p-1 rounded-xl border border-rose-200 dark:border-rose-900/40 animate-in fade-in zoom-in duration-200">
                                                <button
                                                    onClick={() => setDeleteConfirmId(null)}
                                                    className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white dark:bg-slate-800 rounded-lg shadow-sm"
                                                >
                                                    Hủy
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleDeleteCustomer(customer.id, true);
                                                        setDeleteConfirmId(null);
                                                    }}
                                                    className="px-2 py-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => openEdit(customer)}
                                                    className="p-2 rounded-xl text-slate-400 hover:text-[#1A237E] dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                                    title="Chỉnh sửa thông tin"
                                                >
                                                    <span className="material-symbols-outlined text-[19px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmId(customer.id)}
                                                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                                                    title="Xóa khách hàng"
                                                >
                                                    <span className="material-symbols-outlined text-[19px]">delete</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};
