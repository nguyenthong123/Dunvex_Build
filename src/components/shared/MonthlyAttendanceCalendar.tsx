import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, query, where, getDocs, onSnapshot } from '../../services/firebase';
import { db } from '../../services/firebase';

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTH_NAMES = [
	'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
	'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

interface MonthlyAttendanceCalendarProps {
	ownerId: string;
	userId: string;
}

const isSameDay = (a: Date, b: Date): boolean =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

const MonthlyAttendanceCalendar: React.FC<MonthlyAttendanceCalendarProps> = ({ ownerId, userId }) => {
	const [viewDate, setViewDate] = useState(() => new Date());
	const [attendanceMap, setAttendanceMap] = useState<Record<string, { count: number; type: string }>>({});
	const [leaveDates, setLeaveDates] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(false);

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();

	useEffect(() => {
		if (!ownerId || !userId) return;

		setLoading(true);
		
		const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
		const nextMonth = new Date(year, month + 1, 1);
		const endStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

		const qLogs = query(
			collection(db, 'attendance_logs'),
			where('ownerId', '==', ownerId),
			where('userId', '==', userId)
		);

		const qCheckins = query(
			collection(db, 'checkins'),
			where('ownerId', '==', ownerId),
			where('userId', '==', userId)
		);

		let logsData: any[] = [];
		let checkinsData: any[] = [];

		const updateCalendar = (logs: any[], checkins: any[]) => {
			const attendance: Record<string, { count: number; type: string }> = {};
			const leaves = new Set<string>();

			logs.forEach(data => {
				if (data.type === 'request' && Array.isArray(data.dates)) {
					data.dates.forEach((date: string) => leaves.add(date));
				} else if (data.date && data.date >= startStr && data.date < endStr && data.type !== 'request') {
					const dateStr = data.date;
					const isCustomer = data.type === 'customer';
					if (!attendance[dateStr]) {
						attendance[dateStr] = { count: 0, type: data.type || 'store' };
					}
					if (isCustomer) {
						attendance[dateStr].count += 1;
						attendance[dateStr].type = 'customer';
					} else {
						attendance[dateStr].type = 'store';
					}
				}
			});

			checkins.forEach(data => {
				let dateStr = '';
				if (data.createdAt) {
					if (typeof data.createdAt === 'string') {
						dateStr = data.createdAt.split('T')[0];
					} else if (data.createdAt.toDate) {
						dateStr = data.createdAt.toDate().toISOString().split('T')[0];
					} else if (data.createdAt.seconds) {
						dateStr = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
					}
				}
				if (dateStr && dateStr >= startStr && dateStr < endStr) {
					if (!attendance[dateStr]) {
						attendance[dateStr] = { count: 0, type: 'customer' };
					}
					attendance[dateStr].count += 1;
					attendance[dateStr].type = 'customer';
				}
			});

			setAttendanceMap(attendance);
			setLeaveDates(leaves);
			setLoading(false);
		};

		const unsubLogs = onSnapshot(qLogs, (snap) => {
			logsData = snap.docs.map(d => d.data());
			updateCalendar(logsData, checkinsData);
		}, (err) => {
			console.error('Logs listener error:', err);
			setLoading(false);
		});

		const unsubCheckins = onSnapshot(qCheckins, (snap) => {
			checkinsData = snap.docs.map(d => d.data());
			updateCalendar(logsData, checkinsData);
		}, (err) => {
			console.error('Checkins listener error:', err);
			setLoading(false);
		});

		return () => {
			unsubLogs();
			unsubCheckins();
		};
	}, [ownerId, userId, year, month]);

	// Build calendar grid
	const calendarDays = useMemo(() => {
		const firstDayOfMonth = new Date(year, month, 1);
		const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const daysInPrevMonth = new Date(year, month, 0).getDate();

		const cells: Array<{ date: Date; currentMonth: boolean }> = [];

		// Previous month fillers
		for (let i = startDayOfWeek - 1; i >= 0; i--) {
			cells.push({
				date: new Date(year, month - 1, daysInPrevMonth - i),
				currentMonth: false,
			});
		}

		// Current month
		for (let d = 1; d <= daysInMonth; d++) {
			cells.push({
				date: new Date(year, month, d),
				currentMonth: true,
			});
		}

		// Next month fillers
		const remaining = 42 - cells.length;
		for (let d = 1; d <= remaining; d++) {
			cells.push({
				date: new Date(year, month + 1, d),
				currentMonth: false,
			});
		}

		while (cells.length > 35 && cells.slice(35).every(c => !c.currentMonth)) {
			cells.length = 35;
		}

		return cells;
	}, [year, month]);

	const goToPrevMonth = () => setViewDate(new Date(year, month - 1, 1));
	const goToNextMonth = () => setViewDate(new Date(year, month + 1, 1));

	return (
		<div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
					<CalendarDays size={18} className="text-indigo-500" />
					Lịch sử chấm công
				</h3>
			</div>

			<div className="select-none">
				{/* Header: Month Navigation */}
				<div className="flex items-center justify-between mb-3">
					<button
						type="button"
						onClick={goToPrevMonth}
						className="size-8 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
					>
						<ChevronLeft size={16} />
					</button>
					<div className="flex items-center gap-2">
						<span className="text-sm font-bold text-slate-700 dark:text-slate-200">
							{MONTH_NAMES[month]} {year}
						</span>
					</div>
					<button
						type="button"
						onClick={goToNextMonth}
						disabled={year === today.getFullYear() && month === today.getMonth()}
						className="size-8 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<ChevronRight size={16} />
					</button>
				</div>

				{/* Day name headers */}
				<div className="grid grid-cols-7 gap-1 mb-1">
					{DAY_NAMES.map((name, i) => (
						<div
							key={name}
							className={`text-center text-[10px] font-bold uppercase tracking-wider py-1 ${i === 0 ? 'text-rose-400' : 'text-slate-400'
								}`}
						>
							{name}
						</div>
					))}
				</div>

				{/* Calendar grid */}
				<div className="grid grid-cols-7 gap-1 relative">
					{loading && (
						<div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
							<div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
						</div>
					)}
					{calendarDays.map((cell, idx) => {
						// YYYY-MM-DD local formatting safely
						const y = cell.date.getFullYear();
						const m = String(cell.date.getMonth() + 1).padStart(2, '0');
						const d = String(cell.date.getDate()).padStart(2, '0');
						const dateStr = `${y}-${m}-${d}`;

						const attInfo = attendanceMap[dateStr];
						const isLeave = leaveDates.has(dateStr);
						const sunday = cell.date.getDay() === 0;
						const notCurrent = !cell.currentMonth;

						return (
							<div
								key={`${cell.date.getTime()}-${idx}`}
								className={`
									relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-semibold
									${notCurrent ? 'text-slate-300 dark:text-slate-700' : 
										isLeave ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-800' :
										sunday ? 'text-rose-400' : 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50'
									}
								`}
							>
								{cell.date.getDate()}
								{attInfo && (
									attInfo.type === 'customer' ? (
										<span className="absolute bottom-0.5 min-w-[12px] h-[12px] flex items-center justify-center text-[8px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded-full px-0.5 scale-90 border border-emerald-200 dark:border-emerald-800">
											{attInfo.count}
										</span>
									) : (
										<span className="absolute bottom-1 w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
									)
								)}
							</div>
						);
					})}
				</div>
				
				<div className="mt-4 flex items-center justify-center gap-4 text-[10px] font-bold text-slate-500 uppercase">
					<div className="flex items-center gap-1.5">
						<span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
						Đã chấm công
					</div>
					<div className="flex items-center gap-1.5">
						<span className="w-2 h-2 bg-rose-100 dark:bg-rose-900/50 ring-1 ring-rose-300 rounded-full"></span>
						Xin nghỉ
					</div>
				</div>

				<div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[9px] text-slate-400 font-mono break-all text-center">
					LOGS: {Object.keys(attendanceMap).length} | {Object.keys(attendanceMap).join(', ')}
				</div>
			</div>
		</div>
	);
};

export default MonthlyAttendanceCalendar;
