import { useState, useRef } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, query, where, orderBy, writeBatch, doc } from 'firebase/firestore';

// ============================================================
// 🔧 Cấu hình Collections
// ============================================================
const BACKUP_COLLECTIONS = [
  { id: 'products', label: '📦 Sản phẩm', dateField: 'createdAt', critical: true },
  { id: 'orders', label: '📋 Đơn hàng', dateField: 'createdAt', critical: true },
  { id: 'customers', label: '👥 Khách hàng', dateField: 'createdAt', critical: true },
  { id: 'suppliers', label: '🏭 Nhà cung cấp', dateField: 'createdAt', critical: true },
  { id: 'debts', label: '💰 Công nợ KH', dateField: 'createdAt', critical: true },
  { id: 'supplier_debts', label: '💳 Công nợ NCC', dateField: 'createdAt', critical: true },
  { id: 'payments', label: '💵 Thanh toán', dateField: 'createdAt', critical: true },
  { id: 'payment_requests', label: '📝 Y/C thanh toán', dateField: 'createdAt', critical: false },
  { id: 'purchase_orders', label: '🚚 Đơn nhập hàng', dateField: 'createdAt', critical: true },
  { id: 'inventory_logs', label: '📊 Nhật ký kho', dateField: 'createdAt', critical: true },
  { id: 'price_lists', label: '📑 Bảng giá', dateField: null, critical: false },
  { id: 'coupons', label: '🎟️ Mã giảm giá', dateField: null, critical: false },
  { id: 'checkins', label: '📍 Checkin', dateField: 'createdAt', critical: false },
  { id: 'attendance_logs', label: '⏰ Chấm công', dateField: 'date', critical: false },
  { id: 'audit_logs', label: '🔍 Nhật ký kiểm toán', dateField: 'createdAt', critical: false },
  { id: 'notifications', label: '🔔 Thông báo', dateField: 'createdAt', critical: false },
  { id: 'users', label: '👤 Người dùng', dateField: 'createdAt', critical: true },
  { id: 'permissions', label: '🔐 Phân quyền', dateField: null, critical: true },
  { id: 'settings', label: '⚙️ Cài đặt', dateField: null, critical: true },
  { id: 'system_config', label: '🔧 Cấu hình HT', dateField: null, critical: true },
  { id: 'subscription_packages', label: '📦 Gói dịch vụ', dateField: null, critical: false },
  { id: 'rebate_tiers', label: '📈 Bậc chiết khấu', dateField: null, critical: false },
  { id: 'ai_actions', label: '🤖 Hành động AI', dateField: 'createdAt', critical: false },
  { id: 'ai_analytics', label: '📊 Phân tích AI', dateField: 'createdAt', critical: false },
];

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

// ============================================================
// Export: Firestore → JSON
// ============================================================
async function exportData(
  selectedCollections: typeof BACKUP_COLLECTIONS,
  dateFrom: string | null,
  dateTo: string | null,
  progressCallback: (p: any) => void
) {
  const backup: any = {
    metadata: {
      exportedAt: new Date().toISOString(),
      app: 'Dunvex Build',
      totalCollections: selectedCollections.length,
      dateFilter: dateFrom || dateTo ? { from: dateFrom, to: dateTo } : null,
    },
    collections: {},
  };

  let totalDocs = 0;

  for (let i = 0; i < selectedCollections.length; i++) {
    const col = selectedCollections[i];
    progressCallback({ phase: 'fetching', collection: col.label, progress: i, total: selectedCollections.length });

    try {
      let q;
      if (col.dateField && (dateFrom || dateTo)) {
        const constraints: any[] = [];
        if (dateFrom) constraints.push(where(col.dateField, '>=', new Date(dateFrom)));
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          constraints.push(where(col.dateField, '<=', toDate));
        }
        if (constraints.length > 0) {
          constraints.push(orderBy(col.dateField, 'desc'));
          q = query(collection(db, col.id), ...constraints);
        } else {
          q = collection(db, col.id);
        }
      } else {
        q = collection(db, col.id);
      }

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((d) => {
        const data: any = {};
        for (const [key, value] of Object.entries(d.data())) {
          if (value && typeof (value as any).toDate === 'function') {
            data[key] = (value as any).toDate().toISOString();
          } else {
            data[key] = value;
          }
        }
        return { id: d.id, ...data };
      });

      backup.collections[col.id] = { count: docs.length, documents: docs };
      totalDocs += docs.length;
    } catch (err: any) {
      console.error(`Lỗi export ${col.id}:`, err);
      backup.collections[col.id] = { count: 0, documents: [], error: err.message };
    }
  }

  backup.metadata.totalDocuments = totalDocs;
  return backup;
}

