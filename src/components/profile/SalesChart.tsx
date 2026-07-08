import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';

interface DailyRevenue {
  date: string;     // YYYY-MM-DD
  label: string;    // DD/MM
  total: number;
}

interface Props {
  ownerId: string;
  userEmail: string;
}

const SalesChart: React.FC<Props> = ({ ownerId, userEmail }) => {
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DailyRevenue[]>([]);
  const [totalMonth, setTotalMonth] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0);

  useEffect(() => {
    if (!ownerId || !userEmail) return;
    loadData();
  }, [ownerId, userEmail]);

  const loadData = async () => {
    setLoading(true);
    try {
      const qOrders = query(
        collection(db, 'orders'),
        where('ownerId', '==', ownerId),
        orderBy('createdAt', 'desc'),
        limit(500),
      );
      const snap = await getDocs(qOrders);

      // Group by day - only "Đơn chốt" for this user
      const byDay: Record<string, number> = {};
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

      let todayTotal = 0;
      let yesterdayTotal = 0;

      snap.docs.forEach(doc => {
        const d = doc.data();
        // Only confirmed orders by THIS user (case-insensitive email match)
        if (d.status !== 'Đơn chốt') return;
        const orderEmail = (d.createdByEmail || '').toLowerCase();
        if (orderEmail !== userEmail.toLowerCase()) return;

        const date = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
        if (!date || isNaN(date.getTime())) return;
        if (date < thirtyDaysAgo) return;

        const dayKey = date.toISOString().slice(0, 10);
        const amount = Number(d.totalAmount) || 0;
        byDay[dayKey] = (byDay[dayKey] || 0) + amount;

        if (dayKey === todayStr) todayTotal += amount;
        if (dayKey === yesterdayStr) yesterdayTotal += amount;
      });

      // Build day array for last 30 days
      const days: DailyRevenue[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        days.push({ date: key, label, total: byDay[key] || 0 });
      }

      setDailyData(days);
      setTotalMonth(days.reduce((s, d) => s + d.total, 0));
      setTodayRevenue(todayTotal);
      setYesterdayRevenue(yesterdayTotal);
    } catch (e) {
      console.error('Sales chart error:', e);
    } finally {
      setLoading(false);
    }
  };

  const maxRevenue = Math.max(...dailyData.map(d => d.total), 1);

  // Format currency
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return n.toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const trend = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 text-center">
          <div className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Hôm nay</div>
          <div className="text-sm font-black text-indigo-700 dark:text-indigo-300 mt-0.5">{fmt(todayRevenue)}</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hôm qua</div>
          <div className="text-sm font-black text-slate-700 dark:text-slate-300 mt-0.5">{fmt(yesterdayRevenue)}</div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
          <div className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">30 ngày</div>
          <div className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{fmt(totalMonth)}</div>
        </div>
      </div>

      {/* Trend indicator */}
      {yesterdayRevenue > 0 && (
        <div className={`flex items-center justify-center gap-1 text-xs font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {trend >= 0 ? 'Tăng' : 'Giảm'} {Math.abs(trend).toFixed(0)}% so với hôm qua
        </div>
      )}

      {/* Bar Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <BarChart3 size={14} className="text-indigo-500" />
          Doanh thu 30 ngày qua (đơn chốt của bạn)
        </h3>
        
        {/* Chart container */}
        <div className="relative" style={{ height: 220 }}>
          {/* Line connecting bar tops */}
          {dailyData.some(d => d.total > 0) && (
            <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                points={dailyData.map((d, i) => {
                  const barW = 100 / dailyData.length;
                  const x = barW * i + barW / 2;
                  const heightPct = maxRevenue > 0 ? (d.total / maxRevenue) * 100 : 0;
                  const y = 100 - Math.max(heightPct, 0);
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="0.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}

          {/* Bars */}
          <div className="flex items-end gap-[2px] h-full">
            {dailyData.map((day, i) => {
              const heightPct = maxRevenue > 0 ? (day.total / maxRevenue) * 100 : 0;
              const isToday = i === dailyData.length - 1;
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative"
                >
                  {/* Amount label on top of bar */}
                  {day.total > 0 && (
                    <div className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 mb-0.5 whitespace-nowrap leading-none text-center">
                      {fmt(day.total)}
                    </div>
                  )}
                  {/* Tooltip */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                    {day.label}: {day.total.toLocaleString('vi-VN')}đ
                  </div>
                  {/* Bar */}
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 cursor-pointer ${
                      isToday
                        ? 'bg-indigo-500 hover:bg-indigo-600'
                        : day.total > 0
                          ? 'bg-indigo-300 dark:bg-indigo-600 hover:bg-indigo-400 dark:hover:bg-indigo-500'
                          : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                    style={{ height: `${Math.max(heightPct, day.total > 0 ? 2 : 0)}%` }}
                    title={`${day.label}: ${day.total.toLocaleString('vi-VN')}đ`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis labels (every 5 days) */}
        <div className="flex gap-[2px] mt-1.5">
          {dailyData.map((day, i) => (
            <div key={day.date} className="flex-1 text-center">
              {i % 5 === 0 || i === dailyData.length - 1 ? (
                <span className="text-[9px] text-slate-400 font-medium">{day.label}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-indigo-500" />
          Hôm nay
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-indigo-300 dark:bg-indigo-600" />
          Có doanh thu
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
          Không có
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="14" height="10"><polyline points="0,5 14,5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" /></svg>
          Đường xu hướng
        </div>
      </div>
    </div>
  );
};

export default SalesChart;
