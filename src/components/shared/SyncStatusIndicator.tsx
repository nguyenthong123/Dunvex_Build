import React from 'react';
import { useSyncEngine } from '../../hooks/useSyncEngine';
import { AlertCircle, Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';

export const SyncStatusIndicator: React.FC = () => {
  const { isSyncing, isOnline, pendingCount, error, triggerSync } = useSyncEngine();

  return (
    <button
      onClick={() => triggerSync()}
      disabled={isSyncing || !isOnline}
      title={
        !isOnline
          ? 'Đang ngoại tuyến (Offline) - Dữ liệu lưu an toàn trên máy'
          : isSyncing
          ? 'Đang đồng bộ dữ liệu với máy chủ...'
          : error
          ? `Lỗi đồng bộ: ${error} - Bấm để thử lại`
          : pendingCount > 0
          ? `${pendingCount} thay đổi chưa đồng bộ - Bấm để đồng bộ ngay`
          : 'Đã đồng bộ với VPS; thiết bị khác nhận dữ liệu khi VPS báo thay đổi hoặc kiểm tra định kỳ'
      }
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
        !isOnline
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
          : isSyncing
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
          : error
          ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
          : pendingCount > 0
          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      }`}
    >
      {!isOnline ? (
        <>
          <CloudOff className="w-3.5 h-3.5" />
          <span>Offline</span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Đang đồng bộ...</span>
        </>
      ) : error ? (
        <>
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Lỗi đồng bộ</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <Cloud className="w-3.5 h-3.5" />
          <span>Chờ sync ({pendingCount})</span>
        </>
      ) : (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>Đã lên VPS</span>
        </>
      )}
    </button>
  );
};
