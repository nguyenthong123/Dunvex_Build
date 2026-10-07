import React, { useState, useEffect, useMemo } from 'react';
import {
	ChevronLeft, ChevronRight, Calendar, Clock, User, DollarSign,
	AlertCircle, CheckCircle2, XCircle, Info, X, Briefcase, Palmtree,
	AlertTriangle, CalendarDays, ExternalLink, MapPin
} from 'lucide-react';
import { db, collection, query, where, getDocs, Timestamp } from '../../services/firebase';

interface SalarySummaryProps {
	userList: any[];
	ownerId: string;
	companyInfo: any;
	logs?: any[];
	fieldLogs?: any[];
}

export const SalarySummary: React.FC<SalarySummaryProps> = ({
	userList,
	ownerId,
	companyInfo,
	logs: propLogs,
	fieldLogs: propFieldLogs
}) => {
	const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
	const [viewMode, setViewMode] = useState<'summary' | 'calendar'>('summary');
	const [selectedUserId, setSelectedUserId] = useState<string>('');
	const [selectedDayDetail, setSelectedDayDetail] = useState<any | null>(null);

	const [fetchedLogs, setFetchedLogs] = useState<any[]>([]);
	const [fetchedFieldLogs, setFetchedFieldLogs] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);

	// Chọn nhân viên mặc định khi userList có dữ liệu
	useEffect(() => {
		if (userList.length > 0 && !selectedUserId) {
			setSelectedUserId(userList[0].id);
		}
	}, [userList, selectedUserId]);

	// Nếu không có props logs, fetch an toàn từ Firestore (không dùng composite index)
	useEffect(() => {
		if (propLogs && propLogs.length > 0) return;
		if (!ownerId) return;

		let isMounted = true;
		const loadData = async () => {
			setLoading(true);
			try {
				const attQ = query(collection(db, 'attendance_logs'), where('ownerId', '==', ownerId));
				const checkinQ = query(collection(db, 'checkins'), where('ownerId', '==', ownerId));

				const [attSnap, checkinSnap] = await Promise.all([
					getDocs(attQ),
					getDocs(checkinQ)
				]);

				if (isMounted) {
					setFetchedLogs(attSnap.docs.map(d => ({ id: d.id, ...d.data() })));
					setFetchedFieldLogs(checkinSnap.docs.map(d => ({ id: d.id, ...d.data() })));
				}
			} catch (err) {
				console.error('Error fetching logs for SalarySummary:', err);
			} finally {
				if (isMounted) setLoading(false);
			}
		};

		loadData();
		return () => { isMounted = false; };
	}, [ownerId, propLogs]);

	// Nguồn dữ liệu hợp nhất
	const allAttendanceLogs = propLogs && propLogs.length > 0 ? propLogs : fetchedLogs;
	const allFieldLogs = propFieldLogs && propFieldLogs.length > 0 ? propFieldLogs : fetchedFieldLogs;

	const formatPrice = (n: number) => Math.round(n || 0).toLocaleString('vi-VN');

	// Hàm lấy chuỗi YYYY-MM-DD từ giá trị bất kỳ
	const parseDateStr = (val: any): string => {
		if (!val) return '';
		if (typeof val === 'string') {
			if (val.includes('T')) return val.split('T')[0];
			if (val.length === 10 && val.includes('-')) return val;
			const d = new Date(val);
			if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
		}
		if (val?.seconds) {
			return new Date(val.seconds * 1000).toISOString().split('T')[0];
		}
		if (val instanceof Date && !isNaN(val.getTime())) {
			return val.toISOString().split('T')[0];
		}
		return '';
	};

	// Chuyển timestamp sang milliseconds
	const toMs = (time: any): number | null => {
		if (!time) return null;
		if (time.seconds !== undefined) return time.seconds * 1000;
		if (typeof time === 'string') {
			const parsed = new Date(time).getTime();
			return isNaN(parsed) ? null : parsed;
		}
		if (time.toDate) return time.toDate().getTime();
		if (time instanceof Date) return time.getTime();
		return null;
	};

	const formatTime = (time: any): string => {
		const ms = toMs(time);
		if (!ms) return '';
		return new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
	};

	// Điều hướng tháng
	const changeMonth = (offset: number) => {
		const [y, m] = month.split('-').map(Number);
		const d = new Date(y, m - 1 + offset, 1);
		const newMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		setMonth(newMonthStr);
	};

	// Tính toán dữ liệu toàn bộ nhân viên trong tháng
	const salaryData = useMemo(() => {
		const [year, mon] = month.split('-').map(Number);
		const daysInMonth = new Date(year, mon, 0).getDate();
		const todayStr = new Date().toISOString().slice(0, 10);
		const WORKING_DAYS = Number(companyInfo?.standardWorkingDays) || 26;

		return userList.map(user => {
			const userOfficeLogs: any[] = [];
			const userLeaveRequests: any[] = [];
			const userFieldLogs: any[] = [];

			// 1. Phân loại attendance_logs cho user
			allAttendanceLogs.forEach(log => {
				const isUser = log.userId === user.id || (log.userEmail && log.userEmail === user.email);
				if (!isUser) return;

				if (log.type === 'request') {
					userLeaveRequests.push(log);
				} else {
					userOfficeLogs.push(log);
				}
			});

			// 2. Phân loại field_checkins cho user
			allFieldLogs.forEach(log => {
				const isUser = log.userId === user.id || (log.userEmail && log.userEmail === user.email);
				if (isUser) {
					userFieldLogs.push(log);
				}
			});

			// 3. Xây dựng Map chi tiết từng ngày trong tháng
			const daysMap: Record<string, any> = {};

			for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
				const dayStr = `${month}-${String(dayNum).padStart(2, '0')}`;
				const dateObj = new Date(year, mon - 1, dayNum);
				const dayOfWeek = dateObj.getDay(); // 0: CN, 1: T2, ..., 6: T7
				const isSunday = dayOfWeek === 0;
				const isPast = dayStr < todayStr;
				const isToday = dayStr === todayStr;

				// Chấm công văn phòng ngày này
				const officeLogsThisDay = userOfficeLogs.filter(log => {
					const lDate = log.date || parseDateStr(log.checkInAt) || parseDateStr(log.createdAt);
					return lDate === dayStr;
				});

				// Chấm công thị trường ngày này
				const fieldLogsThisDay = userFieldLogs.filter(log => {
					const fDate = parseDateStr(log.createdAt) || log.date;
					return fDate === dayStr;
				});

				// Đơn nghỉ phép áp dụng cho ngày này
				const leaveRequestsThisDay = userLeaveRequests.filter(req => {
					const datesArr: string[] = Array.isArray(req.dates) ? req.dates.map(parseDateStr) : [parseDateStr(req.date)];
					return datesArr.includes(dayStr);
				});

				// Đơn nghỉ phép chính (nếu có)
				const primaryLeave = leaveRequestsThisDay[0] || null;

				// Tính toán giờ vào / ra và công
				let checkInMs: number | null = null;
				let checkOutMs: number | null = null;
				let firstCheckInLog: any = null;
				let lastCheckOutLog: any = null;

				officeLogsThisDay.forEach(log => {
					const inMs = toMs(log.checkInAt || log.createdAt);
					const outMs = toMs(log.checkOutAt);

					if (inMs !== null) {
						if (checkInMs === null || inMs < checkInMs) {
							checkInMs = inMs;
							firstCheckInLog = log;
						}
					}
					if (outMs !== null) {
						if (checkOutMs === null || outMs > checkOutMs) {
							checkOutMs = outMs;
							lastCheckOutLog = log;
						}
					}
				});

				// Số lượt chấm công khách hàng/thị trường
				const marketCount = fieldLogsThisDay.length + officeLogsThisDay.filter(l => l.type === 'customer').length;

				let dayFraction = 0;
				let workedHours = 0;

				if (officeLogsThisDay.length > 0 || checkInMs !== null) {
					if (checkInMs !== null) {
						if (checkOutMs !== null && checkOutMs > checkInMs) {
							workedHours = (checkOutMs - checkInMs) / (1000 * 3600);
						} else if (isToday) {
							workedHours = Math.max(0, Date.now() - checkInMs) / (1000 * 3600);
						} else {
							// Ngày cũ quên check-out -> tính mặc định 4h (0.5 công)
							workedHours = 4;
						}

						if (workedHours >= 6.5) {
							dayFraction = 1.0;
						} else if (workedHours >= 3.5) {
							dayFraction = 0.5;
						} else if (workedHours > 0) {
							dayFraction = Math.min(0.5, Math.round((workedHours / 8) * 100) / 100);
						}
					}
				} else if (marketCount > 0) {
					const reqPoints = Number(user.marketPointsRequired) || Number(companyInfo?.marketPointsRequired) || 1;
					dayFraction = reqPoints > 0 ? Math.min(1, marketCount / reqPoints) : 1;
				}

				// Phân loại trạng thái ngày
				let statusCategory: 'worked' | 'leave' | 'absent' | 'weekend' | 'future' = 'future';
				let statusLabel = '';

				if (dayFraction > 0 || officeLogsThisDay.length > 0 || marketCount > 0) {
					statusCategory = 'worked';
					statusLabel = `${dayFraction} công`;
				} else if (primaryLeave) {
					statusCategory = 'leave';
					const isApproved = primaryLeave.status === 'approved';
					statusLabel = isApproved ? 'Nghỉ phép (Đã duyệt)' : 'Nghỉ phép (Chờ duyệt)';
				} else if (isSunday) {
					statusCategory = 'weekend';
					statusLabel = 'Nghỉ CN';
				} else if (isPast) {
					statusCategory = 'absent';
					statusLabel = 'Không chấm công';
				} else {
					statusCategory = 'future';
					statusLabel = '';
				}

				const monthlyWage = Number(user.monthlyWage) || 0;
				const dailyWage = monthlyWage > 0 
					? Math.round(monthlyWage / WORKING_DAYS)
					: (Number(user.dailyWage) || 0);

				const dailyAmount = Math.round(dayFraction * dailyWage);

				daysMap[dayStr] = {
					dayStr,
					dayNum,
					dateObj,
					dayOfWeek,
					isSunday,
					isPast,
					isToday,
					statusCategory,
					statusLabel,
					dayFraction,
					workedHoursFormatted: workedHours > 0 ? `${Math.round(workedHours * 10) / 10}h` : '',
					checkInTime: checkInMs ? formatTime(checkInMs) : '',
					checkOutTime: checkOutMs ? formatTime(checkOutMs) : '',
					marketCount,
					dailyAmount,
					primaryLeave,
					officeLogs: officeLogsThisDay,
					fieldLogs: fieldLogsThisDay,
					leaveRequests: leaveRequestsThisDay,
					firstCheckInLog,
					lastCheckOutLog
				};
			}

			// Tổng hợp tháng của user
			const allDays = Object.values(daysMap);
			const totalDaysWorked = allDays.reduce((sum, d) => sum + d.dayFraction, 0);
			const roundedWorked = Math.round(totalDaysWorked * 100) / 100;
			const totalLeaveDays = allDays.filter(d => d.statusCategory === 'leave').length;
			const totalAbsentDays = allDays.filter(d => d.statusCategory === 'absent').length;

			const monthlyWage = Number(user.monthlyWage) || 0;
			const dailyWage = monthlyWage > 0 
				? Math.round(monthlyWage / WORKING_DAYS)
				: (Number(user.dailyWage) || 0);
			const totalSalary = Math.round(roundedWorked * dailyWage);

			return {
				userId: user.id,
				user,
				name: user.displayName || user.email?.split('@')[0] || 'N/A',
				email: user.email,
				role: user.role,
				monthlyWage,
				dailyWage,
				totalSalary,
				daysWorked: roundedWorked,
				leaveDays: totalLeaveDays,
				absentDays: totalAbsentDays,
				daysMap,
				daysInMonth
			};
		});
	}, [userList, allAttendanceLogs, allFieldLogs, month, companyInfo]);

	// Nhân viên đang được chọn trong chế độ Lịch
	const selectedUserSalary = useMemo(() => {
		return salaryData.find(s => s.userId === selectedUserId) || salaryData[0] || null;
	}, [salaryData, selectedUserId]);

	// Danh sách các ngày trong tháng xếp theo tuần (Thứ 2 đến CN)
	const calendarGrid = useMemo(() => {
		if (!selectedUserSalary) return [];
		const [year, mon] = month.split('-').map(Number);
		const daysInMonth = selectedUserSalary.daysInMonth;

		// Thứ của ngày 1 (0: CN, 1: T2, ..., 6: T7)
		const firstDayWeekday = new Date(year, mon - 1, 1).getDay();
		// Cột bắt đầu với Thứ 2 là cột 0: (firstDayWeekday + 6) % 7
		const startOffset = (firstDayWeekday + 6) % 7;

		const cells: Array<{ type: 'empty' | 'day'; data?: any; key: string }> = [];

		// Các ô trống đầu tháng
		for (let i = 0; i < startOffset; i++) {
			cells.push({ type: 'empty', key: `empty-start-${i}` });
		}

		// Các ngày trong tháng
		for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
			const dayStr = `${month}-${String(dayNum).padStart(2, '0')}`;
			const dayData = selectedUserSalary.daysMap[dayStr];
			cells.push({
				type: 'day',
				data: dayData,
				key: `day-${dayStr}`
			});
		}

		return cells;
	}, [selectedUserSalary, month]);

	const totalCompanySalary = useMemo(() => {
		return salaryData.reduce((sum, d) => sum + d.totalSalary, 0);
	}, [salaryData]);

	const totalCompanyDays = useMemo(() => {
		return salaryData.reduce((sum, d) => sum + d.daysWorked, 0);
	}, [salaryData]);

	return (
		<div className="space-y-6">
			{/* ─── Header & Điều khiển ─── */}
			<div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
						<DollarSign size={24} />
					</div>
					<div>
						<h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
							Bảng Lương & Lịch Chấm Công
						</h3>
						<p className="text-xs text-slate-400 font-medium">
							Tháng {month} • {salaryData.length} nhân viên • Tổng quỹ lương: <strong className="text-emerald-600 dark:text-emerald-400">{formatPrice(totalCompanySalary)}đ</strong>
						</p>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{/* Chọn tháng */}
					<div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1">
						<button
							type="button"
							onClick={() => changeMonth(-1)}
							className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition text-slate-600 dark:text-slate-300"
							title="Tháng trước"
						>
							<ChevronLeft size={16} />
						</button>
						<div className="flex items-center gap-1.5 px-2 cursor-pointer" onClick={() => {
							const el = document.getElementById('salary-month-input') as HTMLInputElement | null;
							if (el && typeof el.showPicker === 'function') {
								el.showPicker();
							}
						}}>
							<Calendar size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
							<input
								id="salary-month-input"
								type="month"
								value={month}
								onChange={e => setMonth(e.target.value)}
								className="bg-transparent border-none text-xs font-black text-slate-700 dark:text-white py-1 outline-none text-center cursor-pointer"
							/>
						</div>
						<button
							type="button"
							onClick={() => changeMonth(1)}
							className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition text-slate-600 dark:text-slate-300"
							title="Tháng sau"
						>
							<ChevronRight size={16} />
						</button>
					</div>

					{/* Chuyển View Mode */}
					<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
						<button
							onClick={() => setViewMode('summary')}
							className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
								viewMode === 'summary'
									? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
									: 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
							}`}
						>
							<Briefcase size={14} />
							<span>Bảng Tổng Hợp</span>
						</button>
						<button
							onClick={() => setViewMode('calendar')}
							className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
								viewMode === 'calendar'
									? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
									: 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
							}`}
						>
							<CalendarDays size={14} />
							<span>Lịch Chi Tiết</span>
						</button>
					</div>
				</div>
			</div>

			{loading && (
				<div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
					<div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-3" />
					<p className="text-xs font-bold text-slate-400">Đang tổng hợp dữ liệu chấm công & bảng lương...</p>
				</div>
			)}

			{!loading && viewMode === 'summary' && (
				/* ─── TAB 1: BẢNG TỔNG HỢP NHÂN VIÊN ─── */
				<div className="space-y-4">
					{/* Thẻ thống kê nhanh */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						<div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tổng nhân sự</span>
							<p className="text-xl font-black text-slate-800 dark:text-white mt-1">{salaryData.length} người</p>
						</div>
						<div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tổng ngày công</span>
							<p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{totalCompanyDays} công</p>
						</div>
						<div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tổng đơn nghỉ phép</span>
							<p className="text-xl font-black text-amber-500 mt-1">
								{salaryData.reduce((s, d) => s + d.leaveDays, 0)} ngày
							</p>
						</div>
						<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/30">
							<span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Tổng quỹ lương</span>
							<p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatPrice(totalCompanySalary)}đ</p>
						</div>
					</div>

					{/* Desktop Table View */}
					<div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
						<table className="w-full text-left">
							<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
								<tr>
									<th className="px-5 py-3.5">Nhân viên</th>
									<th className="px-4 py-3.5 text-center">Ngày làm</th>
									<th className="px-4 py-3.5 text-center">Nghỉ phép</th>
									<th className="px-4 py-3.5 text-center">Vắng (K.phép)</th>
									<th className="px-4 py-3.5 text-right">Lương/tháng</th>
									<th className="px-4 py-3.5 text-right">Lương/ngày</th>
									<th className="px-4 py-3.5 text-right">Thực lãnh</th>
									<th className="px-4 py-3.5 text-center">Tra cứu</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
								{salaryData.map(d => (
									<tr key={d.userId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
										<td className="px-5 py-4">
											<div className="flex items-center gap-3">
												<div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center uppercase">
													{d.name.slice(0, 2)}
												</div>
												<div>
													<div className="font-bold text-sm text-slate-800 dark:text-white">{d.name}</div>
													<div className="text-[11px] text-slate-400">{d.email}</div>
												</div>
											</div>
										</td>
										<td className="px-4 py-4 text-center">
											<span className={`font-black text-sm px-2.5 py-1 rounded-full ${
												d.daysWorked > 0 ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-300'
											}`}>
												{d.daysWorked} công
											</span>
										</td>
										<td className="px-4 py-4 text-center">
											{d.leaveDays > 0 ? (
												<span className="font-bold text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-full">
													{d.leaveDays} ngày
												</span>
											) : (
												<span className="text-slate-300 text-xs">-</span>
											)}
										</td>
										<td className="px-4 py-4 text-center">
											{d.absentDays > 0 ? (
												<span className="font-bold text-xs bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full">
													{d.absentDays} ngày
												</span>
											) : (
												<span className="text-slate-300 text-xs">-</span>
											)}
										</td>
										<td className="px-4 py-4 text-right text-xs font-bold text-slate-600 dark:text-slate-300">
											{d.monthlyWage > 0 ? `${formatPrice(d.monthlyWage)}đ` : <span className="text-slate-300 italic">-</span>}
										</td>
										<td className="px-4 py-4 text-right text-xs font-bold text-slate-600 dark:text-slate-300">
											{d.dailyWage > 0 ? `${formatPrice(d.dailyWage)}đ` : <span className="text-slate-300 italic">-</span>}
										</td>
										<td className="px-4 py-4 text-right">
											<span className={`font-black text-sm ${
												d.totalSalary > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300'
											}`}>
												{formatPrice(d.totalSalary)}đ
											</span>
										</td>
										<td className="px-4 py-4 text-center">
											<button
												onClick={() => {
													setSelectedUserId(d.userId);
													setViewMode('calendar');
												}}
												className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition flex items-center gap-1 mx-auto"
											>
												<Calendar size={13} />
												<span>Lịch</span>
											</button>
										</td>
									</tr>
								))}
							</tbody>
							<tfoot className="bg-indigo-50/50 dark:bg-indigo-950/20 border-t border-slate-100 dark:border-slate-800">
								<tr>
									<td className="px-5 py-4 font-black text-xs uppercase text-indigo-600 dark:text-indigo-400">TỔNG CỘNG QUỸ LƯƠNG</td>
									<td className="px-4 py-4 text-center font-black text-indigo-600 dark:text-indigo-400">{totalCompanyDays} công</td>
									<td colSpan={4}></td>
									<td className="px-4 py-4 text-right font-black text-lg text-emerald-600 dark:text-emerald-400">{formatPrice(totalCompanySalary)}đ</td>
									<td></td>
								</tr>
							</tfoot>
						</table>
					</div>

					{/* Mobile Card List */}
					<div className="md:hidden space-y-3">
						{salaryData.map(d => (
							<div key={d.userId} className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2.5">
										<div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center uppercase">
											{d.name.slice(0, 2)}
										</div>
										<div>
											<div className="font-bold text-sm text-slate-800 dark:text-white">{d.name}</div>
											<div className="text-[10px] text-slate-400">{d.role === 'admin' ? 'Quản trị' : d.role === 'sale' ? 'Sale' : 'Nhân viên'}</div>
										</div>
									</div>
									<button
										onClick={() => {
											setSelectedUserId(d.userId);
											setViewMode('calendar');
										}}
										className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl flex items-center gap-1"
									>
										<Calendar size={13} />
										<span>Xem Lịch</span>
									</button>
								</div>

								<div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50 dark:border-slate-800 text-center text-xs">
									<div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2">
										<span className="text-[10px] text-slate-400 block">Ngày công</span>
										<strong className="text-indigo-600 dark:text-indigo-400">{d.daysWorked} công</strong>
									</div>
									<div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2">
										<span className="text-[10px] text-slate-400 block">Nghỉ phép</span>
										<strong className="text-purple-600 dark:text-purple-400">{d.leaveDays} ngày</strong>
									</div>
									<div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2">
										<span className="text-[10px] text-slate-400 block">Vắng k.phép</span>
										<strong className="text-rose-500">{d.absentDays} ngày</strong>
									</div>
								</div>

								<div className="flex justify-between items-center pt-2 border-t border-slate-50 dark:border-slate-800">
									<div className="text-xs text-slate-400">
										Lương ngày: <strong className="text-slate-700 dark:text-slate-300">{d.dailyWage > 0 ? `${formatPrice(d.dailyWage)}đ` : '-'}</strong>
									</div>
									<div className="text-base font-black text-emerald-600 dark:text-emerald-400">
										{formatPrice(d.totalSalary)}đ
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{!loading && viewMode === 'calendar' && selectedUserSalary && (
				/* ─── TAB 2: LỊCH CHẤM CÔNG & NGHỈ PHÉP CHI TIẾT ─── */
				<div className="space-y-4">
					{/* Thanh chọn nhân viên và tóm tắt */}
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
							<div className="flex items-center gap-3">
								<div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-base uppercase">
									{selectedUserSalary.name.slice(0, 2)}
								</div>
								<div>
									<div className="flex items-center gap-2">
										<h4 className="text-lg font-black text-slate-800 dark:text-white">{selectedUserSalary.name}</h4>
										<span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
											{selectedUserSalary.role}
										</span>
									</div>
									<p className="text-xs text-slate-400 font-medium">{selectedUserSalary.email}</p>
								</div>
							</div>

							{/* Dropdown chọn nhanh nhân viên khác */}
							<div className="flex items-center gap-2">
								<span className="text-xs font-bold text-slate-400">Chọn nhân viên:</span>
								<select
									value={selectedUserId}
									onChange={e => setSelectedUserId(e.target.value)}
									className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-white outline-none cursor-pointer"
								>
									{userList.map(u => (
										<option key={u.id} value={u.id}>{u.displayName || u.email}</option>
									))}
								</select>
							</div>
						</div>

						{/* Thẻ tóm tắt tháng của nhân viên */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
							<div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-3 text-center">
								<span className="text-[10px] font-bold text-slate-400 uppercase">Tổng ngày công</span>
								<p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{selectedUserSalary.daysWorked} công</p>
							</div>
							<div className="bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl p-3 text-center">
								<span className="text-[10px] font-bold text-purple-400 uppercase">Đã xin nghỉ phép</span>
								<p className="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">{selectedUserSalary.leaveDays} ngày</p>
							</div>
							<div className="bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl p-3 text-center">
								<span className="text-[10px] font-bold text-rose-400 uppercase">Vắng không phép</span>
								<p className="text-lg font-black text-rose-500 mt-0.5">{selectedUserSalary.absentDays} ngày</p>
							</div>
							<div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-3 text-center">
								<span className="text-[10px] font-bold text-emerald-500 uppercase">Lương thực lãnh</span>
								<p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatPrice(selectedUserSalary.totalSalary)}đ</p>
							</div>
						</div>
					</div>

					{/* ─── Lưới Lịch 7 Cột (Thứ 2 -> Chủ Nhật) ─── */}
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
						{/* Tiêu đề 7 ngày trong tuần */}
						<div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
							<div>Thứ 2</div>
							<div>Thứ 3</div>
							<div>Thứ 4</div>
							<div>Thứ 5</div>
							<div>Thứ 6</div>
							<div>Thứ 7</div>
							<div className="text-rose-500">Chủ Nhật</div>
						</div>

						{/* Lưới các ô ngày */}
						<div className="grid grid-cols-7 gap-1.5 sm:gap-2">
							{calendarGrid.map(cell => {
								if (cell.type === 'empty') {
									return (
										<div
											key={cell.key}
											className="min-h-[90px] sm:min-h-[110px] rounded-2xl bg-slate-50/40 dark:bg-slate-850/20 border border-transparent"
										/>
									);
								}

								const day = cell.data;
								const isToday = day.isToday;
								const hasWorked = day.statusCategory === 'worked';
								const hasLeave = day.statusCategory === 'leave';
								const isAbsent = day.statusCategory === 'absent';
								const isSunday = day.isSunday;

								return (
									<div
										key={cell.key}
										onClick={() => setSelectedDayDetail(day)}
										className={`min-h-[90px] sm:min-h-[110px] rounded-2xl p-2 sm:p-2.5 transition-all cursor-pointer flex flex-col justify-between border ${
											isToday
												? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20'
												: hasWorked
												? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-300'
												: hasLeave
												? 'bg-purple-50/30 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30 hover:border-purple-300'
												: isAbsent
												? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30 hover:border-rose-300'
												: isSunday
												? 'bg-slate-50/60 dark:bg-slate-850/40 border-slate-100 dark:border-slate-800 hover:border-slate-300'
												: 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200'
										}`}
									>
										{/* Hàng trên: Ngày + Badge */}
										<div className="flex items-center justify-between">
											<span className={`text-xs sm:text-sm font-black ${
												isToday
													? 'w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs'
													: isSunday
													? 'text-rose-500'
													: 'text-slate-700 dark:text-slate-300'
											}`}>
												{day.dayNum}
											</span>

											{hasWorked && (
												<span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
													{day.dayFraction} công
												</span>
											)}
											{hasLeave && (
												<span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
													Phép
												</span>
											)}
										</div>

										{/* Thân ô: Nội dung giờ vào/ra hoặc lý do nghỉ */}
										<div className="my-1 space-y-0.5 text-[10px]">
											{hasWorked && (
												<>
													{day.checkInTime && (
														<div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold truncate">
															<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
															<span className="truncate">Vào: {day.checkInTime}</span>
														</div>
													)}
													{day.checkOutTime && (
														<div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 truncate">
															<span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
															<span className="truncate">Ra: {day.checkOutTime}</span>
														</div>
													)}
													{day.marketCount > 0 && !day.checkInTime && (
														<div className="text-blue-600 dark:text-blue-400 font-bold truncate">
															📍 {day.marketCount} điểm KH
														</div>
													)}
												</>
											)}

											{hasLeave && (
												<div className="text-purple-700 dark:text-purple-300 font-medium line-clamp-2">
													🏖️ {day.primaryLeave?.note || day.primaryLeave?.reason || 'Có đơn nghỉ phép'}
												</div>
											)}

											{isAbsent && (
												<div className="text-rose-500 font-bold text-[9px] leading-tight">
													❌ Không chấm công
												</div>
											)}

											{isSunday && !hasWorked && !hasLeave && (
												<div className="text-slate-400 text-[9px] italic">
													Nghỉ CN
												</div>
											)}
										</div>

										{/* Hàng dưới: Số tiền ngày đó */}
										<div className="pt-1 border-t border-slate-100/60 dark:border-slate-800/60 flex items-center justify-between text-[10px]">
											{hasWorked && day.dailyAmount > 0 ? (
												<span className="font-black text-emerald-600 dark:text-emerald-400 truncate">
													+{formatPrice(day.dailyAmount)}đ
												</span>
											) : (
												<span className="text-slate-300 dark:text-slate-600">-</span>
											)}
											{day.workedHoursFormatted && (
												<span className="text-[9px] text-slate-400 font-semibold">
													{day.workedHoursFormatted}
												</span>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{/* ─── Modal Popup Chi Tiết Ngày ─── */}
			{selectedDayDetail && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
					<div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
						<div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
							<div>
								<h4 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
									📅 Chi tiết ngày {selectedDayDetail.dayNum}/{month.split('-')[1]}/{month.split('-')[0]}
								</h4>
								<p className="text-xs text-slate-400">
									Nhân viên: <strong className="text-slate-700 dark:text-slate-300">{selectedUserSalary?.name}</strong>
								</p>
							</div>
							<button
								onClick={() => setSelectedDayDetail(null)}
								className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition"
							>
								<X size={16} />
							</button>
						</div>

						{/* Thống kê tính công ngày này */}
						<div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center text-xs">
							<div>
								<span className="text-[10px] text-slate-400 block">Ngày công</span>
								<strong className="text-indigo-600 dark:text-indigo-400 text-sm">
									{selectedDayDetail.dayFraction} công
								</strong>
							</div>
							<div>
								<span className="text-[10px] text-slate-400 block">Thời gian làm</span>
								<strong className="text-slate-700 dark:text-slate-300 text-sm">
									{selectedDayDetail.workedHoursFormatted || '0h'}
								</strong>
							</div>
							<div>
								<span className="text-[10px] text-slate-400 block">Số tiền ngày</span>
								<strong className="text-emerald-600 dark:text-emerald-400 text-sm">
									+{formatPrice(selectedDayDetail.dailyAmount)}đ
								</strong>
							</div>
						</div>

						{/* Trạng thái nghỉ phép (nếu có) */}
						{selectedDayDetail.primaryLeave && (
							<div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/30 rounded-2xl p-3.5 space-y-1.5">
								<div className="flex items-center justify-between">
									<span className="text-xs font-black text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
										<Palmtree size={14} />
										<span>Đơn xin nghỉ phép</span>
									</span>
									<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
										selectedDayDetail.primaryLeave.status === 'approved'
											? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
											: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
									}`}>
										{selectedDayDetail.primaryLeave.status === 'approved' ? 'Đã duyệt' : 'Đang chờ duyệt'}
									</span>
								</div>
								<p className="text-xs text-purple-900 dark:text-purple-200">
									Lý do: <strong>{selectedDayDetail.primaryLeave.note || selectedDayDetail.primaryLeave.reason || 'Nghỉ phép theo đơn'}</strong>
								</p>
							</div>
						)}

						{/* Danh sách lượt chấm công trong ngày */}
						<div className="space-y-2">
							<h5 className="text-xs font-black uppercase text-slate-400 tracking-wider">
								Lượt Chấm Công ({selectedDayDetail.officeLogs.length + selectedDayDetail.fieldLogs.length})
							</h5>

							{selectedDayDetail.officeLogs.length === 0 && selectedDayDetail.fieldLogs.length === 0 ? (
								<div className="text-center py-6 text-xs text-slate-400 italic bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl">
									Không có dữ liệu chấm công cho ngày này.
									{selectedDayDetail.isPast && !selectedDayDetail.primaryLeave && !selectedDayDetail.isSunday && (
										<p className="text-rose-500 font-bold mt-1">⚠️ Nhân viên vắng mặt không có đơn xin phép!</p>
									)}
								</div>
							) : (
								<div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
									{/* Chấm công văn phòng / hệ thống */}
									{selectedDayDetail.officeLogs.map((log: any, idx: number) => (
										<div key={`off-${idx}`} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
											<div className="space-y-0.5">
												<div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
													<Clock size={13} className="text-indigo-500" />
													<span>Vào: {log.checkInAt ? formatTime(log.checkInAt) : 'Chưa có'}</span>
													{log.checkOutAt && <span>• Ra: {formatTime(log.checkOutAt)}</span>}
												</div>
												{log.checkInDistance !== undefined && (
													<span className="text-[10px] text-slate-400 flex items-center gap-1">
														<MapPin size={11} /> Khoảng cách: {log.checkInDistance}m
													</span>
												)}
											</div>
											<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
												log.status === 'late'
													? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
													: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
											}`}>
												{log.status === 'late' ? 'Đi muộn' : 'Đúng giờ'}
											</span>
										</div>
									))}

									{/* Chấm công thị trường / khách hàng */}
									{selectedDayDetail.fieldLogs.map((f: any, idx: number) => (
										<div key={`field-${idx}`} className="bg-blue-50/40 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-100 dark:border-blue-900/30 flex justify-between items-center text-xs">
											<div>
												<div className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
													<MapPin size={13} />
													<span>Check-in khách hàng: {f.customerName || 'Thị trường'}</span>
												</div>
												{f.note && <p className="text-[10px] text-slate-400 mt-0.5">{f.note}</p>}
											</div>
											<span className="text-[10px] font-bold text-slate-500">
												{formatTime(f.createdAt)}
											</span>
										</div>
									))}
								</div>
							)}
						</div>

						<div className="pt-2">
							<button
								onClick={() => setSelectedDayDetail(null)}
								className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl font-bold text-xs text-slate-700 dark:text-white transition"
							>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default SalarySummary;
