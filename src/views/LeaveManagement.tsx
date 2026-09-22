import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { 
  collection, query, where, onSnapshot, updateDoc, doc, 
  serverTimestamp, addDoc, deleteDoc 
} from '../services/firebase';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';
import { createAdminNotification, createUserNotification } from '../utils/notifications';
import { notifyLeaveRequestEvent } from '../utils/telegramNotify';
import { 
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, 
  XCircle, Clock, Users, Filter, Edit2, Trash2, Plus, Send, X,
  UserCheck, AlertCircle, Calendar as CalendarIcon, Check, MessageSquare
} from 'lucide-react';

import LeaveCalendar from '../components/shared/LeaveCalendar';

const MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];
const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const LeaveManagement = () => {
  const navigate = useNavigate();
  const owner = useOwner();
  const { showToast, showConfirm } = useToast();
  
  // Xác định quyền Admin chính xác (bao gồm chủ xưởng hoặc role admin)
  const isAdmin = !owner.isEmployee || owner.role === 'admin' || owner.accessRights?.admin === true;

  const [viewDate, setViewDate] = useState(() => new Date());
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [editData, setEditData] = useState({ type: 'leave', note: '', selectedDates: [] as string[] });
  const [processing, setProcessing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState({ type: 'leave', note: '', selectedDates: [] as string[] });

  // Handle browser back button — close detail modal
  useEffect(() => {
    const handlePopState = () => {
      setSelectedRequest(null);
      setEditingRequest(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Handle mobile center "+" button → open create form
  useEffect(() => {
    const handleOpenCreate = () => setShowCreateModal(true);
    window.addEventListener('open-leave-create', handleOpenCreate);
    return () => window.removeEventListener('open-leave-create', handleOpenCreate);
  }, []);

  const today = useMemo(() => {
    const d = new Date(); 
    d.setHours(0,0,0,0); 
    return d;
  }, []);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatDate(today);

  // Real-time listener for leave requests
  useEffect(() => {
    if (!owner.ownerId) return;
    setLoading(true);

    const q = query(
      collection(db, 'attendance_logs'),
      where('ownerId', '==', owner.ownerId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const requests = all.filter((r: any) => r.type === 'request');

      // Admin xem tất cả nhân viên; Nhân viên chỉ xem của chính mình
      const filtered = isAdmin
        ? requests
        : requests.filter((r: any) => r.userId === auth.currentUser?.uid);

      // Sắp xếp mới nhất lên đầu
      filtered.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds ? a.createdAt.seconds : (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() / 1000 : 0);
        const tB = b.createdAt?.seconds ? b.createdAt.seconds : (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() / 1000 : 0);
        return tB - tA;
      });

      setLeaveRequests(filtered);
      setLoading(false);
    }, (err) => {
      console.error('LeaveManagement fetch error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [owner.ownerId, isAdmin]);

  // Chuẩn hóa và xây dựng map: 'YYYY-MM-DD' -> danh sách đơn nghỉ phép
  const leaveDateMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    
    leaveRequests.forEach(req => {
      const rawDates: any[] = Array.isArray(req.dates) ? req.dates : (req.date ? [req.date] : []);
      
      rawDates.forEach((rawD) => {
        if (!rawD) return;
        let ds = '';
        if (typeof rawD === 'string') {
          ds = rawD.split('T')[0].trim();
        } else if (rawD instanceof Date) {
          ds = formatDate(rawD);
        } else if (rawD?.seconds) {
          ds = formatDate(new Date(rawD.seconds * 1000));
        }

        if (ds && /^\d{4}-\d{2}-\d{2}$/.test(ds)) {
          if (!map[ds]) map[ds] = [];
          map[ds].push(req);
        }
      });
    });
    return map;
  }, [leaveRequests]);

  // Calendar grid generator
  const calendarDays = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const daysInPrev = new Date(y, m, 0).getDate();

    const cells: Array<{date: Date; currentMonth: boolean}> = [];
    for (let i = startDay-1; i >= 0; i--)
      cells.push({date: new Date(y, m-1, daysInPrev-i), currentMonth: false});
    for (let d = 1; d <= daysInMonth; d++)
      cells.push({date: new Date(y, m, d), currentMonth: true});
    const rem = 42 - cells.length;
    for (let d = 1; d <= rem; d++)
      cells.push({date: new Date(y, m+1, d), currentMonth: false});
    while (cells.length > 35 && cells.slice(35).every(c => !c.currentMonth))
      cells.length = 35;
    return cells;
  }, [viewDate]);

  const getLeaveStatus = (dateStr: string) => {
    const entries = leaveDateMap[dateStr] || [];
    if (entries.length === 0) return null;
    const hasPending = entries.some(e => e.status === 'pending');
    if (hasPending) return 'pending';
    const hasApproved = entries.some(e => e.status === 'approved');
    if (hasApproved) return 'approved';
    const hasRejected = entries.some(e => e.status === 'rejected');
    if (hasRejected) return 'rejected';
    return 'pending';
  };

  // Lọc danh sách theo trạng thái và theo ngày được chọn trên lịch
  const filteredRequests = useMemo(() => {
    let list = leaveRequests;
    
    // Lọc theo ngày chọn trên lịch
    if (selectedCalendarDate) {
      list = list.filter(req => {
        const rawDates: any[] = Array.isArray(req.dates) ? req.dates : (req.date ? [req.date] : []);
        return rawDates.some(d => {
          const ds = typeof d === 'string' ? d.split('T')[0].trim() : '';
          return ds === selectedCalendarDate;
        });
      });
    }

    // Lọc theo trạng thái
    if (statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter);
    }
    return list;
  }, [leaveRequests, statusFilter, selectedCalendarDate]);

  // Danh sách nhân viên nghỉ vào ngày đang chọn trên lịch
  const selectedDateRequests = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return leaveDateMap[selectedCalendarDate] || [];
  }, [selectedCalendarDate, leaveDateMap]);

  const handleApprove = async (req: any) => {
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'attendance_logs', req.id), {
        status: 'approved',
        approvedBy: auth.currentUser?.uid,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      // Notify employee
      if (req.userId) {
        await createUserNotification(req.userId, {
          title: '✅ Nghỉ phép được duyệt',
          body: `Yêu cầu nghỉ phép của bạn đã được admin phê duyệt.`,
          type: 'attendance_request',
          priority: 'high'
        });
      }
      showToast('Đã duyệt nghỉ phép thành công!', 'success');
      setSelectedRequest(null);
    } catch (err) {
      showToast('Lỗi khi duyệt', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (req: any) => {
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'attendance_logs', req.id), {
        status: 'rejected',
        approvedBy: auth.currentUser?.uid,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      if (req.userId) {
        await createUserNotification(req.userId, {
          title: '❌ Nghỉ phép bị từ chối',
          body: `Yêu cầu nghỉ phép của bạn đã bị từ chối.`,
          type: 'attendance_request',
          priority: 'high'
        });
      }
      showToast('Đã từ chối nghỉ phép', 'success');
      setSelectedRequest(null);
    } catch (err) {
      showToast('Lỗi khi từ chối', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteRequest = async (req: any, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm(
      "Xóa yêu cầu nghỉ phép",
      "Bạn có chắc muốn xoá yêu cầu này?",
      async () => {
        try {
          await deleteDoc(doc(db, 'attendance_logs', req.id));
          showToast('Đã xoá yêu cầu', 'success');
        } catch (err) {
          showToast('Có lỗi xảy ra', 'error');
        }
      }
    );
  };

  const openEditModal = (req: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRequest(req);
    setEditData({ type: req.requestType || 'leave', note: req.note || '', selectedDates: req.dates || [req.date] });
  };

  const handleUpdateRequest = async () => {
    if (!editData.selectedDates.length) {
      showToast('Vui lòng chọn ngày', 'error');
      return;
    }
    setProcessing(true);
    try {
      const datesToSave = editData.type === 'leave' ? editData.selectedDates : [editData.selectedDates[0]];
      await updateDoc(doc(db, 'attendance_logs', editingRequest.id), {
        requestType: editData.type,
        note: editData.note,
        dates: datesToSave
      });
      setEditingRequest(null);
      showToast('Đã cập nhật yêu cầu', 'success');
    } catch (err) {
      showToast('Có lỗi xảy ra', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateRequest = async () => {
    if (createData.type === 'leave' && createData.selectedDates.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 ngày nghỉ trên lịch', 'warning');
      return;
    }
    if (!createData.note.trim()) {
      showToast('Vui lòng nhập lý do', 'warning');
      return;
    }
    setProcessing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên';
      const userEmail = auth.currentUser?.email || '';
      const userId = auth.currentUser?.uid || '';

      await addDoc(collection(db, 'attendance_logs'), {
        ownerId: owner.ownerId,
        userId,
        userName,
        userEmail,
        date: today,
        type: 'request',
        requestType: createData.type,
        note: createData.note,
        dates: createData.type === 'leave' ? createData.selectedDates : [today],
        status: 'pending',
        createdAt: serverTimestamp()
      });

      const leaveLabel = createData.type === 'leave' ? 'NGHỈ PHÉP' : 'ĐI MUỘN';
      const dateInfo = createData.type === 'leave'
        ? `${createData.selectedDates.length} ngày (${createData.selectedDates.join(', ')})`
        : `ngày ${today}`;

      // Gửi thông báo Telegram cho nhóm xưởng
      notifyLeaveRequestEvent(owner.ownerId, {
        userName,
        userEmail,
        requestType: createData.type as 'leave' | 'late',
        dates: createData.type === 'leave' ? createData.selectedDates : today,
        note: createData.note
      }).catch(() => {});

      await createAdminNotification(owner.ownerId, {
        title: `📋 Yêu cầu ${leaveLabel} mới`,
        body: `${userName} đã đăng ký ${leaveLabel} ${dateInfo}\nLý do: ${createData.note}`,
        type: 'attendance_request',
        priority: 'high'
      });

      await createUserNotification(userId, {
        title: `✅ Đã gửi yêu cầu ${leaveLabel}`,
        body: `Yêu cầu ${leaveLabel.toLowerCase()} ${dateInfo} đã được gửi. Vui lòng chờ admin phê duyệt.`,
        type: 'attendance_request',
        priority: 'normal'
      });

      showToast('Gửi yêu cầu thành công! Admin đã nhận thông báo.', 'success');
      setShowCreateModal(false);
      setCreateData({ type: 'leave', note: '', selectedDates: [] });
    } catch (error) {
      showToast('Lỗi khi gửi yêu cầu: ' + error, 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 min-h-screen">
      {/* Header */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center px-4 shrink-0 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl mr-3">
          <ArrowLeft size={20} className="text-slate-500" />
        </button>
        <CalendarDays size={22} className="text-[#1A237E] dark:text-indigo-400 mr-3" />
        <div>
          <h1 className="text-lg font-black text-[#1A237E] dark:text-indigo-400 uppercase">Quản lý lịch nghỉ phép</h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            {isAdmin ? 'Admin — Kiểm tra lịch nghỉ & Sắp xếp nhân sự' : 'Lịch nghỉ của bạn'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6D00] hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wide shadow-lg shadow-orange-500/20 transition-all active:scale-[0.97]"
        >
          <Plus size={16} /> Đăng ký nghỉ
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-5xl mx-auto w-full">
        {/* Calendar Card */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 md:p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
          {/* Month Navigation & Stats Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()-1, 1))}
                className="size-10 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all active:scale-95"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
                {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
              </h2>
              <button 
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 1))}
                className="size-10 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all active:scale-95"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Quick Summary Pill for Admin */}
            {isAdmin && (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {leaveRequests.filter(r => r.status === 'pending').length} chờ duyệt
                </span>
                <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {leaveRequests.filter(r => r.status === 'approved').length} đã duyệt
                </span>
              </div>
            )}
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {DAYS.map((d, i) => (
              <div 
                key={d} 
                className={`text-center text-[10px] font-black uppercase py-1.5 ${
                  i === 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((cell, idx) => {
              const ds = formatDate(cell.date);
              const status = getLeaveStatus(ds);
              const isToday = ds === todayStr;
              const isSelected = selectedCalendarDate === ds;
              const requests = leaveDateMap[ds] || [];
              const isWeekend = cell.date.getDay() === 0;

              // Tên vắn tắt của nhân viên nghỉ (cho badge lịch)
              const firstReq = requests[0];
              const staffShortName = firstReq 
                ? (firstReq.userName ? firstReq.userName.split(' ').slice(-1)[0] : 'Nghỉ')
                : '';

              return (
                <div 
                  key={idx}
                  onClick={() => {
                    if (requests.length > 0) {
                      setSelectedCalendarDate(prev => prev === ds ? null : ds);
                    } else {
                      setSelectedCalendarDate(prev => prev === ds ? null : ds);
                    }
                  }}
                  className={`
                    relative min-h-[58px] md:min-h-[68px] p-1.5 flex flex-col justify-between rounded-2xl cursor-pointer transition-all border
                    ${!cell.currentMonth ? 'opacity-30' : ''}
                    ${isSelected 
                      ? 'ring-2 ring-indigo-600 dark:ring-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-md scale-[1.02] z-10' 
                      : status === 'pending'
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60 hover:border-amber-400'
                        : status === 'approved'
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60 hover:border-emerald-400'
                          : status === 'rejected'
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                            : isToday
                              ? 'bg-slate-50 dark:bg-slate-800/60 border-indigo-300 dark:border-indigo-700/60'
                              : 'bg-slate-50/40 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'}
                  `}
                >
                  {/* Top row: Date Number + Status Icon */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${isToday ? 'font-black text-indigo-600 dark:text-indigo-400' : isWeekend ? 'font-black text-red-500' : 'font-bold text-slate-700 dark:text-slate-300'}`}>
                      {cell.date.getDate()}
                    </span>

                    {status === 'pending' && (
                      <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                    )}
                    {status === 'approved' && (
                      <span className="size-2 rounded-full bg-emerald-500" />
                    )}
                  </div>

                  {/* Bottom: Staff Names Badge */}
                  {requests.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      <div className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg truncate flex items-center gap-1 ${
                        status === 'pending'
                          ? 'bg-amber-500 text-white'
                          : status === 'approved'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-500 text-white'
                      }`}>
                        <span>🏖️</span>
                        <span className="truncate">
                          {requests.length === 1 ? staffShortName : `${requests.length} người`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-md bg-amber-500" />
                <span className="text-slate-500 dark:text-slate-400 uppercase">Chờ duyệt (Pending)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-md bg-emerald-600" />
                <span className="text-slate-500 dark:text-slate-400 uppercase">Đã duyệt (Approved)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-md bg-rose-500" />
                <span className="text-slate-500 dark:text-slate-400 uppercase">Từ chối (Rejected)</span>
              </div>
            </div>

            {selectedCalendarDate && (
              <button
                onClick={() => setSelectedCalendarDate(null)}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
              >
                <X size={14} /> Xoá lọc ngày ({selectedCalendarDate.split('-').reverse().join('/')})
              </button>
            )}
          </div>
        </div>

        {/* Selected Day Schedule Banner (For Admin check & schedule) */}
        {selectedCalendarDate && (
          <div className="bg-indigo-50 dark:bg-indigo-950/40 rounded-3xl p-5 border border-indigo-100 dark:border-indigo-900/50 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                  <CalendarIcon size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-100 uppercase">
                    Lịch nhân sự ngày {selectedCalendarDate.split('-').reverse().join('/')}
                  </h3>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                    {selectedDateRequests.length > 0 
                      ? `Có ${selectedDateRequests.length} nhân viên đăng ký nghỉ / đi muộn vào ngày này.`
                      : 'Không có nhân viên nào đăng ký nghỉ trong ngày này (Nhân sự đi làm đủ).'}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedCalendarDate(null)}
                className="p-1.5 text-indigo-400 hover:text-indigo-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {selectedDateRequests.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {selectedDateRequests.map((req) => (
                  <div 
                    key={req.id} 
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-between gap-3 shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {req.userName || 'Nhân viên'}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          req.status === 'approved' 
                            ? 'bg-emerald-500/10 text-emerald-600' 
                            : req.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-600'
                              : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {req.status === 'approved' ? 'Đã duyệt' : req.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {req.requestType === 'leave' ? '🏖️ Xin nghỉ phép' : '⏰ Xin đi muộn / về sớm'}
                      </p>

                      {req.note && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <strong className="text-slate-800 dark:text-white">Lý do:</strong> {req.note}
                        </p>
                      )}
                    </div>

                    {isAdmin && req.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={processing}
                          className="flex-1 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          <Check size={14} /> Duyệt đơn
                        </button>
                        <button
                          onClick={() => handleReject(req)}
                          disabled={processing}
                          className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-500 hover:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <X size={14} /> Từ chối
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Filter size={14} className="text-slate-400 shrink-0" />
            {(['all','pending','approved','rejected'] as const).map(f => (
              <button 
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all whitespace-nowrap ${
                  statusFilter === f
                    ? 'bg-[#1A237E] dark:bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                {f === 'all' ? 'Tất cả đơn' : f === 'pending' ? 'Chờ duyệt' : f === 'approved' ? 'Đã duyệt' : 'Từ chối'}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 font-bold shrink-0">
            {filteredRequests.length} yêu cầu
          </span>
        </div>

        {/* Leave Request List */}
        <div className="space-y-3 pb-24">
          {loading ? (
            <div className="text-center py-12 text-slate-400 font-bold text-sm flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              Đang tải danh sách nghỉ phép...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8">
              <CalendarDays size={44} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                {selectedCalendarDate 
                  ? `Không có đơn nghỉ phép nào trong ngày ${selectedCalendarDate.split('-').reverse().join('/')}`
                  : 'Chưa có yêu cầu nghỉ phép nào'}
              </p>
            </div>
          ) : (
            filteredRequests.map(req => {
              const rawDates = req.dates || [req.date];
              const dateArr = Array.isArray(rawDates) ? rawDates : [rawDates];
              const statusIcon = req.status === 'approved' ? <CheckCircle2 size={16} className="text-emerald-500" />
                : req.status === 'rejected' ? <XCircle size={16} className="text-rose-500" />
                : <Clock size={16} className="text-amber-500" />;

              return (
                <div 
                  key={req.id}
                  onClick={() => { 
                    if(isAdmin) { 
                      setSelectedRequest(req); 
                      navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } }); 
                    }
                  }}
                  className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border transition-all relative shadow-sm ${
                    req.status === 'approved' ? 'border-emerald-100 dark:border-emerald-900/30' :
                    req.status === 'rejected' ? 'border-rose-100 dark:border-rose-900/30' :
                    'border-amber-200 dark:border-amber-900/40 bg-amber-50/20'
                  } ${isAdmin ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700' : ''}`}
                >
                  {((req.userId === auth.currentUser?.uid && req.status === 'pending') || isAdmin) && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
                      {req.userId === auth.currentUser?.uid && req.status === 'pending' && (
                        <button onClick={(e) => openEditModal(req, e)} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"><Edit2 size={16}/></button>
                      )}
                      <button onClick={(e) => handleDeleteRequest(req, e)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors"><Trash2 size={16}/></button>
                    </div>
                  )}

                  <div className="flex items-start justify-between pr-16">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusIcon}
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                          {req.userName || req.userEmail || 'Nhân viên'}
                        </span>
                        {req.userEmail && (
                          <span className="text-xs text-slate-400 font-medium">({req.userEmail})</span>
                        )}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          req.status === 'rejected' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                          'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}>
                          {req.status === 'approved' ? 'Đã duyệt' : req.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {req.requestType === 'leave' ? '🏖️ Đăng ký nghỉ phép' : '⏰ Đăng ký đi muộn / về sớm'} • {dateArr.length} ngày
                      </p>

                      {req.note && (
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                          <strong>Lý do:</strong> {req.note}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <span className="text-[10px] text-slate-400 font-bold mr-1">Ngày nghỉ:</span>
                        {dateArr.map((ds: string) => (
                          <span key={ds} className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800">
                            {typeof ds === 'string' ? ds.split('T')[0].split('-').reverse().join('/') : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detail Modal (Admin only) */}
      <AnimatePresence>
        {selectedRequest && isAdmin && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setSelectedRequest(null); }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4">Chi tiết yêu cầu nghỉ phép</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase">Nhân viên</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedRequest.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase">Loại yêu cầu</span>
                  <span className="text-sm font-bold">{selectedRequest.requestType === 'leave' ? '🏖️ Nghỉ phép' : '⏰ Đi muộn / Về sớm'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase">Ngày đăng ký</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {(selectedRequest.dates || [selectedRequest.date]).map((d: string) => typeof d === 'string' ? d.split('T')[0].split('-').reverse().join('/') : '').join(', ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase">Lý do</span>
                  <span className="text-sm text-right max-w-[60%]">{selectedRequest.note}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase">Trạng thái</span>
                  <span className={`text-sm font-bold ${
                    selectedRequest.status === 'approved' ? 'text-emerald-600' :
                    selectedRequest.status === 'rejected' ? 'text-rose-600' :
                    'text-amber-600'
                  }`}>
                    {selectedRequest.status === 'approved' ? 'Đã duyệt' :
                     selectedRequest.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                  </span>
                </div>
              </div>

              {selectedRequest.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="flex-1 py-3 rounded-2xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800"
                  >Đóng</button>
                  <button
                    onClick={() => handleReject(selectedRequest)}
                    disabled={processing}
                    className="flex-1 py-3 rounded-2xl font-bold text-white bg-rose-500 disabled:opacity-50"
                  >Từ chối</button>
                  <button
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={processing}
                    className="flex-1 py-3 rounded-2xl font-bold text-white bg-emerald-500 disabled:opacity-50"
                  >Duyệt</button>
                </div>
              )}
              {selectedRequest.status !== 'pending' && (
                <button onClick={() => setSelectedRequest(null)}
                  className="w-full py-3 rounded-2xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800">Đóng</button>
              )}
            </motion.div>
          </div>
        )}

        {/* Edit Modal (Employee only) */}
        {editingRequest && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setEditingRequest(null); }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4">Chỉnh sửa yêu cầu</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Loại yêu cầu</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditData(p => ({ ...p, type: 'leave' }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                        editData.type === 'leave'
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400'
                          : 'border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      Nghỉ phép
                    </button>
                    <button
                      onClick={() => setEditData(p => ({ ...p, type: 'late' }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                        editData.type === 'late'
                          ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400'
                          : 'border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      Đi muộn / Về sớm
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Lý do</label>
                  <textarea
                    value={editData.note}
                    onChange={(e) => setEditData(p => ({ ...p, note: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 resize-none h-24"
                    placeholder="Nhập lý do chi tiết..."
                  ></textarea>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Chọn ngày</label>
                  <LeaveCalendar
                    selectedDates={editData.selectedDates}
                    onDatesChange={(dates) => {
                      if (editData.type === 'late') {
                        setEditData(p => ({ ...p, selectedDates: dates.slice(-1) }));
                      } else {
                        setEditData(p => ({ ...p, selectedDates: dates }));
                      }
                    }}
                    minDate={today}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingRequest(null)}
                  className="flex-1 py-3 rounded-2xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800"
                >
                  Đóng
                </button>
                <button
                  onClick={handleUpdateRequest}
                  disabled={processing}
                  className="flex-1 py-3 rounded-2xl font-bold text-white bg-indigo-600 disabled:opacity-50"
                >
                  {processing ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Create Request Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4" onClick={() => setShowCreateModal(false)}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ y: '100%', scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: '100%', scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden relative z-10"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase">Đăng ký nghỉ phép</h3>
                <button onClick={() => setShowCreateModal(false)} className="size-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Type */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Loại đăng ký</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setCreateData(p => ({ ...p, type: 'leave' }))}
                      className={`py-3.5 rounded-2xl text-sm font-bold border transition-colors ${
                        createData.type === 'leave'
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400'
                          : 'border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      🏖 Nghỉ phép
                    </button>
                    <button
                      onClick={() => setCreateData(p => ({ ...p, type: 'late' }))}
                      className={`py-3.5 rounded-2xl text-sm font-bold border transition-colors ${
                        createData.type === 'late'
                          ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400'
                          : 'border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      ⏰ Đi muộn / Về sớm
                    </button>
                  </div>
                </div>

                {/* Calendar (only for leave) */}
                {createData.type === 'leave' && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Chọn ngày nghỉ</label>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                      <LeaveCalendar
                        selectedDates={createData.selectedDates}
                        onDatesChange={(dates) => setCreateData(p => ({ ...p, selectedDates: dates }))}
                      />
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Lý do</label>
                  <textarea
                    value={createData.note}
                    onChange={(e) => setCreateData(p => ({ ...p, note: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 resize-none h-24"
                    placeholder="Nhập lý do chi tiết..."
                  ></textarea>
                </div>
              </div>

              <div className="px-6 pb-6 pt-2 shrink-0">
                <button
                  onClick={handleCreateRequest}
                  disabled={processing}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-[#FF6D00] hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <Send size={18} /> {processing ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeaveManagement;
