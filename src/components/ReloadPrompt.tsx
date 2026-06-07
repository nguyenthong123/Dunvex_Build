import React, { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const ReloadPrompt: React.FC = () => {
	const {
		offlineReady: [offlineReady, setOfflineReady],
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		onRegistered(r: ServiceWorkerRegistration | undefined) {
			console.log('SW Registered: ', r)
			// Kiểm tra bản cập nhật mỗi 1 giờ
			if (r) {
				setInterval(() => {
					r.update().catch(console.error);
				}, 60 * 60 * 1000);
			}
		},
		onRegisterError(error: any) {
			console.log('SW registration error', error)
		},
	})

	// Tự động cập nhật thông minh (Smart Auto-Update)
	useEffect(() => {
		if (needRefresh) {
			const handleVisibilityChange = () => {
				// Nếu người dùng tắt màn hình, hoặc chuyển tab, app vào chế độ ngủ (hidden)
				if (document.visibilityState === 'hidden') {
					// Đợi 5 giây để chắc chắn không phải họ lỡ tay vuốt ra rồi vuốt lại
					setTimeout(() => {
						if (document.visibilityState === 'hidden') {
							console.log('App is hidden, silently updating...');
							updateServiceWorker(true);
						}
					}, 5000);
				}
			};

			document.addEventListener('visibilitychange', handleVisibilityChange);

			// Vẫn giữ cơ chế 12h đêm: Nếu tới 12h đêm mà người dùng ĐANG mở màn hình, 
			// thì nó không F5 ngang. Nếu họ tắt màn hình, nó sẽ F5 ngay.
			const now = new Date();
			const midnight = new Date();
			midnight.setHours(24, 0, 0, 0); 
			
			let timeToMidnight = midnight.getTime() - now.getTime();
			
			const timer = setTimeout(() => {
				if (document.visibilityState === 'hidden') {
					updateServiceWorker(true);
				}
			}, timeToMidnight);

			return () => {
				document.removeEventListener('visibilitychange', handleVisibilityChange);
				clearTimeout(timer);
			};
		}
	}, [needRefresh, updateServiceWorker]);

	const close = () => {
		setOfflineReady(false)
		setNeedRefresh(false)
	}

	return (
		<div className="fixed bottom-20 right-4 z-[200]">
			{(offlineReady || needRefresh) && (
				<div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-5 duration-300">
					<div className="mb-4">
						<p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
							{offlineReady ? 'Ứng dụng đã sẵn sàng chạy Offline' : 'Đã có bản cập nhật mới'}
						</p>
					</div>
					<div className="flex gap-2">
						{needRefresh && (
							<button
								onClick={() => updateServiceWorker(true)}
								className="px-5 py-2.5 bg-[#1A237E] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10"
							>
								Cập nhật ngay
							</button>
						)}
						<button
							onClick={() => close()}
							className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
						>
							Đóng
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

export default ReloadPrompt
