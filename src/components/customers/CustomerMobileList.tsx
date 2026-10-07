import React from 'react';
import { Phone, MapPin } from 'lucide-react';

export interface CustomerMobileListProps {
    loading: boolean;
    paginatedCustomers: any[];
    openDetail: (c: any) => void;
}

export const CustomerMobileList: React.FC<CustomerMobileListProps> = ({
    loading,
    paginatedCustomers,
    openDetail
}) => {
    return (
        <div className="md:hidden flex-1 pb-24 relative">
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3 animate-pulse"
                        >
                            <div className="flex justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-11 rounded-full skeleton" />
                                    <div className="space-y-1.5">
                                        <div className="w-32 h-4 skeleton" />
                                        <div className="w-20 h-3 skeleton opacity-50" />
                                    </div>
                                </div>
                                <div className="w-16 h-5 rounded-full skeleton" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : paginatedCustomers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 uppercase font-black text-xs tracking-widest">
                    Không tìm thấy khách hàng nào
                </div>
            ) : (
                <div className="space-y-3">
                    {paginatedCustomers.map((customer) => (
                        <div
                            key={customer.id}
                            className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 transition-all cursor-pointer"
                            onClick={() => openDetail(customer)}
                        >
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="size-11 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-[#1A237E] dark:text-indigo-400 flex items-center justify-center font-black text-xs border border-indigo-100 dark:border-indigo-900/60 shadow-sm shrink-0">
                                        {(customer.name?.[0] || 'K').toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-black text-sm text-slate-900 dark:text-slate-100 uppercase truncate">
                                            {customer.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold font-mono mt-0.5">
                                            #{customer.id.slice(-6).toUpperCase()}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                            customer.status === 'Hoạt động' || !customer.status
                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50'
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        {customer.status || 'Hoạt động'}
                                    </span>
                                </div>
                            </div>

                            {/* Contact info and classification */}
                            <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                                <div>
                                    {customer.phone ? (
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={`tel:${customer.phone}`}
                                                className="inline-flex items-center gap-1 font-bold text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600"
                                            >
                                                <Phone size={11} className="text-slate-400" />
                                                <span>{customer.phone}</span>
                                            </a>
                                            <a
                                                href={`https://zalo.me/${customer.phone.replace(/\D/g, '')}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60"
                                            >
                                                Zalo
                                            </a>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-slate-300 dark:text-slate-700 italic">Chưa có SĐT</span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {customer.route && (
                                        <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded uppercase">
                                            {customer.route}
                                        </span>
                                    )}
                                    <span
                                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                            customer.type === 'Thầu Thợ' || customer.type === 'Thầu thợ'
                                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                                : customer.type === 'Chủ nhà'
                                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                                    : 'bg-orange-50 text-[#FF6D00] dark:bg-orange-950/40 dark:text-orange-400'
                                        }`}
                                    >
                                        {customer.type || 'Chủ nhà'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
