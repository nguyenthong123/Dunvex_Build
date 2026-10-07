import React from 'react';
import { useP2PSync } from '../../hooks/useP2PSync';
import { Smartphone, Monitor, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export const P2PSyncBanner: React.FC = () => {
  const {
    isTransferring,
    role,
    statusMessage,
    progressPercent,
    currentOrderCode,
    totalImages,
    completedImages,
    onlinePeers,
    requestImageSync,
  } = useP2PSync();

  if (!isTransferring && !statusMessage) {
    return null;
  }

  // If transferring, render banner
  if (isTransferring) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 shadow-lg transition-all animate-fadeIn">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full animate-spin">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-semibold text-sm md:text-base">
                {role === 'sender' ? (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>Đang đồng bộ hình ảnh sang máy tính</span>
                  </>
                ) : (
                  <>
                    <Monitor className="w-4 h-4" />
                    <span>Đang nhận hình ảnh từ điện thoại</span>
                  </>
                )}
                {currentOrderCode && (
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                    {currentOrderCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                {role === 'sender'
                  ? 'Vui lòng không đóng ứng dụng trên điện thoại và giữ kết nối mạng.'
                  : `Đang tải: ${completedImages}/${totalImages} ảnh (${progressPercent}%)`}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full md:w-64 flex items-center gap-3">
            <div className="flex-1 bg-white/30 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-bold w-9 text-right">{progressPercent}%</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export const P2PSyncControl: React.FC = () => {
  const { isTransferring, onlinePeers, requestImageSync, statusMessage } = useP2PSync();
  const mobilePeers = onlinePeers.filter(p => p.deviceType === 'mobile');

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Đồng bộ hình ảnh P2P (Kiểu Zalo)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Truyền ảnh trực tiếp từ điện thoại sang máy tính, không tốn dung lượng máy chủ.
            </p>
          </div>
        </div>

        <button
          onClick={() => requestImageSync()}
          disabled={isTransferring || mobilePeers.length === 0}
          className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isTransferring ? 'animate-spin' : ''}`} />
          <span>{isTransferring ? 'Đang đồng bộ...' : 'Đồng bộ từ điện thoại'}</span>
        </button>
      </div>

      {mobilePeers.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Chưa có điện thoại nào trong cửa hàng đang mở app để kết nối.</span>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Đã kết nối với {mobilePeers.length} điện thoại ({mobilePeers.map(p => p.deviceName).join(', ')}).
          </span>
        </div>
      )}
    </div>
  );
};
