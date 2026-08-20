import React, { useEffect, useState } from 'react';

/** Shared skeleton component for loading states */
export function CardSkeleton() {
  return (
    <div className="animate-pulse bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-1/3 mb-4"></div>
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-full w-2/3 mb-4"></div>
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-full mb-2"></div>
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-4/5"></div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-1/4 mb-6"></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-4">
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full flex-1"></div>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-24"></div>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-16"></div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="bg-[#f8f9fb] dark:bg-slate-950 min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="animate-pulse flex items-center justify-between mb-8">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-full w-64"></div>
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-full w-10"></div>
      </div>
      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="animate-pulse bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 mb-8">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-48 mb-6"></div>
        <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
      </div>
      {/* Table placeholder */}
      <TableSkeleton rows={3} />
    </div>
  );
}

/** NProgress-style loading bar — animated, completes loop */
export function LoadingBar() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setProgress(40), 50);
    const t2 = setTimeout(() => setProgress(70), 300);
    const t3 = setTimeout(() => setProgress(90), 800);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (progress >= 90) {
      const t = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(t);
    }
  }, [progress]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-[9999] overflow-hidden bg-transparent">
      <div
        className="h-full bg-gradient-to-r from-[#FF6D00] to-[#FF9100] shadow-[0_0_8px_rgba(255,109,0,0.6)] transition-all duration-700 ease-out"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
}

/** Fade-in page transition wrapper */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {children}
    </div>
  );
}