// ============================================================
// Import: JSON → Firestore
// ============================================================
async function importData(
  backupData: any,
  progressCallback: (p: any) => void
) {
  const allCollections = Object.keys(backupData.collections);
  let totalDocs = 0;
  let restoredDocs = 0;

  for (const colName of allCollections) {
    const colData = backupData.collections[colName];
    if (!colData || !colData.documents) continue;
    totalDocs += colData.documents.length;
  }

  for (const colName of allCollections) {
    const colData = backupData.collections[colName];
    if (!colData || !colData.documents) continue;

    progressCallback({ phase: 'restoring', collection: colName, restored: restoredDocs, total: totalDocs });

    const docs = colData.documents;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + 400);

      chunk.forEach((docData: any) => {
        const { id, ...fields } = docData;
        const parsedFields: any = {};
        for (const [key, value] of Object.entries(fields)) {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value as string)) {
            parsedFields[key] = new Date(value as string);
          } else {
            parsedFields[key] = value;
          }
        }
        batch.set(doc(db, colName, id), parsedFields, { merge: true });
      });

      await batch.commit();
      restoredDocs += chunk.length;
      progressCallback({ phase: 'restoring', collection: colName, restored: restoredDocs, total: totalDocs });
    }
  }

  return restoredDocs;
}

