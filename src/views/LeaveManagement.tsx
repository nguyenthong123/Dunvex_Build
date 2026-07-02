import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';
import { createUserNotification } from '../utils/notifications';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Users, Filter, Edit2, Trash2 } from 'lucide-react';
import LeaveCalendar from '../components/shared/LeaveCalendar';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const DAYS = ['CN','T2','T3','T4','T5','T6','T7'];

const LeaveManagement = () => {
  const navigate = useNavigate();
  const owner = useOwner();
  const { showToast } = useToast();
  const isAdmin = owner.role === 'admin';

  const [viewDate, setViewDate] = useState(() => new Date());
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [editData, setEditData] = useState({ type: 'leave', note: '', selectedDates: [] as string[] });
  const [processing, setProcessing] = useState(false);

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  }, []);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };

  // Fetch leave requests
  useEffect(() => {
    if (!owner.ownerId) return;
    setLoading(true);
    const fetchLeaves = async () => {
      try {
        const q = query(
          collection(db, 'attendance_logs'),
          where('ownerId', '==', owner.ownerId),
          where('type', '==', 'request')
        );
        const snap = await getDocs(q);
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // If not admin, filter to own requests
        const filtered = isAdmin
          ? all
          : all.filter((r: any) => r.userId === auth.currentUser?.uid);

        // Sort by createdAt desc
        filtered.sort((a: any, b: any) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });

        setLeaveRequests(filtered);
      } catch (err) {
        console.error('LeaveManagement fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaves();
  }, [owner.ownerId, isAdmin]);

  // Build calendar map: date string → array of leave requests
  const leaveDateMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    leaveRequests.forEach(req => {
      const dates = req.dates || [req.date];
      if (!Array.isArray(dates)) return;
      dates.forEach((ds: string) => {
        if (!map[ds]) map[ds] = [];
        map[ds].push(req);
      });
    });
    return map;
  }, [leaveRequests]);

  // Calendar grid
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
    const hasApproved = entries.some(e => e.status === 'approved');
    const hasRejected = entries.some(e => e.status === 'rejected');
    const hasPending = entries.some(e => e.status === 'pending');
    if (hasApproved) return 'approved';
    if (hasRejected) return 'rejected';
    if (hasPending) return 'pending';
    return 'pending';
  };

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return leaveRequests;
    return leaveRequests.filter(r => r.status === statusFilter);
  }, [leaveRequests, statusFilter]);

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
      showToast('Đã duyệt nghỉ phép!', 'success');
      setLeaveRequests(prev => prev.map(r => r.id === req.id ? {...r, status: 'approved'} : r));
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
      setLeaveRequests(prev => prev.map(r => r.id === req.id ? {...r, status: 'rejected'} : r));
      setSelectedRequest(null);
    } catch (err) {
      showToast('Lỗi khi từ chối', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteRequest = async (req: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Bạn có chắc muốn xoá yêu cầu này?')) {
      try {
        await deleteDoc(doc(db, 'attendance_logs', req.id));
        setLeaveRequests(prev => prev.filter(r => r.id !== req.id));
        showToast('Đã xoá yêu cầu', 'success');
      } catch (err) {
        showToast('Có lỗi xảy ra', 'error');
      }
    }
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
      setLeaveRequests(prev => prev.map(r => r.id === editingRequest.id ? { ...r, requestType: editData.type, note: editData.note, dates: datesToSave } : r));
      setEditingRequest(null);
      showToast('Đã cập nhật yêu cầu', 'success');
    } catch (err) {
      showToast('Có lỗi xảy ra', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const todayStr = formatDate(today);

  return (
    <div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 min-h-screen">
      {/* Header */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center px-4 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl mr-3">
          <ArrowLeft size={20} className="text-slate-500" />
        </button>
        <CalendarDays size={22} className="text-[#1A237E] dark:text-indigo-400 mr-3" />
        <div>
          <h1 className="text-lg font-black text-[#1A237E] dark:text-indigo-400 uppercase">Quản lý nghỉ phép</h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            {isAdmin ? 'Admin — duyệt & xem lịch' : 'Lịch nghỉ của bạn'}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Calendar Card */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          {/* Month Nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()-1, 1))}
              className="size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 1))}
              className="size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((d, i) => (
              <div key={d} className={`text-center text-[9px] font-black uppercase py-1 ${i === 0 ? 'text-red-400' : 'text-slate-400'}`}>{d}</div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, idx) => {
              const ds = formatDate(cell.date);
              const status = getLeaveStatus(ds);
              const isToday = ds === todayStr;
              const requests = leaveDateMap[ds] || [];
              const isWeekend = cell.date.getDay() === 0;

              return (
                <div key={idx}
                  className={`
                    relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-bold
                    ${!cell.currentMonth ? 'opacity-20' : ''}
                    ${status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                      status === 'rejected' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-400' :
                      status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' :
                      isToday ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 ring-1 ring-indigo-200 dark:ring-indigo-800' :
                      isWeekend ? 'text-red-300 dark:text-red-600' :
                      'text-slate-600 dark:text-slate-400'}
                  `}
                  onClick={() => {
                    if (requests.length > 0) setSelectedRequest(requests[0]);
                  }}
                >
                  <span className={isToday ? 'font-black' : ''}>{cell.date.getDate()}</span>
                  {status && (
                    <div className={`absolute -bottom-0.5 flex gap-0.5`}>
                      {requests.slice(0, 3).map((r: any, i: number) => (
                        <div key={i} className={`size-1 rounded-full ${
                          r.status === 'approved' ? 'bg-emerald-500' :
                          r.status === 'rejected' ? 'bg-rose-500' :
                          'bg-amber-500 animate-pulse'
                        }`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-slate-50 dark:border-slate-800">
            {[
              { color: 'bg-emerald-500', label: 'Đã duyệt' },
              { color: 'bg-amber-500', label: 'Chờ duyệt' },
              { color: 'bg-rose-500', label: 'Từ chối' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`size-2.5 rounded-full ${l.color}`} />
                <span className="text-[9px] font-bold text-slate-400 uppercase">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          {(['all','pending','approved','rejected'] as const).map(f => (
            <button key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${
                statusFilter === f
                  ? 'bg-[#1A237E] dark:bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'
              }`}
            >
              {f === 'all' ? 'Tất cả' : f === 'pending' ? 'Chờ duyệt' : f === 'approved' ? 'Đã duyệt' : 'Từ chối'}
            </button>
          ))}
        </div>

        {/* Leave Request List */}
        <div className="space-y-3 pb-24">
          {loading ? (
            <div className="text-center py-10 text-slate-400 font-bold text-sm">Đang tải...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-10">
              <CalendarDays size={40} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
              <p className="text-sm font-bold text-slate-400">Chưa có yêu cầu nghỉ phép nào</p>
            </div>
          ) : (
            filteredRequests.map(req => {
              const dates = req.dates || [req.date];
              const statusIcon = req.status === 'approved' ? <CheckCircle2 size={16} className="text-emerald-500" />
                : req.status === 'rejected' ? <XCircle size={16} className="text-rose-500" />
                : <Clock size={16} className="text-amber-500" />;

              return (
                <div key={req.id}
                  onClick={() => isAdmin && setSelectedRequest(req)}
                  className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all relative ${
                    req.status === 'approved' ? 'border-emerald-100 dark:border-emerald-900/30' :
                    req.status === 'rejected' ? 'border-rose-100 dark:border-rose-900/30' :
                    'border-amber-100 dark:border-amber-900/30'
                  } ${isAdmin ? 'cursor-pointer active:scale-[0.98]' : ''}`}
                >
                  {((req.userId === auth.currentUser?.uid && req.status === 'pending') || isAdmin) && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
                      {req.userId === auth.currentUser?.uid && req.status === 'pending' && (
                        <button onClick={(e) => openEditModal(req, e)} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"><Edit2 size={16}/></button>
                      )}
                      <button onClick={(e) => handleDeleteRequest(req, e)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                    </div>
                  )}
                  <div className="flex items-start justify-between pr-16">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {statusIcon}
                        <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                          {req.userName || 'Nhân viên'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 ml-6">
                        {req.requestType === 'leave' ? '🏖 Nghỉ phép' : '⏰ Đi muộn'} • {Array.isArray(dates) ? dates.length : 1} ngày
                      </p>
                      <p className="text-xs text-slate-400 ml-6 mt-0.5 line-clamp-2">{req.note}</p>
                      <div className="flex flex-wrap gap-1 ml-6 mt-1.5">
                        {(Array.isArray(dates) ? dates : [dates]).map((ds: string) => (
                          <span key={ds} className="text-[9px] font-bold px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded-md text-slate-500">
                            {ds.split('-').reverse().join('/')}
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
          <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] p-6 shadow-2xl"
            >
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4">Chi tiết yêu cầu</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase">Nhân viên</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedRequest.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase">Loại</span>
                  <span className="text-sm font-bold">{selectedRequest.requestType === 'leave' ? 'Nghỉ phép' : 'Đi muộn'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase">Ngày</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {(selectedRequest.dates || [selectedRequest.date]).map((d: string) => d.split('-').reverse().join('/')).join(', ')}
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
          <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
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
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 resize-none h-24"
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
      </AnimatePresence>
    </div>
  );
};

export default LeaveManagement;
