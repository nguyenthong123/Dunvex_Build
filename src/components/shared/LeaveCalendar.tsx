import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface LeaveCalendarProps {
  selectedDates: string[];
  onDatesChange: (dates: string[]) => void;
  minDate?: Date;
  maxDate?: Date;
}

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const formatDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const LeaveCalendar: React.FC<LeaveCalendarProps> = ({
  selectedDates,
  onDatesChange,
  minDate = new Date(),
  maxDate,
}) => {
  const [viewDate, setViewDate] = useState(() => new Date());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

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

    // Next month fillers (fill to complete 6 rows max, 42 cells)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        date: new Date(year, month + 1, d),
        currentMonth: false,
      });
    }

    // Trim to exactly 6 rows or fewer if last row is all next-month
    while (cells.length > 35 && cells.slice(35).every(c => !c.currentMonth)) {
      cells.length = 35;
    }

    return cells;
  }, [year, month]);

  const goToPrevMonth = () =>
    setViewDate(new Date(year, month - 1, 1));
  const goToNextMonth = () =>
    setViewDate(new Date(year, month + 1, 1));

  const isDisabled = (d: Date): boolean => {
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dayStart < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate) {
      const maxStart = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
      if (dayStart > maxStart) return true;
    }
    return false;
  };

  const toggleDate = (d: Date) => {
    if (isDisabled(d)) return;
    const key = formatDate(d);
    if (selectedSet.has(key)) {
      onDatesChange(selectedDates.filter(x => x !== key));
    } else {
      onDatesChange([...selectedDates, key].sort());
    }
  };

  const isWeekend = (d: Date): boolean => {
    const day = d.getDay();
    return day === 0; // Only Sunday is weekend in Vietnamese context
  };

  return (
    <div className="select-none">
      {/* Header: Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goToPrevMonth}
          className="size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-[#1A237E] dark:text-indigo-400" />
          <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">
            {MONTH_NAMES[month]} {year}
          </span>
        </div>
        <button
          type="button"
          onClick={goToNextMonth}
          className="size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map((name, i) => (
          <div
            key={name}
            className={`text-center text-[9px] font-black uppercase tracking-wider py-1.5 ${
              i === 0 ? 'text-red-400 dark:text-red-500' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((cell, idx) => {
          const key = formatDate(cell.date);
          const isSelected = selectedSet.has(key);
          const disabled = isDisabled(cell.date);
          const isToday = isSameDay(cell.date, today);
          const sunday = cell.date.getDay() === 0;
          const notCurrent = !cell.currentMonth;

          return (
            <motion.button
              key={`${cell.date.getTime()}-${idx}`}
              type="button"
              whileTap={{ scale: disabled ? 1 : 0.85 }}
              onClick={() => toggleDate(cell.date)}
              disabled={disabled || notCurrent}
              className={`
                relative aspect-square flex items-center justify-center rounded-xl
                text-xs font-bold transition-all
                ${disabled || notCurrent
                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                  : isSelected
                    ? 'bg-[#1A237E] dark:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 scale-105'
                    : isToday
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-[#1A237E] dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800'
                      : sunday
                        ? 'text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }
              `}
            >
              {cell.date.getDate()}
              {isSelected && (
                <span className="absolute -top-0.5 -right-0.5 size-3 bg-[#FF6D00] rounded-full border-2 border-white dark:border-slate-900" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Selected dates summary */}
      {selectedDates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50"
        >
          <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
            📅 Đã chọn {selectedDates.length} ngày
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedDates.map(dateStr => {
              const [y, m, d] = dateStr.split('-').map(Number);
              const displayDate = new Date(y, m - 1, d);
              const dayName = DAY_NAMES[displayDate.getDay()];
              return (
                <span
                  key={dateStr}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg text-[9px] font-black text-slate-600 dark:text-slate-300 shadow-sm"
                >
                  <span className={displayDate.getDay() === 0 ? 'text-red-400' : ''}>
                    {dayName}
                  </span>
                  {d}/{m}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDatesChange(selectedDates.filter(x => x !== dateStr));
                    }}
                    className="ml-0.5 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default LeaveCalendar;
