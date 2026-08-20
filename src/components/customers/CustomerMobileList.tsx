import React from 'react';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

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
        <div className="md:hidden flex-1 pb-24 relative min-h-[500px]">
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-slate-800 space-y-4 animate-pulse">
                            <div className="flex justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full skeleton" />
                                    <div className="w-32 h-4 skeleton" />
                                </div>
                                <div className="w-20 h-6 rounded-full skeleton" />
                            </div>
                            <div className="w-full h-4 skeleton" />
                        </div>
                    ))}
                </div>
            ) : paginatedCustomers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium">Không tìm thấy khách hàng nào</div>
            ) : (
                <AutoSizer renderProp={({ height, width }) => (
                    <List
                        style={{ height: height || 600, width: width || '100%' }}
                        rowCount={paginatedCustomers.length}
                        rowHeight={160}
                        rowProps={{}}
                        className="no-scrollbar"
                        rowComponent={({ index, style }) => {
                            const customer = paginatedCustomers[index];
                            if (!customer) return null;
                            return (
                                <div style={{ ...style, padding: '0 4px 16px 4px' }}>
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-slate-800 h-full flex flex-col justify-between" onClick={() => openDetail(customer)}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                                                    {(customer.name?.[0] || 'K').toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-black text-[#1A237E] dark:text-indigo-400 uppercase truncate max-w-[150px]">{customer.name}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                        {customer.phone}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="px-2 py-1 rounded-lg text-[9px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 uppercase">
                                                    {customer.route || 'Mặc định'}
                                                </span>
                                                <span className="px-2 py-1 rounded-lg text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                                                    {customer.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-50 dark:border-slate-800 mt-2">
                                            <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded uppercase tracking-wider">{customer.type}</span>
                                            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">#{customer.id.slice(-6)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    />
                )} />
            )}
        </div>
    );
};
