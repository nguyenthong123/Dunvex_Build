/**
 * RebatePanel — Chiết khấu trả sau
 * Bảng ngang: Tên KH | Phân loại | Tổng tiền | Chiết khấu
 * Lọc theo ngày (Từ - Đến)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Percent, Save, Users, Calendar } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';
import { useCustomers } from '../hooks/useCustomers';
import { useRebateTiers } from '../hooks/useRebateTiers';
import { useToast } from './shared/Toast';

const CUSTOMER_TYPES = ['Thầu thợ', 'Chủ nhà', 'Cửa hàng'] as const;

interface Props {
  ownerId: string;
  isAdmin: boolean;
}

const formatMoney = (val: number) => {
  if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + ' tỷ';
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(0) + 'tr';
  return val.toLocaleString('vi-VN') + 'đ';
};

const today = () => new Date().toISOString().split('T')[0];
const monthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
};

const RebatePanel: React.FC<Props> = ({ ownerId, isAdmin }) => {
  const { showToast } = useToast();
  const { orders } = useOrders({ ownerId, enabled: !!ownerId });
  const { customers } = useCustomers({ ownerId, enabled: !!ownerId });
  const { tiers: savedTiers, getTiersForType, saveTiers } = useRebateTiers({ ownerId, enabled: !!ownerId });

  const [percents, setPercents] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());

  // Load saved percents
  useEffect(() => {
    const loaded: Record<string, number> = {};
    CUSTOMER_TYPES.forEach(type => {
      const tiers = getTiersForType(type);
      loaded[type] = tiers.length > 0 ? tiers[0].percent : 0;
    });
    setPercents(loaded);
  }, [savedTiers]);

  const handleSavePercent = async (type: string) => {
    const pct = percents[type] || 0;
    setSaving(type);
    try {
      await saveTiers(type, [{ minAmount: 0, percent: pct }]);
      showToast(`Đã lưu CK ${pct}% cho ${type}`, 'success');
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
    setSaving(null);
  };

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status !== 'Đơn chốt') return false;
      const ts = o.createdAt?.seconds || o.orderDate?.seconds || 0;
      if (!ts) return false;
      const date = new Date(ts * 1000).toISOString().split('T')[0];
      return date >= dateFrom && date <= dateTo;
    });
  }, [orders, dateFrom, dateTo]);

  // Build customer name lookup
  const nameLookup = useMemo(() => {
    const m = new Map<string, any>();
    customers.forEach(c => {
      m.set(c.id, c);
      if (c.name) m.set(c.name.trim().toLowerCase(), c);
    });
    return m;
  }, [customers]);

  // Compute spending + merge with customer info
  const customerRows = useMemo(() => {
    const spendingMap = new Map<string, any>();

    filteredOrders.forEach(o => {
      const cid = (o.customerId || '').trim();
      const cname = (o.customerName || '').trim();

      // Resolve customer
      let cust = cid ? nameLookup.get(cid) : null;
      if (!cust && cname) cust = nameLookup.get(cname.toLowerCase());

      const key = cust?.id || cid || cname || 'unknown';
      // Get customer type
      const custType = cust?.type || '';
      const prev = spendingMap.get(key) || { total: 0, count: 0, custType: '' };
      spendingMap.set(key, {
        total: prev.total + (Number(o.totalAmount) || 0),
        count: prev.count + 1,
        custType: custType || (prev as any).custType || '',
      });
    });

    // Also include customers with matching type but 0 spending (for visibility)
    const custSet = new Set<string>();
    const rows: Array<{
      id: string;
      name: string;
      type: string;
      phone: string;
      totalSpent: number;
      orderCount: number;
      discount: number;
    }> = [];

    // Add customers with spending
    spendingMap.forEach((val: any, key) => {
      const cust = nameLookup.get(key);
      const type = val.custType || cust?.type || '';
      if (cust) custSet.add(cust.id);
      const pct = percents[type] || 0;
      rows.push({
        id: key,
        name: cust?.name || key,
        type: type || 'Chưa phân loại',
        phone: cust?.phone || '',
        totalSpent: val.total,
        orderCount: val.count,
        discount: Math.round(val.total * pct / 100),
      });
    });

    // Add customers with 0 spending but matching types (so all visible)
    customers.forEach(c => {
      if (!custSet.has(c.id) && CUSTOMER_TYPES.includes(c.type as any)) {
        const pct = percents[c.type] || 0;
        rows.push({
          id: c.id,
          name: c.name,
          type: c.type,
          phone: c.phone || '',
          totalSpent: 0,
          orderCount: 0,
          discount: 0,
        });
      }
    });

    // Sort: by type, then by spending desc
    const typeOrder = ['Thầu thợ', 'Chủ nhà', 'Cửa hàng'];
    rows.sort((a, b) => {
      const ta = typeOrder.indexOf(a.type);
      const tb = typeOrder.indexOf(b.type);
      if (ta !== tb) return ta - tb;
      return b.totalSpent - a.totalSpent;
    });

    return rows;
  }, [filteredOrders, customers, nameLookup, percents]);

  // Summary per type
  const typeSummaries = useMemo(() => {
    return CUSTOMER_TYPES.map(type => {
      const typeRows = customerRows.filter(r => r.type === type);
      return {
        type,
        count: typeRows.length,
        orderCount: typeRows.reduce((s, r) => s + r.orderCount, 0),
        totalSpent: typeRows.reduce((s, r) => s + r.totalSpent, 0),
        totalDiscount: typeRows.reduce((s, r) => s + r.discount, 0),
      };
    });
  }, [customerRows]);

  const totalSpent = customerRows.reduce((s, r) => s + r.totalSpent, 0);
  const totalDiscount = customerRows.reduce((s, r) => s + r.discount, 0);
  const totalOrders = customerRows.reduce((s, r) => s + r.orderCount, 0);

  return (
    <div className="space-y-4">
      {/* Date Filter + Summary */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Từ ngày</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FF6D00]/20" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Đến ngày</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FF6D00]/20" />
          </div>
          <span className="text-xs text-slate-400 ml-1">
            <Calendar size={12} className="inline mr-1" />{filteredOrders.length} đơn chốt
          </span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3">
            <p className="text-[10px] font-black text-slate-400 uppercase">Tổng doanh số</p>
            <p className="text-base font-black text-[#1A237E] dark:text-indigo-400">{formatMoney(totalSpent)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3">
            <p className="text-[10px] font-black text-slate-400 uppercase">Tổng chiết khấu</p>
            <p className="text-base font-black text-[#FF6D00]">{formatMoney(totalDiscount)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3">
            <p className="text-[10px] font-black text-slate-400 uppercase">Khách hàng</p>
            <p className="text-base font-black text-green-600">{customerRows.length}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3">
            <p className="text-[10px] font-black text-slate-400 uppercase">Đơn chốt</p>
            <p className="text-base font-black text-slate-600">{totalOrders}</p>
          </div>
        </div>
      </div>

      {/* Percent Settings — 3 inline inputs */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Thiết lập % chiết khấu theo loại</p>
          <div className="flex flex-wrap gap-4">
            {CUSTOMER_TYPES.map(type => (
              <div key={type} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 min-w-[70px]">{type}</span>
                <input type="number" value={percents[type] || 0}
                  onChange={e => setPercents(prev => ({ ...prev, [type]: Number(e.target.value) }))}
                  min="0" max="100" step="0.5"
                  className="w-16 bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-sm font-bold text-[#FF6D00] outline-none focus:ring-2 focus:ring-[#FF6D00]/20 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-xs font-bold text-slate-400">%</span>
                <button onClick={() => handleSavePercent(type)} disabled={saving === type}
                  className="px-3 py-1.5 rounded-lg bg-[#1A237E] text-white text-[10px] font-black uppercase hover:bg-[#283593] disabled:opacity-50 flex items-center gap-1">
                  <Save size={10} />{saving === type ? '...' : 'Lưu'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Table — Desktop: table, Mobile: card layout */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase">
                <th className="text-left px-4 py-3 font-black">Khách hàng</th>
                <th className="text-left px-4 py-3 font-black w-28">Phân loại</th>
                <th className="text-right px-4 py-3 font-black w-16">Đơn</th>
                <th className="text-right px-4 py-3 font-black w-36">Tổng tiền đơn chốt</th>
                <th className="text-right px-4 py-3 font-black w-36 text-[#FF6D00]">Tổng chiết khấu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {customerRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 italic">
                    Không có đơn chốt nào trong khoảng thời gian này
                  </td>
                </tr>
              ) : (
                customerRows.map((row, idx) => {
                  // Show type separator
                  const prevType = idx > 0 ? customerRows[idx - 1].type : '';
                  const showSeparator = row.type !== prevType;
                  return (
                    <React.Fragment key={row.id || idx}>
                      {showSeparator && (
                        <tr className="bg-amber-50/50 dark:bg-amber-900/5">
                          <td colSpan={5} className="px-4 py-1.5">
                            <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1.5">
                              <Users size={12} /> {row.type}
                              <span className="text-slate-400 font-normal lowercase normal-case">
                                · {typeSummaries.find(s => s.type === row.type)?.count || 0} KH
                                · {formatMoney(typeSummaries.find(s => s.type === row.type)?.totalSpent || 0)}
                                {percents[row.type] > 0 && ` · CK ${formatMoney(typeSummaries.find(s => s.type === row.type)?.totalDiscount || 0)} (${percents[row.type]}%)`}
                              </span>
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-bold text-slate-700 dark:text-slate-300">{row.name}</p>
                          {row.phone && <p className="text-[10px] text-slate-400">{row.phone}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            row.type === 'Thầu thợ' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                            row.type === 'Chủ nhà' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                            'bg-orange-50 dark:bg-orange-900/20 text-[#FF6D00]'
                          }`}>{row.type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{row.orderCount}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-[#1A237E] dark:text-indigo-400">{formatMoney(row.totalSpent)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-[#FF6D00]">{formatMoney(row.discount)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {/* Grand Total */}
            {customerRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-200 dark:border-slate-700 text-[11px] font-black">
                  <td className="px-4 py-3 text-slate-500 uppercase">Tổng cộng</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right text-slate-500">{totalOrders}</td>
                  <td className="px-4 py-3 text-right text-[#1A237E]">{formatMoney(totalSpent)}</td>
                  <td className="px-4 py-3 text-right text-[#FF6D00]">{formatMoney(totalDiscount)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* MOBILE CARD LAYOUT */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {customerRows.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic text-sm">
              Không có đơn chốt nào trong khoảng thời gian này
            </div>
          ) : (
            customerRows.map((row, idx) => {
              const prevType = idx > 0 ? customerRows[idx - 1].type : '';
              const showSeparator = row.type !== prevType;
              return (
                <React.Fragment key={row.id || idx}>
                  {showSeparator && (
                    <div className="px-4 py-2 bg-amber-50/50 dark:bg-amber-900/5">
                      <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1.5">
                        <Users size={12} /> {row.type}
                        <span className="text-slate-400 font-normal lowercase normal-case">
                          · {typeSummaries.find(s => s.type === row.type)?.count || 0} KH
                          · {formatMoney(typeSummaries.find(s => s.type === row.type)?.totalSpent || 0)}
                          {percents[row.type] > 0 && ` · CK ${formatMoney(typeSummaries.find(s => s.type === row.type)?.totalDiscount || 0)}`}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{row.name}</p>
                        {row.phone && <p className="text-[10px] text-slate-400 mt-0.5">{row.phone}</p>}
                      </div>
                      <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        row.type === 'Thầu thợ' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                        row.type === 'Chủ nhà' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                        'bg-orange-50 dark:bg-orange-900/20 text-[#FF6D00]'
                      }`}>{row.type}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{row.orderCount} đơn</span>
                      <span className="font-bold text-[#1A237E] dark:text-indigo-400">{formatMoney(row.totalSpent)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs border-t border-slate-50 dark:border-slate-800 pt-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Chiết khấu</span>
                      <span className="font-bold text-[#FF6D00]">{formatMoney(row.discount)}</span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          {/* Mobile Grand Total */}
          {customerRows.length > 0 && (
            <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-500 uppercase">Tổng cộng</span>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-500">{totalOrders} đơn</span>
                <span className="font-bold text-[#1A237E]">{formatMoney(totalSpent)}</span>
                <span className="font-bold text-[#FF6D00]">{formatMoney(totalDiscount)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RebatePanel;
