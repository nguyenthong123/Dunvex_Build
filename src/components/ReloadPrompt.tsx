import React, { useEffect, useState } from 'react'

const ReloadPrompt: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      // Kiểm tra nếu đã có waiting worker
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setShowUpdate(true);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    });

    // Kiểm tra khi controller thay đổi (reload đã xong)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] max-w-md mx-auto">
      <div className="bg-[#1A237E] dark:bg-indigo-600 text-white rounded-2xl p-4 shadow-2xl shadow-indigo-500/30 flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-xl">system_update</span>
          <span className="text-xs font-black uppercase tracking-wide">Có bản cập nhật mới!</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDismiss}
            className="text-white/60 hover:text-white text-xs px-2"
          >
            Để sau
          </button>
          <button
            onClick={handleUpdate}
            className="bg-[#FF6D00] hover:bg-orange-600 text-white text-xs font-black uppercase px-4 py-2 rounded-xl transition-all"
          >
            Cập nhật
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReloadPrompt
