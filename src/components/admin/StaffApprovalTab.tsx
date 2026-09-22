import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, XCircle, Package, Users, Clock, AlertTriangle, ShieldCheck, 
  CalendarDays, Filter, UserCheck, MessageSquare, Info
} from 'lucide-react';
import { collection, onSnapshot, query, where, updateDoc, doc, serverTimestamp } from '../../services/fakeFirestore';
import { db, auth } from '../../services/firebase';
import { decideApprovalRequest } from '../../services/apiClient';
import { createUserNotification } from '../../utils/notifications';
import { useToast } from '../shared/Toast';

interface PendingRequestItem {
  id: string;
  targetCollection: 'products' | 'customers' | 'attendance_logs';
  actionType: 'create' | 'delete' | 'leave' | 'late';
  name: string;
  subtext: string;
  note?: string;
  dates?: string[];
  requestedBy?: {
    uid?: string;
    email?: string;
    displayName?: string;
  };
  requestedAt?: string;
  rawDoc: any;
}

type FilterCategory = 'all' | 'leaves' | 'products' | 'customers';

export function StaffApprovalTab({ ownerId }: { ownerId: string }) {
  const [pendingItems, setPendingItems] = useState<PendingRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');

  const { showToast } = useToast();

  useEffect(() => {
    if (!ownerId) return;

    let productsList: any[] = [];
    let customersList: any[] = [];
    let attendanceLogsList: any[] = [];

    const updateCombinedList = () => {
      const items: PendingRequestItem[] = [];

      // 1. Leave & Late Requests from attendance_logs
      attendanceLogsList.forEach(log => {
        if (log.type === 'request' && log.status === 'pending') {
          const isLeave = log.requestType === 'leave';
          const dates = log.dates || (log.date ? [log.date] : []);
          
          items.push({
            id: log.id,
            targetCollection: 'attendance_logs',
            actionType: isLeave ? 'leave' : 'late',
            name: log.userName || log.userEmail || 'Nhân viên',
            subtext: isLeave 
              ? `Xin nghỉ ${dates.length} ngày (${dates.map((d: string) => d.split('-').reverse().join('/')).join(', ')})` 
              : `Báo đi muộn / về sớm ngày ${log.date ? log.date.split('-').reverse().join('/') : 'hôm nay'}`,
            note: log.note || '',
            dates: dates,
            requestedBy: {
              uid: log.userId,
              email: log.userEmail,
              displayName: log.userName
            },
            requestedAt: log.createdAt?.seconds 
              ? new Date(log.createdAt.seconds * 1000).toISOString() 
              : (typeof log.createdAt === 'string' ? log.createdAt : new Date().toISOString()),
            rawDoc: log
          });
        }
      });

      // 2. Product approval requests
      productsList.forEach(p => {
        if (p.approvalStatus === 'pending_approval') {
          items.push({
            id: p.id,
            targetCollection: 'products',
            actionType: 'create',
            name: p.name || 'Sản phẩm mới',
            subtext: `SKU: ${p.sku || 'N/A'} • Giá: ${Number(p.priceSell || 0).toLocaleString('vi-VN')}đ`,
            requestedBy: p.requestedBy,
            requestedAt: p.requestedAt || p.createdAt,
            rawDoc: p
          });
        } else if (p.approvalStatus === 'pending_delete') {
          items.push({
            id: p.id,
            targetCollection: 'products',
            actionType: 'delete',
            name: p.name || 'Sản phẩm',
            subtext: `SKU: ${p.sku || 'N/A'} • Tồn kho: ${p.stock || 0}`,
            requestedBy: p.deleteRequestedBy || p.requestedBy,
            requestedAt: p.deleteRequestedAt || p.updatedAt,
            rawDoc: p
          });
        }
      });

      // 3. Customer approval requests
      customersList.forEach(c => {
        if (c.approvalStatus === 'pending_approval') {
          items.push({
            id: c.id,
            targetCollection: 'customers',
            actionType: 'create',
            name: c.name || 'Khách hàng mới',
            subtext: `SĐT: ${c.phone || 'Chưa có'} • Tuyến: ${c.route || 'Chưa xếp'}`,
            requestedBy: c.requestedBy,
            requestedAt: c.requestedAt || c.createdAt,
            rawDoc: c
          });
        } else if (c.approvalStatus === 'pending_delete') {
          items.push({
            id: c.id,
            targetCollection: 'customers',
            actionType: 'delete',
            name: c.name || 'Khách hàng',
            subtext: `SĐT: ${c.phone || 'Chưa có'} • Công nợ: ${Number(c.debt || 0).toLocaleString('vi-VN')}đ`,
            requestedBy: c.deleteRequestedBy || c.requestedBy,
            requestedAt: c.deleteRequestedAt || c.updatedAt,
            rawDoc: c
          });
        }
      });

      // Sort newest requests first
      items.sort((a, b) => {
        const timeA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const timeB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return timeB - timeA;
      });

      setPendingItems(items);
      setLoading(false);
    };

    const unsubAttendance = onSnapshot(
      query(collection(db, 'attendance_logs'), where('ownerId', '==', ownerId)),
      (snap) => {
        attendanceLogsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateCombinedList();
      }
    );

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        productsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateCombinedList();
      }
    );

    const unsubCustomers = onSnapshot(
      collection(db, 'customers'),
      (snap) => {
        customersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateCombinedList();
      }
    );

    return () => {
      unsubAttendance();
      unsubProducts();
      unsubCustomers();
    };
  }, [ownerId]);

  const counts = useMemo(() => {
    const leaves = pendingItems.filter(i => i.targetCollection === 'attendance_logs').length;
    const products = pendingItems.filter(i => i.targetCollection === 'products').length;
    const customers = pendingItems.filter(i => i.targetCollection === 'customers').length;
    return {
      all: pendingItems.length,
      leaves,
      products,
      customers
    };
  }, [pendingItems]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'leaves') {
      return pendingItems.filter(i => i.targetCollection === 'attendance_logs');
    }
    if (selectedCategory === 'products') {
      return pendingItems.filter(i => i.targetCollection === 'products');
    }
    if (selectedCategory === 'customers') {
      return pendingItems.filter(i => i.targetCollection === 'customers');
    }
    return pendingItems;
  }, [pendingItems, selectedCategory]);

  const handleDecision = async (item: PendingRequestItem, decision: 'approve' | 'reject') => {
    try {
      setActionId(item.id);

      // Handle Leave / Late attendance logs
      if (item.targetCollection === 'attendance_logs') {
        const newStatus = decision === 'approve' ? 'approved' : 'rejected';
        await updateDoc(doc(db, 'attendance_logs', item.id), {
          status: newStatus,
          approvedBy: auth.currentUser?.uid || 'admin',
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Notify employee
        if (item.requestedBy?.uid) {
          const isLeave = item.actionType === 'leave';
          const typeLabel = isLeave ? 'nghỉ phép' : 'đi muộn / về sớm';
          const datesInfo = item.dates && item.dates.length > 0 ? ` (${item.dates.join(', ')})` : '';

          await createUserNotification(item.requestedBy.uid, {
            title: decision === 'approve' 
              ? `✅ Yêu cầu ${typeLabel} đã được DUYỆT` 
              : `❌ Yêu cầu ${typeLabel} đã bị TỪ CHỐI`,
            body: decision === 'approve'
              ? `Admin đã phê duyệt đơn xin ${typeLabel}${datesInfo} của bạn.`
              : `Admin đã từ chối đơn xin ${typeLabel}${datesInfo} của bạn.`,
            type: 'attendance_request',
            priority: 'high'
          });
        }

        if (decision === 'approve') {
          showToast(item.actionType === 'leave' ? 'Đã duyệt yêu cầu nghỉ phép thành công!' : 'Đã duyệt yêu cầu đi muộn thành công!', 'success');
        } else {
          showToast('Đã từ chối yêu cầu nghỉ phép!', 'info');
        }
        return;
      }

      // Handle Products & Customers
      const res = await decideApprovalRequest(item.targetCollection, item.id, decision);
      if (res.success) {
        if (decision === 'approve') {
          showToast(item.actionType === 'create' ? 'Đã duyệt tạo mới thành công!' : 'Đã duyệt xoá (chuyển vào Thùng rác)!', 'success');
        } else {
          showToast('Đã từ chối yêu cầu!', 'info');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi xử lý duyệt yêu cầu', 'error');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              Trung Tâm Duyệt Yêu Cầu Nhân Viên
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                {pendingItems.length} yêu cầu chờ duyệt
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Phê duyệt nghỉ phép, đi muộn, thêm hoặc xoá Sản phẩm & Khách hàng từ nhân viên.
            </p>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tất cả
            {counts.all > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                selectedCategory === 'all' ? 'bg-white text-indigo-600' : 'bg-rose-500 text-white'
              }`}>
                {counts.all}
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedCategory('leaves')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              selectedCategory === 'leaves'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <CalendarDays size={14} />
            Nghỉ phép & Đi muộn
            {counts.leaves > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                selectedCategory === 'leaves' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
              }`}>
                {counts.leaves}
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedCategory('products')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              selectedCategory === 'products'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Package size={14} />
            Sản phẩm
            {counts.products > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                selectedCategory === 'products' ? 'bg-white text-emerald-600' : 'bg-emerald-500 text-white'
              }`}>
                {counts.products}
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedCategory('customers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              selectedCategory === 'customers'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Users size={14} />
            Khách hàng
            {counts.customers > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                selectedCategory === 'customers' ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'
              }`}>
                {counts.customers}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            Đang tải danh sách chờ duyệt...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs flex flex-col items-center gap-3">
            <CheckCircle2 size={40} className="text-emerald-400 opacity-60" />
            {selectedCategory === 'all' 
              ? 'Không có yêu cầu nào cần duyệt'
              : `Không có yêu cầu ${selectedCategory === 'leaves' ? 'nghỉ phép' : selectedCategory === 'products' ? 'sản phẩm' : 'khách hàng'} nào cần duyệt`}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredItems.map((item) => (
              <div 
                key={`${item.targetCollection}-${item.id}`} 
                className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="space-y-2.5 flex-1">
                  {/* Tags / Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.targetCollection === 'attendance_logs' ? (
                      item.actionType === 'leave' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <CalendarDays size={13} /> Nghỉ phép
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                          <Clock size={13} /> Đi muộn / Về sớm
                        </span>
                      )
                    ) : item.targetCollection === 'products' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Package size={12} /> Sản phẩm
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Users size={12} /> Khách hàng
                      </span>
                    )}

                    {item.targetCollection !== 'attendance_logs' && (
                      item.actionType === 'create' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Clock size={12} /> Yêu cầu Tạo mới
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                          <AlertTriangle size={12} /> Yêu cầu Xoá
                        </span>
                      )
                    )}

                    {item.requestedAt && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        • {new Date(item.requestedAt).toLocaleString('vi-VN')}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {item.targetCollection === 'attendance_logs' ? (
                        <span className="flex items-center gap-2">
                          <UserCheck size={18} className="text-indigo-600 dark:text-indigo-400 inline" />
                          <span>{item.name}</span>
                          {item.requestedBy?.email && (
                            <span className="text-xs font-normal text-slate-400">({item.requestedBy.email})</span>
                          )}
                        </span>
                      ) : (
                        item.name
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                      {item.subtext}
                    </p>
                  </div>

                  {/* Leave Dates Pill Tags */}
                  {item.dates && item.dates.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] font-bold text-slate-400">Ngày đăng ký:</span>
                      {item.dates.map((d: string) => (
                        <span key={d} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                          {d.split('-').reverse().join('/')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Reason / Note Box */}
                  {item.note && (
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-2.5 max-w-2xl">
                      <MessageSquare size={15} className="text-slate-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                        <strong className="text-slate-900 dark:text-white">Lý do:</strong> {item.note}
                      </div>
                    </div>
                  )}

                  {/* Submitter info for products / customers */}
                  {item.targetCollection !== 'attendance_logs' && (
                    <div className="text-[11px] text-slate-400 font-medium pt-1">
                      Gửi bởi: <strong className="text-slate-700 dark:text-slate-200">{item.requestedBy?.displayName || item.requestedBy?.email || 'Nhân viên'}</strong>
                    </div>
                  )}
                </div>

                {/* Approve / Reject Buttons */}
                <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
                  <button
                    onClick={() => handleDecision(item, 'approve')}
                    disabled={actionId === item.id}
                    className="px-5 py-2.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 active:scale-[0.97] disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    Chấp nhận
                  </button>
                  <button
                    onClick={() => handleDecision(item, 'reject')}
                    disabled={actionId === item.id}
                    className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-500 hover:text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 active:scale-[0.97] disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
