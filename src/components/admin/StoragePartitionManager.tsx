import React, { useState, useEffect, useCallback } from 'react';
import { 
  HardDrive, 
  Database, 
  Image as ImageIcon, 
  Smartphone, 
  Monitor, 
  RefreshCw, 
  Trash2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Share2,
  FolderOpen
} from 'lucide-react';
import { storageManager, type AppStorageBreakdown } from '../../services/storageManager';
import { nativeSqlite } from '../../services/nativeSqlite';
import { useP2PSync } from '../../hooks/useP2PSync';
import { useSyncEngine } from '../../hooks/useSyncEngine';
import { useToast } from '../shared/Toast';

interface StoragePartitionManagerProps {
  ownerId: string;
}

export const StoragePartitionManager: React.FC<StoragePartitionManagerProps> = ({ ownerId }) => {
  const { showToast } = useToast();
  const { isSyncing } = useSyncEngine();
  const [stats, setStats] = useState<AppStorageBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [databasePath, setDatabasePath] = useState('');
  const [canChangeStorageLocation, setCanChangeStorageLocation] = useState(false);
  const [changingLocation, setChangingLocation] = useState(false);
  const syncWasRunning = React.useRef(false);

  const {
    isTransferring,
    role,
    statusMessage,
    progressPercent,
    completedImages,
    totalImages,
    onlinePeers,
    requestImageSync,
  } = useP2PSync();

  const loadStats = useCallback(async () => {
    try {
      if (!ownerId) {
        throw new Error('Chưa xác định được tài khoản để đọc phân vùng dữ liệu.');
      }
      const data = await storageManager.getStorageBreakdown(ownerId);
      const sqliteInfo = await nativeSqlite.ping();
      setStats(data);
      setDatabasePath(sqliteInfo.dbPath);
      setCanChangeStorageLocation(sqliteInfo.supportsStorageLocationSelection === true);
      setStorageError(null);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Không đọc được thông tin phân vùng dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    setStats(null);
    setStorageError(null);
    setLoading(true);
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (isSyncing) {
      syncWasRunning.current = true;
    } else if (syncWasRunning.current) {
      syncWasRunning.current = false;
      void loadStats();
    }
  }, [isSyncing, loadStats]);

  const handleClearImageCache = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn dọn dẹp bộ nhớ đệm hình ảnh không? Các ảnh sản phẩm sẽ được tự động tải lại khi bạn mở xem.')) {
      return;
    }
    setClearing(true);
    try {
      const res = await storageManager.clearImageCache();
      showToast(res.message, res.success ? 'success' : 'error');
      await loadStats();
    } catch (e: any) {
      showToast(e.message || 'Lỗi dọn dẹp', 'error');
    } finally {
      setClearing(false);
    }
  };

  const handleChooseStorageLocation = async () => {
    setChangingLocation(true);
    try {
      const result = await nativeSqlite.chooseStorageLocation();
      if (!result.cancelled) {
        if (result.dbPath) setDatabasePath(result.dbPath);
        showToast('Đã chuyển SQLite và thư mục ảnh offline sang vị trí mới.', 'success');
        await loadStats();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể chuyển vị trí lưu dữ liệu.', 'error');
    } finally {
      setChangingLocation(false);
    }
  };

  const handleTriggerP2PSync = async () => {
    try {
      const started = await requestImageSync();
      if (!started && !statusMessage) {
        showToast('Chưa có điện thoại nào online hoặc các đơn hàng đã có đủ ảnh.', 'info');
      }
    } catch (e: any) {
      showToast(e.message || 'Lỗi kích hoạt đồng bộ P2P', 'error');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                Phân vùng bộ nhớ & Lưu trữ cục bộ (Offline-First)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                Hạn mức 5.0 GB
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mỗi thiết bị được cấp tối đa 5 GB để lưu trữ SQLite và hình ảnh offline, giúp app hoạt động tức thì cả khi mất mạng.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            void loadStats();
          }}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      <div className="p-5 space-y-6">
        {storageError && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{storageError} Dữ liệu vẫn được giữ nguyên; hãy thử làm mới để kiểm tra lại.</span>
          </div>
        )}

        {/* Overall Storage Gauge */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                {stats?.totalUsedFormatted || (loading ? 'Đang kiểm tra...' : 'Chưa có dữ liệu')}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                / {stats?.totalQuotaFormatted || '5.0 GB'} hạn mức
              </span>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              Còn trống {stats?.freeQuotaFormatted || (loading ? '...' : '—')}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (stats?.usedPercentage || 0) > 90
                  ? 'bg-rose-500'
                  : (stats?.usedPercentage || 0) > 70
                  ? 'bg-amber-500'
                  : 'bg-indigo-600 dark:bg-indigo-500'
              }`}
              style={{ width: `${Math.max(2, stats?.usedPercentage || 0)}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Tỷ lệ chiếm dụng: {stats ? `${stats.usedPercentage}%` : '—'}</span>
            <span>Tối đa cấp phép: 5,120 MB (5.0 GB)</span>
          </div>
        </div>

        {/* Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* SQLite Local DB */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    Cơ sở dữ liệu SQLite cục bộ
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {stats ? `${stats.dbRecordCount} tài liệu (Sản phẩm, đơn, nợ...)` : 'Chưa đọc được số liệu'}
                  </p>
                </div>
              </div>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {stats?.dbUsageFormatted || '—'}
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Dữ liệu an toàn, truy xuất tức thì không cần mạng</span>
            </div>
            <div className="mt-3 border-t border-slate-100 dark:border-slate-700/60 pt-3">
              <p className="break-all text-[11px] text-slate-500 dark:text-slate-400" title={databasePath}>
                Vị trí SQLite: {databasePath || 'Đang kiểm tra...'}
              </p>
              {nativeSqlite.supportsStorageLocationSelection() && canChangeStorageLocation ? (
                <button
                  type="button"
                  onClick={() => void handleChooseStorageLocation()}
                  disabled={changingLocation}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {changingLocation
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <FolderOpen className="h-3.5 w-3.5" />}
                  {changingLocation ? 'Đang chuyển dữ liệu...' : 'Chọn ổ / thư mục lưu'}
                </button>
              ) : nativeSqlite.supportsStorageLocationSelection() ? (
                <p role="status" className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                  Bản giao diện này đang chạy với native bridge cũ, chưa hỗ trợ chuyển vị trí. Hãy cài bộ ứng dụng Mac/Windows mới nhất rồi mở lại ứng dụng.
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Android giữ SQLite trong vùng riêng của ứng dụng; vị trí không thể thay đổi bằng cách chọn ổ đĩa.
                </p>
              )}
              {nativeSqlite.supportsStorageLocationSelection() && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  SQLite và ảnh offline sẽ được chuyển vào thư mục DunvexData. Hãy dùng ổ luôn kết nối; cache IndexedDB/HTTP vẫn do WebView quản lý.
                </p>
              )}
            </div>
          </div>

          {/* Image Cache */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    Kho hình ảnh Offline
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {stats ? `${stats.imageCount} tệp ảnh đã lưu trữ` : 'Chưa đọc được số liệu'}
                  </p>
                </div>
              </div>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {stats?.imageUsageFormatted || '—'}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Ảnh đơn hàng & ảnh sản phẩm
              </span>
              <button
                onClick={() => void handleClearImageCache()}
                disabled={clearing || !stats?.imageCount}
                className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                <span>{clearing ? 'Đang xoá...' : 'Dọn dẹp ảnh tạm'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sync Traffic Architecture Rules */}
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/60">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Quy chuẩn luồng đồng bộ theo kiến trúc Dunvex</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Từ App lên VPS: Chỉ đẩy Data
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                  Chỉ đồng bộ các bản ghi số liệu, tuyệt đối không đẩy hình ảnh binary lên máy chủ VPS để bảo vệ dung lượng đĩa.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Từ VPS về App: Nhận Data & Hình ảnh
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                  App tự động kéo danh mục và tải trước các ảnh sản phẩm từ VPS để lưu vào bộ nhớ máy xem offline.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* App-to-App P2P Device Sync (Android <-> Mac / Win) */}
        <div className="bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  Đồng bộ trực tiếp App sang App (P2P Kiểu Zalo)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cùng tài khoản đăng nhập trên Android và Mac/Windows sẽ tự động đồng bộ cả Data và Hình ảnh trực tiếp giữa 2 máy.
                </p>
              </div>
            </div>

            <button
              onClick={() => void handleTriggerP2PSync()}
              disabled={isTransferring || onlinePeers.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg text-xs font-semibold transition shadow-sm shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTransferring ? 'animate-spin' : ''}`} />
              <span>{isTransferring ? 'Đang truyền...' : 'Đồng bộ P2P ngay'}</span>
            </button>
          </div>

          {/* Transfer progress when active */}
          {isTransferring && (
            <div className="mt-4 pt-3 border-t border-indigo-100 dark:border-indigo-900/40">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1.5">
                <span>
                  {role === 'sender' ? 'Đang gửi ảnh sang máy khác...' : `Đang nhận: ${completedImages}/${totalImages} ảnh`}
                </span>
                <span className="font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full bg-indigo-200 dark:bg-indigo-900/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Connected Peers Status */}
          <div className="mt-3.5 pt-3 border-t border-indigo-100/80 dark:border-indigo-900/40">
            {onlinePeers.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Chưa phát hiện thiết bị khác cùng tài khoản đang online để kết nối P2P.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Đã kết nối trực tiếp với {onlinePeers.length} thiết bị:</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {onlinePeers.map(p => (
                    <span
                      key={p.deviceId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                    >
                      {p.deviceType === 'mobile' ? (
                        <Smartphone className="w-3 h-3 text-indigo-500" />
                      ) : (
                        <Monitor className="w-3 h-3 text-blue-500" />
                      )}
                      <span>{p.deviceName}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