// ============================================================
// Backup Component
// ============================================================
export default function Backup() {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');

  // Backup state
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    BACKUP_COLLECTIONS.filter((c) => c.critical).map((c) => c.id)
  );
  const [filterMode, setFilterMode] = useState<'all' | 'date' | 'month'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [backupProgress, setBackupProgress] = useState<any>(null);
  const [backupResult, setBackupResult] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<any>(null);
  const [restoreProgress, setRestoreProgress] = useState<any>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ========== HELPERS ==========
  const toggleCollection = (colId: string) => {
    setSelectedCollections((prev) =>
      prev.includes(colId) ? prev.filter((c) => c !== colId) : [...prev, colId]
    );
  };

  const selectAll = () => setSelectedCollections(BACKUP_COLLECTIONS.map((c) => c.id));
  const selectCritical = () => setSelectedCollections(BACKUP_COLLECTIONS.filter((c) => c.critical).map((c) => c.id));
  const deselectAll = () => setSelectedCollections([]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMonthFilter(val);
    if (val) {
      const [year, month] = val.split('-');
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      setDateFrom(`${val}-01`);
      setDateTo(`${val}-${String(lastDay).padStart(2, '0')}`);
    }
  };

  // ========== EXPORT ==========
  const handleExport = async () => {
    if (selectedCollections.length === 0) {
      alert('Vui lòng chọn ít nhất 1 collection để backup!');
      return;
    }

    setIsExporting(true);
    setBackupProgress(null);
    setBackupResult(null);

    try {
      const selected = BACKUP_COLLECTIONS.filter((c) => selectedCollections.includes(c.id));
      const from = filterMode === 'all' ? null : dateFrom;
      const to = filterMode === 'all' ? null : dateTo;

      const backup = await exportData(selected, from, to, (p) => setBackupProgress(p));

      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `dunvex-backup-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupResult({
        success: true,
        fileName: `dunvex-backup-${timestamp}.json`,
        size: blob.size,
        collections: Object.entries(backup.collections).map(([id, data]: [string, any]) => ({
          id,
          label: BACKUP_COLLECTIONS.find((c) => c.id === id)?.label || id,
          count: data.count,
          error: data.error,
        })),
      });
    } catch (err: any) {
      setBackupResult({ success: false, error: err.message });
    } finally {
      setIsExporting(false);
      setBackupProgress(null);
    }
  };

  // ========== RESTORE ==========
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setRestorePreview({
          metadata: data.metadata,
          collections: Object.entries(data.collections || {}).map(([id, col]: [string, any]) => ({
            id,
            label: BACKUP_COLLECTIONS.find((c) => c.id === id)?.label || id,
            count: col.count || 0,
            error: col.error,
          })),
        });
      } catch (err: any) {
        setRestorePreview({ error: 'File JSON không hợp lệ: ' + err.message });
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!restoreFile || !restorePreview || restorePreview.error) {
      alert('Vui lòng chọn file backup hợp lệ!');
      return;
    }

    const confirmMsg =
      `⚠️ XÁC NHẬN PHỤC HỒI DỮ LIỆU\n\n` +
      `File: ${restoreFile.name}\n` +
      `Export lúc: ${restorePreview.metadata?.exportedAt || 'Không rõ'}\n\n` +
      `❗ Dữ liệu sẽ được MERGE vào Firestore (ghi đè document cùng ID).\n` +
      `❗ Hành động này KHÔNG THỂ HOÀN TÁC.\n\n` +
      `Bạn có chắc chắn muốn tiếp tục?`;

    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    setRestoreResult(null);

    try {
      const reader = new FileReader();
      const data = await new Promise<any>((resolve, reject) => {
        reader.onload = (e) => {
          try { resolve(JSON.parse(e.target?.result as string)); } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsText(restoreFile);
      });

      const count = await importData(data, (p) => setRestoreProgress(p));
      setRestoreResult({ success: true, restoredCount: count });
    } catch (err: any) {
      setRestoreResult({ success: false, error: err.message });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#1A237E] dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl text-[#FF6D00]">cloud_download</span>
          Sao lưu & Phục hồi Dữ liệu
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Xuất dữ liệu ra file JSON để lưu vào USB, hoặc phục hồi từ file backup.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('backup')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'backup'
              ? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          📤 Sao lưu (Export)
        </button>
        <button
          onClick={() => setActiveTab('restore')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'restore'
              ? 'bg-white dark:bg-slate-700 text-[#1A237E] dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          📥 Phục hồi (Restore)
        </button>
      </div>

      {/* ==================== BACKUP TAB ==================== */}
      {activeTab === 'backup' && (
        <div className="space-y-5">
          {/* 1. Select Collections */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#1A237E] dark:text-white text-lg">📂 Chọn dữ liệu cần sao lưu</h3>
              <div className="flex gap-2">
                <button onClick={selectAll} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  Chọn tất cả
                </button>
                <button onClick={selectCritical} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                  Chỉ quan trọng
                </button>
                <button onClick={deselectAll} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-transparent text-gray-400 hover:text-red-500 transition-colors">
                  Bỏ chọn
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {BACKUP_COLLECTIONS.map((col) => (
                <label
                  key={col.id}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm ${
                    selectedCollections.includes(col.id)
                      ? col.critical
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(col.id)}
                    onChange={() => toggleCollection(col.id)}
                    className="accent-[#FF6D00] w-4 h-4"
                  />
                  <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{col.label}</span>
                  {col.critical && (
                    <span className="ml-auto text-[9px] font-bold bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">
                      QT
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* 2. Date Filter */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
            <h3 className="font-bold text-[#1A237E] dark:text-white text-lg mb-4">📅 Lọc theo thời gian (tùy chọn)</h3>
            <div className="flex gap-3 flex-wrap mb-4">
              {[
                { mode: 'all' as const, label: 'Tất cả dữ liệu' },
                { mode: 'date' as const, label: 'Theo khoảng ngày' },
                { mode: 'month' as const, label: 'Theo tháng' },
              ].map((opt) => (
                <label
                  key={opt.mode}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all ${
                    filterMode === opt.mode
                      ? 'border-[#FF6D00] bg-orange-50 dark:bg-orange-900/20 text-[#FF6D00]'
                      : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="filterMode"
                    checked={filterMode === opt.mode}
                    onChange={() => setFilterMode(opt.mode)}
                    className="accent-[#FF6D00]"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {filterMode === 'date' && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Từ ngày</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm outline-none focus:border-[#FF6D00]"
                  />
                </div>
                <span className="text-gray-400 mt-5">→</span>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Đến ngày</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm outline-none focus:border-[#FF6D00]"
                  />
                </div>
              </div>
            )}

            {filterMode === 'month' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Chọn tháng</label>
                <input
                  type="month"
                  value={monthFilter}
                  onChange={handleMonthChange}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm outline-none focus:border-[#FF6D00] w-fit"
                />
              </div>
            )}
          </div>

          {/* Progress */}
          {backupProgress && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
              <div className="h-2 bg-blue-100 dark:bg-blue-800 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${((backupProgress.progress + 1) / backupProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                🔄 Đang tải: {backupProgress.collection}...
              </p>
            </div>
          )}

          {/* Result */}
          {backupResult?.success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5">
              <div className="flex gap-3">
                <span className="text-2xl">✅</span>
                <div className="flex-1 space-y-2">
                  <h4 className="font-bold text-green-800 dark:text-green-300">Xuất dữ liệu thành công!</h4>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    File: <code className="bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded text-xs">{backupResult.fileName}</code>
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400">Dung lượng: {formatBytes(backupResult.size)}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {backupResult.collections.map((c: any) => (
                      <span
                        key={c.id}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-lg ${
                          c.error
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        }`}
                      >
                        {c.label}: {c.error ? '❌ Lỗi' : `${c.count} docs`}
                      </span>
                    ))}
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mt-3">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      💡 <strong>Lưu vào USB:</strong> File đã tải về Downloads. Copy vào USB{' '}
                      <code className="bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded text-xs">BACKUP_USB</code>{' '}
                      để lưu trữ an toàn.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {backupResult && !backupResult.success && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5">
              <div className="flex gap-3">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-bold text-red-800 dark:text-red-300">Lỗi khi xuất dữ liệu</h4>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{backupResult.error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Export Button */}
          <div className="flex justify-center">
            <button
              onClick={handleExport}
              disabled={isExporting || selectedCollections.length === 0}
              className="px-8 py-3.5 bg-gradient-to-r from-[#1A237E] to-[#283593] text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xuất dữ liệu...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">download</span>
                  Xuất file Backup ({selectedCollections.length} collections)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ==================== RESTORE TAB ==================== */}
      {activeTab === 'restore' && (
        <div className="space-y-5">
          {/* 1. File Upload */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
            <h3 className="font-bold text-[#1A237E] dark:text-white text-lg mb-4">📂 Chọn file backup để phục hồi</h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-2xl p-8 text-center cursor-pointer hover:border-[#FF6D00] hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all"
            >
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
              {restoreFile ? (
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl">📄</span>
                  <div className="text-left">
                    <strong className="text-gray-800 dark:text-white block">{restoreFile.name}</strong>
                    <span className="text-xs text-gray-500">{formatBytes(restoreFile.size)}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRestoreFile(null);
                      setRestorePreview(null);
                    }}
                    className="ml-3 text-gray-400 hover:text-red-500 text-lg"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div>
                  <span className="text-4xl">📁</span>
                  <p className="font-bold text-gray-600 dark:text-gray-400 mt-2">Click để chọn file backup (.json)</p>
                  <p className="text-xs text-gray-400 mt-1">Chọn file đã xuất từ Dunvex hoặc từ USB</p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Preview */}
          {restorePreview && !restorePreview.error && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="font-bold text-[#1A237E] dark:text-white text-lg mb-4">📋 Xem trước dữ liệu</h3>
              <div className="flex gap-4 flex-wrap mb-4">
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">⏰ Export lúc</span>
                  <span className="font-bold text-gray-800 dark:text-white text-sm">
                    {restorePreview.metadata?.exportedAt
                      ? new Date(restorePreview.metadata.exportedAt).toLocaleString('vi-VN')
                      : 'Không rõ'}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">📊 Tổng documents</span>
                  <span className="font-bold text-gray-800 dark:text-white text-sm">
                    {restorePreview.metadata?.totalDocuments || 0}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">📂 Collections</span>
                  <span className="font-bold text-gray-800 dark:text-white text-sm">
                    {restorePreview.collections?.length || 0}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {restorePreview.collections?.map((c: any) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                      c.error
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                        : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-600'
                    }`}
                  >
                    {c.label}: <strong className={c.error ? 'text-red-600' : 'text-green-600'}>{c.error ? 'Lỗi' : c.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {restorePreview?.error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5">
              <div className="flex gap-3">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-bold text-red-800 dark:text-red-300">File không hợp lệ</h4>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{restorePreview.error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          {restoreProgress && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
              <div className="h-2 bg-blue-100 dark:bg-blue-800 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-300"
                  style={{
                    width: `${restoreProgress.total > 0 ? (restoreProgress.restored / restoreProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                🔄 Đang phục hồi: {restoreProgress.collection} ({restoreProgress.restored}/{restoreProgress.total} docs)
              </p>
            </div>
          )}

          {/* Result */}
          {restoreResult?.success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5">
              <div className="flex gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <h4 className="font-bold text-green-800 dark:text-green-300">Phục hồi thành công!</h4>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    Đã khôi phục <strong>{restoreResult.restoredCount}</strong> documents vào Firestore.
                  </p>
                </div>
              </div>
            </div>
          )}

          {restoreResult && !restoreResult.success && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5">
              <div className="flex gap-3">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-bold text-red-800 dark:text-red-300">Lỗi khi phục hồi</h4>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{restoreResult.error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Restore Button */}
          <div className="flex justify-center">
            <button
              onClick={handleRestore}
              disabled={isRestoring || !restorePreview || restorePreview.error}
              className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2"
            >
              {isRestoring ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang phục hồi dữ liệu...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">upload</span>
                  Phục hồi dữ liệu vào Firestore
                </>
              )}
            </button>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex gap-3">
            <span className="text-2xl shrink-0">⚠️</span>
            <div>
              <strong className="text-amber-800 dark:text-amber-300 text-sm">Lưu ý quan trọng:</strong>
              <ul className="mt-1 space-y-1 text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
                <li>Phục hồi sẽ <strong>MERGE</strong> dữ liệu (ghi đè document cùng ID, thêm mới nếu chưa có)</li>
                <li>Dữ liệu cũ <strong>KHÔNG bị xóa</strong> — chỉ bị ghi đè nếu trùng ID</li>
                <li>Hãy <strong>backup trước</strong> khi phục hồi để tránh mất dữ liệu</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
