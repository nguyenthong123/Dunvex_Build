/**
 * RebatePanel — Quản lý & Thiết lập Chiết khấu trả sau theo từng khách hàng
 * Thiết lập số tiền cụ thể, khoảng ngày hiệu lực, số lượt dùng, tự động trừ khi là ĐƠN CHỐT.
 */

import React, { useState, useMemo } from 'react';
import { Percent, Plus, Search, Calendar, Users, CheckCircle2, Clock, AlertCircle, Edit3, Trash2, X, DollarSign, ArrowRight, ShieldCheck, Tag } from 'lucide-react';
import { useCustomerRebates } from '../hooks/useCustomerRebates';
import { useCustomers } from '../hooks/useCustomers';
import { useToast } from './shared/Toast';
import { getRebateStatus, type RebateStatusType } from '../utils/rebateUtils';
import type { CustomerRebateData } from '../services/dataAccess';

interface Props {
  ownerId: string;
  isAdmin: boolean;
}

const formatMoney = (val: number) => {
  if (!val) return '0đ';
  return val.toLocaleString('vi-VN') + 'đ';
};

const formatDateVN = (dateStr?: string) => {
  if (!dateStr) return '---';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const todayStr = () => new Date().toISOString().split('T')[0];

const defaultEndDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};

const RebatePanel: React.FC<Props> = ({ ownerId, isAdmin }) => {
  const { showToast, showConfirm } = useToast();
  const { rebates, loading, createRebate, updateRebate, deleteRebate } = useCustomerRebates({ ownerId, enabled: !!ownerId });
  const { customers } = useCustomers({ ownerId, enabled: !!ownerId });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used' | 'upcoming' | 'expired'>('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [custSearch, setCustSearch] = useState('');
  const [showCustDropdown, setShowCustDropdown] = useState(false);

  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerType: '',
    rebateAmount: 0,
    rebateAmountStr: '',
    startDate: todayStr(),
    endDate: defaultEndDate(),
    maxUsage: 1,
    note: '',
    status: 'active' as const,
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      customerId: '',
      customerName: '',
      customerPhone: '',
      customerType: '',
      rebateAmount: 0,
      rebateAmountStr: '',
      startDate: todayStr(),
      endDate: defaultEndDate(),
      maxUsage: 1,
      note: '',
      status: 'active',
    });
    setCustSearch('');
    setShowCustDropdown(false);
    setShowModal(true);
  };

  const handleOpenEdit = (rebate: any) => {
    setEditingId(rebate.id);
    setFormData({
      customerId: rebate.customerId || '',
      customerName: rebate.customerName || '',
      customerPhone: rebate.customerPhone || '',
      customerType: rebate.customerType || '',
      rebateAmount: Number(rebate.rebateAmount) || 0,
      rebateAmountStr: String(rebate.rebateAmount || 0),
      startDate: rebate.startDate || todayStr(),
      endDate: rebate.endDate || defaultEndDate(),
      maxUsage: Number(rebate.maxUsage) || 1,
      note: rebate.note || '',
      status: rebate.status || 'active',
    });
    setCustSearch(rebate.customerName || '');
    setShowCustDropdown(false);
    setShowModal(true);
  };

  const handleSelectCustomer = (c: any) => {
    setFormData(prev => ({
      ...prev,
      customerId: c.id,
      customerName: c.name || '',
      customerPhone: c.phone || '',
      customerType: c.type || '',
    }));
    setCustSearch(c.name || '');
    setShowCustDropdown(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      showToast('Vui lòng chọn hoặc nhập tên khách hàng', 'warning');
      return;
    }
    if (formData.rebateAmount <= 0) {
      showToast('Số tiền chiết khấu phải lớn hơn 0', 'warning');
      return;
    }
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      showToast('Ngày bắt đầu không được lớn hơn ngày kết thúc', 'warning');
      return;
    }

    try {
      const dataToSave = {
        customerId: formData.customerId,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone,
        customerType: formData.customerType,
        rebateAmount: Number(formData.rebateAmount),
        startDate: formData.startDate,
        endDate: formData.endDate,
        maxUsage: Math.max(1, Number(formData.maxUsage) || 1),
        note: formData.note.trim(),
        status: formData.status,
      };

      if (editingId) {
        await updateRebate(editingId, dataToSave);
        showToast('Đã cập nhật chiết khấu cho khách hàng', 'success');
      } else {
        await createRebate({
          ...dataToSave,
          usedCount: 0,
          usedOrderIds: [],
        });
        showToast(`Đã thiết lập chiết khấu ${formatMoney(formData.rebateAmount)} cho ${formData.customerName}`, 'success');
      }
      setShowModal(false);
    } catch (err: any) {
      showToast('Lỗi khi lưu: ' + (err.message || err), 'error');
    }
  };

  const handleDelete = (id: string, name: string) => {
    showConfirm(
      'Xóa chiết khấu',
      `Bạn có chắc chắn muốn xóa chiết khấu của khách hàng "${name}"?`,
      async () => {
        try {
          await deleteRebate(id);
          showToast('Đã xóa chiết khấu thành công', 'success');
        } catch (err: any) {
          showToast('Lỗi khi xóa: ' + (err.message || err), 'error');
        }
      }
    );
  };

  // Filtered customers for dropdown search
  const matchedCustomers = useMemo(() => {
    if (!custSearch.trim()) return customers.slice(0, 8);
    const q = custSearch.toLowerCase();
    return customers.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    ).slice(0, 10);
  }, [customers, custSearch]);

  // Compute summary stats
  const checkDate = todayStr();
  const enhancedRebates = useMemo(() => {
    return rebates.map(r => ({
      ...r,
      computedStatus: getRebateStatus(r, checkDate),
    }));
  }, [rebates, checkDate]);

  const totalAllocated = useMemo(() => {
    return enhancedRebates.reduce((sum, r) => sum + (Number(r.rebateAmount) || 0) * (Number(r.maxUsage) || 1), 0);
  }, [enhancedRebates]);

  const totalUsed = useMemo(() => {
    return enhancedRebates.reduce((sum, r) => sum + (Number(r.rebateAmount) || 0) * (Number(r.usedCount) || 0), 0);
  }, [enhancedRebates]);

  const totalActiveCount = useMemo(() => {
    return enhancedRebates.filter(r => r.computedStatus === 'active').length;
  }, [enhancedRebates]);

  const uniqueCustomersCount = useMemo(() => {
    const set = new Set(enhancedRebates.map(r => r.customerId || r.customerName));
    return set.size;
  }, [enhancedRebates]);

  // Filter list
  const filteredList = useMemo(() => {
    return enhancedRebates.filter(r => {
      const matchSearch =
        !searchTerm.trim() ||
        (r.customerName && r.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.customerPhone && r.customerPhone.includes(searchTerm)) ||
        (r.note && r.note.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      if (statusFilter === 'all') return true;
      return r.computedStatus === statusFilter;
    });
  }, [enhancedRebates, searchTerm, statusFilter]);

  const getStatusBadge = (status: RebateStatusType, usedCount = 0, maxUsage = 1) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
            <CheckCircle2 size={12} /> Đang hiệu lực ({usedCount}/{maxUsage})
          </span>
        );
      case 'used':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
            <ShieldCheck size={12} /> Đã trừ hết ({usedCount}/{maxUsage})
          </span>
        );
      case 'upcoming':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40">
            <Clock size={12} /> Chưa tới ngày
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40">
            <AlertCircle size={12} /> Hết hạn
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-500">
            Tạm khóa
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & ACTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2.5">
            <Percent className="text-[#FF6D00]" size={24} />
            Chiết Khấu Trả Sau Theo Khách Hàng
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium mt-1">
            Thiết lập tiền chiết khấu đích danh cho từng khách hàng, tự động áp dụng và chỉ trừ lượt khi là <b>ĐƠN CHỐT</b>.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-[#1A237E] hover:bg-[#283593] text-white px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 dark:shadow-none transition-all active:scale-95 shrink-0"
        >
          <Plus size={16} />
          Thêm chiết khấu KH
        </button>
      </div>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tổng tiền thiết lập</p>
          <p className="text-lg md:text-xl font-black text-[#1A237E] dark:text-indigo-400 mt-0.5">{formatMoney(totalAllocated)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Đã trừ vào đơn chốt</p>
          <p className="text-lg md:text-xl font-black text-[#FF6D00] mt-0.5">{formatMoney(totalUsed)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Khách hàng được cấp</p>
          <p className="text-lg md:text-xl font-black text-emerald-600 mt-0.5">{uniqueCustomersCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Đang còn hiệu lực</p>
          <p className="text-lg md:text-xl font-black text-slate-700 dark:text-slate-200 mt-0.5">{totalActiveCount} khoản</p>
        </div>
      </div>

      {/* SEARCH & FILTER TABS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng, số điện thoại, ghi chú..."
            className="w-full pl-10 pr-4 h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#FF6D00]/20"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: 'Tất cả', count: enhancedRebates.length },
            { id: 'active', label: '🟢 Đang hiệu lực', count: enhancedRebates.filter(r => r.computedStatus === 'active').length },
            { id: 'used', label: '🔵 Đã sử dụng hết', count: enhancedRebates.filter(r => r.computedStatus === 'used').length },
            { id: 'upcoming', label: '⏳ Chưa tới ngày', count: enhancedRebates.filter(r => r.computedStatus === 'upcoming').length },
            { id: 'expired', label: '🔴 Hết hạn', count: enhancedRebates.filter(r => r.computedStatus === 'expired').length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-[#1A237E] text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              <span className="opacity-75">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* REBATE CARDS / LIST */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12">
            <div className="size-8 border-3 border-[#FF6D00] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-bold mt-2">Đang tải danh sách chiết khấu...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-dashed border-slate-200 dark:border-slate-800">
            <div className="size-12 rounded-2xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mx-auto text-[#FF6D00] mb-3">
              <Percent size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Chưa có khoản chiết khấu nào phù hợp</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Bấm "Thêm chiết khấu KH" để thiết lập số tiền chiết khấu trả sau và thời hạn cho khách hàng.
            </p>
          </div>
        ) : (
          filteredList.map(r => (
            <div
              key={r.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              {/* Left Customer Info */}
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className="size-11 rounded-2xl bg-gradient-to-br from-[#FF6D00] to-amber-500 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md shadow-orange-500/20">
                  {r.customerName ? r.customerName.charAt(0).toUpperCase() : 'K'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-bold text-sm md:text-base text-slate-800 dark:text-white uppercase truncate">
                      {r.customerName}
                    </h3>
                    {r.customerType && (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {r.customerType}
                      </span>
                    )}
                    {getStatusBadge(r.computedStatus, r.usedCount || 0, r.maxUsage || 1)}
                  </div>
                  {r.customerPhone && (
                    <p className="text-xs text-slate-400 font-semibold mb-1">SĐT: {r.customerPhone}</p>
                  )}
                  {r.note && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-1">
                      📝 {r.note}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-400 mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className="text-slate-400" />
                      Hiệu lực: <strong className="text-slate-600 dark:text-slate-300">{formatDateVN(r.startDate)}</strong> → <strong className="text-slate-600 dark:text-slate-300">{formatDateVN(r.endDate)}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Lượt đã dùng: <strong className="text-[#FF6D00]">{r.usedCount || 0}</strong> / {r.maxUsage || 1}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Money & Actions */}
              <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                <div className="text-left md:text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Mức chiết khấu</p>
                  <p className="text-lg md:text-xl font-black text-[#FF6D00]">{formatMoney(r.rebateAmount)}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEdit(r)}
                    className="size-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-center transition-colors"
                    title="Chỉnh sửa"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id, r.customerName)}
                    className="size-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                    title="Xóa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL THÊM / SỬA CHIẾT KHẤU KHÁCH HÀNG */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                <Percent size={18} className="text-[#FF6D00]" />
                {editingId ? 'Cập nhật chiết khấu KH' : 'Thiết lập chiết khấu trả sau'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 pt-4">
              {/* Chọn khách hàng */}
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                  Khách hàng áp dụng <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Tìm hoặc nhập tên khách hàng..."
                    value={custSearch || formData.customerName}
                    onChange={e => {
                      setCustSearch(e.target.value);
                      setFormData(prev => ({ ...prev, customerName: e.target.value }));
                      setShowCustDropdown(true);
                    }}
                    onFocus={() => setShowCustDropdown(true)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#FF6D00]/20"
                  />
                  {formData.customerName && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustSearch('');
                        setFormData(prev => ({ ...prev, customerId: '', customerName: '', customerPhone: '', customerType: '' }));
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {showCustDropdown && matchedCustomers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {matchedCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className="p-2.5 hover:bg-orange-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{c.name}</p>
                          {c.phone && <p className="text-[10px] text-slate-400">{c.phone}</p>}
                        </div>
                        {c.type && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-500">
                            {c.type}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Số tiền chiết khấu */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                  Số tiền chiết khấu (VNĐ) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={formData.rebateAmountStr}
                    onChange={e => {
                      const raw = e.target.value;
                      const clean = raw.replace(/,/g, '.');
                      const val = parseFloat(clean) || 0;
                      setFormData(prev => ({ ...prev, rebateAmount: val, rebateAmountStr: raw }));
                    }}
                    placeholder="ví dụ: 2600000 hoặc 2500000.5"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-[#FF6D00] outline-none focus:ring-2 focus:ring-[#FF6D00]/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {formatMoney(formData.rebateAmount)}
                  </span>
                </div>
              </div>

              {/* Thời hạn Từ ngày - Đến ngày */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Từ ngày</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#FF6D00]/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Đến ngày</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#FF6D00]/20"
                  />
                </div>
              </div>

              {/* Số lượt áp dụng */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                  Số lượt trừ chiết khấu tối đa
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.maxUsage}
                  onChange={e => setFormData(prev => ({ ...prev, maxUsage: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#FF6D00]/20"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 Mặc định là 1 lượt. Hệ thống chỉ trừ khi đơn hàng ở trạng thái <b>Đơn chốt</b>. Đơn nháp sẽ không làm mất lượt.
                </p>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Ghi chú chính sách / Lý do</label>
                <textarea
                  rows={2}
                  value={formData.note}
                  onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="ví dụ: Đạt mốc doanh số tháng trước, thưởng chiết khấu công trình..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#FF6D00]/20"
                />
              </div>

              {/* Nút lưu */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#FF6D00] hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                >
                  {editingId ? 'Lưu cập nhật' : 'Xác nhận tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RebatePanel;
